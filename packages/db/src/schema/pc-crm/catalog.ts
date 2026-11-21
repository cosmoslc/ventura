import { sql } from "drizzle-orm";
import { bigint, boolean, index, integer, jsonb, numeric, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns";

export interface I18nText {
  uz: string;
  ru?: string;
  en?: string;
}

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: jsonb("name").$type<I18nText>().notNull(),
    slug: text("slug").notNull().unique(),
    iconUrl: text("icon_url"),
    parentId: uuid("parent_id"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("categories_parent_id_idx").on(t.parentId), index("categories_sort_idx").on(t.sort)],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logoUrl: text("logo_url"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("brands_sort_idx").on(t.sort)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id),
    brandId: uuid("brand_id").references(() => brands.id),
    sku: text("sku").unique(),
    name: jsonb("name").$type<I18nText>().notNull(),
    desc: jsonb("desc").$type<I18nText>(),
    /** Tannarx so'mda (UZS) */
    costPrice: bigint("cost_price", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    /** Sotuv narxi so'mda (UZS) */
    sellPrice: bigint("sell_price", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    discountPercent: integer("discount_percent").notNull().default(0),
    /** Haqiqiy jismoniy qoldiq */
    stock: integer("stock").notNull().default(0),
    /** PC'lar yoki to'lov kutilayotgan buyurtmalar uchun zaxira */
    reserved: integer("reserved").notNull().default(0),
    minStock: integer("min_stock").notNull().default(2),
    isNew: boolean("is_new").notNull().default(true),
    isHit: boolean("is_hit").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    ratingAvg: numeric("rating_avg", { precision: 3, scale: 2 }).notNull().default("0.00"),
    ratingCount: integer("rating_count").notNull().default(0),
    soldCount: integer("sold_count").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("products_category_id_idx").on(t.categoryId),
    index("products_brand_id_idx").on(t.brandId),
    index("products_is_active_idx").on(t.isActive),
    index("products_is_hit_idx").on(t.isHit),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    colorName: text("color_name").notNull(),
    colorHex: text("color_hex").notNull(),
    sku: text("sku"),
    stock: integer("stock").notNull().default(0),
    reserved: integer("reserved").notNull().default(0),
    price: bigint("price", { mode: "bigint" }),
    ...timestamps,
  },
  (t) => [index("product_variants_product_id_idx").on(t.productId)],
);

export const productImages = pgTable(
  "product_images",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("product_images_product_id_idx").on(t.productId)],
);

export const productSpecs = pgTable(
  "product_specs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    title: jsonb("title").$type<I18nText>().notNull(),
    value: jsonb("value").$type<I18nText>().notNull(),
    filterable: boolean("filterable").notNull().default(false),
    helpTitle: jsonb("help_title").$type<I18nText>(),
    helpText: jsonb("help_text").$type<I18nText>(),
    ...timestamps,
  },
  (t) => [index("product_specs_product_id_idx").on(t.productId)],
);
