import { notFound } from "next/navigation";
import { z } from "zod";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../../students/data";
import { getLeadFields, leadHistory, leadNotesOf, listLeads, listStages, staffOptions } from "../data";
import { LeadProfile } from "../lead-profile";
import { leadPerms } from "../perms";

export const metadata = { title: uz.leads.title };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("leads", "/leads");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : branch.options.map((b) => b.id);
  const [lead] = await listLeads(db, scope, id.data);
  if (!lead) notFound();
  const [stages, history, notes, courses, staffList, fields] = await Promise.all([
    listStages(db),
    leadHistory(db, lead.id),
    leadNotesOf(db, lead.id),
    courseOptions(db),
    staffOptions(db, scope),
    getLeadFields(db),
  ]);
  return (
    <LeadProfile
      lead={lead}
      stages={stages}
      history={history}
      notes={notes}
      courses={courses}
      staff={staffList}
      fields={fields}
      branches={branch.options}
      selectedBranch={branch.selected}
      today={todayTashkent()}
      me={staff.id}
      perms={leadPerms(staff.access)}
    />
  );
}
