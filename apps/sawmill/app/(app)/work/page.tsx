import { redirect } from "next/navigation";
import { desc, isNull } from "drizzle-orm";
import {
  materials,
  materialSizes,
  terakMaterials,
  teraks,
  workerMaterialPrices,
  workers,
  workTypes,
} from "@ventura/db/schema/sawmill";
import { hasFeature } from "@ventura/tenants";
import { can } from "@/lib/auth/roles";
import { getSettings } from "@/lib/settings/schema";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getRemainingRes, getWorkList } from "./actions";
import { WorkClient } from "./work-client";

export default async function WorkPage() {
  const { user, tenant } = await requireUser();
  if (!(await hasFeature(tenant, "work"))) {
    redirect("/bolim-yopiq");
  }

  const { deps } = await currentDeps();
  if (!deps) return null;

  const canManage = can(user.role, "work.manage");
  const locale = user.locale ?? "uz";

  // 1. Ishlar ro'yxati
  const initialWorks = await getWorkList(deps.db);

  // 2. Faol ishchilar
  const activeWorkers = await deps.db
    .select({
      id: workers.id,
      name: workers.name,
      salaryType: workers.salaryType,
    })
    .from(workers)
    .where(isNull(workers.archivedAt))
    .orderBy(workers.name);

  // 3. Faol teraklar va ularning qolgan reslari
  const activeTeraksRaw = await deps.db
    .select({
      id: teraks.id,
      name: teraks.name,
    })
    .from(teraks)
    .where(isNull(teraks.deletedAt))
    .orderBy(desc(teraks.purchaseDate));

  const activeTeraks = await Promise.all(
    activeTeraksRaw.map(async (tr) => {
      const remainingRes = await getRemainingRes(deps.db, tr.id);
      return {
        id: tr.id,
        name: tr.name,
        remainingRes,
      };
    }),
  );

  // 4. Ish turlari
  const activeWorkTypes = await deps.db
    .select({
      id: workTypes.id,
      name: workTypes.name,
      kind: workTypes.kind,
    })
    .from(workTypes)
    .orderBy(workTypes.name);

  // 5. Materiallar va ularning o'lchamlari
  const allMaterials = await deps.db
    .select()
    .from(materials)
    .where(isNull(materials.archivedAt))
    .orderBy(materials.name);

  const allSizes = await deps.db.select().from(materialSizes);

  const materialsWithSizes = allMaterials.map((m) => {
    const sizes = allSizes.filter((s) => s.materialId === m.id);
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      pricingMode: m.pricingMode,
      thicknessCm: m.thicknessCm,
      widthCm: m.widthCm,
      lengthCm: m.lengthCm,
      sizes: sizes.map((s) => ({
        id: s.id,
        thicknessCm: s.thicknessCm,
        widthCm: s.widthCm,
        lengthCm: s.lengthCm,
      })),
    };
  });

  // 6. Teraklardagi material narxlari
  const allTerakMaterials = await deps.db
    .select({
      terakId: terakMaterials.terakId,
      materialId: terakMaterials.materialId,
      workerPrice: terakMaterials.workerPrice,
      cubeWorkerPrice: terakMaterials.cubeWorkerPrice,
    })
    .from(terakMaterials);

  // 7. Maxsus narxlar
  const allSpecialPrices = await deps.db
    .select({
      workerId: workerMaterialPrices.workerId,
      materialId: workerMaterialPrices.materialId,
      price: workerMaterialPrices.price,
    })
    .from(workerMaterialPrices);

  // 8. Sozlamalar
  const settings = await getSettings(deps.db);

  return (
    <WorkClient
      initialWorks={initialWorks}
      workers={activeWorkers}
      teraks={activeTeraks}
      workTypes={activeWorkTypes}
      materials={materialsWithSizes}
      terakMaterials={allTerakMaterials}
      specialPrices={allSpecialPrices}
      cubeInputMode={settings.cubeInputMode}
      canManage={canManage}
      locale={locale}
    />
  );
}
