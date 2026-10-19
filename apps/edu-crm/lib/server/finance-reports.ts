import "server-only";
import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  courses,
  expensePlans,
  expenses,
  financeCategories,
  groups,
  payments,
  studentDiscounts,
  students,
} from "@ventura/db/schema/tenant";
import { formatMonth, money } from "@/lib/format";
import { addTo, monthBounds, previousMonths, sumMonths, trendMonths } from "@/lib/finance-views";
import {
  type ChargeLine,
  type ReportData,
  type ReportRow,
  chargeBase,
  chargeDiscount,
  expenseRows,
  inMonths,
  percent,
} from "@/lib/reports";
import { uz } from "@/lib/uz";
import { loadFlows } from "./dashboard";
import { loadAccountsCached } from "./finance";
import type { LoadArgs, ReportPeriod } from "./reports";

/*
 * Moliyaviy hisobotlar (E5a, ADR 0030): xarajatlar tahlili, chegirmalar tahlili, kurs bo'yicha daromad. To'lov va
 * chegirma — o'quvchi hisobidan (loadAccounts), xarajat rejasi — ADR 0016 rejalari.
 */

const t = uz.reports;
const inRange = (date: string, r: ReportPeriod["range"]) => !r || (date >= r.from && date < r.to);

/* ---------- Xarajatlar tahlili ---------- */

/** Xarajatlar ko'rinishi (grafiklar): o'zgarmas va o'zgaruvchan, oldingi davr, oylar dinamikasi, toifa qatorlari */
export interface ExpenseViewData {
  fact: number;
  plan: number | null;
  income: number;
  fixed: number;
  variable: number;
  /** Oldingi davr (o'tgan oy yoki o'tgan yil) jami xarajati; barcha davrda yo'q */
  prev: { value: number; label: string } | null;
  trend: { month: string; fixed: number; variable: number }[];
  rows: {
    category: string;
    plan: number | null;
    fact: number;
    diff: number | null;
    done: number | null;
    share: number;
    ofIncome: number | null;
  }[];
}

export async function expenseAnalysis({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const branchScope = (col: typeof expenses.branchId | typeof expensePlans.branchId) =>
    filter ? inArray(col, [...filter]) : undefined;
  // Grafik oynasi va oldingi davr bitta so'rovda (voided va filial cheklovi bir xil)
  const winMonths = trendMonths(period, today);
  const prevMonths = previousMonths(period);
  const ext = monthBounds([...winMonths, ...(prevMonths ?? [])]);
  const [facts, plans, cats, flows, series] = await Promise.all([
    db
      .select({
        categoryId: expenses.categoryId,
        category: financeCategories.name,
        amount: expenses.amount,
        date: expenses.date,
        kind: expenses.kind,
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
    db
      .select({ date: expenses.date, amount: expenses.amount, kind: expenses.kind })
      .from(expenses)
      .where(
        and(
          isNull(expenses.voidedAt),
          branchScope(expenses.branchId),
          gte(expenses.date, ext.from),
          lt(expenses.date, ext.to),
        ),
      ),
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
  const fixedBy = new Map<string, number>();
  const variableBy = new Map<string, number>();
  const totalBy = new Map<string, number>();
  for (const x of series) {
    const m = x.date.slice(0, 7);
    addTo(x.kind === "fixed" ? fixedBy : variableBy, m, Number(x.amount));
    addTo(totalBy, m, Number(x.amount));
  }
  const view: ExpenseViewData = {
    fact: factTotal,
    plan: planTotal || null,
    income,
    fixed: facts.filter((f) => f.kind === "fixed").reduce((s, f) => s + Number(f.amount), 0),
    variable: facts.filter((f) => f.kind !== "fixed").reduce((s, f) => s + Number(f.amount), 0),
    prev: prevMonths
      ? {
          value: sumMonths(totalBy, prevMonths),
          label: period.month !== null ? formatMonth(prevMonths[0]!) : t.yearLabel(period.year! - 1),
        }
      : null,
    trend: winMonths.map((month) => ({
      month,
      fixed: fixedBy.get(month) ?? 0,
      variable: variableBy.get(month) ?? 0,
    })),
    rows: rows.map((r) => ({
      category: r.category,
      plan: r.plan,
      fact: r.fact,
      diff: r.diff,
      done: r.done,
      share: r.share,
      ofIncome: percent(r.fact, income),
    })),
  };
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
    view,
  };
}

/* ---------- O'quvchi hisobidan: chegirmalar va kurs daromadi ---------- */

export async function chargesOf(db: TenantDb, filter: readonly string[] | null, today: string) {
  const list = await db
    .select({ id: students.id, name: students.name })
    .from(students)
    .where(filter ? inArray(students.branchId, [...filter]) : undefined);
  const accounts = await loadAccountsCached(
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

/** Chegirmalar ko'rinishi (grafiklar): oldingi davr, oylar dinamikasi, kurs va guruh kesimi */
export interface DiscountViewData {
  total: number;
  permanent: number;
  once: number;
  /** Chegirmasiz hisob */
  base: number;
  recipients: number;
  /** Amaldagi va muddati tugagan doimiy chegirma qoidalari (bugungi oyga) */
  activeRules: number;
  endedRules: number;
  prev: { value: number; label: string } | null;
  trend: { month: string; permanent: number; once: number }[];
  courses: { name: string; total: number; base: number }[];
  groups: { name: string; course: string; total: number; base: number }[];
}

export async function discountsReport({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
  const [{ students: list, charges }, rules, oneOff, groupRows, courseRows] = await Promise.all([
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
    db.select({ id: groups.id, name: groups.name, courseId: groups.courseId }).from(groups),
    db.select({ id: courses.id, name: courses.name }).from(courses),
  ]);
  const groupName = new Map(groupRows.map((g) => [g.id, g.name]));
  const courseName = new Map(courseRows.map((c) => [c.id, c.name]));
  const courseOfGroup = new Map(groupRows.map((g) => [g.id, g.courseId]));
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
  // Kurs va guruh kesimi (guruhi ko'rsatilmagan bir martalik chegirma — "" kalitda)
  const byGroup = new Map<string, { total: number; base: number }>();
  const bump = (groupId: string, total: number, base: number) => {
    const g = byGroup.get(groupId) ?? { total: 0, base: 0 };
    g.total += total;
    g.base += base;
    byGroup.set(groupId, g);
  };
  const permBy = new Map<string, number>();
  const onceBy = new Map<string, number>();
  for (const c of charges) {
    const d = chargeDiscount(c);
    if (d) addTo(permBy, c.month, d);
  }
  for (const c of inPeriod) {
    if (chargeBase(c) > 0) bump(c.groupId, 0, chargeBase(c));
    const d = chargeDiscount(c);
    if (!d) continue;
    bump(c.groupId, d, 0);
    const a = get(c.studentId);
    a.permanent += d;
    a.months.add(c.month);
    a.groups.add(c.groupId);
  }
  for (const e of oneOff) addTo(onceBy, e.month ?? e.date.slice(0, 7), Number(e.amount));
  for (const e of oneOff) {
    // Bir martalik chegirma — qaysi oy uchun berilgan bo'lsa o'sha oyda, oy yo'q bo'lsa sanasi bo'yicha
    if (e.month ? !inMonths(e.month, period.months) : !inRange(e.date, period.range)) continue;
    const a = get(e.studentId);
    a.once += Number(e.amount);
    if (e.groupId) a.groups.add(e.groupId);
    bump(e.groupId ?? "", Number(e.amount), 0);
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
  const thisMonth = today.slice(0, 7);
  let activeRules = 0;
  let endedRules = 0;
  for (const r of rules) {
    if (!names.has(r.studentId)) continue;
    if (r.toMonth && r.toMonth < thisMonth) endedRules++;
    else if (r.fromMonth <= thisMonth) activeRules++;
  }
  const prevMonths = previousMonths(period);
  const totalBy = new Map<string, number>();
  for (const [m, v] of permBy) addTo(totalBy, m, v);
  for (const [m, v] of onceBy) addTo(totalBy, m, v);
  const byCourse = new Map<string, { total: number; base: number }>();
  for (const [gid, g] of byGroup) {
    const key = courseOfGroup.get(gid) ?? "";
    const c = byCourse.get(key) ?? { total: 0, base: 0 };
    c.total += g.total;
    c.base += g.base;
    byCourse.set(key, c);
  }
  const view: DiscountViewData = {
    total,
    permanent: rows.reduce((s, r) => s + r.permanent, 0),
    once: rows.reduce((s, r) => s + r.once, 0),
    base: baseTotal,
    recipients: rows.length,
    activeRules,
    endedRules,
    prev: prevMonths
      ? {
          value: sumMonths(totalBy, prevMonths),
          label: period.month !== null ? formatMonth(prevMonths[0]!) : t.yearLabel(period.year! - 1),
        }
      : null,
    trend: trendMonths(period, today).map((month) => ({
      month,
      permanent: permBy.get(month) ?? 0,
      once: onceBy.get(month) ?? 0,
    })),
    courses: [...byCourse]
      .map(([id, c]) => ({ name: courseName.get(id) ?? d.unassigned, ...c }))
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total),
    groups: [...byGroup]
      .map(([id, g]) => ({
        name: groupName.get(id) ?? d.unassigned,
        course: courseName.get(courseOfGroup.get(id) ?? "") ?? "",
        ...g,
      }))
      .filter((g) => g.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6),
  };
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
    view,
  };
}

/** Kurs daromadi ko'rinishi (grafiklar): oldingi davr, hisoblangan va tushum dinamikasi, kurs qatorlari */
export interface CourseViewData {
  charged: number;
  cash: number;
  students: number;
  perStudent: number | null;
  groups: number;
  courses: number;
  /** Oldingi davr hisoblangan summasi */
  prev: { value: number; label: string } | null;
  trend: { month: string; charged: number; cash: number }[];
  rows: {
    course: string;
    groups: number;
    students: number;
    base: number;
    discount: number | null;
    charged: number;
    cash: number;
    share: number | null;
  }[];
}

export async function courseRevenue({ db, filter, period, today }: LoadArgs): Promise<ReportData> {
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
  const chargedBy = new Map<string, number>();
  const cashBy = new Map<string, number>();
  for (const c of charges) {
    if (c.amount > 0 && courseOf.get(c.groupId)) addTo(chargedBy, c.month, c.amount);
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
    if (!p.groupId || !courseOf.get(p.groupId)) continue;
    const signed = p.kind === "refund" ? -Number(p.amount) : Number(p.amount);
    addTo(cashBy, p.date.slice(0, 7), signed);
    if (!inRange(p.date, period.range)) continue;
    get(courseOf.get(p.groupId)!).cash += signed;
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
  const prevMonths = previousMonths(period);
  const view: CourseViewData = {
    charged,
    cash: cashTotal,
    students: studentsTotal,
    perStudent: studentsTotal ? Math.round(charged / studentsTotal) : null,
    groups: rows.reduce((s, r) => s + r.groups.size, 0),
    courses: rows.length,
    prev: prevMonths
      ? {
          value: sumMonths(chargedBy, prevMonths),
          label: period.month !== null ? formatMonth(prevMonths[0]!) : t.yearLabel(period.year! - 1),
        }
      : null,
    trend: trendMonths(period, today).map((month) => ({
      month,
      charged: chargedBy.get(month) ?? 0,
      cash: cashBy.get(month) ?? 0,
    })),
    rows: rows.map((r) => ({
      course: names.get(r.id) ?? "—",
      groups: r.groups.size,
      students: r.students.size,
      base: r.base,
      discount: r.base - r.charged > 0 ? r.base - r.charged : null,
      charged: r.charged,
      cash: r.cash,
      share: percent(r.charged, charged),
    })),
  };
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
    view,
  };
}
