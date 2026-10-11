import { sql } from "drizzle-orm";
import { pgPolicy, text, timestamp } from "drizzle-orm/pg-core";

/*
 * Har mijoz jadvali uchun umumiy ustunlar (EDU-CRM-PLAN 4-bo'lim, 9-tamoyil).
 *
 * tenant_id qo'lda yozilmaydi: ulanish ochilganda `app.tenant_id` parametri qo'yiladi (createTenantDb),
 * ustun standart qiymatni shundan oladi, RLS siyosati esa faqat shu mijoz qatorlarini ko'rsatadi va
 * boshqa mijoz nomidan yozishga yo'l qo'ymaydi. Parametr qo'yilmagan ulanish hech narsa ko'rmaydi va yoza olmaydi.
 */

export const TENANT_SETTING = "app.tenant_id";

export const tenantId = () =>
  text("tenant_id")
    .notNull()
    .default(sql`current_setting('app.tenant_id')`);

/** Faqat joriy ulanish mijozining qatorlari: o'qish, yozish, o'zgartirish, o'chirish. */
export const tenantPolicy = (table: string) =>
  pgPolicy(`${table}_tenant_isolation`, {
    as: "permissive",
    for: "all",
    to: "public",
    using: sql`tenant_id = current_setting('app.tenant_id', true)`,
    withCheck: sql`tenant_id = current_setting('app.tenant_id', true)`,
  });

export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
