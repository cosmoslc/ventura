import { sql } from "drizzle-orm";
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { products, productVariants } from "./catalog";
import { timestamps } from "./columns";
import { pcBuilds } from "./pc";

export const ORDER_STATUSES = [
  "new",
  "confirmed",
  "shipping",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_PROVIDERS = [
  "cod_operator",
  "mock",
  "click",
  "payme",
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const SALE_SOURCES = ["site", "offline"] as const;
export type SaleSource = (typeof SALE_SOURCES)[number];

export const SALE_TYPES = ["product", "pc"] as const;
export type SaleType = (typeof SALE_TYPES)[number];

// Savat
export const carts = pgTable("carts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").unique().references(() => users.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    pcId: uuid("pc_id").references(() => pcBuilds.id, { onDelete: "cascade" }),
    qty: integer("qty").notNull().default(1),
    ...timestamps,
  },
  (t) => [index("cart_items_cart_id_idx").on(t.cartId)]
);

// Buyurtmalar
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull().unique(), // e.g. "ORD-1001"
    userId: uuid("user_id").references(() => users.id),
    status: text("status", { enum: ORDER_STATUSES }).notNull().default("new"),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    region: text("region"),
    address: text("address"),
    lat: numeric("lat", { precision: 10, scale: 7 }),
    lng: numeric("lng", { precision: 10, scale: 7 }),
    subtotal: bigint("subtotal", { mode: "bigint" }).notNull(),
    shipping: bigint("shipping", { mode: "bigint" }).notNull().default(sql`0`),
    discount: bigint("discount", { mode: "bigint" }).notNull().default(sql`0`),
    tax: bigint("tax", { mode: "bigint" }).notNull().default(sql`0`),
    total: bigint("total", { mode: "bigint" }).notNull(),
    paymentMethod: text("payment_method", { enum: PAYMENT_PROVIDERS }).notNull().default("cod_operator"),
    note: text("note"),
    ...timestamps,
  },
  (t) => [
    index("orders_user_id_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_created_at_idx").on(t.createdAt),
  ]
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    pcId: uuid("pc_id").references(() => pcBuilds.id),
    nameSnapshot: text("name_snapshot").notNull(),
    priceSnapshot: bigint("price_snapshot", { mode: "bigint" }).notNull(),
    costSnapshot: bigint("cost_snapshot", { mode: "bigint" }).notNull(),
    qty: integer("qty").notNull(),
    ...timestamps,
  },
  (t) => [index("order_items_order_id_idx").on(t.orderId)]
);

// To'lovlar
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    provider: text("provider", { enum: PAYMENT_PROVIDERS }).notNull(),
    status: text("status", { enum: PAYMENT_STATUSES }).notNull().default("pending"),
    amount: bigint("amount", { mode: "bigint" }).notNull(),
    currency: text("currency").notNull().default("UZS"),
    externalId: text("external_id").unique(),
    rawPayload: jsonb("raw_payload"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("payments_order_id_idx").on(t.orderId)]
);

// Sotuvlar (Sof foyda jurnali)
export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source", { enum: SALE_SOURCES }).notNull(),
    type: text("type", { enum: SALE_TYPES }).notNull(),
    orderId: uuid("order_id").references(() => orders.id),
    buyerName: text("buyer_name").notNull(),
    buyerPhone: text("buyer_phone").notNull(),
    soldAt: timestamp("sold_at", { withTimezone: true }).notNull().defaultNow(),
    total: bigint("total", { mode: "bigint" }).notNull(),
    costTotal: bigint("cost_total", { mode: "bigint" }).notNull(),
    profit: bigint("profit", { mode: "bigint" }).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index("sales_sold_at_idx").on(t.soldAt), index("sales_source_idx").on(t.source)]
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id),
    pcId: uuid("pc_id").references(() => pcBuilds.id),
    variantId: uuid("variant_id").references(() => productVariants.id),
    nameSnapshot: text("name_snapshot").notNull(),
    qty: integer("qty").notNull(),
    listPrice: bigint("list_price", { mode: "bigint" }).notNull(),
    soldPrice: bigint("sold_price", { mode: "bigint" }).notNull(),
    costSnapshot: bigint("cost_snapshot", { mode: "bigint" }).notNull(),
    profit: bigint("profit", { mode: "bigint" }).notNull(),
    ...timestamps,
  },
  (t) => [index("sale_items_sale_id_idx").on(t.saleId)]
);
