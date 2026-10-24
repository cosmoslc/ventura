import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getTeraksList } from "./actions";
import { TeraksClient } from "./teraks-client";

export default async function TeraksPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const { active, trashed } = await getTeraksList(deps.db);
  const canManage = can(user.role, "teraks.manage");
  const canDelete = can(user.role, "teraks.delete");
  const locale = user.locale ?? "uz";

  return (
    <TeraksClient
      activeTeraks={active}
      trashedTeraks={trashed}
      canManage={canManage}
      canDelete={canDelete}
      locale={locale}
    />
  );
}
