import { hasFeature } from "@ventura/tenants";
import { getBranchContext } from "@/lib/server/branch";
import { loadAccounts } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { financePerms } from "../payments/perms";
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
  const ids = base.map((s) => s.id);
  const withFinance = financePerms(staff.access).view && (await hasFeature(tenant, "payments"));
  const [byStudent, accounts] = await Promise.all([
    openGroupsByStudent(db, ids),
    withFinance ? loadAccounts(db, ids, todayTashkent()) : Promise.resolve(null),
  ]);
  const rows = base.map((s) => ({
    ...s,
    groups: byStudent.get(s.id) ?? [],
    balance: accounts?.get(s.id)?.summary.balance ?? null,
  }));
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
