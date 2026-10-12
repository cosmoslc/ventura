import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { BranchesView } from "./branches-view";
import { assignableStaff, listBranches } from "./data";

export const metadata = { title: uz.branches.title };

export default async function BranchesPage() {
  const { tenant, staff } = await requirePage("branches", "/branches");
  const db = getTenantDb(tenant);
  const canWrite = can(staff.access, "settings.branches");
  const canAssign = canWrite && can(staff.access, "staff.roles_assign");
  const [rows, staffOptions] = await Promise.all([listBranches(db, staff), canAssign ? assignableStaff(db) : []]);
  return (
    <BranchesView
      rows={rows}
      staffOptions={staffOptions}
      canWrite={canWrite}
      canCreate={canWrite && staff.director}
      canAssign={canAssign}
    />
  );
}
