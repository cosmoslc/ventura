import { notFound } from "next/navigation";
import { z } from "zod";
import { can } from "@ventura/auth/staff/policy";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { getStaffFields, listStaff, positionOptions } from "../data";
import { StaffDetail } from "../staff-detail";

export const metadata = { title: uz.staff.title };

export default async function StaffMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant, staff } = await requirePage("teachers", "/staff");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  // Ko'rinish xodimning o'z filial cheklovi bo'yicha (tepadagi tanlovdan qat'i nazar)
  const scope = staff.scope === "all" ? null : staff.scope;
  const [[row], positions, fields] = await Promise.all([
    listStaff(db, staff, scope, id.data),
    positionOptions(db, staff.access),
    getStaffFields(db),
  ]);
  if (!row) notFound();
  return (
    <StaffDetail
      row={row}
      positions={positions}
      branches={branch.options}
      selectedBranch={branch.selected}
      fields={fields}
      canViewLog={can(staff.access, "settings.logs")}
      perms={{
        create: can(staff.access, "staff.create"),
        edit: can(staff.access, "staff.edit"),
        delete: can(staff.access, "staff.delete"),
        assign: can(staff.access, "staff.roles_assign"),
      }}
    />
  );
}
