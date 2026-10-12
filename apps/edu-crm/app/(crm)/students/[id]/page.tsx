import { notFound } from "next/navigation";
import { z } from "zod";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions, listStudents, studentHistory, studentNotesOf } from "../data";
import { listGroups, studentMemberships } from "../../groups/data";
import { groupPerms } from "../../groups/perms";
import { studentPerms } from "../perms";
import { StudentProfile } from "../student-profile";

export const metadata = { title: uz.students.title };

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("students", "/students");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : branch.options.map((b) => b.id);
  const [student] = await listStudents(db, scope, id.data);
  if (!student) notFound();
  const [notes, history, courses, memberships, groups] = await Promise.all([
    studentNotesOf(db, student.id),
    studentHistory(db, student.id),
    courseOptions(db),
    studentMemberships(db, student.id),
    listGroups(db, [student.branchId]),
  ]);
  return (
    <StudentProfile
      student={student}
      notes={notes}
      history={history}
      branches={branch.options}
      selectedBranch={branch.selected}
      courses={courses}
      perms={studentPerms(staff.access)}
      memberships={memberships}
      groupOptions={groups.map((g) => ({
        id: g.id,
        title: g.name,
        subtitle: `${g.courseName} · ${g.teacherName} · ${g.startTime}`,
      }))}
      groupPerms={groupPerms(staff.access)}
    />
  );
}
