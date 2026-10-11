"use server";

import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  findUserById,
  findUserByPhone,
  formatPhone,
  getSessionPolicy,
  LOCK_THRESHOLD,
  normalizeUzPhone,
  notifyUser,
  onLoginSuccess,
  passwordProblem,
  readPending,
  registerFailure,
  revokeAllSessions,
  setUserPassword,
  signPending,
  verifyUserPassword,
} from "@ventura/auth";
import { users, verifications } from "@ventura/db/schema/panel";
import { escapeHtml } from "@ventura/integrations";
import { audit } from "@ventura/security";
import { deps } from "@/lib/server/deps";
import { PENDING_COOKIE, ensureDeviceId, requestMeta } from "@/lib/server/request";
import { getViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";

export interface FormState {
  error?: string;
  info?: string;
}

const secret = () => process.env.BETTER_AUTH_SECRET ?? "";

/* ---------- 1. Telefon + parol ---------- */

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { db, auth, telegram } = deps();
  const phone = normalizeUzPhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  if (!phone || !password) return { error: uz.auth.wrongCredentials };

  const user = await findUserByPhone(db, phone);
  if (user?.lockedAt) return { error: uz.auth.locked };

  const meta = await requestMeta();
  await ensureDeviceId();
  const policy = await getSessionPolicy(db);

  let result: unknown;
  try {
    result = await auth.api.signInPhoneNumber({
      body: { phoneNumber: phone, password, rememberMe: policy !== "browser" },
      headers: await headers(),
    });
  } catch {
    if (!user) return { error: uz.auth.wrongCredentials };
    const { locked, attempts } = await registerFailure({ db, telegram }, user, "password", meta);
    if (locked) return { error: uz.auth.lockedNow };
    return { error: `${uz.auth.wrongCredentials}. ${uz.auth.attemptsLeft(LOCK_THRESHOLD - attempts)}` };
  }

  if (user && (result as { twoFactorRedirect?: boolean })?.twoFactorRedirect) {
    (await cookies()).set(PENDING_COOKIE, signPending(user.id, secret()), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });
    redirect("/login/verify");
  }
  // 2FA hali yoqilmagan (yangi admin): sessiya bor, lekin panel yopiq — parol yoki Telegram sahifasiga
  redirect("/");
}

/* ---------- 2. Telegram kodi ---------- */

export async function sendCodeAction(): Promise<FormState> {
  const { auth } = deps();
  try {
    await auth.api.sendTwoFactorOTP({ headers: await headers(), body: {} });
    return { info: uz.auth.codeSent };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    if (/telegram/i.test(msg)) return { error: uz.auth.telegramDown };
    return { error: uz.auth.sessionGone };
  }
}

export async function verifyCodeAction(_prev: FormState, form: FormData): Promise<FormState> {
  const { db, auth, telegram } = deps();
  const code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== 6) return { error: uz.auth.codeFormat };

  const store = await cookies();
  const userId = readPending(store.get(PENDING_COOKIE)?.value, secret());
  if (!userId) return { error: uz.auth.sessionGone };
  const user = await findUserById(db, userId);
  if (!user || user.lockedAt) return { error: uz.auth.locked };
  const meta = await requestMeta();

  try {
    await auth.api.verifyTwoFactorOTP({ body: { code, trustDevice: false }, headers: await headers() });
  } catch {
    const { locked, attempts } = await registerFailure({ db, telegram }, user, "otp", meta);
    if (locked) return { error: uz.auth.lockedNow };
    return { error: `${uz.auth.codeInvalid}. ${uz.auth.attemptsLeft(LOCK_THRESHOLD - attempts)}` };
  }

  store.delete(PENDING_COOKIE);
  await onLoginSuccess({ db, telegram }, user, { ...meta, deviceId: await ensureDeviceId() });
  redirect("/");
}

/* ---------- Chiqish ---------- */

export async function signOutAction() {
  const { auth, db } = deps();
  const viewer = await getViewer();
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  if (viewer) {
    await audit.record(db, {
      actor: { type: "user", id: viewer.id, name: viewer.name },
      action: "auth.logout",
      target: { type: "user", id: viewer.id },
      ...(await requestMeta()),
    });
  }
  redirect("/login");
}

/* ---------- Telegram'ni ulash (yangi admin yoki 2FA qayta o'rnatilgandan keyin) ---------- */

const LINK_PREFIX = "tg-link:";

/** Bot havolasi uchun bir martalik token (10 daqiqa). */
export async function linkTokenAction(): Promise<{ url: string } | { error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { error: uz.auth.sessionGone };
  const { db, telegram } = deps();
  const token = randomBytes(9).toString("base64url");
  await db.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + viewer.id));
  await db.insert(verifications).values({
    identifier: LINK_PREFIX + viewer.id,
    value: token,
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  const me = await telegram.getMe().catch(() => null);
  if (!me?.username) return { error: uz.auth.telegramDown };
  return { url: `https://t.me/${me.username}?start=${token}` };
}

export async function checkLinkAction(_prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: uz.auth.sessionGone };
  const { db, auth, telegram } = deps();
  const user = await findUserById(db, viewer.id);
  if (!user) return { error: uz.auth.sessionGone };
  const meta = await requestMeta();

  const password = String(form.get("password") ?? "");
  if (!(await verifyUserPassword(auth, user.id, password))) {
    const { locked } = await registerFailure({ db, telegram }, user, "password", meta);
    return { error: locked ? uz.auth.lockedNow : uz.auth.wrongPassword };
  }

  const [pending] = await db
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
      const text = u.message?.text ?? "";
      if (u.message?.chat.type === "private" && text === `/start ${pending.value}`) chatId = String(u.message.chat.id);
    }
    if (updates.length) await telegram.getUpdates(updates[updates.length - 1]!.update_id + 1);
  } catch {
    return { error: uz.auth.telegramDown };
  }
  if (!chatId) return { error: uz.auth.notStarted };

  await db.update(users).set({ telegramChatId: chatId, twoFactorEnabled: true }).where(eq(users.id, user.id));
  await db.delete(verifications).where(eq(verifications.identifier, LINK_PREFIX + user.id));
  await audit.record(db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.telegram_linked",
    target: { type: "user", id: user.id },
    ...meta,
  });
  await notifyUser(
    { db, telegram },
    { telegramChatId: chatId },
    `✅ <b>Telegram ulandi</b>: ${escapeHtml(user.name)} (${formatPhone(user.phoneNumber ?? "")})\nEndi har kirishda kod shu yerga keladi.`,
  );
  // Parolning o'zi bilan ochilgan sessiya yopiladi — endi to'liq (2FA bilan) kirish kerak
  await revokeAllSessions(db, user.id);
  redirect("/login?telegram=ulandi");
}

/* ---------- Parolni almashtirish ---------- */

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: uz.auth.sessionGone };
  const { db, auth, telegram } = deps();
  const user = await findUserById(db, viewer.id);
  if (!user) return { error: uz.auth.sessionGone };

  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  const confirmValue = String(form.get("confirm") ?? "");
  const meta = await requestMeta();

  if (!user.mustChangePassword && !(await verifyUserPassword(auth, user.id, current))) {
    const { locked } = await registerFailure({ db, telegram }, user, "password", meta);
    return { error: locked ? uz.auth.lockedNow : uz.auth.wrongPassword };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== confirmValue) return { error: uz.auth.mismatch };
  if (await verifyUserPassword(auth, user.id, next)) return { error: uz.auth.samePassword };

  await setUserPassword(auth, user.id, next);
  await db.update(users).set({ mustChangePassword: false }).where(eq(users.id, user.id));
  await audit.record(db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "user.password_change",
    target: { type: "user", id: user.id },
    ...meta,
    metadata: { forced: user.mustChangePassword },
  });
  await notifyUser(
    { db, telegram },
    user,
    `🔑 <b>Parol almashtirildi</b>\nIP: <code>${escapeHtml(meta.ip ?? "")}</code>`,
  );
  redirect(user.mustChangePassword ? "/" : "/settings/security?parol=ok");
}
