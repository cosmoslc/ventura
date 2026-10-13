import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../students/data";
import { getLeadFields, getLostReasons, leadGroupOptions, listLeads, listStages, staffOptions } from "./data";
import { LeadsView } from "./leads-view";
import { leadPerms } from "./perms";

export const metadata = { title: uz.leads.title };

export default async function LeadsPage() {
  const { tenant, staff } = await requirePage("leads", "/leads");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [stages, rows, courses, staffList, fields, groups, lostReasons] = await Promise.all([
    listStages(db),
    listLeads(db, branch.filter),
    courseOptions(db),
    staffOptions(db, branch.filter),
    getLeadFields(db),
    leadGroupOptions(db, branch.filter),
    getLostReasons(db),
  ]);
  return (
    <LeadsView
      stages={stages}
      rows={rows}
      courses={courses}
      staff={staffList}
      fields={fields}
      branches={branch.options}
      selectedBranch={branch.selected}
      today={todayTashkent()}
      me={staff.id}
      perms={leadPerms(staff.access)}
      groups={groups}
      lostReasons={lostReasons}
    />
  );
}
