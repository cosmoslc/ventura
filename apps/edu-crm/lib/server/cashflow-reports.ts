import "server-only";
import { and, inArray } from "drizzle-orm";
import type { Permission } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { expensePlans, financePlans } from "@ventura/db/schema/tenant";
import {
  type GridLabels,
  type GridRow,
  type MonthFlow,
  type PlanMonth,
  gridRows,
  gridTable,
  monthlyFlows,
  outflowBreakdown,
  planMonths,
  shortMonth,
} from "@/lib/cashflow-views";
import { formatDate, money } from "@/lib/format";
import { type OperationalMonth, operationalTable } from "@/lib/operational";
import { cumulativeBalance, openingSummary } from "@/lib/opening-balance";
import {
  type ForecastInput,
  type PlanCell,
  type PlanKey,
  type ReportData,
  type ReportRow,
  cashflowTable,
  percent,
  planTable,
  yearMonths,
} from "@/lib/reports";
import { uz } from "@/lib/uz";
import type { BranchContext } from "./branch";
import { loadFlows } from "./dashboard";
import { chargesOf } from "./finance-reports";
import { balanceStreams, getOpeningBalances } from "./opening-balance";
import { loadOperational } from "./operational-reports";
import type { LoadArgs } from "./reports";

/*
 * Pul oqimi, reja va prognoz — bitta hisobot (E5a, ADR 0030; birlashtirish — ADR 0045). Fakt — bosh panel bilan bir xil
 * manba (loadFlows), reja — finance_plans va ADR 0016 xarajat rejalari.
 */

const t = uz.reports;

/** Birlashgan sahifa uchun qo'shimcha ma'lumot (jadval, grafiklar, operatsion bo'lim) */
export interface CashflowViewData {
  year: number;
  months: MonthFlow[];
  /** Yillik chiqim tarkibi: [nom, summa], kamayish tartibida */
  breakdown: [string, number][];
  /** Oyma-oy reja, fakt va prognoz (qatorlar, kirim, chiqim, sof oqim) */
  planMonths: PlanMonth[];
  /** Birlashgan jadval qatorlari (reja/fakt/prognoz × 12 oy) */
  grid: GridRow[];
  operational: OperationalMonth[];
}

/** Joriy oyda o'quvchilar hisobidagi hisoblangan summa — to'lovlar prognozi uchun */
async function expectedPayments(db: TenantDb, filter: readonly string[] | null, today: string) {
  const { charges } = await chargesOf(db, filter, today);
  const month = today.slice(0, 7);
  return charges.filter((c) => c.month === month).reduce((s, c) => s + c.amount, 0);
}

/** Reja va prognoz hisobi uchun kirish: reja qatorlari (finance_plans, xarajat rejalari) va kutilgan to'lov */
async function planInputs(
  db: TenantDb,
  filter: readonly string[] | null,
  months: readonly string[],
  today: string,
  flows: ForecastInput["flows"],
): Promise<ForecastInput> {
  const scope = (col: typeof financePlans.branchId | typeof expensePlans.branchId) =>
    filter ? inArray(col, [...filter]) : undefined;
  const [financeRows, expenseRows, expected] = await Promise.all([
    db
      .select({ line: financePlans.line, month: financePlans.month, amount: financePlans.amount })
      .from(financePlans)
      .where(and(scope(financePlans.branchId), inArray(financePlans.month, [...months]))),
    db
      .select({ month: expensePlans.month, amount: expensePlans.amount })
      .from(expensePlans)
      .where(and(scope(expensePlans.branchId), inArray(expensePlans.month, [...months]))),
    // Kelgusi oylar bo'lmasa o'quvchi hisobi kerak emas
    months.some((m) => m >= today.slice(0, 7)) ? expectedPayments(db, filter, today) : 0,
  ]);
  const plans: Partial<Record<PlanKey, Map<string, number>>> = {};
  const addPlan = (key: PlanKey, month: string, amount: number) => {
    const map = (plans[key] ??= new Map());
    map.set(month, (map.get(month) ?? 0) + amount);
  };
  for (const r of financeRows) addPlan(r.line, r.month, Number(r.amount));
  for (const r of expenseRows) addPlan("expenses", r.month, Number(r.amount));
  return { flows, plans, expectedPayments: expected, today };
}

const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);

/** Tanlangan oylar bo'yicha qatorlar jadvali: reja, fakt, bajarilish, prognoz (Excel'ning ikkinchi varag'i) */
function planSummary(months: readonly string[], input: ForecastInput): ReportData {
  const data = planTable(months, input);
  const p = t.plan;
  const row = (label: string, c: PlanCell, kind: ReportRow["kind"] = "row"): ReportRow => ({
    kind,
    cells: {
      label,
      plan: c.plan,
      fact: c.fact,
      done: c.plan && c.fact !== null ? percent(c.fact, c.plan) : null,
      forecast: c.forecast,
      forecastDone: c.plan ? percent(c.forecast, c.plan) : null,
    },
  });
  const section = (label: string): ReportRow => ({ kind: "section", cells: { label } });
  const { income, outflow, net, lines } = data;
  return {
    metrics: [
      {
        label: p.incomeFact,
        value: income.fact,
        kind: "money",
        tone: "success",
        foot: income.plan ? p.planFoot(money(income.plan), pct(percent(income.fact ?? 0, income.plan))) : p.noPlan,
      },
      {
        label: p.incomeForecast,
        value: income.forecast,
        kind: "money",
        tone: "primary",
        foot: income.plan ? p.ofPlan(pct(percent(income.forecast, income.plan))) : undefined,
      },
      {
        label: p.outflowForecast,
        value: outflow.forecast,
        kind: "money",
        tone: "danger",
        foot: outflow.plan ? p.ofPlan(pct(percent(outflow.forecast, outflow.plan))) : undefined,
      },
      { label: p.netForecast, value: net.forecast, kind: "money", tone: net.forecast < 0 ? "danger" : "primary" },
    ],
    table: {
      columns: [
        { key: "label", label: p.label, kind: "text" },
        { key: "plan", label: p.plan, kind: "money" },
        { key: "fact", label: p.fact, kind: "money" },
        { key: "done", label: p.done, kind: "percent" },
        { key: "forecast", label: p.forecast, kind: "money" },
        { key: "forecastDone", label: p.forecastDone, kind: "percent" },
      ],
      rows: [
        section(p.income),
        row(p.payments, lines.payments),
        row(p.extra, lines.income),
        row(p.incomeTotal, income, "total"),
        section(p.outflow),
        row(p.salary, lines.salary),
        row(p.expenses, lines.expenses),
        row(p.refunds, lines.refunds),
        row(p.outflowTotal, outflow, "total"),
        row(p.net, net, "total"),
      ],
    },
    note: p.note,
  };
}

/**
 * Tanlangan oylar uchun "Reja, fakt va prognoz" jadvali (qatorlar × reja, fakt, bajarilish, prognoz). Sahifada alohida
 * hisobot emas — Pul oqimi sahifasining bir qismi: shu hisob Excel'ning ikkinchi varag'ini beradi va testlanadi.
 */
export async function cashflowPlan({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const months = period.months ?? yearMonths(Number(today.slice(0, 4)));
  const flows = await loadFlows(db, filter);
  return planSummary(months, await planInputs(db, filter, months, today, flows));
}

/**
 * Pul oqimi (eski tizimdagi CashflowReportPage): 12 oylik jadval — har oy uchun reja, fakt, prognoz; grafiklar;
 * toifalar bo'yicha batafsil jadval va operatsion ko'rsatkichlar.
 */
export async function cashflow({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const year = period.year ?? Number(today.slice(0, 4));
  const months = yearMonths(year);
  const [flows, openings] = await Promise.all([loadFlows(db, filter), getOpeningBalances(db)]);
  // Boshlang'ich qoldiq (E6j): yig'ma qoldiq shundan boshlanadi; qoldiq kiritilmagan bo'lsa — yil boshidan
  const [streams, input, operational] = await Promise.all([
    balanceStreams(db, filter, openings, flows),
    planInputs(db, filter, months, today, flows),
    loadOperational(db, filter, year, today),
  ]);
  const balance = streams.length ? cumulativeBalance(streams, year, today) : undefined;
  const opening = openingSummary(openings, filter ?? Object.keys(openings));
  const short = uz.months.map(shortMonth);
  const table = cashflowTable(flows, year, today, { ...t.cashflow, months: short }, balance);
  const flowMonths = monthlyFlows(flows, year, today, balance);
  const pm = planMonths(months, input);
  const grid = gridRows(
    pm,
    flowMonths.map((m) => m.cumulative),
  );
  const { income, outflow, net } = planTable(months, input);
  const incomeFact = income.fact ?? 0;
  const outflowFact = outflow.fact ?? 0;
  const passed = months.filter((m) => m <= today.slice(0, 7)).length;
  const p = t.plan;
  const planFoot = (c: PlanCell) => (c.plan ? p.planFoot(money(c.plan), pct(percent(c.fact ?? 0, c.plan))) : p.noPlan);
  const gridLabels: GridLabels = {
    label: p.label,
    plan: p.plan,
    fact: p.fact,
    forecast: p.forecast,
    total: t.total,
    rows: t.cashflow.rows as GridLabels["rows"],
    months: short,
  };
  return {
    metrics: [
      { label: t.cashflow.incomeTotal, value: incomeFact, kind: "money", tone: "success", foot: planFoot(income) },
      { label: t.cashflow.outflowTotal, value: outflowFact, kind: "money", tone: "danger", foot: planFoot(outflow) },
      {
        label: t.cashflow.net,
        value: incomeFact - outflowFact,
        kind: "money",
        tone: incomeFact - outflowFact < 0 ? "danger" : "primary",
        foot: p.netForecastFoot(money(Math.round(net.forecast))),
      },
      {
        label: t.cashflow.avgIncome,
        value: passed ? Math.round(incomeFact / passed) : null,
        kind: "money",
        foot: t.cashflow.avgFoot(passed),
      },
    ],
    table,
    extra: [
      { title: t.cashflow.sheets.summary, table: planSummary(months, input).table },
      { title: t.cashflow.sheets.grid, table: gridTable(grid, months, today, gridLabels) },
      {
        title: t.cashflow.sheets.operational,
        table: operationalTable(operational, { ...t.cashflow.operational, months: uz.months }),
      },
    ],
    note: opening
      ? `${t.cashflow.note} ${t.cashflow.opening.note(money(opening.amount), formatDate(opening.date), opening.count)}`
      : t.cashflow.note,
    view: {
      year,
      months: flowMonths,
      breakdown: outflowBreakdown(flows, year, today, t.cashflow),
      planMonths: pm,
      grid,
      operational,
    } satisfies CashflowViewData,
  };
}

/** Rejani kiritish — hisobotni ko'radigan ruxsat (reja pul yozuvi emas) */
export const PLAN_EDIT: readonly Permission[] = ["dashboard.financial_stats"];

/** Rejani kiritish oynasi uchun: xodim ko'radigan filiallarning shu yildagi rejalari */
export async function planEditorRows(db: TenantDb, branch: BranchContext, year: number) {
  const ids = branch.options.map((b) => b.id);
  if (!ids.length) return [];
  const rows = await db
    .select({
      branchId: financePlans.branchId,
      month: financePlans.month,
      line: financePlans.line,
      amount: financePlans.amount,
    })
    .from(financePlans)
    .where(and(inArray(financePlans.branchId, ids), inArray(financePlans.month, yearMonths(year))));
  return rows.map((r) => ({ ...r, amount: Number(r.amount) }));
}
