import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import type { TenantDb } from "@ventura/db";
import { accounts, sessions, twoFactors, users, verifications } from "@ventura/db/schema/tenant";
import { type Telegram, escapeHtml } from "@ventura/integrations";

/*
 * Mijoz tizimi uchun Better Auth (EDU-CRM-PLAN 8-qaror): panel bilan bir xil mexanizm — telefon + parol,
 * Telegram kodi (5 daqiqa, 5 urinish, xeshlangan), ochiq ro'yxatdan o'tish yo'q. Farqi:
 * - foydalanuvchilar mijoz bazasida (createTenantDb ulanishi — RLS boshqa mijozni ko'rsatmaydi);
 * - kodni mijozning o'z boti yuboradi, xabarda markaz nomi turadi;
 * - har mijozning o'z kaliti (authSecret) va o'z domeni (baseURL).
 */

export interface StaffAuthDeps {
  db: TenantDb;
  /** Mijozning o'z boti; berilmasa kod yuborib bo'lmaydi va xodim kira olmaydi */
  telegram: Telegram | null | (() => Telegram | null);
  /** Markaz nomi: Telegram xabarida ko'rinadi */
  appName: string;
  secret: string;
  /** So'rov kelgan manzil (https://crm.bilim.uz) */
  baseURL: string;
}

export function createStaffAuth({ db, telegram, appName, secret, baseURL }: StaffAuthDeps) {
  const schema = { user: users, session: sessions, account: accounts, verification: verifications, twoFactor: twoFactors };
  const baseAdapter = drizzleAdapter(db as any, {
    provider: "pg",
    schema,
  });

  const tenantAdapter = (options: any) => {
    const raw = baseAdapter(options);
    if (!("run" in db)) return raw;

    const wrapped: any = { ...raw };
    const methods = [
      "create",
      "update",
      "updateMany",
      "findOne",
      "findMany",
      "delete",
      "deleteMany",
      "consumeOne",
      "incrementOne",
      "count",
    ] as const;

    for (const m of methods) {
      if (typeof (raw as any)[m] === "function") {
        wrapped[m] = async (...args: any[]) => {
          return db.run(async (tx) => {
            const txAdapter = drizzleAdapter(tx as any, { provider: "pg", schema })(options);
            return (txAdapter as any)[m](...args);
          });
        };
      }
    }
    return wrapped;
  };

  return betterAuth({
    appName,
    secret,
    baseURL,
    database: tenantAdapter,
    advanced: {
      cookiePrefix: "edu",
      useSecureCookies: baseURL.startsWith("https://"),
      database: { generateId: "uuid" },
    },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    session: {
      // Server tomonidagi yuqori chegara; haqiqiy muddat markaz sozlamasidan (policy.ts)
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    user: {
      additionalFields: {
        role: { type: "string", input: false, defaultValue: "staff" },
        kind: { type: "string", input: false, defaultValue: "staff" },
        telegramChatId: { type: "string", required: false, input: false },
        mustChangePassword: { type: "boolean", input: false, defaultValue: false },
        failedAttempts: { type: "number", input: false, defaultValue: 0 },
        lockedAt: { type: "date", required: false, input: false },
        archivedAt: { type: "date", required: false, input: false },
      },
    },
    plugins: [
      phoneNumber({
        sendOTP: () => {
          throw new Error("Telefon OTP o'chirilgan");
        },
        phoneNumberValidator: (n) => /^\+998\d{9}$/.test(n),
      }),
      twoFactor({
        issuer: appName,
        skipVerificationOnEnable: true,
        otpOptions: {
          period: 5,
          digits: 6,
          allowedAttempts: 5,
          storeOTP: "hashed",
          async sendOTP({ user, otp }) {
            const chatId = (user as { telegramChatId?: string | null }).telegramChatId;
            const tg = typeof telegram === "function" ? telegram() : telegram;
            if (!tg) throw new Error("Telegram bot ulanmagan");
            if (!chatId) throw new Error("Telegram ulanmagan");
            await tg.sendMessage(
              chatId,
              `🔐 <b>${escapeHtml(appName)}</b> kirish kodi: <code>${escapeHtml(otp)}</code>\n` +
                `Kod 5 daqiqa amal qiladi. Siz so'ramagan bo'lsangiz, hech kimga bermang.`,
            );
          },
        },
      }),
      nextCookies(),
    ],
  });
}

export type StaffAuth = ReturnType<typeof createStaffAuth>;
