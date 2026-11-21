import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { type I18nText, products, productVariants } from "./catalog";
import { timestamps } from "./columns";

export const PC_BUILD_STATUSES = ["available", "sold", "hidden"] as const;
export type PcBuildStatus = (typeof PC_BUILD_STATUSES)[number];

export const PC_COMPONENT_ROLES = [
  "cpu",
  "gpu",
  "ram",
  "ssd",
  "hdd",
  "motherboard",
  "psu",
  "case",
  "cooler",
  "monitor",
  "other",
] as const;
export type PcComponentRole = (typeof PC_COMPONENT_ROLES)[number];

export const PC_ORDER_STATUSES = [
  "new",
  "reviewing",
  "quoted",
  "confirmed",
  "assembling",
  "ready",
  "delivered",
  "cancelled",
] as const;
export type PcOrderStatus = (typeof PC_ORDER_STATUSES)[number];

export const pcBuilds = pgTable(
  "pc_builds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: jsonb("name").$type<I18nText>().notNull(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** Komponentlar tannarxlari yig'indisi (UZS) */
    costPrice: bigint("cost_price", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    /** Sotuv narxi (UZS) */
    sellPrice: bigint("sell_price", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    discountPercent: integer("discount_percent").notNull().default(0),
    status: text("status", { enum: PC_BUILD_STATUSES }).notNull().default("available"),
    buyerName: text("buyer_name"),
    buyerPhone: text("buyer_phone"),
    soldAt: timestamp("sold_at", { withTimezone: true }),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0.00"),
    ratingCount: integer("rating_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("pc_builds_status_idx").on(t.status)],
);

export const pcComponents = pgTable(
  "pc_components",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pcId: uuid("pc_id")
      .notNull()
      .references(() => pcBuilds.id, { onDelete: "cascade" }),
    role: text("role", { enum: PC_COMPONENT_ROLES }).notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    qty: integer("qty").notNull().default(1),
    /** Komponentning PC yig'ilgan paytdagi tannarx snapshot'i (UZS) */
    costSnapshot: bigint("cost_snapshot", { mode: "bigint" }).notNull(),
    ...timestamps,
  },
  (t) => [index("pc_components_pc_id_idx").on(t.pcId)],
);

export const pcSpecs = pgTable(
  "pc_specs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pcId: uuid("pc_id")
      .notNull()
      .references(() => pcBuilds.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: jsonb("title").$type<I18nText>().notNull(),
    value: jsonb("value").$type<I18nText>().notNull(),
    filterable: boolean("filterable").notNull().default(false),
    helpTitle: jsonb("help_title").$type<I18nText>(),
    helpText: jsonb("help_text").$type<I18nText>(),
    ...timestamps,
  },
  (t) => [index("pc_specs_pc_id_idx").on(t.pcId)],
);

export const pcOrders = pgTable(
  "pc_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    status: text("status", { enum: PC_ORDER_STATUSES }).notNull().default("new"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    address: text("address"),
    note: text("note"),
    /** Kelishilgan yakuniy narx (UZS) */
    quotedPrice: bigint("quoted_price", { mode: "bigint" }),
    convertedPcId: uuid("converted_pc_id").references(() => pcBuilds.id),
    ...timestamps,
  },
  (t) => [index("pc_orders_user_id_idx").on(t.userId), index("pc_orders_status_idx").on(t.status)],
);

export const pcOrderItems = pgTable(
  "pc_order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pcOrderId: uuid("pc_order_id")
      .notNull()
      .references(() => pcOrders.id, { onDelete: "cascade" }),
    role: text("role", { enum: PC_COMPONENT_ROLES }).notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    qty: integer("qty").notNull().default(1),
    ...timestamps,
  },
  (t) => [index("pc_order_items_pc_order_id_idx").on(t.pcOrderId)],
);
