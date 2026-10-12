import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";

/*
 * O'quv jarayoni ma'lumotnomalari (EDU-CRM-PLAN E1): kurslar va xonalar. Pul so'mda, butun son.
 * `branch_id` bo'sh — markaz bo'yicha umumiy (hamma filialda ko'rinadi), eski tizimdagidek.
 * Filialga havola (tenant_id, branch_id) juftligi bilan: oddiy FK RLS'ni chetlab o'tardi (ADR 0006),
 * kompozit kalit esa boshqa mijoz filialiga bog'lashni bazaning o'zida taqiqlaydi.
 */

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id"),
    name: text("name").notNull(),
    /** Baza narxi (oyiga), so'm; guruh o'z narxini qo'ymasa shu olinadi */
    price: bigint("price", { mode: "number" }).notNull().default(0),
    durationMonths: integer("duration_months").notNull().default(0),
    color: text("color").notNull().default("#6366f1"),
    /** Arxivga o'tgan vaqt: ro'yxatda ko'rinmaydi, Arxiv bo'limidan tiklanadi */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("courses_branch_idx").on(t.branchId),
    foreignKey({
      name: "courses_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    check("courses_price_nonneg", sql`${t.price} >= 0`),
    check("courses_duration_nonneg", sql`${t.durationMonths} >= 0`),
    check("courses_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    tenantPolicy("courses"),
  ],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id"),
    name: text("name").notNull(),
    /** O'quvchi o'rinlari soni (1–200) */
    capacity: integer("capacity").notNull().default(20),
    ...timestamps,
  },
  (t) => [
    index("rooms_branch_idx").on(t.branchId),
    foreignKey({
      name: "rooms_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    check("rooms_capacity_range", sql`${t.capacity} between 1 and 200`),
    tenantPolicy("rooms"),
  ],
);
