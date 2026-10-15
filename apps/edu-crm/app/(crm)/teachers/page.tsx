import { can, canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { loadPayroll } from "@/lib/server/payroll";
import { todayTashkent } from "@/lib/server/memberships";
import { retentionCounts } from "@/lib/teacher-stats";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../groups/data";
import { listTeachers, teacherRefs, teacherSpans } from "./data";
import { TeachersView } from "./teachers-view";

export const metadata = { title: uz.teachers.title };

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tenant, staff } = await requirePage("teachers", "/teachers");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const today = todayTashkent();
  const month = today.slice(0, 7);
  const canShare = canAny(staff.access, pagePermissions("/salaries"));
  const [base, allGroups, spans, payroll] = await Promise.all([
    listTeachers(db, branch.filter),
    listGroups(db, null),
    teacherSpans(db),
    canShare ? loadPayroll(db, branch.filter, month, today) : null,
  ]);
  const share = new Map(
    (payroll?.rows ?? []).flatMap((r) => (r.kind === "teacher" ? [[r.id, r.accrual.total] as const] : [])),
  );
  // Guruh va o'quvchi soni — faol guruhlardan (o'quvchi takrorsiz); retention va ulush — joriy oy
  const rows = base.map((t) => {
    const mine = allGroups.filter((g) => g.teacherId === t.id);
    const r = retentionCounts(spans.get(t.id) ?? [], month, today);
    return {
      ...t,
      groups: mine.length,
      students: new Set(mine.flatMap((g) => g.studentIds)).size,
      retentionBase: r.base,
      retentionKept: r.kept,
      share: canShare ? (share.get(t.id) ?? 0) : null,
    };
  });
  const assigned = [...new Set(rows.flatMap((t) => (t.assignedTeacherId ? [t.assignedTeacherId] : [])))];
  const refs = await teacherRefs(db, assigned);
  const { tab } = await searchParams;
  return (
    <TeachersView
      rows={rows}
      refs={refs}
      branches={branch.options}
      selectedBranch={branch.selected}
      initialTab={tab === "support" ? "support" : "teachers"}
      perms={{
        create: can(staff.access, "staff.create"),
        edit: can(staff.access, "staff.edit"),
        delete: can(staff.access, "staff.delete"),
      }}
    />
  );
}
