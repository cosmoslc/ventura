import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/*
 * Mijoz xodimlari (EDU-CRM-PLAN 2-bo'lim, 8-qaror): kirish mexanizmi panel bilan bir xil (Better Auth,
 * telefon + parol, Telegram kodi), lekin foydalanuvchilar har mijozning o'z bazasida. Telefon va ichki
 * email faqat bitta mijoz ichida noyob: umumiy bazada ikki markazda bir xil raqamli xodim bo'lishi mumkin.
 */

/** Tayyor rollar (9-qaror). Ruxsatlar: packages/auth/src/staff/policy.ts */
/**
 * `director` — hamma narsa; `staff` — ruxsatlar lavozimdan (positions). `manager`, `cashier`, `viewer` — lavozimlardan
 * oldingi rollar: birinchi kirishda mos tayyor lavozimga o'tkaziladi (ensurePositions).
 */
export const STAFF_ROLES = ["director", "staff", "manager", "cashier", "viewer"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** `staff` — admin CRM; `teacher` — faqat o'qituvchi kabineti (ADR 0062), `teachers.user_id` orqali bog'langan */
export const USER_KINDS = ["staff", "teacher"] as const;
export type UserKind = (typeof USER_KINDS)[number];

export const GENDERS = ["male", "female"] as const;
export const SALARY_TYPES = ["fixed", "kpi"] as const;
export type SalaryType = (typeof SALARY_TYPES)[number];

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
    kind: text("kind", { enum: USER_KINDS }).notNull().default("staff"),
    /** Kirish kodlari mijozning o'z Telegram boti orqali shu chatga yuboriladi */
    telegramChatId: text("telegram_chat_id"),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    /* Xodim kartochkasi (eski tizimdagi "Xodimlar" formasi) */
    gender: text("gender", { enum: GENDERS }),
    birthDate: date("birth_date", { mode: "string" }),
    address: text("address"),
    /** `fixed` — oylik oklad; `kpi` — asosiy oklad + o'quvchi va 1 oylik bonus (hisob E3 da) */
    salaryType: text("salary_type", { enum: SALARY_TYPES }).notNull().default("fixed"),
    monthlySalary: bigint("monthly_salary", { mode: "number" }).notNull().default(0),
    kpiStudentAmount: bigint("kpi_student_amount", { mode: "number" }).notNull().default(0),
    kpiContractBonus: bigint("kpi_contract_bonus", { mode: "number" }).notNull().default(0),
    note: text("note"),
    /** Markaz o'zi qo'shgan qo'shimcha maydonlar (Xodim formasi sozlamasi): maydon id → qiymat */
    customData: jsonb("custom_data").$type<Record<string, string>>().notNull().default({}),
    /** Bo'shatilgan (arxiv): kira olmaydi, ro'yxatda ko'rinmaydi; tarix (to'lovlar, jurnal) saqlanadi */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("users_tenant_email_uq").on(t.tenantId, t.email),
    unique("users_tenant_phone_uq").on(t.tenantId, t.phoneNumber),
    unique("users_tenant_id_uq").on(t.tenantId, t.id),
    check(
      "users_salary_nonneg",
      sql`${t.monthlySalary} >= 0 and ${t.kpiStudentAmount} >= 0 and ${t.kpiContractBonus} >= 0`,
    ),
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
    /** "Chrome · Windows" — kirishda user-agent'dan olinadi (ko'rsatish uchun); eski qatorlarda bo'sh */
    deviceName: text("device_name"),
    /** Shu qurilmadan muvaffaqiyatli kirishlar soni (har kirishda +1) */
    loginCount: integer("login_count").notNull().default(1),
    /** Direktor bloklagan: bu qurilmadan kirib ham, ochiq sessiya bilan ishlab ham bo'lmaydi (E6g, ADR 0040) */
    blockedAt: timestamp("blocked_at", { withTimezone: true }),
    /** Kim blokladi (xodim o'chsa ham yozuv qoladi) */
    blockedBy: uuid("blocked_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("known_devices_user_idx").on(t.userId, t.deviceHash),
    check("known_devices_login_count_nonneg", sql`${t.loginCount} >= 0`),
    tenantPolicy("known_devices"),
  ],
);
