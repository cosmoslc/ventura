import "server-only";
import { and, inArray } from "drizzle-orm";
import type { Permission } from "@ventura/auth/staff/policy";
import type { TenantDb } from "@ventura/db";
import { expensePlans, financePlans } from "@ventura/db/schema/tenant";
import { money } from "@/lib/format";
import {
  type ReportData,
  type ReportRow,
  cashflowTable,
  type PlanCell,
  type PlanKey,
  percent,
  planTable,
  yearMonths,
} from "@/lib/reports";
import { uz } from "@/lib/uz";
import type { BranchContext } from "./branch";
import { loadFlows } from "./dashboard";
import { chargesOf } from "./finance-reports";
import type { LoadArgs } from "./reports";

/*
 * Pul oqimi va "Reja, fakt va prognoz" hisobotlari (E5a, ADR 0030). Pul oqimi — bosh panel bilan bir xil manba
 * (loadFlows), reja — finance_plans va ADR 0016 xarajat rejalari.
 */

const t = uz.reports;

/* ---------- Pul oqimi ---------- */

export async function cashflow({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const flows = await loadFlows(db, filter);
  const year = period.year ?? Number(today.slice(0, 4));
  const table = cashflowTable(flows, year, today, {
    ...t.cashflow,
    months: uz.months.map((m) => m.slice(0, 3)),
  });
  const total = (label: string) => {
    const row = table.rows.find((r) => r.cells.label === label);
    return (row?.cells.total as number | null) ?? 0;
  };
  const income = total(t.cashflow.incomeTotal);
  const outflow = total(t.cashflow.outflowTotal);
  const passed = yearMonths(year).filter((m) => m <= today.slice(0, 7)).length;
  return {
    metrics: [
      { label: t.cashflow.incomeTotal, value: income, kind: "money", tone: "success" },
      { label: t.cashflow.outflowTotal, value: outflow, kind: "money", tone: "danger" },
      {
        label: t.cashflow.net,
        value: income - outflow,
        kind: "money",
        tone: income - outflow < 0 ? "danger" : "primary",
      },
      {
        label: t.cashflow.avgIncome,
        value: passed ? Math.round(income / passed) : null,
        kind: "money",
        foot: t.cashflow.avgFoot(passed),
      },
    ],
    table,
    note: t.cashflow.note,
  };
}

/* ---------- Reja, fakt va prognoz ---------- */

/** Joriy oyda o'quvchilar hisobidagi hisoblangan summa — to'lovlar prognozi uchun */
async function expectedPayments(db: TenantDb, filter: readonly string[] | null, today: string) {
  const { charges } = await chargesOf(db, filter, today);
  const month = today.slice(0, 7);
  return charges.filter((c) => c.month === month).reduce((s, c) => s + c.amount, 0);
}

export async function cashflowPlan({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const months = period.months ?? yearMonths(Number(today.slice(0, 4)));
  const scope = (col: typeof financePlans.branchId | typeof expensePlans.branchId) =>
    filter ? inArray(col, [...filter]) : undefined;
  const [flows, financeRows, expenseRows, expected] = await Promise.all([
    loadFlows(db, filter),
    db
      .select({ line: financePlans.line, month: financePlans.month, amount: financePlans.amount })
      .from(financePlans)
      .where(and(scope(financePlans.branchId), inArray(financePlans.month, months))),
    db
      .select({ month: expensePlans.month, amount: expensePlans.amount })
      .from(expensePlans)
      .where(and(scope(expensePlans.branchId), inArray(expensePlans.month, months))),
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

  const data = planTable(months, { flows, plans, expectedPayments: expected, today });
  const p = t.plan;
  const pct = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}%`);
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
