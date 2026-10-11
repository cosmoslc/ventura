import { boolean, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/*
 * Mijoz xodimlari (EDU-CRM-PLAN 2-bo'lim, 8-qaror): kirish mexanizmi panel bilan bir xil (Better Auth,
 * telefon + parol, Telegram kodi), lekin foydalanuvchilar har mijozning o'z bazasida. Telefon va ichki
 * email faqat bitta mijoz ichida noyob: umumiy bazada ikki markazda bir xil raqamli xodim bo'lishi mumkin.
 */

/** Tayyor rollar (9-qaror). Ruxsatlar: packages/auth/src/staff/policy.ts */
export const STAFF_ROLES = ["director", "manager", "cashier", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    /** Better Auth talab qiladi; telefon bilan kiriladi, shuning uchun ichki manzil yoziladi. */
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** +998XXXXXXXXX — login */
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    role: text("role", { enum: STAFF_ROLES }).notNull().default("viewer"),
    /** Kirish kodlari mijozning o'z Telegram boti orqali shu chatga yuboriladi */
    telegramChatId: text("telegram_chat_id"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("users_tenant_email_uq").on(t.tenantId, t.email),
    unique("users_tenant_phone_uq").on(t.tenantId, t.phoneNumber),
    tenantPolicy("users"),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId), tenantPolicy("sessions")],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    /** Better Auth xeshlagan parol (scrypt) */
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_id_idx").on(t.userId), tenantPolicy("accounts")],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier), tenantPolicy("verifications")],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factors_user_id_idx").on(t.userId), tenantPolicy("two_factors")],
);

/** Ko'rilgan qurilmalar — yangi qurilmadan kirilganda Telegram ogohlantirishi uchun. */
export const knownDevices = pgTable(
  "known_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Qurilma cookie'sining sha256 xeshi */
    deviceHash: text("device_hash").notNull(),
    userAgent: text("user_agent"),
    lastIp: text("last_ip"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("known_devices_user_idx").on(t.userId, t.deviceHash), tenantPolicy("known_devices")],
);
