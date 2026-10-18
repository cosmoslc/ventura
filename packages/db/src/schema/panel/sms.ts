import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { projects } from "./core";

/*
 * Ventura SMS paketi (docs/EDU-CRM-SMS.md, S4; ADR 0056). Ventura'ning bitta Eskiz hisobi orqali markazlar SMS
 * yuboradi (panel relay). Har loyihaning SMS qismlari hisobi: qoldiq (`sms_wallets`) va o'chirilmaydigan harakatlar
 * jurnali (`sms_wallet_entries`). Markaz paketni CRM ichida so'raydi (`sms_purchase_requests`), panel admini to'lov
 * kelganini tasdiqlaydi — qismlar hisobga tushadi.
 */

export const smsPackages = pgTable(
  "sms_packages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    /** SMS qismlari soni */
    parts: integer("parts").notNull(),
    /** So'm */
    price: integer("price").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("sms_packages_parts", sql`${t.parts} between 1 and 10000000`),
    check("sms_packages_price", sql`${t.price} >= 0`),
    check("sms_packages_name_len", sql`length(${t.name}) between 1 and 80`),
  ],
);

export const smsWallets = pgTable(
  "sms_wallets",
  {
    projectId: uuid("project_id")
      .primaryKey()
      .references(() => projects.id, { onDelete: "cascade" }),
    /** Qolgan SMS qismlari (manfiy bo'lmaydi) */
    balance: integer("balance").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [check("sms_wallets_balance_nonneg", sql`${t.balance} >= 0`)],
);

export const SMS_WALLET_ENTRY_KINDS = ["purchase", "send", "refund", "adjust"] as const;

export const smsWalletEntries = pgTable(
  "sms_wallet_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: SMS_WALLET_ENTRY_KINDS }).notNull(),
    /** + qo'shildi, − yechildi (qismlar) */
    delta: integer("delta").notNull(),
    /** Eskiz xabar id si (send / refund) yoki so'rov id si (purchase) */
    ref: text("ref"),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("sms_wallet_entries_project_idx").on(t.projectId, t.createdAt.desc()),
    // Bitta xabar uchun qaytarish bir martadan ortiq bo'lmaydi
    index("sms_wallet_entries_ref_idx").on(t.ref),
    check("sms_wallet_entries_delta_nonzero", sql`${t.delta} <> 0`),
  ],
);

export const SMS_PURCHASE_STATUSES = ["pending", "paid", "cancelled"] as const;

export const smsPurchaseRequests = pgTable(
  "sms_purchase_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    packageId: uuid("package_id").references(() => smsPackages.id, { onDelete: "set null" }),
    /** So'rov paytidagi paket qiymatlari (paket keyin o'zgarsa ham) */
    packageName: text("package_name").notNull(),
    parts: integer("parts").notNull(),
    price: integer("price").notNull(),
    status: text("status", { enum: SMS_PURCHASE_STATUSES }).notNull().default("pending"),
    /** Markazda kim so'radi (xodim ismi) */
    requestedBy: text("requested_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: uuid("decided_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("sms_purchase_requests_status_idx").on(t.status, t.createdAt.desc()),
    index("sms_purchase_requests_project_idx").on(t.projectId, t.createdAt.desc()),
  ],
);

/**
 * Relay orqali ketgan xabarlar: qancha qism band qilingani va yakuniy holati. Yetkazilmasa band qilingan qismlar bir
 * marta qaytariladi; Eskiz haqiqiy qism sonini aytsa farqi tuzatiladi.
 */
export const SMS_RELAY_STATUSES = ["sent", "delivered", "failed"] as const;

export const smsRelayMessages = pgTable(
  "sms_relay_messages",
  {
    providerId: text("provider_id").primaryKey(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    parts: integer("parts").notNull(),
    status: text("status", { enum: SMS_RELAY_STATUSES }).notNull().default("sent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
  },
  (t) => [index("sms_relay_messages_project_idx").on(t.projectId, t.createdAt.desc())],
);
