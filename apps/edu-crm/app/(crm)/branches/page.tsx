import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { requireFeature } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { BranchesView } from "./branches-view";
import { assignableStaff, listBranches } from "./data";

export const metadata = { title: uz.branches.title };

export default async function BranchesPage() {
  const { tenant, staff } = await requireFeature("branches");
  const db = getTenantDb(tenant);
  const canWrite = can(staff.role, "branches.write");
  const [rows, staffOptions] = await Promise.all([listBranches(db, staff), canWrite ? assignableStaff(db) : []]);
  return <BranchesView rows={rows} staffOptions={staffOptions} canWrite={canWrite} />;
}
