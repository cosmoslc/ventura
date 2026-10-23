"use server";

import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  LOCK_THRESHOLD,
  formatPhone,
  normalizeUzPhone,
  passwordProblem,
  readPending,
  signPending,
} from "@ventura/auth";
import {
  type StaffAuth,
  findStaffById,
  findStaffByPhone,
  getStaffSessionPolicy,
  isDeviceBlocked,
  notifyStaff,
  onStaffLoginSuccess,
  registerStaffFailure,
  revokeStaffSessions,
  setStaffPassword,
  staffActor,
  verifyStaffPassword,
} from "@ventura/auth/staff";
import { users, verifications } from "@ventura/db/schema/tenant";
import { type Telegram, escapeHtml } from "@ventura/integrations";
import { tenantAudit } from "@ventura/security";
import { type TenantDeps, resolveTelegramBot } from "@/lib/server/deps";
import { currentDeps, getStaff } from "@/lib/server/session";
import { PENDING_COOKIE, ensureDeviceId, requestMeta, requestOrigin, secureRequest } from "@/lib/server/request";
import { uz } from "@/lib/uz";

/**
 * Amal natijasi. `next` — muvaffaqiyatdan keyin brauzer o'tadigan manzil. Server amali ichida redirect()
 * ishlatilmaydi: Next yo'naltirilgan sahifani ichki so'rov bilan chizadi va unda mijoz domeni yo'qoladi
 * (shared rejimda mijoz aynan domen bo'yicha aniqlanadi). Forma o'tishni o'zi bajaradi (useFormNext).
 */
export interface FormState {
  error?: string;
  info?: string;
  next?: string;
}

const text = (form: FormData, name: string) => String(form.get(name) ?? "");

const signInSchema = z.object({
  phone: z.string().max(32),
  password: z.string().min(1).max(128),
});

type Ready = { error: string } | { deps: TenantDeps; telegram: Telegram | null; auth: StaffAuth };

/** Kirish uchun mijoz bog'liqliklari; baza sozlanmagan bo'lsa — xato matni. */
async function ready(): Promise<Ready> {
  const { deps } = await currentDeps();
  if (!deps) return { error: uz.auth.notConfigured };
  const telegram = await resolveTelegramBot(deps);
  return { deps, telegram, auth: deps.auth(await requestOrigin()) };
}

/* ---------- 1. Telefon + parol ---------- */

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = signInSchema.safeParse({ phone: text(form, "phone"), password: text(form, "password") });
  const phone = parsed.success ? normalizeUzPhone(parsed.data.phone) : null;
  if (!parsed.success || !phone) return { error: uz.auth.wrongCredentials };
  const r = await ready();
  if ("error" in r) return { error: r.error };
  const { deps, auth } = r;

  const user = await findStaffByPhone(deps.db, phone);
  if (user?.lockedAt || user?.archivedAt) return { error: uz.auth.locked };

  const meta = await requestMeta();
  const deviceId = await ensureDeviceId();
  // Bloklangan qurilmadan parol ham so'ralmaydi (E6g)
  if (user && (await isDeviceBlocked(deps.db, user.id, deviceId))) return { error: uz.auth.deviceBlocked };
  const policy = await getStaffSessionPolicy(deps.db);

  let result: unknown;
  try {
    result = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phone, password: parsed.data.password, rememberMe: policy !== "browser" },
      headers: await headers(),
    });
  } catch {
    if (!user) return { error: uz.auth.wrongCredentials };
    const { locked, attempts } = await registerStaffFailure(deps, user, "password", meta);
    if (locked) return { error: uz.auth.lockedNow };
    return { error: `${uz.auth.wrongCredentials}. ${uz.auth.attemptsLeft(LOCK_THRESHOLD - attempts)}` };
  }

  if (user && (result as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
    (await cookies()).set(PENDING_COOKIE, signPending(user.id, deps.secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: await secureRequest(),
      maxAge: 600,
      path: "/",
    });
    return { next: "/login/verify" };
  }
  // 2FA hali yoqilmagan (yangi xodim yoki o'quvchi)
  const next = user?.kind === "student" ? "/portal" : user?.kind === "teacher" ? "/kabinet" : "/";
  return { next };
}

/* ---------- 2. Telegram kodi ---------- */

export async function sendCodeAction(): Promise<FormState> {
  const r = await ready();
  if ("error" in r) return { error: r.error };
  if (!r.telegram) return { error: uz.auth.noBot };
  try {
    await r.auth.api.sendTwoFactorOTP({ headers: await headers(), body: {} });
    return { info: uz.auth.codeSent };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/telegram/i.test(msg)) return { error: uz.auth.telegramDown };
    return { error: uz.auth.sessionGone };
  }
}

export async function verifyCodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const code = text(form, "code").replace(/\D/g, "");
  if (code.length !== 6) return { error: uz.auth.codeFormat };
  const r = await ready();
  if ("error" in r) return { error: r.error };
  const { deps, auth } = r;

  const store = await cookies();
  const userId = readPending(store.get(PENDING_COOKIE)?.value, deps.secret);
  if (!userId) return { error: uz.auth.sessionGone };
  const user = await findStaffById(deps.db, userId);
  if (!user || user.lockedAt || user.archivedAt) return { error: uz.auth.locked };
  const meta = await requestMeta();

  try {
    await auth.api.verifyTwoFactorOTP({ body: { code, trustDevice: false }, headers: await headers() });
  } catch {
    const { locked, attempts } = await registerStaffFailure(deps, user, "otp", meta);
    if (locked) return { error: uz.auth.lockedNow };
    return { error: `${uz.auth.codeInvalid}. ${uz.auth.attemptsLeft(LOCK_THRESHOLD - attempts)}` };
  }

  store.delete(PENDING_COOKIE);
  const { blocked } = await onStaffLoginSuccess(deps, user, { ...meta, deviceId: await ensureDeviceId() });
  if (blocked) {
    // Kod to'g'ri, lekin qurilma bloklangan: shu so'rov ochgan sessiya yopiladi
    await auth.api.signOut({ headers: await headers() }).catch(() => {});
    return { error: uz.auth.deviceBlocked };
  }
  const next = user.kind === "student" ? "/portal" : user.kind === "teacher" ? "/kabinet" : "/";
  return { next };
}

/* ---------- Chiqish ---------- */

/** Chiqish: sessiya yopiladi, keyin brauzer /login ga o'tadi (CrmShell). */
export async function signOutAction(): Promise<void> {
  const { deps } = await currentDeps();
  const staff = await getStaff();
  if (deps) {
    await deps
      .auth(await requestOrigin())
      .api.signOut({ headers: await headers() })
      .catch(() => {});
    if (staff) {
      await tenantAudit.record(deps.db, {
        actor: staffActor(staff),
        action: "auth.logout",
        target: { type: "user", id: staff.id },
        ...(await requestMeta()),
      });
    }
  }
}

/* ---------- Telegram'ni ulash (yangi xodim) ---------- */

const LINK_PREFIX = "tg-link:";

/** Markaz botiga havola uchun bir martalik token (10 daqiqa). */
export async function linkTokenAction(): Promise<{ url: string } | { error: string }> {
  const staff = await getStaff();
  if (!staff) return { error: uz.auth.sessionGone };
  const r = await ready();
  if ("error" in r) return { error: r.error };
  if (!r.telegram) return { error: uz.auth.noBot };
  const { deps, telegram } = r;
  const token = randomBytes(9).toString("base64url");
  await deps.db.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + staff.id));
  await deps.db.insert(verifications).values({
    identifier: LINK_PREFIX + staff.id,
    value: token,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  const me = await telegram.getMe().catch(() => null);
  if (!me?.username) return { error: uz.auth.telegramDown };
  return { url: `https://t.me/${me.username}?start=${token}` };
}

export async function checkLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff) return { error: uz.auth.sessionGone };
  const r = await ready();
  if ("error" in r) return { error: r.error };
  if (!r.telegram) return { error: uz.auth.noBot };
  const { deps, telegram, auth } = r;
  const user = await findStaffById(deps.db, staff.id);
  if (!user) return { error: uz.auth.sessionGone };
  const meta = await requestMeta();

  if (!(await verifyStaffPassword(auth, user.id, text(form, "password")))) {
    const { locked } = await registerStaffFailure(deps, user, "password", meta);
    return { error: locked ? uz.auth.lockedNow : uz.auth.wrongPassword };
  }

  const [pending] = await deps.db
    .select({ value: verifications.value })
    .from(verifications)
    .where(and(eq(verifications.identifier, LINK_PREFIX + user.id), gt(verifications.expiresAt, new Date())))
    .limit(1);
  if (!pending) return { error: uz.auth.notStarted };

  // Botga kelgan /start <token> xabarini qidiramiz (bot webhook'siz — long polling)
  let chatId: string | null = null;
  try {
    const updates = await telegram.getUpdates();
    for (const u of updates) {
      const msg = u.message?.text ?? "";
      if (u.message?.chat.type === "private" && msg === `/start ${pending.value}`) chatId = String(u.message.chat.id);
    }
    if (updates.length) await telegram.getUpdates(updates[updates.length - 1]!.update_id + 1);
  } catch {
    return { error: uz.auth.telegramDown };
  }
  if (!chatId) return { error: uz.auth.notStarted };

  await deps.db.update(users).set({ telegramChatId: chatId, twoFactorEnabled: true }).where(eq(users.id, user.id));
  await deps.db.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + user.id));
  await tenantAudit.record(deps.db, {
    actor: staffActor(user),
    action: "user.telegram_linked",
    target: { type: "user", id: user.id },
    ...meta,
  });
  await notifyStaff(
    deps,
    { telegramChatId: chatId },
    `✅ <b>${escapeHtml(deps.appName)}</b>: Telegram ulandi — ${escapeHtml(user.name)} (${formatPhone(user.phoneNumber ?? "")})\nEndi har kirishda kod shu yerga keladi.`,
  );
  const nextTarget = text(form, "next");
  if (nextTarget === "/account") {
    return { next: "/account?telegram=ulandi" };
  }
  // Parolning o'zi bilan ochilgan sessiya yopiladi — endi to'liq (kod bilan) kirish kerak (login funnel paytida)
  await revokeStaffSessions(deps.db, user.id);
  return { next: "/login?telegram=ulandi" };
}

/* ---------- Parolni almashtirish ---------- */

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await getStaff();
  if (!staff) return { error: uz.auth.sessionGone };
  const { deps } = await currentDeps();
  if (!deps) return { error: uz.auth.notConfigured };
  const auth = deps.auth(await requestOrigin());
  const user = await findStaffById(deps.db, staff.id);
  if (!user) return { error: uz.auth.sessionGone };

  const next = text(form, "next");
  const meta = await requestMeta();

  if (!user.mustChangePassword && !(await verifyStaffPassword(auth, user.id, text(form, "current")))) {
    const { locked } = await registerStaffFailure(deps, user, "password", meta);
    return { error: locked ? uz.auth.lockedNow : uz.auth.wrongPassword };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== text(form, "confirm")) return { error: uz.auth.mismatch };
  if (await verifyStaffPassword(auth, user.id, next)) return { error: uz.auth.samePassword };

  await setStaffPassword(auth, user.id, next);
  await deps.db.update(users).set({ mustChangePassword: false }).where(eq(users.id, user.id));
  await tenantAudit.record(deps.db, {
    actor: staffActor(user),
    action: "user.password_change",
    target: { type: "user", id: user.id },
    ...meta,
    metadata: { forced: user.mustChangePassword },
  });
  await notifyStaff(
    deps,
    user,
    `🔑 <b>${escapeHtml(deps.appName)}</b>: parol almashtirildi\nIP: <code>${escapeHtml(meta.ip ?? "")}</code>`,
  );
  return { next: "/" };
}
