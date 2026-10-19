import { and, eq, sql } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  type StaffRole,
  type UserKind,
  knownDevices,
  sessions,
  settings,
  userBranches,
  userPositions,
  users,
} from "@ventura/db/schema/tenant";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { type AuditActor, tenantAudit } from "@ventura/security";
import {
  DEFAULT_SESSION_POLICY,
  type SessionPolicy,
  formatPhone,
  internalEmail,
  isSessionPolicy,
  shouldLock,
} from "../policy";
import type { RequestMeta } from "../service";
import { deviceHash, describeUserAgent } from "./devices";
import type { StaffAuth } from "./server";

/*
 * Mijoz tizimida kirish oqimi yordamchilari — panel'dagi service.ts bilan bir xil qoidalar (bloklash, yangi
 * qurilma, Telegram ogohlantirishlari), lekin mijoz bazasida va mijozning o'z boti orqali.
 * Ulanish createTenantDb() dan keladi: RLS tufayli bu yerdagi har so'rov faqat shu mijoz qatorlarini ko'radi.
 */

export interface StaffDeps {
  db: TenantDb;
  telegram: Telegram | null;
  /** Markaz nomi (xabarlarda) */
  appName: string;
}

export type StaffRow = typeof users.$inferSelect;

export async function findStaffByPhone(db: TenantDb, phone: string): Promise<StaffRow | null> {
  const [u] = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  return u ?? null;
}

export async function findStaffById(db: TenantDb, id: string): Promise<StaffRow | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export function staffActor(user: Pick<StaffRow, "id" | "name">): AuditActor {
  return { type: "user", id: user.id, name: user.name };
}

export async function staffBranchIds(db: TenantDb, userId: string): Promise<string[]> {
  const rows = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));
  return rows.map((r) => r.branchId);
}

/* ---------- Telegram ogohlantirishlari ---------- */

function when(): string {
  return new Date().toLocaleString("uz-UZ", { timeZone: "Asia/Tashkent", hour12: false });
}

function metaLines(meta: RequestMeta): string {
  const ua = meta.userAgent ? escapeHtml(meta.userAgent.slice(0, 120)) : "noma'lum";
  return `IP: <code>${escapeHtml(meta.ip ?? "noma'lum")}</code>\nQurilma: ${ua}\nVaqt: ${when()}`;
}

/** Xabar yuborilmasa ham asosiy amal to'xtamaydi (xato faqat server logiga). */
export async function notifyStaff(deps: StaffDeps, user: Pick<StaffRow, "telegramChatId">, html: string) {
  if (!deps.telegram || !user.telegramChatId) return;
  try {
    await deps.telegram.sendMessage(user.telegramChatId, html);
  } catch (e) {
    console.error("[telegram] xabar yuborilmadi:", (e as Error).message);
  }
}

/** Xavfli hodisalar haqida markaz direktorlariga. */
export async function notifyDirectors(deps: StaffDeps, html: string) {
  const rows = await deps.db
    .select({ telegramChatId: users.telegramChatId })
    .from(users)
    .where(eq(users.role, "director"));
  await Promise.all(rows.map((r) => notifyStaff(deps, r, html)));
}

/* ---------- Xato urinishlar va bloklash ---------- */

export async function registerStaffFailure(
  deps: StaffDeps,
  user: StaffRow,
  reason: "password" | "otp",
  meta: RequestMeta,
): Promise<{ locked: boolean; attempts: number }> {
  const [row] = await deps.db
    .update(users)
    .set({ failedAttempts: sql`${users.failedAttempts} + 1` })
    .where(eq(users.id, user.id))
    .returning({ attempts: users.failedAttempts });
  const attempts = row?.attempts ?? user.failedAttempts + 1;
  const what = reason === "password" ? "Noto'g'ri parol" : "Noto'g'ri kirish kodi";

  if (shouldLock(attempts)) {
    await deps.db.update(users).set({ lockedAt: new Date() }).where(eq(users.id, user.id));
    await deps.db.delete(sessions).where(eq(sessions.userId, user.id));
    await tenantAudit.record(deps.db, {
      actor: { type: "system" },
      action: "auth.locked",
      target: { type: "user", id: user.id },
      ...meta,
      metadata: { attempts, reason },
    });
    const html =
      `⛔️ <b>${escapeHtml(deps.appName)}: hisob bloklandi</b> — ${escapeHtml(user.name)} (${formatPhone(user.phoneNumber ?? "")})\n` +
      `${attempts} ta ketma-ket xato urinish. Direktor ochguncha kirib bo'lmaydi.\n${metaLines(meta)}`;
    await notifyStaff(deps, user, html);
    await notifyDirectors(deps, html);
    return { locked: true, attempts };
  }

  await tenantAudit.record(deps.db, {
    actor: { type: "system" },
    action: "auth.failed",
    target: { type: "user", id: user.id },
    ...meta,
    metadata: { attempts, reason },
  });
  await notifyStaff(
    deps,
    user,
    `⚠️ <b>Xato kirish urinishi</b> (${what}), ${attempts}/5.\n${metaLines(meta)}\nBu siz bo'lmasangiz, parolingizni almashtiring.`,
  );
  return { locked: false, attempts };
}

/* ---------- Muvaffaqiyatli kirish ---------- */

/**
 * Kirish muvaffaqiyatli bo'ldi (parol + kod). Qurilma direktor tomonidan bloklangan bo'lsa — hech narsa yozilmaydi
 * (kirishlar soni ham oshmaydi), `blocked: true` qaytadi va chaqiruvchi sessiyani yopib, kirishni rad etadi.
 */
export async function onStaffLoginSuccess(
  deps: StaffDeps,
  user: StaffRow,
  meta: RequestMeta & { deviceId: string },
): Promise<{ blocked: boolean }> {
  const hash = deviceHash(meta.deviceId);
  const rows = await deps.db
    .select({ id: knownDevices.id, blockedAt: knownDevices.blockedAt })
    .from(knownDevices)
    .where(and(eq(knownDevices.userId, user.id), eq(knownDevices.deviceHash, hash)));
  if (rows.some((r) => r.blockedAt)) {
    await tenantAudit.record(deps.db, {
      actor: staffActor(user),
      action: "auth.login_blocked",
      target: { type: "user", id: user.id },
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return { blocked: true };
  }
  await deps.db.update(users).set({ failedAttempts: 0 }).where(eq(users.id, user.id));
  const known = rows[0];
  const name = describeUserAgent(meta.userAgent);
  if (known) {
    await deps.db
      .update(knownDevices)
      .set({
        lastSeenAt: new Date(),
        lastIp: meta.ip ?? null,
        userAgent: meta.userAgent ?? null,
        deviceName: name,
        loginCount: sql`${knownDevices.loginCount} + 1`,
      })
      .where(eq(knownDevices.id, known.id));
  } else {
    await deps.db.insert(knownDevices).values({
      userId: user.id,
      deviceHash: hash,
      lastIp: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      deviceName: name,
    });
  }
  await tenantAudit.record(deps.db, {
    actor: staffActor(user),
    action: "auth.login",
    target: { type: "user", id: user.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { newDevice: !known },
  });
  await notifyStaff(
    deps,
    user,
    known
      ? `✅ <b>${escapeHtml(deps.appName)}</b>: tizimga kirildi\n${metaLines(meta)}`
      : `🆕 <b>${escapeHtml(deps.appName)}</b>: yangi qurilmadan kirildi\n${metaLines(meta)}\nBu siz bo'lmasangiz, darhol direktorga xabar bering.`,
  );
  return { blocked: false };
}

/* ---------- Sessiya muddati (markaz sozlamasi) ---------- */

const SESSION_KEY = "session.policy";

export async function getStaffSessionPolicy(db: TenantDb): Promise<SessionPolicy> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SESSION_KEY)).limit(1);
  return isSessionPolicy(row?.value) ? row.value : DEFAULT_SESSION_POLICY;
}

/* ---------- Xodim hisobi ---------- */

export interface NewStaff {
  phone: string;
  name: string;
  password: string;
  role: StaffRole;
  branchIds?: string[];
  /** Lavozimlar (role = "staff" bo'lsa) */
  positionIds?: string[];
  /** Vaqtinchalik parol bilan yaratilsa — birinchi kirishda almashtiriladi */
  mustChangePassword?: boolean;
  /** `teacher` — faqat o'qituvchi kabineti (ADR 0062) */
  kind?: UserKind;
}

export async function createStaffUser(auth: StaffAuth, db: TenantDb, input: NewStaff) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(input.password);
  const user = await ctx.internalAdapter.createUser(
    {
      name: input.name,
      email: internalEmail(input.phone),
      phoneNumber: input.phone,
      phoneNumberVerified: true,
      role: input.role,
      kind: input.kind ?? "staff",
      telegramChatId: null,
      twoFactorEnabled: false,
      mustChangePassword: input.mustChangePassword ?? true,
      failedAttempts: 0,
    },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  if (input.branchIds?.length) {
    await db.insert(userBranches).values(input.branchIds.map((branchId) => ({ userId: user.id, branchId })));
  }
  if (input.positionIds?.length) {
    await db.insert(userPositions).values(input.positionIds.map((positionId) => ({ userId: user.id, positionId })));
  }
  return user;
}

export async function verifyStaffPassword(auth: StaffAuth, userId: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const account = (await ctx.internalAdapter.findAccounts(userId)).find((a) => a.providerId === "credential");
  if (!account?.password) return false;
  return ctx.password.verify({ password, hash: account.password });
}

export async function setStaffPassword(auth: StaffAuth, userId: string, password: string) {
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
}

export async function revokeStaffSessions(db: TenantDb, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export { temporaryPassword } from "../admins";

/** Bloklashni ochish: xato urinishlar hisobi ham nolga tushadi */
export async function unlockStaff(db: TenantDb, userId: string) {
  await db.update(users).set({ lockedAt: null, failedAttempts: 0 }).where(eq(users.id, userId));
}

/** Telegramni uzish: xodim keyingi kirishda botni qayta ulaydi; ochiq sessiyalar yopiladi */
export async function resetStaffTelegram(db: TenantDb, userId: string) {
  await db.update(users).set({ telegramChatId: null, twoFactorEnabled: false }).where(eq(users.id, userId));
  await revokeStaffSessions(db, userId);
}
