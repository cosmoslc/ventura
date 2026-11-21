import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { type I18nText, products } from "./catalog";
import { timestamps } from "./columns";
import { orderItems } from "./orders";
import { pcBuilds } from "./pc";

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    pcId: uuid("pc_id").references(() => pcBuilds.id, { onDelete: "cascade" }),
    orderItemId: uuid("order_item_id").references(() => orderItems.id),
    rating: integer("rating").notNull(), // 1..5
    text: text("text").notNull(),
    ...timestamps,
  },
  (t) => [
    index("reviews_product_id_idx").on(t.productId),
    index("reviews_pc_id_idx").on(t.pcId),
    index("reviews_user_id_idx").on(t.userId),
  ],
);

export const favorites = pgTable(
  "favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    pcId: uuid("pc_id").references(() => pcBuilds.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [
    index("favorites_user_id_idx").on(t.userId),
    unique("favorites_user_product_uq").on(t.userId, t.productId),
    unique("favorites_user_pc_uq").on(t.userId, t.pcId),
  ],
);

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: text("type").notNull(), // 'promo', 'order', 'system'
  title: text("title").notNull(),
  body: text("body").notNull(),
  link: text("link"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userNotifications = pgTable(
  "user_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => notifications.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("user_notifications_user_id_idx").on(t.userId)],
);

export const faqCategories = pgTable("faq_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: jsonb("name").$type<I18nText>().notNull(),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const faqs = pgTable(
  "faqs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => faqCategories.id, { onDelete: "cascade" }),
    question: jsonb("question").$type<I18nText>().notNull(),
    answer: jsonb("answer").$type<I18nText>().notNull(),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [index("faqs_category_id_idx").on(t.categoryId)],
);

export const heroSlides = pgTable("hero_slides", {
  id: uuid("id").primaryKey().defaultRandom(),
  imageUrl: text("image_url").notNull(),
  title: jsonb("title").$type<I18nText>(),
  subtitle: jsonb("subtitle").$type<I18nText>(),
  link: text("link"),
  sort: integer("sort").notNull().default(0),
  position: text("position").notNull().default("hero"), // 'hero', 'banner_1', 'banner_2'
  ...timestamps,
});

export const homeSections = pgTable("home_sections", {
  key: text("key").primaryKey(), // 'categories', 'new_arrivals', 'best_sellers', 'pc_builds', etc.
  title: jsonb("title").$type<I18nText>(),
  enabled: boolean("enabled").notNull().default(true),
  sort: integer("sort").notNull().default(0),
  ...timestamps,
});

export const searchStats = pgTable("search_stats", {
  term: text("term").primaryKey(),
  targetType: text("target_type"), // 'category', 'brand', 'product'
  targetId: uuid("target_id"),
  count: integer("count").notNull().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
