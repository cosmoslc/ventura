import ExcelJS from "exceljs";
import { notFound } from "next/navigation";
import { canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { REPORTS, isReportKey, reportPeriod } from "@/lib/server/reports";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * Hisobotni Excel'ga (ADR 0030): sahifadagi jadvalning o'zi — bir xil yuklovchi, bir xil davr va filial. Raqamlar
 * matn emas, son bo'lib yoziladi (Excel'da yig'ish mumkin); foiz — "0.0%" formatida. Qo'shimcha jadvallar —
 * alohida varaqlarda.
 */

export async function GET(req: Request, { params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();
  const def = REPORTS[report];
  const tenant = await requireTenant();
  if (!(await hasFeature(tenant, "reports")) || !(await hasFeature(tenant, def.feature))) notFound();
  const staff = await requireStaff();
  if (!canAny(staff.access, def.permissions)) return new Response(uz.common.forbidden, { status: 403 });

  const url = new URL(req.url);
  const today = todayTashkent();
  const period = reportPeriod(
    { yil: url.searchParams.get("yil") ?? undefined, oy: url.searchParams.get("oy") ?? undefined },
    today,
    def.periodMode,
  );
  const branch = await getBranchContext();
  const data = await def.load({
    db: getTenantDb(tenant),
    filter: branch.filter,
    period,
    today,
    finance: canAny(staff.access, ["dashboard.financial_stats"]),
  });
  const title = uz.reports.titles[report] ?? report;

  const wb = new ExcelJS.Workbook();
  const sheets = [{ title, table: data.table, note: data.note }, ...(data.extra ?? [])];
  for (const [i, sheet] of sheets.entries()) {
    // Varaq nomi: 31 belgigacha, takrorlanmaydi
    const ws = wb.addWorksheet(`${i ? `${i + 1}. ` : ""}${sheet.title}`.slice(0, 31));
    ws.addRow([`${sheet.title} — ${period.label}`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    const cols = sheet.table.columns;
    ws.addRow(cols.map((c) => c.label)).font = { bold: true };
    for (const r of sheet.table.rows) {
      const row = ws.addRow(
        cols.map((c) => {
          const v = r.cells[c.key] ?? null;
          if (v === null) return null;
          // Foiz Excel'da 0..1 ulush
          return c.kind === "percent" && typeof v === "number" ? v / 100 : v;
        }),
      );
      if (r.kind === "section" || r.kind === "total") row.font = { bold: true };
    }
    cols.forEach((c, j) => {
      const col = ws.getColumn(j + 1);
      col.width = j === 0 ? 32 : c.kind === "text" ? 28 : 16;
      if (c.kind === "money" || c.kind === "number") col.numFmt = "#,##0";
      if (c.kind === "percent") col.numFmt = "0.0%";
    });
    if ("note" in sheet && sheet.note) {
      ws.addRow([]);
      ws.addRow([sheet.note]).font = { italic: true, color: { argb: "FF64748B" } };
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const stamp = period.label.replace(/[^\p{L}\p{N}-]+/gu, "_");
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${title}_${stamp}.xlsx`)}`,
      "cache-control": "no-store",
    },
  });
}
