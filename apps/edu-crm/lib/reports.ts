import { addMonths } from "./billing";
import type { DayFlow } from "./dashboard";

/*
 * Hisobotlar (E5, ADR 0030) — umumiy jadval tuzilmasi va moliyaviy hisobotlar hisobi, toza funksiyalar (Vitest).
 * Sahifa ham, Excel ham shu jadvaldan chiziladi: ekrandagi raqam faylda ham aynan shu.
 */

export type CellKind = "text" | "money" | "number" | "percent";
export type Cell = string | number | null;

export interface ReportColumn {
  key: string;
  label: string;
  kind: CellKind;
}

export interface ReportRow {
  /** section — bo'lim sarlavhasi (faqat birinchi katak), total — jami qatori */
  kind?: "row" | "section" | "total";
  cells: Record<string, Cell>;
  /** Birinchi katak havolasi (masalan o'quvchi profili) */
  href?: string;
}

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportRow[];
}

export interface ReportMetric {
  label: string;
  value: number | null;
  kind: CellKind;
  foot?: string;
  tone?: "neutral" | "primary" | "success" | "warning" | "danger" | "info";
}

export interface ReportData {
  metrics: ReportMetric[];
  table: ReportTable;
  /** Jadval ostidagi izoh (hisob qoidasi) */
  note?: string;
  /** Qo'shimcha jadvallar (masalan sabablar va ro'yxat) — sahifada pastda, Excel'da alohida varaq */
  extra?: { title: string; table: ReportTable }[];
  /** Hisobot ko'rinishi uchun qo'shimcha ma'lumot (grafiklar); turi yuklovchi faylida (ADR 0034) */
  view?: unknown;
}

const sumOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0);

/** Yilning 12 oyi: "YYYY-01" … "YYYY-12" */
export const yearMonths = (year: number) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

/* ---------- Pul oqimi ---------- */

export interface CashflowLabels {
  label: string;
  total: string;
  income: string;
  pay: string;
  extra: string;
  incomeTotal: string;
  outflow: string;
  salary: string;
  advance: string;
  refund: string;
  noCategory: string;
  outflowTotal: string;
  net: string;
  cumulative: string;
  months: readonly string[];
}

/**
 * Yil bo'yicha 12 oy: kirim (to'lovlar, qo'shimcha daromad), chiqim (xarajat toifalari — yillik summasi bo'yicha
 * kamayish tartibida, ish haqi, avans, qaytarishlar), sof oqim va yig'ma qoldiq. Hali kelmagan oylar — bo'sh.
 */
export function cashflowTable(flows: readonly DayFlow[], year: number, today: string, l: CashflowLabels): ReportTable {
  const months = yearMonths(year);
  const thisMonth = today.slice(0, 7);
  const future = (m: string) => m > thisMonth;
  const byMonth = (pick: (f: DayFlow) => boolean) =>
    months.map((m) =>
      future(m) ? null : sumOf(flows.filter((f) => f.date.startsWith(m) && pick(f)).map((f) => f.amount)),
    );

  const pay = byMonth((f) => f.kind === "pay");
  const extra = byMonth((f) => f.kind === "income");
  const categories = [...new Set(flows.filter((f) => f.kind === "expense").map((f) => f.category ?? ""))];
  const catRows = categories
    .map((c) => ({ name: c || l.noCategory, values: byMonth((f) => f.kind === "expense" && (f.category ?? "") === c) }))
    .filter((r) => r.values.some((v) => v))
    .sort((a, b) => sumOf(b.values.map((v) => v ?? 0)) - sumOf(a.values.map((v) => v ?? 0)));
  const salary = byMonth((f) => f.kind === "salary");
  const advance = byMonth((f) => f.kind === "advance");
  const refund = byMonth((f) => f.kind === "refund");

  const add = (...lists: (number | null)[][]) =>
    months.map((m, i) => (future(m) ? null : sumOf(lists.map((list) => list[i] ?? 0))));
  const incomeTotal = add(pay, extra);
  const outflowTotal = add(...catRows.map((r) => r.values), salary, advance, refund);
  const net = months.map((m, i) => (future(m) ? null : incomeTotal[i]! - outflowTotal[i]!));
  let running = 0;
  const cumulative = net.map((v) => (v === null ? null : (running += v)));

  const columns: ReportColumn[] = [
    { key: "label", label: l.label, kind: "text" },
    ...months.map((m, i) => ({ key: m, label: l.months[i]!, kind: "money" as const })),
    { key: "total", label: l.total, kind: "money" },
  ];
  const row = (label: string, values: (number | null)[], kind: ReportRow["kind"] = "row", total = true): ReportRow => ({
    kind,
    cells: {
      label,
      ...Object.fromEntries(months.map((m, i) => [m, values[i] ?? null])),
      total: total ? sumOf(values.map((v) => v ?? 0)) : null,
    },
  });
  const section = (label: string): ReportRow => ({ kind: "section", cells: { label } });

  return {
    columns,
    rows: [
      section(l.income),
      row(l.pay, pay),
      row(l.extra, extra),
      row(l.incomeTotal, incomeTotal, "total"),
      section(l.outflow),
      ...catRows.map((r) => row(r.name, r.values)),
      row(l.salary, salary),
      row(l.advance, advance),
      row(l.refund, refund),
      row(l.outflowTotal, outflowTotal, "total"),
      row(l.net, net, "total"),
      // Yig'ma qoldiq — oy oxiridagi holat, yillik "jami" ma'nosiz
      row(l.cumulative, cumulative, "row", false),
    ],
  };
}

/* ---------- Xarajatlar tahlili ---------- */

export interface ExpenseLine {
  categoryId: string;
  category: string;
  amount: number;
}

export interface PlanLine {
  categoryId: string;
  amount: number;
}

export interface ExpenseRow {
  categoryId: string;
  category: string;
  plan: number | null;
  fact: number;
  /** reja − fakt; reja yo'q bo'lsa null */
  diff: number | null;
  /** fakt / reja, %; reja yo'q bo'lsa null */
  done: number | null;
  /** jami xarajatdagi ulush, % */
  share: number;
}

/** Toifalar bo'yicha reja va fakt (fakt bo'yicha kamayish tartibida; faqat rejasi bor toifalar ham ko'rinadi) */
export function expenseRows(
  facts: readonly ExpenseLine[],
  plans: readonly PlanLine[],
  names: ReadonlyMap<string, string>,
): ExpenseRow[] {
  const fact = new Map<string, number>();
  for (const f of facts) fact.set(f.categoryId, (fact.get(f.categoryId) ?? 0) + f.amount);
  const plan = new Map<string, number>();
  for (const p of plans) plan.set(p.categoryId, (plan.get(p.categoryId) ?? 0) + p.amount);
  const total = sumOf([...fact.values()]);
  const ids = [...new Set([...fact.keys(), ...plan.keys()])];
  return ids
    .map((id) => {
      const f = fact.get(id) ?? 0;
      const p = plan.get(id) ?? null;
      return {
        categoryId: id,
        category: names.get(id) ?? facts.find((x) => x.categoryId === id)?.category ?? "—",
        plan: p,
        fact: f,
        diff: p === null ? null : p - f,
        done: p ? (f / p) * 100 : null,
        share: total ? (f / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.fact - a.fact || (b.plan ?? 0) - (a.plan ?? 0));
}

/* ---------- Chegirmalar va kurs daromadi (o'quvchi hisobidan) ---------- */

export interface ChargeLine {
  studentId: string;
  groupId: string;
  month: string;
  basePrice: number;
  fullPrice: number;
  lessons: number;
  charged: number;
  amount: number;
}

/**
 * Doimiy chegirma summasi shu oy hisobida: (asl narx − chegirmali narx) × to'lanadigan darslar / oydagi darslar —
 * hisoblangan summa bilan bir xil ulush (lib/billing.ts monthCharge).
 */
export function chargeDiscount(c: Pick<ChargeLine, "basePrice" | "fullPrice" | "lessons" | "charged">): number {
  if (c.lessons <= 0 || c.charged <= 0 || c.fullPrice >= c.basePrice) return 0;
  return Math.round(((c.basePrice - c.fullPrice) * c.charged) / c.lessons);
}

/** Chegirmasiz hisoblangan bo'lar edi: asl narx × to'lanadigan darslar / oydagi darslar */
export function chargeBase(c: Pick<ChargeLine, "basePrice" | "lessons" | "charged">): number {
  if (c.lessons <= 0 || c.charged <= 0) return 0;
  return Math.round((c.basePrice * c.charged) / c.lessons);
}

/** Oy davrga tushadimi: `months` — davr oylari (bo'sh — barcha davr) */
export const inMonths = (month: string, months: readonly string[] | null) => !months || months.includes(month);

/** Foiz (0..100), bo'luvchi 0 bo'lsa null */
export const percent = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);

/* ---------- Reja, fakt va prognoz ---------- */

/** Pul oqimi rejasi qatorlari: payments/income/salary — `finance_plans`, expenses — xarajat rejalari yig'indisi */
export type PlanKey = "payments" | "income" | "salary" | "expenses" | "refunds";
export const PLAN_KEYS: readonly PlanKey[] = ["payments", "income", "salary", "expenses", "refunds"];

const FLOW_KINDS: Record<PlanKey, readonly DayFlow["kind"][]> = {
  payments: ["pay"],
  income: ["income"],
  salary: ["salary", "advance"],
  expenses: ["expense"],
  refunds: ["refund"],
};

export interface PlanCell {
  plan: number | null;
  /** Hali kelmagan oy(lar) — null */
  fact: number | null;
  forecast: number;
}

export interface ForecastInput {
  flows: readonly DayFlow[];
  /** Oy → summa; qator yo'q — reja kiritilmagan */
  plans: Partial<Record<PlanKey, ReadonlyMap<string, number>>>;
  /** Joriy oyda o'quvchilar hisobidagi hisoblangan summa (to'lovlar prognozi) */
  expectedPayments: number;
  today: string;
}

/**
 * Bitta oy, bitta qator. Prognoz:
 * - o'tgan oy — fakt;
 * - joriy oy — fakt va kutilgan summadan kattasi;
 * - kelgusi oy — kutilgan summa.
 * Kutilgan: to'lovlar — joriy oy hisoblangan summasi (o'quvchilar tarkibi o'zgarmasa); qolganlari — reja, reja
 * bo'lmasa oxirgi 3 to'liq oy o'rtachasi.
 */
export function forecastCell(key: PlanKey, month: string, input: ForecastInput): PlanCell {
  const thisMonth = input.today.slice(0, 7);
  const factOf = (m: string) =>
    sumOf(input.flows.filter((f) => f.date.startsWith(m) && FLOW_KINDS[key].includes(f.kind)).map((f) => f.amount));
  const plan = input.plans[key]?.get(month) ?? null;
  const fact = month > thisMonth ? null : factOf(month);
  if (month < thisMonth) return { plan, fact, forecast: fact ?? 0 };
  const recent = [1, 2, 3].map((n) => factOf(addMonths(thisMonth, -n)));
  const expected = key === "payments" ? input.expectedPayments : (plan ?? Math.round(sumOf(recent) / 3));
  return { plan, fact, forecast: fact === null ? expected : Math.max(fact, expected) };
}

/** Bir necha oy yig'indisi: reja — hech bo'lmasa bitta oyda bo'lsa; fakt — kelgan oylar bo'yicha */
export function sumCells(cells: readonly PlanCell[]): PlanCell {
  const plans = cells.map((c) => c.plan).filter((v): v is number => v !== null);
  const facts = cells.map((c) => c.fact).filter((v): v is number => v !== null);
  return {
    plan: plans.length ? sumOf(plans) : null,
    fact: facts.length ? sumOf(facts) : null,
    forecast: sumOf(cells.map((c) => c.forecast)),
  };
}

export interface PlanTable {
  lines: Record<PlanKey, PlanCell>;
  income: PlanCell;
  outflow: PlanCell;
  net: PlanCell;
}

/** Tanlangan oylar bo'yicha har qator, jami kirim, jami chiqim va sof oqim */
export function planTable(months: readonly string[], input: ForecastInput): PlanTable {
  const lines = Object.fromEntries(
    PLAN_KEYS.map((k) => [k, sumCells(months.map((m) => forecastCell(k, m, input)))]),
  ) as Record<PlanKey, PlanCell>;
  const income = sumCells([lines.payments, lines.income]);
  const outflow = sumCells([lines.salary, lines.expenses, lines.refunds]);
  const net: PlanCell = {
    plan: income.plan !== null && outflow.plan !== null ? income.plan - outflow.plan : null,
    fact: income.fact === null ? null : income.fact - (outflow.fact ?? 0),
    forecast: income.forecast - outflow.forecast,
  };
  return { lines, income, outflow, net };
}
