import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions } from "../../students/data";
import { groupFormOptions, groupMembers, listGroups, studentCandidates } from "../data";
import { GroupProfile } from "../group-profile";
import { groupPerms } from "../perms";

export const metadata = { title: uz.groups.title };

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("groups", "/groups");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : branch.options.map((b) => b.id);
  const [group] = await listGroups(db, scope, id.data);
  if (!group) notFound();
  const [members, candidates, options, studentCourses] = await Promise.all([
    groupMembers(db, group.id),
    studentCandidates(db, scope),
    groupFormOptions(db, scope),
    courseOptions(db),
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
    />
  );
}
