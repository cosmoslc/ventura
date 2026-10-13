import "server-only";
import { and, count, desc, eq, inArray, isNull, or, sql, sum } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  additionalIncomes,
  attendance,
  expenses,
  financeCategories,
  groups,
  payments,
  salaryEntries,
  students,
  teachers,
  userBranches,
} from "@ventura/db/schema/tenant";
import { listGroups, openGroupsByStudent } from "@/app/(crm)/groups/data";
import {
  type DayFlow,
  type Period,
  type Range,
  type Totals,
  addDays,
  addMonths,
  inRange,
  monthRange,
  totalsFor,
} from "@/lib/dashboard";
import { loadAccounts } from "./finance";

/*
 * Bosh panel ma'lumoti (ADR 0017). Pul oqimi va davomat bazada kunlar bo'yicha yig'iladi (bekor qilinganlar
 * kirmaydi), oylik hisob va qarz — o'quvchi hisobidan (lib/billing.ts, lib/ledger.ts): Qarzdorlar sahifasi bilan
 * bir xil manba, alohida formula yo'q.
 */

export interface MonthPoint {
  month: string;
  income: number;
  outflow: number;
  profit: number;
  refund: number;
  advance: number;
  payCount: number;
  /** Davomat foizi; null — belgilanmagan */
  att: number | null;
  newStudents: number;
}

export interface DayPoint {
  date: string;
  income: number;
  outflow: number;
  payCount: number;
}

export interface DashboardGroup {
  id: string;
  name: string;
  count: number;
  cap: number | null;
  /** Fokus oyi uchun hisoblangan */
  expected: number;
  /** Fokus oyi hisobidan yopilgani */
  covered: number;
  payPct: number;
  /** Barcha oylar bo'yicha guruh qarzi */
  debt: number;
  debtors: number;
  att: number | null;
  teacherName: string;
  /** Bugun darsi bor */
  today: boolean;
}

export interface DashboardEvent {
  id: string;
  date: string;
  name: string;
  group: string | null;
  amount: number;
  refund: boolean;
}

export interface DashboardData {
  cur: Totals;
  prev: Totals | null;
  months: MonthPoint[];
  days: DayPoint[];
  attendance: { cur: number | null; prev: number | null };
  students: {
    active: number;
    trial: number;
    paused: number;
    left: number;
    graduated: number;
    noGroup: number;
    newInPeriod: number;
  };
  expected: number;
  covered: number;
  totalDebt: number;
  debtors: number;
  groups: DashboardGroup[];
  tiles: {
    groups: number;
    avgPerGroup: number;
    activeTeachers: number;
    teachers: number;
    avgFill: number | null;
    rooms: number;
    todayLessons: number;
    studentsToday: number;
  };
  events: DashboardEvent[];
  years: number[];
}

const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const pct = (ok: number, tot: number) => (tot ? (ok / tot) * 100 : null);

export async function loadDashboard(
  db: TenantDb,
  filter: readonly string[] | null,
  period: Period,
  today: string,
): Promise<DashboardData> {
  const studentScope = filter ? inArray(students.branchId, [...filter]) : undefined;
  const groupScope = filter ? inArray(groups.branchId, [...filter]) : undefined;

  const [payRows, incomeRows, expenseRows, attRows, studentRows, groupList, teacherCount, recent] = await Promise.all([
    db
      .select({ date: payments.date, kind: payments.kind, amount: sum(payments.amount), n: count() })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .where(and(isNull(payments.voidedAt), inArray(payments.kind, ["payment", "refund"]), studentScope))
      .groupBy(payments.date, payments.kind),
    db
      .select({ date: additionalIncomes.date, amount: sum(additionalIncomes.amount), n: count() })
      .from(additionalIncomes)
      .where(
        and(isNull(additionalIncomes.voidedAt), filter ? inArray(additionalIncomes.branchId, [...filter]) : undefined),
      )
      .groupBy(additionalIncomes.date),
    db
      .select({ date: expenses.date, category: financeCategories.name, amount: sum(expenses.amount), n: count() })
      .from(expenses)
      .innerJoin(financeCategories, eq(financeCategories.id, expenses.categoryId))
      .where(and(isNull(expenses.voidedAt), filter ? inArray(expenses.branchId, [...filter]) : undefined))
      .groupBy(expenses.date, financeCategories.name),
    db
      .select({
        date: attendance.date,
        groupId: attendance.groupId,
        ok: sql<number>`count(*) filter (where ${attendance.status} in ('present', 'late'))`.mapWith(Number),
        tot: count(),
      })
      .from(attendance)
      .innerJoin(groups, eq(groups.id, attendance.groupId))
      .where(groupScope)
      .groupBy(attendance.date, attendance.groupId),
    db
      .select({
        id: students.id,
        status: students.status,
        joinedAt: students.joinedAt,
        archivedAt: students.archivedAt,
      })
      .from(students)
      .where(studentScope),
    listGroups(db, filter),
    db
      .select({ n: count() })
      .from(teachers)
      .where(and(isNull(teachers.archivedAt), filter ? inArray(teachers.branchId, [...filter]) : undefined)),
    db
      .select({
        id: payments.id,
        date: payments.date,
        kind: payments.kind,
        amount: payments.amount,
        name: students.name,
        group: groups.name,
      })
      .from(payments)
      .innerJoin(students, eq(students.id, payments.studentId))
      .leftJoin(groups, eq(groups.id, payments.groupId))
      .where(and(isNull(payments.voidedAt), inArray(payments.kind, ["payment", "refund"]), studentScope))
      .orderBy(desc(payments.createdAt))
      .limit(24),
  ]);

  // Berilgan ish haqi (maosh va avans, ADR 0018): filial — o'qituvchi filiali yoki xodimning biriktirilgan filiallari
  const salaryRows = await db
    .select({ date: salaryEntries.date, kind: salaryEntries.kind, amount: sum(salaryEntries.amount), n: count() })
    .from(salaryEntries)
    .leftJoin(teachers, eq(teachers.id, salaryEntries.teacherId))
    .where(
      and(
        isNull(salaryEntries.voidedAt),
        inArray(salaryEntries.kind, ["salary", "advance"]),
        filter
          ? or(
              inArray(teachers.branchId, [...filter]),
              inArray(
                salaryEntries.userId,
                db
                  .select({ id: userBranches.userId })
                  .from(userBranches)
                  .where(inArray(userBranches.branchId, [...filter])),
              ),
            )
          : undefined,
      ),
    )
    .groupBy(salaryEntries.date, salaryEntries.kind);

  /* ---------- Pul oqimi ---------- */
  const flows: DayFlow[] = [
    ...salaryRows.map((r) => ({
      date: r.date,
      kind: r.kind === "advance" ? ("advance" as const) : ("salary" as const),
      amount: Number(r.amount ?? 0),
      count: r.n,
    })),
    ...payRows.map((r) => ({
      date: r.date,
      kind: r.kind === "refund" ? ("refund" as const) : ("pay" as const),
      amount: Number(r.amount ?? 0),
      count: r.n,
    })),
    ...incomeRows.map((r) => ({ date: r.date, kind: "income" as const, amount: Number(r.amount ?? 0), count: r.n })),
    ...expenseRows.map((r) => ({
      date: r.date,
      kind: "expense" as const,
      amount: Number(r.amount ?? 0),
      count: r.n,
      category: r.category,
    })),
  ];

  /* ---------- Davomat ---------- */
  const attFor = (r: Range) => {
    let ok = 0;
    let tot = 0;
    for (const a of attRows) {
      if (!inRange(a.date, r)) continue;
      ok += a.ok;
      tot += a.tot;
    }
    return pct(ok, tot);
  };

  /* ---------- O'quvchilar ---------- */
  const live = studentRows.filter((s) => !s.archivedAt);
  const open = await openGroupsByStudent(
    db,
    live.map((s) => s.id),
  );
  const st = { active: 0, trial: 0, paused: 0, left: 0, graduated: 0, noGroup: 0, newInPeriod: 0 };
  for (const s of live) {
    if (s.status === "left") st.left++;
    else if (s.status === "graduated") st.graduated++;
    else if (s.status === "paused") st.paused++;
    else if (s.status === "trial") st.trial++;
    else if ((open.get(s.id) ?? []).length) st.active++;
    else st.noGroup++;
    if (inRange(s.joinedAt, period.cur)) st.newInPeriod++;
  }

  /* ---------- 12 oy va 30 kun ---------- */
  const months: MonthPoint[] = Array.from({ length: 12 }, (_, i) => {
    const month = addMonths(period.focusMonth, i - 11);
    const r = monthRange(month);
    const t = totalsFor(flows, r);
    return {
      month,
      income: t.income,
      outflow: t.outflow,
      profit: t.profit,
      refund: t.refund,
      advance: t.advance,
      payCount: t.payCount,
      att: attFor(r),
      newStudents: live.filter((s) => inRange(s.joinedAt, r)).length,
    };
  });
  const days: DayPoint[] = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(period.anchor, i - 29);
    const t = totalsFor(flows, { from: date, to: addDays(date, 1) });
    return { date, income: t.income, outflow: t.outflow, payCount: t.payCount };
  });

  /* ---------- Guruhlar (fokus oyi) va qarz ---------- */
  const accounts = await loadAccounts(
    db,
    studentRows.map((s) => s.id),
    today,
  );
  const fm = period.focusMonth;
  const byGroup = new Map<string, { expected: number; covered: number; debt: number; debtors: number }>();
  let totalDebt = 0;
  let debtors = 0;
  for (const acc of accounts.values()) {
    if (acc.summary.debt > 0) {
      totalDebt += acc.summary.debt;
      debtors++;
    }
    for (const g of acc.summary.groups) {
      const cell = byGroup.get(g.groupId) ?? { expected: 0, covered: 0, debt: 0, debtors: 0 };
      const m = g.months.find((x) => x.month === fm);
      if (m) {
        cell.expected += m.amount;
        cell.covered += m.covered;
      }
      const due = g.months.reduce((s, x) => s + x.due, 0);
      if (due > 0) {
        cell.debt += due;
        cell.debtors++;
      }
      byGroup.set(g.groupId, cell);
    }
  }
  const attByGroup = new Map<string, { ok: number; tot: number }>();
  for (const a of attRows) {
    if (!inRange(a.date, period.cur)) continue;
    const c = attByGroup.get(a.groupId) ?? { ok: 0, tot: 0 };
    c.ok += a.ok;
    c.tot += a.tot;
    attByGroup.set(a.groupId, c);
  }
  const weekday = WEEKDAYS[new Date(`${today}T00:00:00Z`).getUTCDay()]!;
  const groupRows: DashboardGroup[] = groupList.map((g) => {
    const f = byGroup.get(g.id) ?? { expected: 0, covered: 0, debt: 0, debtors: 0 };
    const n = g.members.active + g.members.trial + g.members.paused;
    const a = attByGroup.get(g.id);
    return {
      id: g.id,
      name: g.name,
      count: n,
      cap: g.roomCapacity,
      expected: f.expected,
      covered: f.covered,
      payPct: f.expected > 0 ? Math.min(100, Math.round((f.covered / f.expected) * 100)) : f.covered > 0 ? 100 : 0,
      debt: f.debt,
      debtors: f.debtors,
      att: a ? pct(a.ok, a.tot) : null,
      teacherName: g.teacherName,
      today: (g.days as readonly string[]).includes(weekday),
    };
  });
  // Guruh profilidagidek: fokus oyi hisobi — barcha guruhlar (arxivdagilari ham, agar shu oyda hisob bo'lsa)
  let expected = 0;
  let covered = 0;
  for (const c of byGroup.values()) {
    expected += c.expected;
    covered += c.covered;
  }

  const withCap = groupRows.filter((g) => g.cap);
  const todayGroups = groupRows.filter((g) => g.today);
  const years = new Set<number>([Number(today.slice(0, 4))]);
  for (const f of flows) years.add(Number(f.date.slice(0, 4)));

  return {
    cur: totalsFor(flows, period.cur),
    prev: period.prev ? totalsFor(flows, period.prev) : null,
    months,
    days,
    attendance: { cur: attFor(period.cur), prev: period.prev ? attFor(period.prev) : null },
    students: st,
    expected,
    covered,
    totalDebt,
    debtors,
    groups: groupRows,
    tiles: {
      groups: groupRows.length,
      avgPerGroup: groupRows.length ? Math.round(groupRows.reduce((s, g) => s + g.count, 0) / groupRows.length) : 0,
      activeTeachers: new Set(groupList.map((g) => g.teacherId)).size,
      teachers: teacherCount[0]?.n ?? 0,
      avgFill: withCap.length
        ? withCap.reduce((s, g) => s + Math.min(100, (g.count / g.cap!) * 100), 0) / withCap.length
        : null,
      rooms: new Set(groupList.map((g) => g.roomId).filter(Boolean)).size,
      todayLessons: todayGroups.length,
      studentsToday: todayGroups.reduce((s, g) => s + g.count, 0),
    },
    events: recent.map((r) => ({
      id: r.id,
      date: r.date,
      name: r.name,
      group: r.group,
      amount: r.amount,
      refund: r.kind === "refund",
    })),
    years: [...years].sort((a, b) => b - a),
  };
}
