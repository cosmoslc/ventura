import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getTrucksList } from "./actions";
import { TrucksClient } from "./trucks-client";

export default async function TrucksPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const { active, archived } = await getTrucksList(deps.db);
  const canManage = can(user.role, "trucks.manage");
  const locale = user.locale ?? "uz";

  return <TrucksClient activeTrucks={active} archivedTrucks={archived} canManage={canManage} locale={locale} />;
}
