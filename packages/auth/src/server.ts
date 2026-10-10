import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import type { PanelDb } from "@ventura/db";
import { accounts, sessions, twoFactors, users, verifications } from "@ventura/db/schema/panel";
import { type Telegram, escapeHtml } from "@ventura/integrations";

/*
 * Better Auth sozlamasi (SPEC 2: login; 1-bosqich qarorlari docs/decisions/0001):
 * - telefon (+998) + parol; ochiq ro'yxatdan o'tish yo'q;
 * - 2FA: 6 xonali kod Telegram orqali, 5 daqiqa, 5 urinish, bazada xeshlangan;
 * - foydalanuvchi maydonlarini (rol, bloklash, Telegram) faqat server o'zgartiradi.
 */

export interface AuthDeps {
  db: PanelDb;
  telegram: Telegram;
  secret?: string;
  baseURL?: string;
}

export function createAuth({ db, telegram, secret, baseURL }: AuthDeps) {
  return betterAuth({
    appName: "Ventura",
    secret: secret ?? process.env.BETTER_AUTH_SECRET,
    baseURL: baseURL ?? process.env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications, twoFactor: twoFactors },
    }),
    advanced: {
      cookiePrefix: "ventura",
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      // Server tomonidagi yuqori chegara; haqiqiy muddat umumiy sozlamadan (policy.ts)
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "viewer" },
        telegramChatId: { type: "string", required: false, input: false },
        mustChangePassword: { type: "boolean", input: false, defaultValue: false },
        failedAttempts: { type: "number", input: false, defaultValue: 0 },
        lockedAt: { type: "date", required: false, input: false },
      },
    },
    plugins: [
      phoneNumber({
        // Telefon orqali OTP ishlatilmaydi — faqat parol bilan kirish
        sendOTP: () => {
          throw new Error("Telefon OTP o'chirilgan");
        },
        phoneNumberValidator: (n) => /^\+998\d{9}$/.test(n),
      }),
      twoFactor({
        issuer: "Ventura",
        skipVerificationOnEnable: true,
        otpOptions: {
          period: 5,
          digits: 6,
          allowedAttempts: 5,
          storeOTP: "hashed",
          async sendOTP({ user, otp }) {
            const chatId = (user as { telegramChatId?: string | null }).telegramChatId;
            if (!chatId) throw new Error("Telegram ulanmagan");
            await telegram.sendMessage(
              chatId,
              `🔐 <b>Ventura</b> kirish kodi: <code>${escapeHtml(otp)}</code>\n` +
                `Kod 5 daqiqa amal qiladi. Siz so'ramagan bo'lsangiz, hech kimga bermang.`,
            );
          },
        },
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
