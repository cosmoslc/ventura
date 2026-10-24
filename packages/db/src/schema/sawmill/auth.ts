import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/*
 * Sawmill foydalanuvchilari (SAWMILL-PLAN 2-bo'lim, 4-qaror):
 * 3 asosiy rol: owner (egasi), accountant (hisobchi), viewer (ko'ruvchi).
 * Better Auth bilan mos: telefon + parol, Telegram 2FA.
 */

export const SAWMILL_ROLES = ["owner", "accountant", "viewer"] as const;
export type SawmillRole = (typeof SAWMILL_ROLES)[number];

export const SAWMILL_LOCALES = ["uz", "ru"] as const;
export type SawmillLocale = (typeof SAWMILL_LOCALES)[number];

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    /** Better Auth talab qiladi; telefon bilan kiriladi, ichki manzil yoziladi */
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** +998XXXXXXXXX — login */
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
    role: text("role", { enum: SAWMILL_ROLES }).notNull().default("viewer"),
    /** Foydalanuvchi tanlagan interfeys tili (uz/ru) */
    locale: text("locale", { enum: SAWMILL_LOCALES }).notNull().default("uz"),
    /** Kirish kodlari uchun Telegram chat ID */
    telegramChatId: text("telegram_chat_id"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("users_tenant_email_uq").on(t.tenantId, t.email),
    unique("users_tenant_phone_uq").on(t.tenantId, t.phoneNumber),
    unique("users_tenant_id_uq").on(t.tenantId, t.id),
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

export const knownDevices = pgTable(
  "known_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceHash: text("device_hash").notNull(),
    userAgent: text("user_agent"),
    lastIp: text("last_ip"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    deviceName: text("device_name"),
    loginCount: integer("login_count").notNull().default(1),
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    blockedBy: uuid("blocked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("known_devices_user_idx").on(t.userId, t.deviceHash),
    check("known_devices_login_count_nonneg", sql`${t.loginCount} >= 0`),
    tenantPolicy("known_devices"),
  ],
);
