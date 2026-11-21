import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { getTenantDb } from "@/lib/server/deps";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { getStorageStats } from "@/lib/server/storage";
import { StorageView } from "./storage-view";
import { uz } from "@/lib/uz";

export const metadata = {
  title: uz.storage.xotiraVaFayllarVentura,
};

/**
 * Xotira va fayllarni boshqarish sahifasi (/storage).
 * Markazga ajratilgan disk limiti, ishlatilishi va tozalash amallari.
 * Muallif / Agent: Google Gemini
 */
export default async function StoragePage() {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const db = getTenantDb(tenant);

  const stats = await getStorageStats(tenant, db);
  const canManage = staff.director || canAny(staff.access, pagePermissions("/storage"));

  return <StorageView initialStats={stats} canManage={canManage} />;
}
