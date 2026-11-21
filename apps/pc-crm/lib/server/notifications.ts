import "server-only";
import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { notifications, userNotifications } from "@ventura/db/schema/pc-crm";
import { getDb } from "@/lib/db";

export interface DbNotificationItem {
  id: string;
  type: "discount" | "order" | "new_product" | "system" | string;
  title: string;
  message: string;
  link?: string;
  createdAt: string;
  isRead: boolean;
}

const DEFAULT_SEEDS = [
  {
    type: "discount",
    title: "Katta kuzgi chegirmalar!",
    body: "Barcha GeForce RTX 4070 Ti SUPER videokartalariga 10% gacha maxsus chegirma eʼlon qilindi.",
    link: "/products?q=4070",
  },
  {
    type: "new_product",
    title: "Yangi avlod PC yigʻildi",
    body: "Gaming Titan tayyor kompyuterlar qatoriga qoʻshildi.",
    link: "/computers/ventura-gaming-titan-i7-4070",
  },
  {
    type: "order",
    title: "Buyurtmalar holati yangilandi",
    body: "Xaridlaringiz holatini shaxsiy kabinetingizda kuzatib borishingiz mumkin.",
    link: "/profile/orders",
  },
  {
    type: "system",
    title: "Kafolat va bepul servis",
    body: "Ventura PC doʻkonidan xarid qilingan barcha kompyuterlarga 1 yillik bepul profilaktika va changdan tozalash xizmati taqdim etiladi.",
    link: "/faq",
  },
];

/** Agar jadval bo'sh bo'lsa, birlamchi do'kon bildirishnomalarini bazaga yozish */
async function ensureSeededNotifications() {
  const db = getDb();
  const existing = await db.select({ id: notifications.id }).from(notifications).limit(1);
  if (existing.length === 0) {
    for (const s of DEFAULT_SEEDS) {
      await db.insert(notifications).values({
        type: s.type,
        title: s.title,
        body: s.body,
        link: s.link,
      });
    }
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 5) return "Hozirgina";
  if (diffMins < 60) return `${diffMins} daqiqa oldin`;
  if (diffHours < 24) return `${diffHours} soat oldin`;
  if (diffDays === 1) return "Kecha";
  if (diffDays < 7) return `${diffDays} kun oldin`;
  return date.toLocaleDateString("uz-UZ");
}

export async function getDbNotifications(userId?: string): Promise<{
  notifications: DbNotificationItem[];
  unreadCount: number;
}> {
  await ensureSeededNotifications();
  const db = getDb();

  const allRows = await db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(20);

  let readMap = new Map<string, boolean>();

  if (userId) {
    const userReads = await db
      .select({
        notificationId: userNotifications.notificationId,
        readAt: userNotifications.readAt,
      })
      .from(userNotifications)
      .where(and(eq(userNotifications.userId, userId), isNotNull(userNotifications.readAt)));

    for (const r of userReads) {
      if (r.readAt) {
        readMap.set(r.notificationId, true);
      }
    }
  }

  const items: DbNotificationItem[] = allRows.map((row) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.body,
    link: row.link ?? undefined,
    createdAt: formatRelativeTime(row.createdAt),
    isRead: readMap.get(row.id) ?? false,
  }));

  const unreadCount = items.filter((i) => !i.isRead).length;

  return {
    notifications: items,
    unreadCount,
  };
}

export async function markDbNotificationAsRead(notificationId: string, userId: string) {
  const db = getDb();

  const [existing] = await db
    .select({ id: userNotifications.id })
    .from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), eq(userNotifications.notificationId, notificationId)))
    .limit(1);

  if (existing) {
    await db.update(userNotifications).set({ readAt: new Date() }).where(eq(userNotifications.id, existing.id));
  } else {
    await db.insert(userNotifications).values({
      userId,
      notificationId,
      readAt: new Date(),
    });
  }
}

export async function markAllDbNotificationsAsRead(userId: string) {
  const db = getDb();
  const all = await db.select({ id: notifications.id }).from(notifications);

  for (const n of all) {
    await markDbNotificationAsRead(n.id, userId);
  }
}

export async function createDbNotification(input: { type: string; title: string; body: string; link?: string }) {
  const db = getDb();
  const [created] = await db
    .insert(notifications)
    .values({
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    })
    .returning();
  return created;
}
