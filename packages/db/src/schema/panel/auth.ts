import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/*
 * Better Auth jadvallari (core + phone-number + two-factor plaginlari).
 * Maydon nomlari Better Auth kutganidek (camelCase), ustunlar snake_case.
 */

export const ROLES = ["super_admin", "admin", "viewer"] as const;
export type Role = (typeof ROLES)[number];

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Better Auth talab qiladi; telefon bilan kiriladi, shuning uchun ichki manzil yoziladi. */
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  /** +998XXXXXXXXX — login */
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified").notNull().default(false),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  role: text("role", { enum: ROLES }).notNull().default("viewer"),
  /** 2FA kodlari va ogohlantirishlar shu chatga yuboriladi */
  telegramChatId: text("telegram_chat_id"),
  /** Vaqtinchalik parol bilan yaratilgan admin birinchi kirishda parolni almashtiradi */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  /** Ketma-ket xato urinishlar (parol yoki 2FA kodi) */
  failedAttempts: integer("failed_attempts").notNull().default(0),
  /** 5 xatodan keyin — super admin (yoki terminal) ochguncha */
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  (t) => [index("accounts_user_id_idx").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...timestamps,
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

export const twoFactors = pgTable(
  "two_factors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    secret: text("secret").notNull(),
    backupCodes: text("backup_codes").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verified: boolean("verified").default(true),
    failedVerificationCount: integer("failed_verification_count").default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
  },
  (t) => [index("two_factors_user_id_idx").on(t.userId), index("two_factors_secret_idx").on(t.secret)],
);

/** Ko'rilgan qurilmalar — yangi qurilmadan kirilganda Telegram ogohlantirishi uchun. */
export const knownDevices = pgTable(
  "known_devices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
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
  (t) => [index("known_devices_user_idx").on(t.userId, t.deviceHash)],
);
