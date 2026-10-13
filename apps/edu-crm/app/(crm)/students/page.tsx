import { can, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { pagePermissions } from "@/lib/access";
import { getBranchContext } from "@/lib/server/branch";
import { loadAccounts } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { financePerms } from "../payments/perms";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { openGroupsByStudent } from "../groups/data";
import { courseOptions, getStudentFields, listArchivedStudentRows, listStudents } from "./data";
import { studentPerms } from "./perms";
import { StudentsView } from "./students-view";

export const metadata = { title: uz.students.title };

export default async function StudentsPage() {
  const { tenant, staff } = await requirePage("students", "/students");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // "O'chirilganlar" filtri — Arxiv sahifasini ko'ra oladigan xodimga
  const canArchived = canAny(staff.access, pagePermissions("/archive"));
  const [base, archivedBase, courses, fields] = await Promise.all([
    listStudents(db, branch.filter),
    canArchived ? listArchivedStudentRows(db, branch.filter) : Promise.resolve([]),
    courseOptions(db),
    getStudentFields(db),
  ]);
  const ids = [...base, ...archivedBase].map((s) => s.id);
  const withFinance = financePerms(staff.access).view && (await hasFeature(tenant, "payments"));
  const [byStudent, accounts] = await Promise.all([
    openGroupsByStudent(db, ids),
    withFinance ? loadAccounts(db, ids, todayTashkent()) : Promise.resolve(null),
  ]);
  const fill = (s: (typeof base)[number]) => ({
    ...s,
    groups: byStudent.get(s.id) ?? [],
    balance: accounts?.get(s.id)?.summary.balance ?? null,
  });
  return (
    <StudentsView
      rows={base.map(fill)}
      archived={canArchived ? archivedBase.map(fill) : null}
      canRestore={can(staff.access, "archive.restore")}
      branches={branch.options}
      selectedBranch={branch.selected}
      courses={courses}
      fields={fields}
      perms={studentPerms(staff.access)}
    />
  );
}
