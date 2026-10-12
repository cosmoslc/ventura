import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../groups/data";
import { listTeachers, teacherRefs } from "./data";
import { TeachersView } from "./teachers-view";

export const metadata = { title: uz.teachers.title };

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tenant, staff } = await requirePage("teachers", "/teachers");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [base, allGroups] = await Promise.all([listTeachers(db, branch.filter), listGroups(db, null)]);
  // Guruh va o'quvchi soni — faol guruhlardan (o'quvchi takrorsiz)
  const rows = base.map((t) => {
    const mine = allGroups.filter((g) => g.teacherId === t.id);
    return { ...t, groups: mine.length, students: new Set(mine.flatMap((g) => g.studentIds)).size };
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
