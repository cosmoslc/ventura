import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { notifications } from "@ventura/db/schema/tenant";
import type { NotificationItem } from "@/lib/notifications";

/*
 * Bildirishnomalarni o'qish (E6d): faqat xodimning o'z qatorlari — har so'rov `user_id` bo'yicha cheklanadi
 * (RLS faqat mijozni ajratadi, xodimlar orasidagi chegara shu yerda).
 */

export async function unreadCount(db: TenantDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

export async function listNotifications(
  db: TenantDb,
  userId: string,
  opts: { limit: number; unreadOnly?: boolean },
): Promise<NotificationItem[]> {
  const rows = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), opts.unreadOnly ? isNull(notifications.readAt) : undefined))
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit);
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    href: r.href,
    createdAt: r.createdAt.toISOString(),
    read: r.readAt !== null,
  }));
}

/** Tanlanganlarni o'qilgan qiladi (faqat o'zinikini); o'zgargan qatorlar soni */
export async function markRead(db: TenantDb, userId: string, ids: readonly string[]): Promise<number> {
  if (!ids.length) return 0;
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), inArray(notifications.id, [...ids]), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}

export async function markAllRead(db: TenantDb, userId: string): Promise<number> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
}
