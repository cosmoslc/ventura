import { uz } from "./uz";
import type { DayFlow } from "./dashboard";
import {
  type ForecastInput,
  type PlanCell,
  type PlanKey,
  type ReportColumn,
  type ReportRow,
  type ReportTable,
  percent,
  planTable,
  sumCells,
} from "./reports";

/*
 * Pul oqimi va reja hisobotlari ko'rinishi uchun toza funksiyalar (grafiklar, ulushlar). Raqamlar jadval bilan bir
 * xil manbadan (`DayFlow`, `planTable`) — ekrandagi va Excel'dagi son farq qilmaydi. Vitest bilan tekshiriladi.
 */

const sumOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

const OUTFLOW_KINDS: readonly DayFlow["kind"][] = ["expense", "salary", "advance", "refund"];

/** Oy nomining qisqasi: 3 harf; "Iyun" va "Iyul" bir xil chiqmasligi uchun "Iyn" va "Iyl" */
export const shortMonth = (name: string) =>
  uz.monthsShort[(uz.months as readonly string[]).indexOf(name)] ?? name.slice(0, 3);

/* ---------- Pul oqimi ---------- */

export interface MonthFlow {
  /** "YYYY-MM" */
  month: string;
  /** Hali kelmagan oy — null */
  income: number | null;
  outflow: number | null;
  net: number | null;
  /** Yil boshidan shu oy oxirigacha yig'ma qoldiq */
  cumulative: number | null;
}

/** Yil bo'yicha 12 oy: kirim, chiqim, sof oqim va yig'ma qoldiq (hisob `cashflowTable` bilan bir xil) */
export function monthlyFlows(
  flows: readonly DayFlow[],
  year: number,
  today: string,
  /** Boshlang'ich qoldiq bilan hisoblangan yig'ma qoldiq (E6j) */
  balance?: readonly (number | null)[],
): MonthFlow[] {
  const thisMonth = today.slice(0, 7);
  let running = 0;
  return Array.from({ length: 12 }, (_, i) => {
    const month = `${year}-${String(i + 1).padStart(2, "0")}`;
    if (month > thisMonth) return { month, income: null, outflow: null, net: null, cumulative: null };
    const inMonth = flows.filter((f) => f.date.startsWith(month));
    const income = sumOf(inMonth.filter((f) => f.kind === "pay" || f.kind === "income").map((f) => f.amount));
    const outflow = sumOf(inMonth.filter((f) => OUTFLOW_KINDS.includes(f.kind)).map((f) => f.amount));
    running += income - outflow;
    return { month, income, outflow, net: income - outflow, cumulative: balance ? (balance[i] ?? null) : running };
  });
}

export interface BreakdownLabels {
  noCategory: string;
  salaryAdvance: string;
  refund: string;
}

/**
 * Yillik chiqim tarkibi: xarajat toifalari, ish haqi (maosh va avans birga) va qaytarishlar. Kamayish tartibida,
 * nol summalar tushmaydi. Hali kelmagan oylar kirmaydi.
 */
export function outflowBreakdown(
  flows: readonly DayFlow[],
  year: number,
  today: string,
  l: BreakdownLabels,
): [string, number][] {
  const thisMonth = today.slice(0, 7);
  const sums = new Map<string, number>();
  const add = (name: string, amount: number) => sums.set(name, (sums.get(name) ?? 0) + amount);
  for (const f of flows) {
    if (!f.date.startsWith(`${year}-`) || f.date.slice(0, 7) > thisMonth) continue;
    if (f.kind === "expense") add(f.category || l.noCategory, f.amount);
    else if (f.kind === "salary" || f.kind === "advance") add(l.salaryAdvance, f.amount);
    else if (f.kind === "refund") add(l.refund, f.amount);
  }
  return [...sums.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
}

export interface FlowHighlights {
  /** Eng yuqori kirimli oy; kirim yo'q bo'lsa null */
  bestIncome: { month: string; amount: number } | null;
  bestOutflow: { month: string; amount: number } | null;
  income: number;
  outflow: number;
  /** Chiqimning kirimdagi ulushi, %; kirim yo'q bo'lsa null */
  outflowShare: number | null;
}

export function flowHighlights(months: readonly MonthFlow[]): FlowHighlights {
  const top = (pick: (m: MonthFlow) => number | null) => {
    let best: { month: string; amount: number } | null = null;
    for (const m of months) {
      const v = pick(m);
      if (v !== null && v > 0 && (!best || v > best.amount)) best = { month: m.month, amount: v };
    }
    return best;
  };
  const income = sumOf(months.map((m) => m.income ?? 0));
  const outflow = sumOf(months.map((m) => m.outflow ?? 0));
  return {
    bestIncome: top((m) => m.income),
    bestOutflow: top((m) => m.outflow),
    income,
    outflow,
    outflowShare: percent(outflow, income),
  };
}

/* ---------- Reja, fakt va prognoz ---------- */

export interface PlanMonth {
  month: string;
  income: PlanCell;
  outflow: PlanCell;
  net: PlanCell;
  /** Har qator (to'lovlar, qo'shimcha daromad, ish haqi, xarajat, qaytarish) */
  lines: Record<PlanKey, PlanCell>;
}

/** Har oy uchun qatorlar, jami kirim, jami chiqim va sof oqim (reja, fakt, prognoz) — oyma-oy jadval va grafik uchun */
export function planMonths(months: readonly string[], input: ForecastInput): PlanMonth[] {
  return months.map((month) => {
    const t = planTable([month], input);
    return { month, income: t.income, outflow: t.outflow, net: t.net, lines: t.lines };
  });
}

export interface PlanPoint {
  month: string;
  fact: number;
  plan: number;
  /** Faqat joriy va kelgusi oylarda (o'tgan oyda prognoz — fakt, takrorlanmaydi) */
  forecast: number;
}

export function planPoints(months: readonly PlanMonth[], pick: "income" | "outflow", today: string): PlanPoint[] {
  const thisMonth = today.slice(0, 7);
  return months.map((m) => {
    const c = m[pick];
    return {
      month: m.month,
      fact: c.fact ?? 0,
      plan: c.plan ?? 0,
      forecast: m.month >= thisMonth ? c.forecast : 0,
    };
  });
}

/** Qatorlar guruhi uchun umumiy shkala: eng katta reja, fakt yoki prognoz */
export const barScale = (cells: readonly PlanCell[]) =>
  Math.max(0, ...cells.flatMap((c) => [c.plan ?? 0, c.fact ?? 0, c.forecast]));

export interface BarShare {
  /** Shkalaning ulushi, 0–100 */
  fact: number;
  /** Fakt + kutilayotgan qism (fakt'dan kam bo'lmaydi) */
  forecast: number;
  /** Reja belgisi o'rni; reja yo'q — null */
  plan: number | null;
}

export function barShare(cell: PlanCell, scale: number): BarShare {
  const pc = (v: number) => (scale > 0 ? Math.min(100, Math.max(0, (v / scale) * 100)) : 0);
  const fact = cell.fact ?? 0;
  return {
    fact: pc(fact),
    forecast: pc(Math.max(cell.forecast, fact)),
    plan: cell.plan ? pc(cell.plan) : null,
  };
}

/** Prognoz faktdan farq qiladimi (kutilayotgan qism bor) — bo'lmasa prognoz alohida yozilmaydi */
export const hasForecastGap = (cell: PlanCell) => Math.round(cell.forecast) !== Math.round(cell.fact ?? 0);

/* ---------- Birlashgan jadval: 12 oy × reja, fakt, prognoz (eski tizimdagi Pul oqimi jadvali) ---------- */

export type GridKey =
  "payments" | "income" | "incomeTotal" | "salary" | "expenses" | "refunds" | "outflowTotal" | "net" | "balance";

export interface GridRow {
  key: GridKey;
  kind: "line" | "total" | "balance";
  /** Chiqim: rejadan oshish yomon */
  lowerIsBetter: boolean;
  /** Reja katagi shu qatorda to'g'ridan-to'g'ri kiritiladi (finance_plans); xarajat rejasi — toifalar bo'yicha */
  editable: boolean;
  /** Oyma-oy (har oy uchun bitta) */
  cells: PlanCell[];
  /** Yillik jami */
  total: PlanCell;
}

/** Reja katagi kiritiladigan qatorlar */
export const EDITABLE_PLAN_KEYS: readonly GridKey[] = ["payments", "income", "salary"];

/**
 * Jadval qatorlari: to'lovlar, qo'shimcha daromad, jami kirim, ish haqi, xarajatlar, qaytarishlar, jami chiqim,
 * sof oqim va yig'ma qoldiq. Hammasi `planMonths` (ya'ni `planTable`) dan — yillik jami `planTable(butun yil)` bilan bir xil.
 */
export function gridRows(months: readonly PlanMonth[], balance: readonly (number | null)[]): GridRow[] {
  const line = (key: GridKey, pick: (m: PlanMonth) => PlanCell, kind: GridRow["kind"], lowerIsBetter: boolean) => {
    const cells = months.map(pick);
    return { key, kind, lowerIsBetter, editable: EDITABLE_PLAN_KEYS.includes(key), cells, total: sumCells(cells) };
  };
  const last = [...balance].reverse().find((v) => v !== null) ?? null;
  const balanceCells = months.map((_, i): PlanCell => ({ plan: null, fact: balance[i] ?? null, forecast: 0 }));
  return [
    line("payments", (m) => m.lines.payments, "line", false),
    line("income", (m) => m.lines.income, "line", false),
    line("incomeTotal", (m) => m.income, "total", false),
    line("salary", (m) => m.lines.salary, "line", true),
    line("expenses", (m) => m.lines.expenses, "line", true),
    line("refunds", (m) => m.lines.refunds, "line", true),
    line("outflowTotal", (m) => m.outflow, "total", true),
    line("net", (m) => m.net, "total", false),
    {
      key: "balance",
      kind: "balance",
      lowerIsBetter: false,
      editable: false,
      cells: balanceCells,
      total: { plan: null, fact: last, forecast: 0 },
    },
  ];
}

export type PlanTone = "success" | "warning" | "danger";

/**
 * Qiymat (fakt yoki prognoz) rejaga nisbatan: kirimda 100% va undan ko'p — yaxshi, 90–99% — ogohlantirish,
 * undan kam — yomon. Chiqimda teskari: reja doirasida — yaxshi, 10% gacha oshsa — ogohlantirish. Reja yo'q — null.
 */
export function planTone(plan: number | null, value: number | null, lowerIsBetter: boolean): PlanTone | null {
  if (!plan || plan <= 0 || value === null) return null;
  const pc = (value / plan) * 100;
  if (lowerIsBetter) return pc <= 100 ? "success" : pc <= 110 ? "warning" : "danger";
  return pc >= 100 ? "success" : pc >= 90 ? "warning" : "danger";
}

/** Prognoz ustuni oyda ko'rsatiladimi: faqat joriy va kelgusi oylarda (o'tgan oyda prognoz — fakt) */
export const showMonthForecast = (month: string, today: string) => month >= today.slice(0, 7);

export interface GridLabels {
  label: string;
  plan: string;
  fact: string;
  forecast: string;
  total: string;
  rows: Record<GridKey, string>;
  /** Oy qisqa nomlari (12 ta) */
  months: readonly string[];
}

/**
 * Excel uchun yassi jadval: qator — ko'rsatkich, ustunlar — har oy uchun reja, fakt, prognoz va yillik jami.
 * Prognoz faqat joriy va kelgusi oylarda (sahifadagi bilan bir xil).
 */
export function gridTable(
  rows: readonly GridRow[],
  months: readonly string[],
  today: string,
  l: GridLabels,
): ReportTable {
  const columns: ReportColumn[] = [
    { key: "label", label: l.label, kind: "text" },
    ...months.flatMap((m, i) =>
      (["plan", "fact", "forecast"] as const).map((k) => ({
        key: `${m}:${k}`,
        label: `${l.months[i]} · ${l[k]}`,
        kind: "money" as const,
      })),
    ),
    ...(["plan", "fact", "forecast"] as const).map((k) => ({
      key: `total:${k}`,
      label: `${l.total} · ${l[k]}`,
      kind: "money" as const,
    })),
  ];
  return {
    columns,
    rows: rows.map((r): ReportRow => {
      const cells: Record<string, number | string | null> = { label: l.rows[r.key] };
      const put = (prefix: string, c: PlanCell, forecast: boolean) => {
        cells[`${prefix}:plan`] = c.plan;
        cells[`${prefix}:fact`] = c.fact;
        cells[`${prefix}:forecast`] = forecast ? Math.round(c.forecast) : null;
      };
      months.forEach((m, i) => put(m, r.cells[i]!, r.kind !== "balance" && showMonthForecast(m, today)));
      put("total", r.total, r.kind !== "balance" && hasForecastGap(r.total));
      return { kind: r.kind === "total" ? "total" : "row", cells };
    }),
  };
}
