import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import type { SawmillDb } from "@ventura/db";
import { accounts, sessions, twoFactors, users, verifications } from "@ventura/db/schema/sawmill";
import type { Telegram } from "@ventura/integrations";

/*
 * Sawmill uchun Better Auth konfiguratsiyasi.
 * Har mijozning o'z bazasi (createSawmillDb), o'z authSecret va baseURL'i bilan.
 */

export interface SawmillAuthDeps {
  db: SawmillDb;
  telegram?: Telegram | null;
  appName: string;
  secret: string;
  baseURL: string;
}

export function createSawmillAuth({ db, appName, secret, baseURL }: SawmillAuthDeps) {
  return betterAuth({
    appName,
    secret,
    baseURL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
        twoFactor: twoFactors,
      },
    }),
    advanced: {
      cookiePrefix: "sawmill",
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
      expiresIn: 7 * 24 * 60 * 60,
      updateAge: 24 * 60 * 60,
    },
    user: {
      additionalFields: {
        phoneNumber: { type: "string", required: false, input: false },
        role: { type: "string", input: false, defaultValue: "viewer" },
        locale: { type: "string", input: false, defaultValue: "uz" },
        telegramChatId: { type: "string", required: false, input: false },
        mustChangePassword: { type: "boolean", input: false, defaultValue: false },
        failedAttempts: { type: "number", input: false, defaultValue: 0 },
        lockedAt: { type: "date", required: false, input: false },
        archivedAt: { type: "date", required: false, input: false },
      },
    },
    plugins: [nextCookies()],
  });
}

export type SawmillAuth = ReturnType<typeof createSawmillAuth>;
