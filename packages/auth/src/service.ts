import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { knownDevices, sessions, settings, users } from "@ventura/db/schema/panel";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { type AuditActor, audit } from "@ventura/security";
import { DEFAULT_SESSION_POLICY, type SessionPolicy, formatPhone, isSessionPolicy, shouldLock } from "./policy";

/*
 * Kirish oqimi yordamchilari: urinishlarni sanash va bloklash, yangi qurilma, Telegram
 * ogohlantirishlari, umumiy sessiya sozlamasi. Next server action'lari va CLI shu yerdan foydalanadi.
 */

export interface ServiceDeps {
  db: PanelDb;
  telegram: Telegram;
}

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
}

type UserRow = typeof users.$inferSelect;

export async function findUserByPhone(db: PanelDb, phone: string): Promise<UserRow | null> {
  const [u] = await db.select().from(users).where(eq(users.phoneNumber, phone)).limit(1);
  return u ?? null;
}

export async function findUserById(db: PanelDb, id: string): Promise<UserRow | null> {
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return u ?? null;
}

export function actorOf(user: Pick<UserRow, "id" | "name">): AuditActor {
  return { type: "user", id: user.id, name: user.name };
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
export async function notifyUser(deps: ServiceDeps, user: Pick<UserRow, "telegramChatId">, html: string) {
  if (!user.telegramChatId) return;
  try {
    await deps.telegram.sendMessage(user.telegramChatId, html);
  } catch (e) {
    console.error("[telegram] xabar yuborilmadi:", (e as Error).message);
  }
}

/** Xavfli amallar haqida barcha super adminlarga. */
export async function notifySuperAdmins(deps: ServiceDeps, html: string) {
  const admins = await deps.db
    .select({ telegramChatId: users.telegramChatId })
    .from(users)
    .where(eq(users.role, "super_admin"));
  await Promise.all(admins.map((a) => notifyUser(deps, a, html)));
}

/* ---------- Xato urinishlar va bloklash ---------- */

export async function registerFailure(
  deps: ServiceDeps,
  user: UserRow,
  reason: "password" | "otp",
  meta: RequestMeta,
): Promise<{ locked: boolean; attempts: number }> {
  const [row] = await deps.db
    .update(users)
    .set({ failedAttempts: sql`${users.failedAttempts} + 1` })
    .where(eq(users.id, user.id))
    .returning({ attempts: users.failedAttempts });
  const attempts = row?.attempts ?? user.failedAttempts + 1;
  const what = reason === "password" ? "Noto'g'ri parol" : "Noto'g'ri 2FA kodi";

  if (shouldLock(attempts)) {
    await deps.db.update(users).set({ lockedAt: new Date() }).where(eq(users.id, user.id));
    await deps.db.delete(sessions).where(eq(sessions.userId, user.id));
    await audit.record(deps.db, {
      actor: { type: "system" },
      action: "auth.locked",
      target: { type: "user", id: user.id },
      ...meta,
      metadata: { attempts, reason },
    });
    const html =
      `⛔️ <b>Hisob bloklandi</b>: ${escapeHtml(user.name)} (${formatPhone(user.phoneNumber ?? "")})\n` +
      `${attempts} ta ketma-ket xato urinish. Super admin ochguncha kirib bo'lmaydi.\n${metaLines(meta)}`;
    await notifyUser(deps, user, html);
    await notifySuperAdmins(deps, html);
    return { locked: true, attempts };
  }

  await audit.record(deps.db, {
    actor: { type: "system" },
    action: "auth.failed",
    target: { type: "user", id: user.id },
    ...meta,
    metadata: { attempts, reason },
  });
  await notifyUser(
    deps,
    user,
    `⚠️ <b>Xato kirish urinishi</b> (${what}), ${attempts}/5.\n${metaLines(meta)}\nBu siz bo'lmasangiz, parolingizni almashtiring.`,
  );
  return { locked: false, attempts };
}

export async function unlockUser(deps: ServiceDeps, userId: string, actor: AuditActor) {
  await deps.db.update(users).set({ lockedAt: null, failedAttempts: 0 }).where(eq(users.id, userId));
  await audit.record(deps.db, { actor, action: "user.unlock", target: { type: "user", id: userId } });
}

/* ---------- Muvaffaqiyatli kirish ---------- */

const deviceHash = (deviceId: string) => createHash("sha256").update(deviceId).digest("hex");

export function newDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

export async function onLoginSuccess(deps: ServiceDeps, user: UserRow, meta: RequestMeta & { deviceId: string }) {
  await deps.db.update(users).set({ failedAttempts: 0 }).where(eq(users.id, user.id));
  const hash = deviceHash(meta.deviceId);
  const [known] = await deps.db
    .select({ id: knownDevices.id })
    .from(knownDevices)
    .where(and(eq(knownDevices.userId, user.id), eq(knownDevices.deviceHash, hash)))
    .limit(1);
  if (known) {
    await deps.db
      .update(knownDevices)
      .set({ lastSeenAt: new Date(), lastIp: meta.ip ?? null, userAgent: meta.userAgent ?? null })
      .where(eq(knownDevices.id, known.id));
  } else {
    await deps.db
      .insert(knownDevices)
      .values({ userId: user.id, deviceHash: hash, lastIp: meta.ip ?? null, userAgent: meta.userAgent ?? null });
  }
  await audit.record(deps.db, {
    actor: actorOf(user),
    action: "auth.login",
    target: { type: "user", id: user.id },
    ip: meta.ip,
    userAgent: meta.userAgent,
    metadata: { newDevice: !known },
  });
  await notifyUser(
    deps,
    user,
    known
      ? `✅ <b>Panelga kirildi</b>\n${metaLines(meta)}`
      : `🆕 <b>Yangi qurilmadan kirildi</b>\n${metaLines(meta)}\nBu siz bo'lmasangiz, darhol super adminga xabar bering.`,
  );
}

/* ---------- Umumiy sessiya sozlamasi ---------- */

const SESSION_KEY = "session.policy";

export async function getSessionPolicy(db: PanelDb): Promise<SessionPolicy> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, SESSION_KEY)).limit(1);
  return isSessionPolicy(row?.value) ? row.value : DEFAULT_SESSION_POLICY;
}

export async function setSessionPolicy(
  deps: ServiceDeps,
  policy: SessionPolicy,
  actor: AuditActor & { id: string },
  meta: RequestMeta,
) {
  const before = await getSessionPolicy(deps.db);
  await deps.db
    .insert(settings)
    .values({ key: SESSION_KEY, value: policy, updatedBy: actor.id })
    .onConflictDoUpdate({ target: settings.key, set: { value: policy, updatedBy: actor.id, updatedAt: new Date() } });
  await audit.record(deps.db, {
    actor,
    action: "settings.session_policy",
    target: { type: "setting", id: SESSION_KEY },
    ...meta,
    metadata: { before, after: policy },
  });
  await notifySuperAdmins(
    deps,
    `⚙️ <b>Sessiya muddati o'zgartirildi</b>: ${before} → ${policy}\nKim: ${escapeHtml(actor.name ?? "")}\n${metaLines(meta)}`,
  );
}

/* ---------- Kirish jarayonidagi foydalanuvchi (parol → 2FA oralig'i) ---------- */

/** "userId.expires.imzo" — 2FA bosqichida xato urinishlarni to'g'ri foydalanuvchiga yozish uchun. */
export function signPending(userId: string, secret: string, ttlMs = 10 * 60_000): string {
  const exp = Date.now() + ttlMs;
  const sig = createHmac("sha256", secret).update(`${userId}.${exp}`).digest("base64url");
  return `${userId}.${exp}.${sig}`;
}

export function readPending(token: string | undefined, secret: string): string | null {
  if (!token) return null;
  const [userId, exp, sig] = token.split(".");
  if (!userId || !exp || !sig || Number(exp) < Date.now()) return null;
  const expected = createHmac("sha256", secret).update(`${userId}.${exp}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
