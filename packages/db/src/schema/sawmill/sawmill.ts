import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";

/* =========================================================================
   1. ISHCHILAR VA ISH HAQI
   ========================================================================= */

export const WORKER_SALARY_TYPES = ["piecework", "daily", "weekly", "monthly"] as const;
export type WorkerSalaryType = (typeof WORKER_SALARY_TYPES)[number];

export const workers = pgTable(
  "workers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    phone: text("phone"),
    salaryType: text("salary_type", { enum: WORKER_SALARY_TYPES }).notNull().default("piecework"),
    wageAmount: bigint("wage_amount", { mode: "number" }).notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("workers_tenant_id_uq").on(t.tenantId, t.id),
    check("workers_wage_amount_nonneg", sql`${t.wageAmount} >= 0`),
    tenantPolicy("workers"),
  ],
);

/* =========================================================================
   2. ISH TURLARI
   ========================================================================= */

export const WORK_TYPE_KINDS = ["regular", "sorting"] as const;
export type WorkTypeKind = (typeof WORK_TYPE_KINDS)[number];

export const workTypes = pgTable(
  "work_types",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    kind: text("kind", { enum: WORK_TYPE_KINDS }).notNull().default("regular"),
    isSystem: boolean("is_system").notNull().default(false),
    ...timestamps,
  },
  (t) => [
    unique("work_types_tenant_name_uq").on(t.tenantId, t.name),
    unique("work_types_tenant_id_uq").on(t.tenantId, t.id),
    tenantPolicy("work_types"),
  ],
);

/* =========================================================================
   3. MATERIALLAR VA O'LCHAMLAR
   ========================================================================= */

export const PRICING_MODES = ["piece", "row"] as const;
export type PricingMode = (typeof PRICING_MODES)[number];

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("dona"),
    pricingMode: text("pricing_mode", { enum: PRICING_MODES }).notNull().default("piece"),
    thicknessCm: numeric("thickness_cm", { precision: 8, scale: 2 }),
    widthCm: numeric("width_cm", { precision: 8, scale: 2 }),
    lengthCm: numeric("length_cm", { precision: 8, scale: 2 }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("materials_tenant_name_uq").on(t.tenantId, t.name),
    unique("materials_tenant_id_uq").on(t.tenantId, t.id),
    tenantPolicy("materials"),
  ],
);

export const materialSizes = pgTable(
  "material_sizes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    thicknessCm: numeric("thickness_cm", { precision: 8, scale: 2 }).notNull(),
    widthCm: numeric("width_cm", { precision: 8, scale: 2 }).notNull(),
    lengthCm: numeric("length_cm", { precision: 8, scale: 2 }).notNull(),
    ...timestamps,
  },
  (t) => [
    unique("material_sizes_tenant_id_uq").on(t.tenantId, t.id),
    index("material_sizes_material_idx").on(t.materialId),
    tenantPolicy("material_sizes"),
  ],
);

/* =========================================================================
   4. TERAKLAR (YOG'OCH PARTIYASI)
   ========================================================================= */

export const teraks = pgTable(
  "teraks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    purchasePrice: bigint("purchase_price", { mode: "number" }).notNull().default(0),
    note: text("note"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("teraks_tenant_name_uq").on(t.tenantId, t.name),
    unique("teraks_tenant_id_uq").on(t.tenantId, t.id),
    check("teraks_purchase_price_nonneg", sql`${t.purchasePrice} >= 0`),
    tenantPolicy("teraks"),
  ],
);

/* Terak materiallari ombori va narxlari */
export const terakMaterials = pgTable(
  "terak_materials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id")
      .notNull()
      .references(() => teraks.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    /** Qoldiq (kesh) — har doim stock_movements orqali yangilanadi */
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull().default("0"),
    workerPrice: bigint("worker_price", { mode: "number" }).notNull().default(0),
    sellingPrice: bigint("selling_price", { mode: "number" }).notNull().default(0),
    cubeWorkerPrice: bigint("cube_worker_price", { mode: "number" }).notNull().default(0),
    cubePrice: bigint("cube_price", { mode: "number" }).notNull().default(0),
    goal: numeric("goal", { precision: 14, scale: 4 }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("terak_materials_uq").on(t.tenantId, t.terakId, t.materialId),
    index("terak_materials_terak_idx").on(t.terakId),
    tenantPolicy("terak_materials"),
  ],
);

/* Ombor harakatlari jurnali */
export const STOCK_MOVEMENT_SOURCES = ["work", "dispatch", "adjust"] as const;
export type StockMovementSource = (typeof STOCK_MOVEMENT_SOURCES)[number];

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id")
      .notNull()
      .references(() => teraks.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    sizeId: uuid("size_id").references(() => materialSizes.id, { onDelete: "set null" }),
    delta: numeric("delta", { precision: 14, scale: 4 }).notNull(),
    source: text("source", { enum: STOCK_MOVEMENT_SOURCES }).notNull(),
    sourceId: uuid("source_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("stock_movements_terak_material_idx").on(t.terakId, t.materialId), tenantPolicy("stock_movements")],
);

/* Ishchiga maxsus material narxi (barcha teraklar uchun) */
export const workerMaterialPrices = pgTable(
  "worker_material_prices",
  {
    tenantId: tenantId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    price: bigint("price", { mode: "number" }).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.workerId, t.materialId] }), tenantPolicy("worker_material_prices")],
);

/* =========================================================================
   5. KUNLIK ISHLAR VA GURUHLAR
   ========================================================================= */

export const WORK_PAY_UNITS = ["piece", "row", "cube"] as const;
export type WorkPayUnit = (typeof WORK_PAY_UNITS)[number];

export const workGroups = pgTable(
  "work_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id").references(() => teraks.id, { onDelete: "set null" }),
    workTypeId: uuid("work_type_id").references(() => workTypes.id, { onDelete: "set null" }),
    date: date("date", { mode: "string" }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    payFullToEach: boolean("pay_full_to_each").notNull().default(false),
    materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    rows: numeric("rows", { precision: 14, scale: 4 }),
    payUnit: text("pay_unit", { enum: WORK_PAY_UNITS }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    unique("work_groups_tenant_id_uq").on(t.tenantId, t.id),
    index("work_groups_terak_idx").on(t.terakId),
    tenantPolicy("work_groups"),
  ],
);

export const WORK_ENTRY_KINDS = ["regular", "material"] as const;
export type WorkEntryKind = (typeof WORK_ENTRY_KINDS)[number];

export const workEntries = pgTable(
  "work_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    terakId: uuid("terak_id").references(() => teraks.id, { onDelete: "set null" }),
    workTypeId: uuid("work_type_id").references(() => workTypes.id, { onDelete: "set null" }),
    kind: text("kind", { enum: WORK_ENTRY_KINDS }).notNull().default("regular"),
    groupId: uuid("group_id").references(() => workGroups.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    materialId: uuid("material_id").references(() => materials.id, { onDelete: "set null" }),
    sizeId: uuid("size_id").references(() => materialSizes.id, { onDelete: "set null" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }),
    rows: numeric("rows", { precision: 14, scale: 4 }),
    payUnit: text("pay_unit", { enum: WORK_PAY_UNITS }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    unique("work_entries_tenant_id_uq").on(t.tenantId, t.id),
    index("work_entries_worker_idx").on(t.workerId),
    index("work_entries_terak_idx").on(t.terakId),
    index("work_entries_date_idx").on(t.date),
    tenantPolicy("work_entries"),
  ],
);

/* Maosh hisoblash yozuvlari (K1) */
export const wageAccruals = pgTable(
  "wage_accruals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    units: numeric("units", { precision: 8, scale: 2 }).notNull(),
    rate: bigint("rate", { mode: "number" }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    terakId: uuid("terak_id").references(() => teraks.id, { onDelete: "set null" }),
    workEntryId: uuid("work_entry_id").references(() => workEntries.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    unique("wage_accruals_period_uq").on(t.tenantId, t.workerId, t.periodStart, t.periodEnd),
    tenantPolicy("wage_accruals"),
  ],
);

/* Ishchilarga to'lovlar */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    workerId: uuid("worker_id")
      .notNull()
      .references(() => workers.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("payments_worker_idx").on(t.workerId),
    index("payments_date_idx").on(t.date),
    check("payments_amount_pos", sql`${t.amount} > 0`),
    tenantPolicy("payments"),
  ],
);

/* =========================================================================
   6. YUK MASHINALARI VA YUK CHIQARISH (SOTUV)
   ========================================================================= */

export const trucks = pgTable(
  "trucks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull().default(0),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("trucks_tenant_name_uq").on(t.tenantId, t.name),
    unique("trucks_tenant_id_uq").on(t.tenantId, t.id),
    check("trucks_amount_nonneg", sql`${t.amount} >= 0`),
    tenantPolicy("trucks"),
  ],
);

export const dispatches = pgTable(
  "dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id")
      .notNull()
      .references(() => teraks.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    enteredUnit: text("entered_unit", { enum: ["piece", "cube"] })
      .notNull()
      .default("piece"),
    enteredQty: numeric("entered_qty", { precision: 14, scale: 4 }).notNull(),
    totalAmount: bigint("total_amount", { mode: "number" }).notNull().default(0),
    date: date("date", { mode: "string" }).notNull(),
    recipientName: text("recipient_name"),
    address: text("address"),
    phone: text("phone"),
    truckId: uuid("truck_id").references(() => trucks.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("dispatches_tenant_id_uq").on(t.tenantId, t.id),
    index("dispatches_terak_idx").on(t.terakId),
    index("dispatches_date_idx").on(t.date),
    check("dispatches_quantity_pos", sql`${t.quantity} > 0`),
    tenantPolicy("dispatches"),
  ],
);

/* Terak xarajatlari (K5: yuk mashinasi xarajati ham shu yerga yoziladi) */
export const TERAK_COST_KINDS = ["transport", "res", "truck", "other"] as const;
export type TerakCostKind = (typeof TERAK_COST_KINDS)[number];

export const terakCosts = pgTable(
  "terak_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id")
      .notNull()
      .references(() => teraks.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: TERAK_COST_KINDS }).notNull().default("other"),
    title: text("title"),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    trips: integer("trips"),
    pricePerTrip: bigint("price_per_trip", { mode: "number" }),
    dispatchId: uuid("dispatch_id").references(() => dispatches.id, { onDelete: "cascade" }),
    truckId: uuid("truck_id").references(() => trucks.id, { onDelete: "set null" }),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("terak_costs_terak_idx").on(t.terakId),
    check("terak_costs_amount_nonneg", sql`${t.amount} >= 0`),
    tenantPolicy("terak_costs"),
  ],
);

/* Zakazlar */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    terakId: uuid("terak_id")
      .notNull()
      .references(() => teraks.id, { onDelete: "cascade" }),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id, { onDelete: "cascade" }),
    quantity: numeric("quantity", { precision: 14, scale: 4 }).notNull(),
    customerName: text("customer_name").notNull(),
    phone: text("phone"),
    address: text("address"),
    dueDate: date("due_date", { mode: "string" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    readyNotifiedAt: timestamp("ready_notified_at", { withTimezone: true }),
    dueNotifiedAt: timestamp("due_notified_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index("orders_terak_idx").on(t.terakId),
    check("orders_quantity_pos", sql`${t.quantity} > 0`),
    tenantPolicy("orders"),
  ],
);

/* =========================================================================
   7. UMUMIY XARAJATLAR (K14)
   ========================================================================= */

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique("expense_categories_tenant_name_uq").on(t.tenantId, t.name), tenantPolicy("expense_categories")],
);

export const generalExpenses = pgTable(
  "general_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id, { onDelete: "cascade" }),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("general_expenses_category_idx").on(t.categoryId),
    index("general_expenses_date_idx").on(t.date),
    check("general_expenses_amount_pos", sql`${t.amount} > 0`),
    tenantPolicy("general_expenses"),
  ],
);
