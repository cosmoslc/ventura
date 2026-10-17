import ExcelJS from "exceljs";
import { can } from "@ventura/auth/staff/policy";
import { notFound } from "next/navigation";
import { hasFeature } from "@ventura/tenants";
import { sheetName } from "@/lib/excel";
import { rankEmployees } from "@/lib/employee-ranking";
import { formatMonth } from "@/lib/format";
import { monthRange } from "@/lib/lessons";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { employeeRecords, listEmployees } from "../data";

/*
 * Xodimlar davomati oylik hisoboti Excelga (E6j, ADR 0038, ruxsat `attendance.employee_view`): sahifadagi jadval bilan bir
 * xil hisob (`rankEmployees`) va bir xil xodimlar ro'yxati (filial cheklovi bilan). Foiz "0.0%" formatida.
 */

const t = uz.staffAttendance;

export async function GET(req: Request) {
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, "attendance"))) notFound();
  const staff = await requireStaff();
  if (!can(staff.access, "attendance.employee_view")) return new Response(uz.common.forbidden, { status: 403 });

  const today = todayTashkent();
  const raw = new URL(req.url).searchParams.get("oy") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) && raw <= today.slice(0, 7) ? raw : today.slice(0, 7);
  const [from, to] = monthRange(month);
  const db = getTenantDb(tenant);
  const branch = await getBranchContext();
  const [employees, records] = await Promise.all([
    listEmployees(db, staff, branch.filter),
    employeeRecords(db, from, to),
  ]);
  const byKey = new Map(employees.map((e) => [e.key, e]));
  const rows = rankEmployees(
    employees.map((e) => e.key),
    records,
    from,
    to,
  );

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName(t.title, new Set()));
  ws.addRow([t.excelTitle(formatMonth(month))]).font = { bold: true, size: 13 };
  ws.addRow([]);
  ws.addRow([
    t.colRank,
    t.colEmployee,
    t.roleColumn,
    t.colPresent,
    t.colLate,
    t.colAbsent,
    t.colRecords,
    t.colRate,
  ]).font = { bold: true };
  rows.forEach((r, i) => {
    const e = byKey.get(r.key)!;
    ws.addRow([i + 1, e.name, e.role, r.present, r.late, r.absent, r.records, r.rate === null ? null : r.rate / 100]);
  });
  ws.addRow([]);
  ws.addRow([t.rankingHint]).font = { italic: true, color: { argb: "FF64748B" } };
  [5, 30, 24, 10, 10, 10, 16, 12].forEach((w, i) => (ws.getColumn(i + 1).width = w));
  ws.getColumn(8).numFmt = "0.0%";

  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${t.excelFile}_${month}.xlsx`)}`,
      "cache-control": "no-store",
    },
  });
}
