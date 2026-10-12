import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { courseOptions, listStudents } from "./data";
import { studentPerms } from "./perms";
import { StudentsView } from "./students-view";

export const metadata = { title: uz.students.title };

export default async function StudentsPage() {
  const { tenant, staff } = await requirePage("students", "/students");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [rows, courses] = await Promise.all([listStudents(db, branch.filter), courseOptions(db)]);
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
