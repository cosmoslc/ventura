import { randomInt } from "node:crypto";
import { eq } from "drizzle-orm";
import type { PanelDb } from "@ventura/db";
import { type Role, sessions, users } from "@ventura/db/schema/panel";
import { internalEmail } from "./policy";
import type { Auth } from "./server";

/*
 * Adminlarni yaratish va parol bilan ishlash. Ochiq ro'yxatdan o'tish yo'q (disableSignUp),
 * shuning uchun foydalanuvchilar faqat shu yerdan — Better Auth ichki adapteri orqali — yaratiladi.
 */

export interface NewAdmin {
  phone: string;
  name: string;
  password: string;
  role: Role;
  telegramChatId?: string | null;
  /** Telegram ulangan bo'lsa (CLI), 2FA darhol yoqiladi */
  twoFactorEnabled?: boolean;
  /** Super admin vaqtinchalik parol bilan yaratgan bo'lsa — birinchi kirishda almashtiriladi */
  mustChangePassword?: boolean;
}

export async function createAdminUser(auth: Auth, input: NewAdmin) {
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(input.password);
  const user = await ctx.internalAdapter.createUser(
    {
      name: input.name,
      email: internalEmail(input.phone),
      phoneNumber: input.phone,
      phoneNumberVerified: true,
      role: input.role,
      telegramChatId: input.telegramChatId ?? null,
      twoFactorEnabled: input.twoFactorEnabled ?? false,
      mustChangePassword: input.mustChangePassword ?? false,
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
  return user;
}

export async function verifyUserPassword(auth: Auth, userId: string, password: string): Promise<boolean> {
  const ctx = await auth.$context;
  const account = (await ctx.internalAdapter.findAccounts(userId)).find((a) => a.providerId === "credential");
  if (!account?.password) return false;
  return ctx.password.verify({ password, hash: account.password });
}

export async function setUserPassword(auth: Auth, userId: string, password: string) {
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(userId, await ctx.password.hash(password));
}

/** Foydalanuvchining barcha sessiyalarini yopadi (bloklash, 2FA'ni qayta o'rnatish, rol o'zgarishi). */
export async function revokeAllSessions(db: PanelDb, userId: string) {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function resetTelegram(db: PanelDb, userId: string) {
  await db.update(users).set({ telegramChatId: null, twoFactorEnabled: false }).where(eq(users.id, userId));
  await revokeAllSessions(db, userId);
}

/** Vaqtinchalik parol: chalkash belgilarsiz (0/O, 1/l/I yo'q), 12 belgi. */
export function temporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => alphabet[randomInt(alphabet.length)]).join("");
}
