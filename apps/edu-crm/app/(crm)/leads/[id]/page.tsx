import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { students } from "@ventura/db/schema/tenant";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../../students/data";
import {
  getLeadFields,
  getLostReasons,
  leadGroupOptions,
  leadHistory,
  leadNotesOf,
  listLeads,
  listStages,
  listWaitlists,
  staffOptions,
} from "../data";
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
  const [stages, history, notes, courses, staffList, fields, groups, lostReasons, waitlists, [same]] =
    await Promise.all([
      listStages(db),
      leadHistory(db, lead.id),
      leadNotesOf(db, lead.id),
      courseOptions(db),
      staffOptions(db, scope),
      getLeadFields(db),
      leadGroupOptions(db, scope),
      getLostReasons(db),
      listWaitlists(db, scope),
      // O'quvchiga aylantirishda shu telefonli o'quvchiga bog'lanadi
      db
        .select({ name: students.name })
        .from(students)
        .where(and(eq(students.phone, `+998${lead.phone}`), isNull(students.archivedAt)))
        .limit(1),
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
      groups={groups}
      lostReasons={lostReasons}
      existingStudent={lead.studentId ? null : (same?.name ?? null)}
      waitlists={waitlists}
    />
  );
}
