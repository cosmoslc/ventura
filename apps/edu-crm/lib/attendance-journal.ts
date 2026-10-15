import { type MemberPeriod, markable } from "./lessons";

/*
 * Davomat jurnalini Excelga (E6j, ADR 0038): bitta guruhning bir oylik jadvali — o'quvchi × dars kunlari. Katak: bor,
 * kech, sababli, yo'q; belgisiz kun va o'quvchi guruhda bo'lmagan (yoki muzlatilgan) kun — bo'sh. Foiz = (bor + kech) /
 * belgilangan kunlar (hisobotdagi qoida, ADR 0014). Toza funksiya — Vitest bilan tekshiriladi.
 */

export type JournalStatus = "present" | "late" | "excused" | "absent";

export const JOURNAL_SYMBOL: Record<JournalStatus, string> = { present: "✓", late: "K", excused: "S", absent: "✕" };

export interface JournalInput {
  /** Dars sanalari (bayramlarsiz), o'sish tartibida */
  dates: readonly string[];
  members: readonly { name: string; periods: readonly MemberPeriod[] }[];
  /** Belgi: a'zo indeksi va sana bo'yicha (ism takrorlanishi mumkin) */
  marks: (memberIndex: number, date: string) => JournalStatus | undefined;
}

export interface JournalRow {
  name: string;
  /** Sana bo'yicha belgi (bo'sh — null) */
  cells: (string | null)[];
  present: number;
  late: number;
  excused: number;
  absent: number;
  /** 0..1; belgi yo'q bo'lsa null */
  rate: number | null;
}

export function journalRows(input: JournalInput): JournalRow[] {
  return input.members.map((m, i) => {
    const row: JournalRow = { name: m.name, cells: [], present: 0, late: 0, excused: 0, absent: 0, rate: null };
    for (const date of input.dates) {
      const status = markable(m.periods, date) ? input.marks(i, date) : undefined;
      row.cells.push(status ? JOURNAL_SYMBOL[status] : null);
      if (status) row[status]++;
    }
    const marked = row.present + row.late + row.excused + row.absent;
    row.rate = marked ? (row.present + row.late) / marked : null;
    return row;
  });
}
