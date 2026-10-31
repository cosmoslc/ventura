import { boolean, index, integer, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";

export const PC_CRM_ROLES = ["admin", "customer", "seller", "accountant"] as const;
export type PcCrmRole = (typeof PC_CRM_ROLES)[number];

export const PC_CRM_LOCALES = ["uz", "ru", "en"] as const;
export type PcCrmLocale = (typeof PC_CRM_LOCALES)[number];

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: text("first_name").default(""),
  lastName: text("last_name"),
  name: text("name").notNull(), // Better Auth compatibility (computed or combined)
  phone: text("phone").unique(),
  phoneVerified: boolean("phone_verified").notNull().default(false),
  email: text("email").unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  googleId: text("google_id"),
  image: text("image"), // Better Auth avatar field
  role: text("role", { enum: PC_CRM_ROLES }).notNull().default("customer"),
  isActive: boolean("is_active").notNull().default(true),
  locale: text("locale", { enum: PC_CRM_LOCALES }).notNull().default("uz"),
  region: text("region"),
  address: text("address"),
  lat: numeric("lat", { precision: 10, scale: 7 }),
  lng: numeric("lng", { precision: 10, scale: 7 }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  failedAttempts: integer("failed_attempts").notNull().default(0),
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
  (t) => [index("sessions_user_id_idx").on(t.userId)]
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
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("accounts_user_id_idx").on(t.userId)]
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
  (t) => [index("verifications_identifier_idx").on(t.identifier)]
);
