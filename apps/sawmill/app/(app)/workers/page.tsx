import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import { getWorkersList } from "./actions";
import { WorkersClient } from "./workers-client";

export default async function WorkersPage() {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return null;

  const { active, archived } = await getWorkersList(deps.db);
  const canManage = can(user.role, "workers.manage");
  const locale = user.locale ?? "uz";

  return <WorkersClient activeWorkers={active} archivedWorkers={archived} canManage={canManage} locale={locale} />;
}
