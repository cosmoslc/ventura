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
import { listTeachers, teacherOverview, teacherRefs } from "../data";
import { listPersonEntries } from "../../salaries/data";
import { TeacherProfile, type TeacherSalaryData } from "../teacher-profile";

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

  // Oy — butun profil uchun (ko'rsatkichlar va maosh); "Maosh" — Ish haqi sahifasi bilan bir manba va ruxsat (ADR 0018)
  const today = todayTashkent();
  const months = recentMonths(today);
  const sp = await searchParams;
  const month = months.find((m) => m === sp.oy) ?? months[0]!;
  const withSalary = (await hasFeature(tenant, "salaries")) && canAny(staff.access, pagePermissions("/salaries"));
  const [overview, pay, entries, methods] = await Promise.all([
    teacherOverview(db, teacher.id, month, today),
    withSalary ? loadTeacherPayroll(db, teacher.id, month, today) : Promise.resolve(null),
    withSalary ? listPersonEntries(db, { teacherId: teacher.id }, month) : Promise.resolve([]),
    withSalary ? ensurePaymentMethods(db) : Promise.resolve([]),
  ]);
  const salary: TeacherSalaryData | null = pay
    ? {
        row: pay.row,
        groupNames: pay.groupNames,
        shares: pay.shares,
        entries,
        methods,
        perms: {
          salary: can(staff.access, "salaries.pay"),
          advance: canAny(staff.access, ["salaries.advance_manage", "finance.advance_give"]),
          adjust: can(staff.access, "salaries.kpi_edit"),
        },
      }
    : null;

  return (
    <TeacherProfile
      salary={salary}
      month={month}
      months={months}
      overview={overview}
      groups={own.map((g) => ({
        id: g.id,
        name: g.name,
        courseName: g.courseName,
        days: g.days,
        startTime: g.startTime,
        endTime: g.endTime,
        price: g.price,
        members: g.members,
        color: g.color,
      }))}
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
