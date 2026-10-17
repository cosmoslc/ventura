import "server-only";
import ExcelJS from "exceljs";
import type { TenantDb } from "@ventura/db";
import { sheetName } from "@/lib/excel";
import { journalRows } from "@/lib/attendance-journal";
import { formatMonth } from "@/lib/format";
import { uz } from "@/lib/uz";
import { groupAttendance } from "./attendance";

const t = uz.attendance.journalExport;

/**
 * Davomat jurnali kitobi (E6j, ADR 0038): har guruh — alohida varaq, o'quvchi × dars kunlari, oxirida bor/kech/sababli/yo'q
 * soni va foiz. Raqamlar son bo'lib yoziladi, foiz "0.0%" formatida.
 */
export async function journalWorkbook(
  db: TenantDb,
  groups: readonly { id: string; name: string; days: readonly string[]; startDate: string; branchId: string }[],
  month: string,
): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  const used = new Set<string>();
  for (const g of groups) {
    const att = await groupAttendance(db, g, month);
    const rows = journalRows({
      dates: att.dates,
      members: att.members,
      marks: (i, d) => att.marks[`${att.members[i]!.studentId}|${d}`]?.status,
    });
    // Varaq nomi: taqiqlangan belgilarsiz, 31 belgigacha, takrorlanmaydi
    const name = sheetName(g.name, used, "Guruh");
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", xSplit: 2, ySplit: 3 }] });
    ws.addRow([t.sheetTitle(g.name, formatMonth(month))]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.addRow([
      t.colNo,
      t.colStudent,
      ...att.dates.map((d) => `${d.slice(8)}.${d.slice(5, 7)}`),
      t.colPresent,
      t.colLate,
      t.colExcused,
      t.colAbsent,
      t.colRate,
    ]).font = { bold: true };
    rows.forEach((r, i) => ws.addRow([i + 1, r.name, ...r.cells, r.present, r.late, r.excused, r.absent, r.rate]));
    if (!att.dates.length) ws.addRow([null, t.noLessons]);
    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 30;
    att.dates.forEach((_, j) => {
      const col = ws.getColumn(3 + j);
      col.width = 7;
      col.alignment = { horizontal: "center" };
    });
    const sum = 3 + att.dates.length;
    for (let j = 0; j < 5; j++) {
      const col = ws.getColumn(sum + j);
      col.width = j === 4 ? 11 : 9;
      col.alignment = { horizontal: "center" };
    }
    ws.getColumn(sum + 4).numFmt = "0.0%";
  }
  return wb;
}
