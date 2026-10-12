import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listHolidays } from "./data";
import { HolidaysView } from "./holidays-view";

export const metadata = { title: uz.holidays.title };

export default async function HolidaysPage() {
  const { tenant, staff } = await requirePage("holidays", "/holidays");
  const branch = await getBranchContext();
  // Bayramlar xodimning filial cheklovi bo'yicha (tepadagi tanlov bayramni yashirmaydi)
  const rows = await listHolidays(getTenantDb(tenant), staff.scope === "all" ? null : branch.options.map((b) => b.id));
  return (
    <HolidaysView
      rows={rows}
      branches={branch.options}
      canWrite={can(staff.access, "settings.branches")}
      canAllBranches={staff.scope === "all"}
    />
  );
}
