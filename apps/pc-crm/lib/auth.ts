import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { accounts, sessions, users, verifications } from "@ventura/db/schema/pc-crm";
import { getDb } from "./db";

const baseURL =
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  "http://localhost:3004";

const secret =
  process.env.BETTER_AUTH_SECRET ??
  "ventura_pc_crm_secret_auth_key_2026_super_secure_token_999";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};

if (googleClientId && googleClientSecret) {
  socialProviders.google = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  };
}

export const auth = betterAuth({
  appName: "Ventura PC Store",
  secret,
  baseURL,
  trustedOrigins: [
    "http://localhost:3004",
    "http://127.0.0.1:3004",
    baseURL,
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS
      ? process.env.BETTER_AUTH_TRUSTED_ORIGINS.split(",").map((s) => s.trim())
      : []),
  ],
  database: drizzleAdapter(getDb(), {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  advanced: {
    cookiePrefix: "ventura_pc",
    useSecureCookies: process.env.NODE_ENV === "production" && baseURL.startsWith("https://"),
    database: { generateId: "uuid" },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    autoSignIn: true,
  },
  socialProviders,
  user: {
    additionalFields: {
      firstName: { type: "string", required: false, defaultValue: "" },
      lastName: { type: "string", required: false, defaultValue: "" },
      role: { type: "string", defaultValue: "customer" },
      isActive: { type: "boolean", defaultValue: true },
      locale: { type: "string", defaultValue: "uz" },
    },
  },
  session: {
    expiresIn: 30 * 24 * 60 * 60, // 30 kun
    updateAge: 24 * 60 * 60, // 1 kunda bir yangilash
  },
  plugins: [nextCookies()],
});

export type Auth = typeof auth;
