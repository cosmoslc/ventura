"use server";

import { and, count, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createAdminUser,
  findUserById,
  findUserByPhone,
  formatPhone,
  isSessionPolicy,
  normalizeUzPhone,
  notifySuperAdmins,
  resetTelegram,
  revokeAllSessions,
  setSessionPolicy,
  temporaryPassword,
  unlockUser,
} from "@ventura/auth";
import { ROLES, users } from "@ventura/db/schema/panel";
import { escapeHtml } from "@ventura/integrations";
import { audit } from "@ventura/security";
import { type CrmContacts, setCrmContacts } from "@/lib/server/crm-contacts";
import { deps } from "@/lib/server/deps";
import { requestMeta } from "@/lib/server/request";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export type SettingsResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function superCtx() {
  const viewer = await requireViewer("admins.manage");
  return {
    viewer,
    actor: { type: "user" as const, id: viewer.id, name: viewer.name },
    meta: await requestMeta(),
    ...deps(),
  };
}

/* ---------- Sessiya muddati ---------- */

export async function setSessionPolicyAction(policy: string): Promise<SettingsResult> {
  const viewer = await requireViewer("settings.manage");
  if (!isSessionPolicy(policy)) return { ok: false, error: uz.common.loadError };
  const { db, telegram } = deps();
  await setSessionPolicy(
    { db, telegram },
    policy,
    { type: "user", id: viewer.id, name: viewer.name },
    await requestMeta(),
  );
  revalidatePath("/settings/security");
  return { ok: true };
}

/* ---------- Adminlar ---------- */

const newAdminSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string(),
  role: z.enum(ROLES),
});

/** Vaqtinchalik parol faqat shu javobda qaytadi (bazada xeshlangan) — bir marta ko'rsatiladi. */
export async function createAdminAction(input: unknown): Promise<SettingsResult<{ password: string }>> {
  const { actor, meta, db, telegram, auth, viewer } = await superCtx();
  const parsed = newAdminSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  const phone = normalizeUzPhone(parsed.data.phone);
  if (!phone) return { ok: false, error: uz.clients.phoneInvalid };
  if (await findUserByPhone(db, phone)) return { ok: false, error: uz.settings.phoneTaken };

  const password = temporaryPassword();
  const user = await createAdminUser(auth, {
    phone,
    name: parsed.data.name,
    password,
    role: parsed.data.role,
    mustChangePassword: true,
  });
  await audit.record(db, {
    actor,
    action: "user.create",
    target: { type: "user", id: user.id },
    ...meta,
    metadata: { role: parsed.data.role, phone: formatPhone(phone) },
  });
  await notifySuperAdmins(
    { db, telegram },
    `👤 <b>Yangi admin</b>: ${escapeHtml(parsed.data.name)} (${formatPhone(phone)}), rol: ${parsed.data.role}\nKim qo'shdi: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/settings/admins");
  return { ok: true, password };
}

async function superAdminCount(db: ReturnType<typeof deps>["db"], exceptId?: string) {
  const where = exceptId ? and(eq(users.role, "super_admin"), ne(users.id, exceptId)) : eq(users.role, "super_admin");
  const [r] = await db.select({ n: count() }).from(users).where(where);
  return r?.n ?? 0;
}

export async function changeRoleAction(userId: string, role: string): Promise<SettingsResult> {
  const { actor, meta, db, telegram, viewer } = await superCtx();
  const parsed = z.enum(ROLES).safeParse(role);
  if (!parsed.success) return { ok: false, error: uz.common.loadError };
  if (userId === viewer.id) return { ok: false, error: uz.settings.cannotSelf };
  const target = await findUserById(db, userId);
  if (!target) return { ok: false, error: uz.common.loadError };
  if (target.role === "super_admin" && parsed.data !== "super_admin" && (await superAdminCount(db, userId)) === 0) {
    return { ok: false, error: uz.settings.lastSuperAdmin };
  }
  await db.update(users).set({ role: parsed.data }).where(eq(users.id, userId));
  // Ruxsatlar o'zgardi — eski sessiyalar yopiladi
  await revokeAllSessions(db, userId);
  await audit.record(db, {
    actor,
    action: "user.role_change",
    target: { type: "user", id: userId },
    ...meta,
    metadata: { before: target.role, after: parsed.data },
  });
  await notifySuperAdmins(
    { db, telegram },
    `🛡 <b>Rol o'zgartirildi</b>: ${escapeHtml(target.name)}: ${target.role} → ${parsed.data}\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/settings/admins");
  return { ok: true };
}

export async function unlockAction(userId: string): Promise<SettingsResult> {
  const { actor, db, telegram, viewer } = await superCtx();
  const target = await findUserById(db, userId);
  if (!target) return { ok: false, error: uz.common.loadError };
  await unlockUser({ db, telegram }, userId, actor);
  await notifySuperAdmins(
    { db, telegram },
    `🔓 <b>Hisob ochildi</b>: ${escapeHtml(target.name)}\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/settings/admins");
  return { ok: true };
}

export async function resetTelegramAction(userId: string): Promise<SettingsResult> {
  const { actor, meta, db, telegram, viewer } = await superCtx();
  if (userId === viewer.id) return { ok: false, error: uz.settings.cannotSelf };
  const target = await findUserById(db, userId);
  if (!target) return { ok: false, error: uz.common.loadError };
  await resetTelegram(db, userId);
  await audit.record(db, { actor, action: "user.reset_2fa", target: { type: "user", id: userId }, ...meta });
  await notifySuperAdmins(
    { db, telegram },
    `🛠 <b>2FA qayta o'rnatildi</b>: ${escapeHtml(target.name)}\nKim: ${escapeHtml(viewer.name)}`,
  );
  revalidatePath("/settings/admins");
  return { ok: true };
}

/* ---------- CRM Aloqa va Manzil sozlamalari ---------- */

const crmContactsSchema = z.object({
  phonePrimary: z.string().trim().min(5, "Asosiy telefon raqamini kiriting"),
  phoneSecondary: z.string().trim().optional().default(""),
  telegramSupport: z.string().trim().optional().default(""),
  telegramChannel: z.string().trim().optional().default(""),
  email: z.string().trim().optional().default(""),
  address: z.string().trim().min(3, "Manzilni kiriting"),
  workHours: z.string().trim().min(2, "Ish vaqtini kiriting"),
  mapUrl: z.string().trim().optional().default(""),
});

export async function saveCrmContactsAction(input: unknown): Promise<SettingsResult> {
  const viewer = await requireViewer("settings.manage");
  const parsed = crmContactsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.loadError };
  }
  const { db } = deps();
  await setCrmContacts(db, parsed.data as CrmContacts, viewer.id);
  const meta = await requestMeta();
  await audit.record(db, {
    actor: { type: "user", id: viewer.id, name: viewer.name },
    action: "settings.update",
    target: { type: "system", id: "crm_contacts" },
    ...meta,
    metadata: { key: "crm_contacts", updated: Object.keys(parsed.data) },
  });
  revalidatePath("/crm");
  revalidatePath("/settings/contacts");
  return { ok: true };
}
