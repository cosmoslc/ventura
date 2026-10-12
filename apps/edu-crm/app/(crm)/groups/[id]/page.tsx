import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { groupAttendance } from "@/lib/server/attendance";
import { getBranchContext } from "@/lib/server/branch";
import { groupFinance } from "../../payments/data";
import { financePerms } from "../../payments/perms";
import { todayTashkent } from "@/lib/server/memberships";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../../students/data";
import { groupFormOptions, groupMembers, listGroups, studentCandidates } from "../data";
import { GroupProfile } from "../group-profile";
import { groupPerms } from "../perms";

export const metadata = { title: uz.groups.title };

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; month?: string }>;
}) {
  const { tenant, staff } = await requirePage("groups", "/groups");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : branch.options.map((b) => b.id);
  const [group] = await listGroups(db, scope, id.data);
  if (!group) notFound();
  const sp = await searchParams;
  const today = todayTashkent();
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const attendanceOn = await hasFeature(tenant, "attendance");
  const financeOn = financePerms(staff.access).view && (await hasFeature(tenant, "payments"));
  const [members, candidates, options, studentCourses, attendance, finance] = await Promise.all([
    groupMembers(db, group.id),
    studentCandidates(db, scope),
    groupFormOptions(db, scope),
    courseOptions(db),
    attendanceOn ? groupAttendance(db, group, month) : Promise.resolve(null),
    financeOn ? groupFinance(db, group.id, today) : Promise.resolve(null),
  ]);
  return (
    <GroupProfile
      group={group}
      members={members}
      candidates={candidates}
      courses={options.courses}
      teachers={options.teachers}
      rooms={options.rooms}
      studentCourses={studentCourses}
      branches={branch.options}
      perms={groupPerms(staff.access)}
      canCreateStudent={can(staff.access, "students.create")}
      attendance={attendance}
      finance={finance}
      today={today}
      canMarkToday={can(staff.access, "attendance.student_mark")}
      canEditPast={can(staff.access, "attendance.student_edit_past")}
      initialTab={sp.tab === "attendance" ? "attendance" : "students"}
    />
  );
}
