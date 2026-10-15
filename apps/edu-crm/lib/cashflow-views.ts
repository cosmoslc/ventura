import { uz } from "./uz";
import type { DayFlow } from "./dashboard";
import { type ForecastInput, type PlanCell, percent, planTable } from "./reports";

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
}

/** Har oy uchun jami kirim va jami chiqim (reja, fakt, prognoz) — oyma-oy grafik uchun */
export function planMonths(months: readonly string[], input: ForecastInput): PlanMonth[] {
  return months.map((month) => {
    const t = planTable([month], input);
    return { month, income: t.income, outflow: t.outflow };
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
