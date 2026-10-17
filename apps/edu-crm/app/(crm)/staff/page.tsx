import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { getStaffFields, listStaff, positionOptions } from "./data";
import { StaffView } from "./staff-view";

export const metadata = { title: uz.staff.title };

export default async function StaffPage() {
  const { tenant, staff } = await requirePage("teachers", "/staff");
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [rows, positions, fields] = await Promise.all([
    listStaff(db, staff, branch.filter),
    positionOptions(db, staff.access),
    getStaffFields(db),
  ]);
  return (
    <StaffView
      rows={rows}
      positions={positions}
      branches={branch.options}
      fields={fields}
      perms={{
        create: can(staff.access, "staff.create"),
        edit: can(staff.access, "staff.edit"),
        delete: can(staff.access, "staff.delete"),
        assign: can(staff.access, "staff.roles_assign"),
      }}
    />
  );
}
