import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy } from "./columns";

/*
 * Ichki bildirishnomalar (EDU-CRM-PLAN E6d, ADR 0039): xodimga yoziladigan qisqa xabar. Qabul qiluvchi (`user_id`)
 * yozilganda aniqlanadi — filial va ruxsat qoidalari yozish vaqtida tekshiriladi (lib/server/notify.ts), o'qishda
 * faqat o'z qatorlari ko'rinadi (so'rovlar `user_id` bo'yicha). Telegram yuborish yo'q.
 */

export const NOTIFICATION_KINDS = ["lead_apply", "lead_assigned", "approval_request", "approval_decided"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    /** Qabul qiluvchi xodim */
    userId: uuid("user_id").notNull(),
    kind: text("kind", { enum: NOTIFICATION_KINDS }).notNull(),
    title: text("title").notNull(),
    body: text("body"),
    /** Bosilganda ochiladigan ichki manzil (`/leads/...`) */
    href: text("href"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    index("notifications_user_created_idx").on(t.userId, t.createdAt.desc()),
    // O'qilmaganlar soni — qo'ng'iroq har daqiqa so'raydi
    index("notifications_user_unread_idx")
      .on(t.userId)
      .where(sql`${t.readAt} is null`),
    foreignKey({
      name: "notifications_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("cascade"),
    check("notifications_title_len", sql`length(${t.title}) between 1 and 200`),
    check("notifications_body_len", sql`${t.body} is null or length(${t.body}) <= 500`),
    check("notifications_href_local", sql`${t.href} is null or ${t.href} like '/%'`),
    tenantPolicy("notifications"),
  ],
);
