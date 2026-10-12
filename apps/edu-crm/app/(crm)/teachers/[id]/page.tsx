import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { teachers } from "@ventura/db/schema/tenant";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../../groups/data";
import { listTeachers, teacherRefs } from "../data";
import { TeacherProfile } from "../teacher-profile";

export const metadata = { title: uz.teachers.profile };

export default async function TeacherPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("teachers", "/teachers");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = branch.options.map((b) => b.id);
  const [base] = await listTeachers(db, staff.scope === "all" ? null : scope, id.data);
  if (!base) notFound();
  const own = (await listGroups(db, null)).filter((g) => g.teacherId === base.id);
  const teacher = { ...base, groups: own.length, students: new Set(own.flatMap((g) => g.studentIds)).size };
  const [supports, mentors, refs] = await Promise.all([
    db
      .select({ id: teachers.id, name: teachers.name })
      .from(teachers)
      .where(and(eq(teachers.assignedTeacherId, teacher.id), isNull(teachers.archivedAt))),
    teacher.kind === "support" ? listTeachers(db, staff.scope === "all" ? null : scope) : Promise.resolve([]),
    teacherRefs(db, teacher.assignedTeacherId ? [teacher.assignedTeacherId] : []),
  ]);
  return (
    <TeacherProfile
      teacher={teacher}
      supports={supports}
      mentor={refs[0] ?? null}
      mentors={mentors.filter((t) => t.kind === "teacher").map((t) => ({ id: t.id, name: t.name }))}
      branches={branch.options}
      selectedBranch={branch.selected}
      perms={{
        create: can(staff.access, "staff.create"),
        edit: can(staff.access, "staff.edit"),
        delete: can(staff.access, "staff.delete"),
      }}
    />
  );
}
