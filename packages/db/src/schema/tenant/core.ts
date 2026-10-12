import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/* ---------- Filiallar ---------- */

/**
 * Markaz filiallari. Bitta filialli markazda ham bitta qator bo'ladi: keyingi bo'limlar (guruh, to'lov)
 * doim filialga bog'lanadi, ko'p filialli rejim (`branches` bo'limi) yoqilganda faqat tanlov paydo bo'ladi.
 */
export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    address: text("address"),
    phone: text("phone"),
    /** Filial belgisi rangi (#rrggbb) — menyu, kartochka va filial tanlovida */
    color: text("color").notNull().default("#6366f1"),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    unique("branches_tenant_name_uq").on(t.tenantId, t.name),
    /** Boshqa jadvallar filialga (tenant_id, id) juftligi bilan bog'lanadi — boshqa mijoz filialiga havola bo'lmaydi */
    unique("branches_tenant_id_uq").on(t.tenantId, t.id),
    check("branches_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    tenantPolicy("branches"),
  ],
);

/** Xodim ishlaydigan filiallar. Direktor hammasini ko'radi; qolgan rollar faqat shu ro'yxatdagilarni. */
export const userBranches = pgTable(
  "user_branches",
  {
    tenantId: tenantId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] }), tenantPolicy("user_branches")],
);

/* ---------- Markaz sozlamalari ---------- */

export const settings = pgTable(
  "settings",
  {
    tenantId: tenantId(),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.key] }), tenantPolicy("settings")],
);

/* ---------- Faoliyat jurnali (o'chmas, xesh zanjiri — har mijozning o'z zanjiri) ---------- */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    seq: bigserial("seq", { mode: "number" }).notNull().unique(),
    at: timestamp("at", { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id"),
    actorName: text("actor_name"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    prevHash: text("prev_hash"),
    hash: text("hash").notNull(),
  },
  (t) => [
    index("audit_events_tenant_seq_idx").on(t.tenantId, t.seq),
    index("audit_events_target_idx").on(t.targetType, t.targetId),
    tenantPolicy("audit_events"),
  ],
);
