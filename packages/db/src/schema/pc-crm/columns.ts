import { timestamp } from "drizzle-orm/pg-core";

/*
 * PC-CRM dedicated schema ustunlari.
 * Dedicated (Silo) model bo'lgani sababli `tenant_id` va RLS siyosatlari kerak emas.
 */

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
