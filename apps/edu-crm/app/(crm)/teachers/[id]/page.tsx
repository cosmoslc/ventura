import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { pagePermissions } from "@/lib/access";
import { recentMonths } from "@/lib/format";
import { ensurePaymentMethods } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { loadTeacherPayroll } from "@/lib/server/payroll";
import { teachers } from "@ventura/db/schema/tenant";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../../groups/data";
import { listTeachers, teacherRefs } from "../data";
import { listPersonEntries } from "../../salaries/data";
import { TeacherProfile } from "../teacher-profile";
import { TeacherSalary } from "../teacher-salary";

export const metadata = { title: uz.teachers.profile };

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ oy?: string }>;
}) {
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

  // "Maosh" bo'limi — Ish haqi sahifasi bilan bir xil manba va ruxsat (ADR 0018)
  let salary: React.ReactNode = null;
  if ((await hasFeature(tenant, "salaries")) && canAny(staff.access, pagePermissions("/salaries"))) {
    const today = todayTashkent();
    const months = recentMonths(today);
    const sp = await searchParams;
    const month = months.find((m) => m === sp.oy) ?? months[0]!;
    const [pay, entries, methods] = await Promise.all([
      loadTeacherPayroll(db, teacher.id, month, today),
      listPersonEntries(db, { teacherId: teacher.id }, month),
      ensurePaymentMethods(db),
    ]);
    if (pay)
      salary = (
        <TeacherSalary
          teacherName={teacher.name}
          month={month}
          months={months}
          row={pay.row}
          groupNames={pay.groupNames}
          entries={entries}
          methods={methods}
          perms={{
            salary: can(staff.access, "salaries.pay"),
            advance: canAny(staff.access, ["salaries.advance_manage", "finance.advance_give"]),
            adjust: can(staff.access, "salaries.kpi_edit"),
          }}
        />
      );
  }

  return (
    <TeacherProfile
      salary={salary}
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
