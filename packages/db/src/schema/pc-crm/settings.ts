import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const settings = pgTable("settings", {
  /**
   * Sozlama kaliti:
   * 'usd_rate', 'tax_percent', 'free_shipping_from', 'store_contacts', 'branding', 'modules'
   */
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const shippingRates = pgTable("shipping_rates", {
  region: text("region").primaryKey(), // Masalan: 'Toshkent shahri', 'Samarqand', etc.
  price: bigint("price", { mode: "bigint" }).notNull().default(sql`0`),
  estimatedDays: text("estimated_days").default("1-3 kun"),
  enabled: boolean("enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const adminAuditLogs = pgTable(
  "admin_audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(), // 'product.create', 'sale.void', 'order.status_change'
    entity: text("entity").notNull(), // 'product', 'order', 'purchase', 'sale', 'pc_build'
    entityId: text("entity_id"),
    diff: jsonb("diff"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("admin_audit_logs_user_id_idx").on(t.userId),
    index("admin_audit_logs_entity_idx").on(t.entity),
    index("admin_audit_logs_created_at_idx").on(t.createdAt),
  ]
);
