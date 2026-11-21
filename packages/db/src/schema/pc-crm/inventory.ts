import { bigint, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { products, productVariants } from "./catalog";
import { timestamps } from "./columns";

export const PURCHASE_TYPES = ["piece", "bulk"] as const;
export type PurchaseType = (typeof PURCHASE_TYPES)[number];

export const STOCK_MOVEMENT_REASONS = ["purchase", "sale", "reserve", "release", "return", "adjust"] as const;
export type StockMovementReason = (typeof STOCK_MOVEMENT_REASONS)[number];

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    type: text("type", { enum: PURCHASE_TYPES }).notNull().default("piece"),
    qty: integer("qty").notNull(),
    /** Jami xarajat so'mda */
    totalCost: bigint("total_cost", { mode: "bigint" }).notNull(),
    /** Dona tannarxi (optomda: totalCost / qty) */
    unitCost: bigint("unit_cost", { mode: "bigint" }).notNull(),
    supplier: text("supplier"),
    note: text("note"),
    purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("purchases_product_id_idx").on(t.productId), index("purchases_purchased_at_idx").on(t.purchasedAt)],
);

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    /** Qoldiq o'zgarishi: + yoki - */
    delta: integer("delta").notNull(),
    reason: text("reason", { enum: STOCK_MOVEMENT_REASONS }).notNull(),
    refType: text("ref_type"), // 'purchase', 'order', 'pc_build', 'manual'
    refId: uuid("ref_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movements_product_id_idx").on(t.productId),
    index("stock_movements_created_at_idx").on(t.createdAt),
  ],
);
