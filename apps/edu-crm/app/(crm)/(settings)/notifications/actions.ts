"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BELL_LIMIT, type NotificationItem } from "@/lib/notifications";
import type { ActionResult } from "@/lib/server/action";
import { getTenantDb } from "@/lib/server/deps";
import { getStaff } from "@/lib/server/session";
import { currentTenant } from "@/lib/server/tenant";
import { uz } from "@/lib/uz";
import { listNotifications, markAllRead, markRead, unreadCount } from "./data";

/*
 * Bildirishnoma amallari (E6d). Bo'lim emas — har xodimga ochiq, `crmAction` o'rniga oddiy kirish tekshiruvi
 * (qo'ng'iroq har daqiqa so'raydi, jurnalga yozilmaydi: o'qilgan belgisi tarixiy ma'lumot emas).
 */

async function context() {
  const tenant = await currentTenant();
  if (!tenant) return null;
  const staff = await getStaff();
  if (!staff || staff.state !== "ok") return null;
  return { db: getTenantDb(tenant), staff };
}

/** Qo'ng'iroq: o'qilmaganlar soni (har daqiqa) */
export async function unreadCountAction(): Promise<ActionResult<{ count: number }>> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  return { ok: true, count: await unreadCount(c.db, c.staff.id) };
}

/** Qo'ng'iroq ochilganda: oxirgi 10 ta va o'qilmaganlar soni */
export async function latestNotificationsAction(): Promise<ActionResult<{ items: NotificationItem[]; count: number }>> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  const [items, count] = await Promise.all([
    listNotifications(c.db, c.staff.id, { limit: BELL_LIMIT }),
    unreadCount(c.db, c.staff.id),
  ]);
  return { ok: true, items, count };
}

export async function markNotificationReadAction(id: unknown): Promise<ActionResult<{ count: number }>> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };
  await markRead(c.db, c.staff.id, [parsed.data]);
  revalidatePath("/notifications");
  return { ok: true, count: await unreadCount(c.db, c.staff.id) };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult<{ count: number }>> {
  const c = await context();
  if (!c) return { ok: false, error: uz.common.sessionGone };
  await markAllRead(c.db, c.staff.id);
  revalidatePath("/notifications");
  return { ok: true, count: 0 };
}
