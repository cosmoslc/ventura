import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { loadWorkbench, workbenchBlocks } from "@/lib/server/workbench";
import { pagePermissions } from "@/lib/access";
import { uz } from "@/lib/uz";
import { WorkbenchView } from "./workbench-view";

export const metadata = { title: uz.workbench.title };

/**
 * "Bugungi ishlar" (E4d, ADR 0027): eski tizimdagi "Bugungi ish stoli". Bloklar xodim ruxsatiga qarab: lidlar,
 * bugun kelmaganlar, qarzdorlar, tugayotgan guruhlar.
 */
export default async function TodayPage() {
  const tenant = await requireTenant();
  const staff = await requireStaff(pagePermissions("/bugun"));
  const blocks = await workbenchBlocks(tenant, staff.access);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const data = await loadWorkbench(getTenantDb(tenant), blocks, branch.filter, today);
  return <WorkbenchView data={data} today={today} />;
}
