import { notFound } from "next/navigation";
import { can } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { journalWorkbook } from "@/lib/server/attendance-journal";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { listGroups } from "../../groups/data";

/*
 * Davomat jurnalini Excelga (E6j, ADR 0038, ruxsat `attendance.export`): guruh va oy bo'yicha jadval — o'quvchi × dars
 * kunlari. `guruh` bo'lmasa yoki "all" — xodim ko'radigan barcha guruhlar, har biri alohida varaqda.
 */

const t = uz.attendance.journalExport;
const MAX_GROUPS = 60;

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, "attendance"))) notFound();
  const staff = await requireStaff();
  if (!can(staff.access, "attendance.export")) return new Response(uz.common.forbidden, { status: 403 });

  const url = new URL(req.url);
  const rawMonth = url.searchParams.get("oy") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : todayTashkent().slice(0, 7);
  const groupParam = url.searchParams.get("guruh") ?? "all";
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const list = (await listGroups(db, branch.filter, groupParam !== "all" ? groupParam : undefined)).slice(
    0,
    MAX_GROUPS,
  );
  if (!list.length) return new Response(uz.common.notFound, { status: 404 });

  const buf = await (await journalWorkbook(db, list, month)).xlsx.writeBuffer();
  const file = list.length === 1 ? `${t.file}_${list[0]!.name}_${month}` : `${t.file}_${month}`;
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${file}.xlsx`)}`,
      "cache-control": "no-store",
    },
  });
}
