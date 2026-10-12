import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { openGroupsByStudent } from "../groups/data";
import { courseOptions, listStudents } from "./data";
import { studentPerms } from "./perms";
import { StudentsView } from "./students-view";

export const metadata = { title: uz.students.title };

export default async function StudentsPage() {
  const { tenant, staff } = await requirePage("students", "/students");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [base, courses] = await Promise.all([listStudents(db, branch.filter), courseOptions(db)]);
  const byStudent = await openGroupsByStudent(
    db,
    base.map((s) => s.id),
  );
  const rows = base.map((s) => ({ ...s, groups: byStudent.get(s.id) ?? [] }));
  return (
    <StudentsView
      rows={rows}
      branches={branch.options}
      selectedBranch={branch.selected}
      courses={courses}
      perms={studentPerms(staff.access)}
    />
  );
}
