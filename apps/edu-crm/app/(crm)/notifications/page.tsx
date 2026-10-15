import { PAGE_LIMIT } from "@/lib/notifications";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listNotifications } from "./data";
import { NotificationsView } from "./notifications-view";

export const metadata = { title: uz.notifications.title };

/** Bildirishnomalar (E6d): har xodimga ochiq, faqat o'zinikini ko'radi. Bo'lim emas (manifestda yo'q). */
export default async function NotificationsPage() {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const items = await listNotifications(getTenantDb(tenant), staff.id, { limit: PAGE_LIMIT });
  return <NotificationsView items={items} />;
}
