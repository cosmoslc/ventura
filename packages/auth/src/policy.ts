import type { Role } from "@ventura/db/schema/panel";

/* ---------- Telefon (login) ---------- */

/** Faqat O'zbekiston raqami: "+998 90 123 45 67", "901234567", "998901234567" → "+998901234567". */
export function normalizeUzPhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const local = digits.length === 12 && digits.startsWith("998") ? digits.slice(3) : digits;
  return /^\d{9}$/.test(local) ? `+998${local}` : null;
}

/** Better Auth email talab qiladi — telefon bilan kiriladigan foydalanuvchiga ichki manzil. */
export function internalEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@users.ventura.invalid`;
}

export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "").slice(-9);
  return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7, 9)}`;
}

/* ---------- Parol ---------- */

export const PASSWORD_MIN = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN) return `Parol kamida ${PASSWORD_MIN} belgidan iborat bo'lishi kerak`;
  if (password.length > 128) return "Parol juda uzun";
  return null;
}

/* ---------- Sessiya muddati (umumiy sozlama) ---------- */

export const SESSION_POLICIES = ["browser", "1m", "1h", "3h", "1d", "7d"] as const;
export type SessionPolicy = (typeof SESSION_POLICIES)[number];
export const DEFAULT_SESSION_POLICY: SessionPolicy = "1d";

const MS: Record<Exclude<SessionPolicy, "browser">, number> = {
  "1m": 60_000,
  "1h": 3_600_000,
  "3h": 3 * 3_600_000,
  "1d": 24 * 3_600_000,
  "7d": 7 * 24 * 3_600_000,
};

/** "browser" — cookie brauzer yopilganda o'chadi; server tomonida 1 kun bilan cheklanadi. */
export function sessionLifetimeMs(policy: SessionPolicy): number {
  return policy === "browser" ? MS["1d"] : MS[policy];
}

/** Sessiya kirgan paytdan boshlab hisoblanadi; sozlama o'zgarsa mavjud sessiyalarga darhol qo'llanadi. */
export function isSessionExpired(createdAt: Date, policy: SessionPolicy, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() >= sessionLifetimeMs(policy);
}

export function isSessionPolicy(v: unknown): v is SessionPolicy {
  return typeof v === "string" && (SESSION_POLICIES as readonly string[]).includes(v);
}

/* ---------- Bloklash ---------- */

/** Shuncha ketma-ket xatodan keyin hisob super admin (yoki terminal) ochguncha bloklanadi. */
export const LOCK_THRESHOLD = 5;

export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts >= LOCK_THRESHOLD;
}

/* ---------- Kirish holati (2FA'siz panelga kirib bo'lmaydi) ---------- */

export type AccessState = "ok" | "locked" | "must_change_password" | "needs_telegram";

export function accessState(user: {
  lockedAt: Date | null;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean;
  telegramChatId: string | null;
}): AccessState {
  if (user.lockedAt) return "locked";
  if (user.mustChangePassword) return "must_change_password";
  if (!user.twoFactorEnabled || !user.telegramChatId) return "needs_telegram";
  return "ok";
}

/* ---------- Rollar (SPEC 11-bo'lim) ---------- */

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super admin",
  admin: "Admin",
  viewer: "Kuzatuvchi",
};

type Permission = "view" | "projects.write" | "clients.write" | "templates.sync" | "admins.manage" | "settings.manage";

const PERMISSIONS: Record<Role, readonly Permission[]> = {
  super_admin: ["view", "projects.write", "clients.write", "templates.sync", "admins.manage", "settings.manage"],
  admin: ["view", "projects.write", "clients.write", "templates.sync"],
  viewer: ["view"],
};

export function can(role: Role, permission: Permission): boolean {
  return PERMISSIONS[role].includes(permission);
}

export type { Permission };
