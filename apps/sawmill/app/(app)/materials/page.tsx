import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getSawmillSettings } from "@/lib/settings/schema";
import { getMaterialsCatalog } from "./actions";
import { MaterialsClient } from "./materials-client";

export default async function MaterialsPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const { active, archived } = await getMaterialsCatalog(deps.db);
  const settings = await getSawmillSettings(deps.db);
  const canManage = can(user.role, "stock.manage");
  const locale = user.locale ?? "uz";

  return (
    <MaterialsClient
      activeMaterials={active}
      archivedMaterials={archived}
      defaultUnit={settings.dimensionUnit}
      canManage={canManage}
      locale={locale}
    />
  );
}
