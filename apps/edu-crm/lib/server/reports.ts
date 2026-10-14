import "server-only";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import { type Permission, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import type { TenantDb } from "@ventura/db";
import {
  courses,
  expensePlans,
  expenses,
  financeCategories,
  financePlans,
  groups,
  payments,
  studentDiscounts,
  students,
} from "@ventura/db/schema/tenant";
import { formatMonth, money } from "@/lib/format";
import {
  type ChargeLine,
  type ReportData,
  type ReportRow,
  cashflowTable,
  chargeBase,
  chargeDiscount,
  expenseRows,
  inMonths,
  type PlanCell,
  type PlanKey,
  percent,
  planTable,
  yearMonths,
} from "@/lib/reports";
import { uz } from "@/lib/uz";
import { leavesReport, retentionReport, riskReport } from "./academic-reports";
import type { BranchContext } from "./branch";
import { funnelReport, lostReport, seasonalReport, sourcesReport } from "./lead-reports";
import { loadFlows } from "./dashboard";
import { loadAccounts } from "./finance";

/*
 * Hisobotlar ro'yxati va ma'lumoti (E5a, ADR 0030). Har hisobot: guruh, ruxsat, bo'lim, davr turi va yuklovchi.
 * Raqamlar ro'yxat sahifalaridagi bilan bir xil funksiyalardan: pul oqimi — bosh panel (loadFlows), to'lov va
 * chegirma — o'quvchi hisobi (loadAccounts), xarajat rejasi — ADR 0016 rejalari.
 */

const t = uz.reports;

/** year — faqat yil; period — yil + oy yoki barcha davr; month — yil + oy (barcha davrsiz); none — bugungi holat */
export type PeriodMode = "year" | "period" | "month" | "none";

/** Davr: yil (oy yo'q) yoki yil + oy; `months` null — barcha davr */
export interface ReportPeriod {
  year: number | null;
  month: number | null;
  months: string[] | null;
  /** [from, to) — sanalar; null — barcha davr */
  range: { from: string; to: string } | null;
  label: string;
}

export function reportPeriod(params: { yil?: string; oy?: string }, today: string, mode: PeriodMode): ReportPeriod {
  if (mode === "none") return { year: null, month: null, months: null, range: null, label: t.now };
  const cy = Number(today.slice(0, 4));
  const y =
    params.yil === "all" && mode === "period" ? null : /^\d{4}$/.test(params.yil ?? "") ? Number(params.yil) : cy;
  const m =
    mode === "year" || y === null
      ? null
      : params.oy === undefined
        ? Number(today.slice(5, 7))
        : /^(?:[1-9]|1[0-2])$/.test(params.oy)
          ? Number(params.oy)
          : null;
  if (y === null) return { year: null, month: null, months: null, range: null, label: t.allTime };
  if (m === null) {
    return {
      year: y,
      month: null,
      months: yearMonths(y),
      range: { from: `${y}-01-01`, to: `${y + 1}-01-01` },
      label: t.yearLabel(y),
    };
  }
  const key = `${y}-${String(m).padStart(2, "0")}`;
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { year: y, month: m, months: [key], range: { from: `${key}-01`, to: `${next}-01` }, label: formatMonth(key) };
}

export interface LoadArgs {
  db: TenantDb;
  filter: readonly string[] | null;
  period: ReportPeriod;
  today: string;
  /** Xodimda moliyaviy ruxsat bor — pul ustunlari ko'rinadi (masalan manbalar tushumi) */
  finance?: boolean;
}

export interface ReportDef {
  group: "finance" | "academic" | "leads" | "teachers";
  feature: string;
  permissions: readonly Permission[];
  periodMode: PeriodMode;
  load(args: LoadArgs): Promise<ReportData>;
}

const FINANCE: readonly Permission[] = ["dashboard.financial_stats"];
/** O'quv hisobotlari (E5 qarori 7) */
const ACADEMIC: readonly Permission[] = ["dashboard.view"];
/** Lid hisobotlari (E5 qarori 7) */
const LEADS: readonly Permission[] = ["dashboard.conversion_stats"];

const inRange = (date: string, r: ReportPeriod["range"]) => !r || (date >= r.from && date < r.to);

/* ---------- Pul oqimi ---------- */

async function cashflow({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
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

async function cashflowPlan({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
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
export const PLAN_EDIT: readonly Permission[] = FINANCE;

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

/* ---------- Xarajatlar tahlili ---------- */

async function expenseAnalysis({ db, filter, period }: LoadArgs): Promise<ReportData> {
  const branchScope = (col: typeof expenses.branchId | typeof expensePlans.branchId) =>
    filter ? inArray(col, [...filter]) : undefined;
  const [facts, plans, cats, flows] = await Promise.all([
    db
      .select({
        categoryId: expenses.categoryId,
        category: financeCategories.name,
        amount: expenses.amount,
        date: expenses.date,
      })
      .from(expenses)
      .innerJoin(financeCategories, eq(financeCategories.id, expenses.categoryId))
      .where(
        and(
          isNull(expenses.voidedAt),
          branchScope(expenses.branchId),
          period.range ? gte(expenses.date, period.range.from) : undefined,
          period.range ? lt(expenses.date, period.range.to) : undefined,
        ),
      ),
    db
      .select({ categoryId: expensePlans.categoryId, amount: expensePlans.amount })
      .from(expensePlans)
      .where(
        and(branchScope(expensePlans.branchId), period.months ? inArray(expensePlans.month, period.months) : undefined),
      ),
    db.select({ id: financeCategories.id, name: financeCategories.name }).from(financeCategories),
    loadFlows(db, filter),
  ]);
  const rows = expenseRows(
    facts.map((f) => ({ categoryId: f.categoryId, category: f.category, amount: Number(f.amount) })),
    plans.map((p) => ({ categoryId: p.categoryId, amount: Number(p.amount) })),
    new Map(cats.map((c) => [c.id, c.name])),
  );
  const income = flows
    .filter((f) => (f.kind === "pay" || f.kind === "income") && inRange(f.date, period.range))
    .reduce((s, f) => s + f.amount, 0);
  const factTotal = rows.reduce((s, r) => s + r.fact, 0);
  const planTotal = rows.reduce((s, r) => s + (r.plan ?? 0), 0);
  const e = t.expenses;
  return {
    metrics: [
      { label: e.fact, value: factTotal, kind: "money", tone: "danger" },
      { label: e.plan, value: planTotal || null, kind: "money", foot: planTotal ? undefined : e.noPlan },
      {
        label: e.done,
        value: percent(factTotal, planTotal),
        kind: "percent",
        tone: planTotal && factTotal > planTotal ? "danger" : "neutral",
      },
      { label: e.ofIncome, value: percent(factTotal, income), kind: "percent", foot: e.incomeFoot(money(income)) },
    ],
    table: {
      columns: [
        { key: "category", label: e.category, kind: "text" },
        { key: "plan", label: e.plan, kind: "money" },
        { key: "fact", label: e.fact, kind: "money" },
        { key: "diff", label: e.diff, kind: "money" },
        { key: "done", label: e.done, kind: "percent" },
        { key: "share", label: e.share, kind: "percent" },
        { key: "ofIncome", label: e.ofIncome, kind: "percent" },
      ],
      rows: [
        ...rows.map((r): ReportRow => ({
          cells: {
            category: r.category,
            plan: r.plan,
            fact: r.fact,
            diff: r.diff,
            done: r.done,
            share: r.share,
            ofIncome: percent(r.fact, income),
          },
        })),
        {
          kind: "total",
          cells: {
            category: uz.reports.total,
            plan: planTotal || null,
            fact: factTotal,
            diff: planTotal ? planTotal - factTotal : null,
            done: percent(factTotal, planTotal),
            share: factTotal ? 100 : null,
            ofIncome: percent(factTotal, income),
          },
        },
      ],
    },
    note: e.note,
  };
}

/* ---------- O'quvchi hisobidan: chegirmalar va kurs daromadi ---------- */

async function chargesOf(db: TenantDb, filter: readonly string[] | null, today: string) {
  const list = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(filter ? inArray(students.branchId, [...filter]) : undefined);
  const accounts = await loadAccounts(
    db,
    list.map((s) => s.id),
    today,
  );
  const charges: ChargeLine[] = [];
  for (const [studentId, a] of accounts)
    for (const c of a.charges)
      charges.push({
        studentId,
        groupId: c.groupId,
        month: c.month,
        basePrice: c.basePrice,
        fullPrice: c.fullPrice,
        lessons: c.lessons,
        charged: c.charged,
        amount: c.amount,
      });
  return { students: list, charges };
}

async function discountsReport({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const [{ students: list, charges }, rules, oneOff, groupRows] = await Promise.all([
    chargesOf(db, filter, today),
    db.select().from(studentDiscounts),
    db
      .select({
        studentId: payments.studentId,
        amount: payments.amount,
        month: payments.month,
        date: payments.date,
        groupId: payments.groupId,
      })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .where(
        and(
          eq(payments.kind, "discount"),
          isNull(payments.voidedAt),
          filter ? inArray(students.branchId, [...filter]) : undefined,
        ),
      ),
    db.select({ id: groups.id, name: groups.name }).from(groups),
  ]);
  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));
  const names = new Map(list.map((s) => [s.id, s.name]));
  const inPeriod = charges.filter((c) => inMonths(c.month, period.months));
  const baseTotal = inPeriod.reduce((s, c) => s + chargeBase(c), 0);

  interface Acc {
    permanent: number;
    once: number;
    months: Set<string>;
    groups: Set<string>;
  }
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { permanent: 0, once: 0, months: new Set(), groups: new Set() }));
    return a;
  };
  for (const c of inPeriod) {
    const d = chargeDiscount(c);
    if (!d) continue;
    const a = get(c.studentId);
    a.permanent += d;
    a.months.add(c.month);
    a.groups.add(c.groupId);
  }
  for (const e of oneOff) {
    // Bir martalik chegirma — qaysi oy uchun berilgan bo'lsa o'sha oyda, oy yo'q bo'lsa sanasi bo'yicha
    if (e.month ? !inMonths(e.month, period.months) : !inRange(e.date, period.range)) continue;
    const a = get(e.studentId);
    a.once += Number(e.amount);
    if (e.groupId) a.groups.add(e.groupId);
  }
  const reasonsOf = new Map<string, string[]>();
  for (const r of rules) {
    const label = `${r.kind === "percent" ? `${r.value}%` : `${money(r.value)} ${uz.common.som}`} · ${r.reason}`;
    reasonsOf.set(r.studentId, [...(reasonsOf.get(r.studentId) ?? []), label]);
  }

  const rows = [...acc]
    .map(([id, a]) => ({ id, ...a, total: a.permanent + a.once }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
  const total = rows.reduce((s, r) => s + r.total, 0);
  const d = t.discounts;
  return {
    metrics: [
      { label: d.total, value: total, kind: "money", tone: "warning" },
      { label: d.students, value: rows.length, kind: "number" },
      { label: d.share, value: percent(total, baseTotal), kind: "percent", foot: d.shareFoot },
      { label: d.average, value: rows.length ? Math.round(total / rows.length) : null, kind: "money" },
    ],
    table: {
      columns: [
        { key: "student", label: d.student, kind: "text" },
        { key: "groups", label: d.groups, kind: "text" },
        { key: "rules", label: d.rules, kind: "text" },
        { key: "months", label: d.months, kind: "number" },
        { key: "permanent", label: d.permanent, kind: "money" },
        { key: "once", label: d.once, kind: "money" },
        { key: "total", label: d.sum, kind: "money" },
      ],
      rows: [
        ...rows.map((r): ReportRow => ({
          href: `/students/${r.id}`,
          cells: {
            student: names.get(r.id) ?? "—",
            groups: [...r.groups].map((g) => groupName.get(g) ?? "—").join(", "),
            rules: (reasonsOf.get(r.id) ?? []).join("; ") || "—",
            months: r.months.size || null,
            permanent: r.permanent || null,
            once: r.once || null,
            total: r.total,
          },
        })),
        {
          kind: "total",
          cells: {
            student: uz.reports.total,
            permanent: rows.reduce((s, r) => s + r.permanent, 0),
            once: rows.reduce((s, r) => s + r.once, 0),
            total,
          },
        },
      ],
    },
    note: d.note,
  };
}

async function courseRevenue({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const [{ charges }, groupRows, courseRows, cash] = await Promise.all([
    chargesOf(db, filter, today),
    db
      .select({ id: groups.id, courseId: groups.courseId, archivedAt: groups.archivedAt })
      .from(groups)
      .where(filter ? inArray(groups.branchId, [...filter]) : undefined),
    db.select({ id: courses.id, name: courses.name }).from(courses),
    db
      .select({ groupId: payments.groupId, amount: payments.amount, kind: payments.kind, date: payments.date })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .where(
        and(
          inArray(payments.kind, ["payment", "refund"]),
          isNull(payments.voidedAt),
          filter ? inArray(students.branchId, [...filter]) : undefined,
        ),
      ),
  ]);
  const courseOf = new Map(groupRows.map((g) => [g.id, g.courseId]));
  interface Acc {
    groups: Set<string>;
    students: Set<string>;
    base: number;
    charged: number;
    cash: number;
  }
  const acc = new Map<string, Acc>();
  const get = (id: string) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { groups: new Set(), students: new Set(), base: 0, charged: 0, cash: 0 }));
    return a;
  };
  for (const c of charges) {
    if (!inMonths(c.month, period.months) || c.amount <= 0) continue;
    const courseId = courseOf.get(c.groupId);
    if (!courseId) continue;
    const a = get(courseId);
    a.groups.add(c.groupId);
    a.students.add(c.studentId);
    a.base += chargeBase(c);
    a.charged += c.amount;
  }
  for (const p of cash) {
    if (!p.groupId || !inRange(p.date, period.range)) continue;
    const courseId = courseOf.get(p.groupId);
    if (!courseId) continue;
    get(courseId).cash += p.kind === "refund" ? -Number(p.amount) : Number(p.amount);
  }
  const names = new Map(courseRows.map((c) => [c.id, c.name]));
  const rows = [...acc]
    .map(([id, a]) => ({ id, ...a }))
    .filter((r) => r.charged || r.cash)
    .sort((a, b) => b.charged - a.charged);
  const charged = rows.reduce((s, r) => s + r.charged, 0);
  const cashTotal = rows.reduce((s, r) => s + r.cash, 0);
  const studentsTotal = new Set(rows.flatMap((r) => [...r.students])).size;
  const k = t.courses;
  return {
    metrics: [
      { label: k.charged, value: charged, kind: "money", tone: "primary" },
      { label: k.cash, value: cashTotal, kind: "money", tone: "success" },
      { label: k.students, value: studentsTotal, kind: "number" },
      { label: k.perStudent, value: studentsTotal ? Math.round(charged / studentsTotal) : null, kind: "money" },
    ],
    table: {
      columns: [
        { key: "course", label: k.course, kind: "text" },
        { key: "groups", label: k.groups, kind: "number" },
        { key: "students", label: k.students, kind: "number" },
        { key: "base", label: k.base, kind: "money" },
        { key: "discount", label: k.discount, kind: "money" },
        { key: "charged", label: k.charged, kind: "money" },
        { key: "cash", label: k.cash, kind: "money" },
        { key: "share", label: k.share, kind: "percent" },
      ],
      rows: [
        ...rows.map((r): ReportRow => ({
          cells: {
            course: names.get(r.id) ?? "—",
            groups: r.groups.size,
            students: r.students.size,
            base: r.base,
            discount: r.base - r.charged > 0 ? r.base - r.charged : null,
            charged: r.charged,
            cash: r.cash,
            share: percent(r.charged, charged),
          },
        })),
        {
          kind: "total",
          cells: {
            course: uz.reports.total,
            groups: rows.reduce((s, r) => s + r.groups.size, 0),
            students: studentsTotal,
            base: rows.reduce((s, r) => s + r.base, 0),
            discount: rows.reduce((s, r) => s + Math.max(0, r.base - r.charged), 0) || null,
            charged,
            cash: cashTotal,
            share: charged ? 100 : null,
          },
        },
      ],
    },
    note: k.note,
  };
}

/* ---------- Ro'yxat ---------- */

export const REPORTS = {
  cashflow: { group: "finance", feature: "payments", permissions: FINANCE, periodMode: "year", load: cashflow },
  plan: { group: "finance", feature: "payments", permissions: FINANCE, periodMode: "month", load: cashflowPlan },
  expenses: {
    group: "finance",
    feature: "expenses",
    permissions: FINANCE,
    periodMode: "period",
    load: expenseAnalysis,
  },
  discounts: {
    group: "finance",
    feature: "payments",
    permissions: FINANCE,
    periodMode: "period",
    load: discountsReport,
  },
  courses: { group: "finance", feature: "payments", permissions: FINANCE, periodMode: "period", load: courseRevenue },
  leaves: { group: "academic", feature: "groups", permissions: ACADEMIC, periodMode: "period", load: leavesReport },
  risk: { group: "academic", feature: "attendance", permissions: ACADEMIC, periodMode: "none", load: riskReport },
  retention: {
    group: "academic",
    feature: "groups",
    permissions: ACADEMIC,
    periodMode: "period",
    load: retentionReport,
  },
  funnel: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: funnelReport },
  lost: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: lostReport },
  sources: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "period", load: sourcesReport },
  seasonal: { group: "leads", feature: "leads", permissions: LEADS, periodMode: "year", load: seasonalReport },
} as const satisfies Record<string, ReportDef>;

export type ReportKey = keyof typeof REPORTS;

/** Guruhlar tartibi (hisobotlar sahifasi va menyu) */
export const REPORT_GROUPS: readonly ReportDef["group"][] = ["finance", "academic", "leads", "teachers"];

/** Xodimga ochiq hisobotlar: ruxsati bor va bo'limi yoqilgan */
export async function visibleReports(
  tenant: Parameters<typeof hasFeature>[0],
  access: Parameters<typeof canAny>[0],
): Promise<ReportKey[]> {
  const keys: ReportKey[] = [];
  for (const [key, def] of Object.entries(REPORTS) as [ReportKey, ReportDef][])
    if (canAny(access, def.permissions) && (await hasFeature(tenant, def.feature))) keys.push(key);
  return keys;
}
export const isReportKey = (k: string): k is ReportKey => Object.hasOwn(REPORTS, k);
