import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listTeachers, teacherRefs } from "./data";
import { TeachersView } from "./teachers-view";

export const metadata = { title: uz.teachers.title };

export default async function TeachersPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tenant, staff } = await requirePage("teachers", "/teachers");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const rows = await listTeachers(db, branch.filter);
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
