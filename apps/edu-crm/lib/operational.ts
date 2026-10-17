import { addDays, addMonths } from "./billing";
import { type ReportTable, yearMonths } from "./reports";

/*
 * Operatsion ko'rsatkichlar (eski tizimdagi Pul oqimi sahifasining "Operatsion ko'rsatkichlar" bo'limi): oyma-oy
 * lidlar, birinchi to'lov, konversiya, o'quvchilar, ketganlar, guruhlar, to'ldirilish va davomat. Toza funksiya
 * (Vitest); ma'lumotni lib/server/operational-reports.ts bazadan yig'adi.
 */

export interface Stint {
  studentId: string;
  /** Faollashtirilgan sana (to'lov hisoblanadigan) */
  from: string;
  /** Guruhdan chiqqan sana; null — hozir ham guruhda */
  to: string | null;
}

export interface GroupSpan {
  start: string;
  /** Arxivga o'tgan sana; null — faol */
  end: string | null;
}

export interface OperationalInput {
  /** Oy ("YYYY-MM") → shu oyda yaratilgan lidlar soni */
  leads: ReadonlyMap<string, number>;
  /** Oy → shu oyda yaratilgan lidlardan o'quvchi bo'lganlar (guruh bo'yicha: oy lidlari) */
  won: ReadonlyMap<string, number>;
  /** Oy → birinchi to'lovi shu oyga tushgan o'quvchilar soni */
  firstPayers: ReadonlyMap<string, number>;
  stints: readonly Stint[];
  groups: readonly GroupSpan[];
  /** Oy → davomat belgilari: kelgan (kech qolgan ham) va jami belgilangan */
  attendance: ReadonlyMap<string, { present: number; marked: number }>;
}

export interface OperationalMonth {
  month: string;
  /** Hali kelmagan oy — hamma ko'rsatkich null */
  future: boolean;
  leads: number | null;
  firstPayers: number | null;
  /** Shu oy lidlaridan o'quvchi bo'lganlar ulushi, % (100 dan oshmaydi) */
  conversion: number | null;
  /** Oy oxiridagi (joriy oyda — bugungi) faol o'quvchilar */
  students: number | null;
  /** Oy boshida guruhda bo'lib, oy oxirida guruhi qolmaganlar */
  left: number | null;
  groups: number | null;
  /** O'quvchilar / guruhlar */
  avgFill: number | null;
  /** Davomat, % */
  attendance: number | null;
}

/** Oyning oxirgi kuni ("YYYY-MM-DD") */
const monthEnd = (month: string) => addDays(`${addMonths(month, 1)}-01`, -1);

const activeAt = (stints: readonly Stint[], date: string) => {
  const ids = new Set<string>();
  for (const s of stints) if (s.from <= date && (s.to === null || s.to > date)) ids.add(s.studentId);
  return ids;
};

export function operationalMonths(input: OperationalInput, year: number, today: string): OperationalMonth[] {
  const thisMonth = today.slice(0, 7);
  return yearMonths(year).map((month): OperationalMonth => {
    if (month > thisMonth) {
      return {
        month,
        future: true,
        leads: null,
        firstPayers: null,
        conversion: null,
        students: null,
        left: null,
        groups: null,
        avgFill: null,
        attendance: null,
      };
    }
    const end = month === thisMonth ? today : monthEnd(month);
    const before = addDays(`${month}-01`, -1);
    const leads = input.leads.get(month) ?? 0;
    const firstPayers = input.firstPayers.get(month) ?? 0;
    const now = activeAt(input.stints, end);
    const prev = activeAt(input.stints, before);
    let left = 0;
    for (const id of prev) if (!now.has(id)) left++;
    const groups = input.groups.filter((g) => g.start <= end && (g.end === null || g.end > end)).length;
    const a = input.attendance.get(month);
    return {
      month,
      future: false,
      leads,
      firstPayers,
      conversion: leads > 0 ? ((input.won.get(month) ?? 0) / leads) * 100 : null,
      students: now.size,
      left,
      groups,
      avgFill: groups > 0 ? now.size / groups : null,
      attendance: a && a.marked > 0 ? (a.present / a.marked) * 100 : null,
    };
  });
}

export interface OperationalLabels {
  month: string;
  leads: string;
  firstPayers: string;
  conversion: string;
  students: string;
  left: string;
  groups: string;
  avgFill: string;
  attendance: string;
  /** To'liq oy nomlari (12 ta) */
  months: readonly string[];
}

/** Excel uchun: qator — oy, ustun — ko'rsatkich (har ustunning o'z formati bor). Kelmagan oylar bo'sh. */
export function operationalTable(rows: readonly OperationalMonth[], l: OperationalLabels): ReportTable {
  return {
    columns: [
      { key: "month", label: l.month, kind: "text" },
      { key: "leads", label: l.leads, kind: "number" },
      { key: "firstPayers", label: l.firstPayers, kind: "number" },
      { key: "conversion", label: l.conversion, kind: "percent" },
      { key: "students", label: l.students, kind: "number" },
      { key: "left", label: l.left, kind: "number" },
      { key: "groups", label: l.groups, kind: "number" },
      { key: "avgFill", label: l.avgFill, kind: "decimal" },
      { key: "attendance", label: l.attendance, kind: "percent" },
    ],
    rows: rows.map((r, i) => ({
      cells: {
        month: l.months[i] ?? r.month,
        leads: r.leads,
        firstPayers: r.firstPayers,
        conversion: r.conversion,
        students: r.students,
        left: r.left,
        groups: r.groups,
        avgFill: r.avgFill,
        attendance: r.attendance,
      },
    })),
  };
}
