import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import {
  materials,
  terakMaterials,
  teraks,
} from "@ventura/db/schema/sawmill";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getOrdersList } from "./actions";
import { OrdersClient } from "./orders-client";

export default async function OrdersPage() {
  const { user, tenant } = await requireUser();
  if (!(await hasFeature(tenant, "orders"))) {
    redirect("/bolim-yopiq");
  }

  const { deps } = await currentDeps();
  if (!deps) return null;

  const canManage = can(user.role, "orders.manage");
  const locale = user.locale ?? "uz";

  // 1. Zakazlar ro'yxati
  const ordersList = await getOrdersList(deps.db);

  // 2. Faol teraklar
  const activeTeraks = await deps.db
    .select({
      id: teraks.id,
      name: teraks.name,
    })
    .from(teraks)
    .where(isNull(teraks.deletedAt))
    .orderBy(desc(teraks.purchaseDate));

  // 3. Faol materiallar
  const allMaterials = await deps.db
    .select({
      id: materials.id,
      name: materials.name,
      unit: materials.unit,
    })
    .from(materials)
    .where(isNull(materials.archivedAt))
    .orderBy(materials.name);

  // 4. Terak materiallari (qoldiqlar uchun)
  const allTerakMaterials = await deps.db
    .select({
      terakId: terakMaterials.terakId,
      materialId: terakMaterials.materialId,
      quantity: terakMaterials.quantity,
    })
    .from(terakMaterials);

  return (
    <OrdersClient
      initialOrders={ordersList}
      teraks={activeTeraks}
      materials={allMaterials}
      terakMaterials={allTerakMaterials}
      canManage={canManage}
      locale={locale}
    />
  );
}
