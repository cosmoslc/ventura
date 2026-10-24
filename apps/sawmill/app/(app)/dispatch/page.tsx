import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import {
  materials,
  terakMaterials,
  teraks,
  trucks,
} from "@ventura/db/schema/sawmill";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getDispatchList } from "./actions";
import { DispatchClient } from "./dispatch-client";

export default async function DispatchPage() {
  const { user, tenant } = await requireUser();
  if (!(await hasFeature(tenant, "dispatch"))) {
    redirect("/bolim-yopiq");
  }

  const { deps } = await currentDeps();
  if (!deps) return null;

  const canManage = can(user.role, "dispatch.manage");
  const canDelete = can(user.role, "dispatch.delete");
  const locale = user.locale ?? "uz";

  // 1. Yuk chiqarishlar ro'yxati
  const dispatchesList = await getDispatchList(deps.db);

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
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
    })
    .from(materials)
    .where(isNull(materials.archivedAt))
    .orderBy(materials.name);

  // 4. Teraklardagi materiallar (qoldiq va narxlar)
  const allTerakMaterials = await deps.db
    .select({
      terakId: terakMaterials.terakId,
      materialId: terakMaterials.materialId,
      quantity: terakMaterials.quantity,
      sellingPrice: terakMaterials.sellingPrice,
      cubePrice: terakMaterials.cubePrice,
    })
    .from(terakMaterials);

  // 5. Faol yuk mashinalari
  const activeTrucks = await deps.db
    .select({
      id: trucks.id,
      name: trucks.name,
      amount: trucks.amount,
    })
    .from(trucks)
    .where(isNull(trucks.archivedAt))
    .orderBy(trucks.name);

  return (
    <DispatchClient
      initialDispatches={dispatchesList}
      teraks={activeTeraks}
      materials={allMaterials.map((m) => ({
        ...m,
        thicknessCm: m.thicknessCm ? Number(m.thicknessCm) : null,
        widthCm: m.widthCm ? Number(m.widthCm) : null,
        lengthCm: m.lengthCm ? Number(m.lengthCm) : null,
      }))}
      terakMaterials={allTerakMaterials.map((tm) => ({
        ...tm,
        sellingPrice: Number(tm.sellingPrice),
        cubePrice: Number(tm.cubePrice),
      }))}
      trucks={activeTrucks.map((tr) => ({
        ...tr,
        amount: Number(tr.amount),
      }))}
      canManage={canManage}
      canDelete={canDelete}
      locale={locale}
    />
  );
}
