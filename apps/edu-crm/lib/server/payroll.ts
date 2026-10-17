import "server-only";
import { and, asc, eq, inArray, isNotNull, isNull, ne } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import {
  groupMemberships,
  groups,
  payments,
  salaryEntries,
  students,
  teachers,
  userBranches,
  users,
} from "@ventura/db/schema/tenant";
import { activeDiscounts, addMonths, discountedPrice } from "@/lib/billing";
import {
  type GroupCash,
  type ManagerAccrual,
  type PayrollGroup,
  type Proration,
  type SalaryBalance,
  type SalaryType,
  type StudentMonth,
  type TeacherAccrual,
  type TeacherRule,
  groupShares,
  groupTerms,
  managerAccrual,
  salaryBalance,
  teacherAccrual,
  teacherFixedFrom,
} from "@/lib/payroll";
import { loadAccounts } from "./finance";
import { tashkentDate } from "./memberships";

/*
 * Oylik ish haqi hisobi ma'lumoti (ADR 0018): bazadan kirishlarni yig'ib, lib/payroll.ts dagi toza funksiyalarga
 * beradi. Ish haqi sahifasi, o'qituvchi profili va (keyin) bosh panel shu yerdan oladi.
 */

export interface TeacherPayrollRow {
  kind: "teacher";
  id: string;
  name: string;
  phone: string;
  role: "teacher" | "support";
  salaryType: SalaryType;
  rule: TeacherRule;
  /** Guruhlarda o'zgacha sozlama bor */
  mixed: boolean;
  accrual: TeacherAccrual;
  balance: SalaryBalance;
}

export interface StaffPayrollRow {
  kind: "user";
  id: string;
  name: string;
  phone: string;
  salaryType: "fixed" | "kpi";
  accrual: ManagerAccrual;
  balance: SalaryBalance;
}

export type PayrollRow = TeacherPayrollRow | StaffPayrollRow;

export interface Payroll {
  month: string;
  rows: PayrollRow[];
  /** O'qituvchilar guruhlariga tushgan pul, ulardan o'qituvchilar ulushi va markazga qolgani (eski tizimdagidek) */
  totals: { revenue: number; share: number; center: number };
}

const localPhone = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-9);

async function movesFor(db: TenantDb, month: string) {
  const rows = await db
    .select({
      userId: salaryEntries.userId,
      teacherId: salaryEntries.teacherId,
      kind: salaryEntries.kind,
      amount: salaryEntries.amount,
    })
    .from(salaryEntries)
    .where(and(eq(salaryEntries.month, month), isNull(salaryEntries.voidedAt)));
  const map = new Map<string, { kind: (typeof rows)[number]["kind"]; amount: number }[]>();
  for (const r of rows) {
    const key = r.userId ? `user:${r.userId}` : `teacher:${r.teacherId}`;
    map.set(key, [...(map.get(key) ?? []), { kind: r.kind, amount: r.amount }]);
  }
  return map;
}

/* ---------- O'qituvchilar ---------- */

/** Profil ro'yxati uchun: o'qituvchining guruhlari (qoidasi bilan), shu oy to'lovlari va o'quvchi hisoblari */
interface TeacherCtx {
  groups: { rule: TeacherRule; group: PayrollGroup }[];
  cash: GroupCash[];
  months: StudentMonth[];
}

async function teacherRows(
  db: TenantDb,
  filter: readonly string[] | null,
  month: string,
  today: string,
  moves: Awaited<ReturnType<typeof movesFor>>,
  /** Faqat shu o'qituvchi (profil uchun; bo'shatilgani ham) */
  onlyId?: string,
): Promise<{ rows: TeacherPayrollRow[]; ctx: TeacherCtx }> {
  const list = await db
    .select()
    .from(teachers)
    .where(
      onlyId
        ? eq(teachers.id, onlyId)
        : and(isNull(teachers.archivedAt), filter ? inArray(teachers.branchId, [...filter]) : undefined),
    )
    .orderBy(asc(teachers.name));
  if (!list.length) return { rows: [], ctx: { groups: [], cash: [], months: [] } };
  const groupRows = await db
    .select()
    .from(groups)
    .where(
      inArray(
        groups.teacherId,
        list.map((t) => t.id),
      ),
    );
  const groupIds = groupRows.map((g) => g.id);
  const [cashRows, members] = groupIds.length
    ? await Promise.all([
        db
          .select({
            id: payments.id,
            studentId: payments.studentId,
            groupId: payments.groupId,
            kind: payments.kind,
            amount: payments.amount,
            date: payments.date,
          })
          .from(payments)
          .where(
            and(
              inArray(payments.groupId, groupIds),
              eq(payments.month, month),
              isNull(payments.voidedAt),
              inArray(payments.kind, ["payment", "refund"]),
            ),
          ),
        db
          .select({ studentId: groupMemberships.studentId })
          .from(groupMemberships)
          .where(and(inArray(groupMemberships.groupId, groupIds), isNotNull(groupMemberships.activatedAt))),
      ])
    : [[], []];
  const cash: GroupCash[] = cashRows.map((c) => ({
    id: c.id,
    date: c.date,
    studentId: c.studentId,
    groupId: c.groupId!,
    amount: c.kind === "refund" ? -c.amount : c.amount,
  }));
  const accounts = await loadAccounts(
    db,
    members.map((m) => m.studentId),
    today,
  );
  const groupSet = new Set(groupIds);
  const months: StudentMonth[] = [];
  for (const acc of accounts.values()) {
    for (const ch of acc.charges) {
      if (ch.month !== month || !groupSet.has(ch.groupId)) continue;
      months.push({
        studentId: acc.studentId,
        groupId: ch.groupId,
        amount: ch.amount,
        basePrice: ch.basePrice,
        fullPrice: ch.fullPrice,
        teacherPrice: discountedPrice(ch.basePrice, activeDiscounts(acc.discounts, ch.groupId, month), {
          teacherOnly: true,
        }),
      });
    }
  }

  const payGroups = new Map<string, { rule: TeacherRule; group: PayrollGroup }>();
  const rows = list.map((t) => {
    const mine = groupRows.filter((g) => g.teacherId === t.id);
    const own: PayrollGroup[] = mine.map((g) => ({
      id: g.id,
      salaryType: g.teacherSalaryType,
      percent: g.teacherSalaryPercent,
      amount: g.teacherSalaryAmount,
      // Belgilangan summa ish boshlagan sanadan; aniq sana yo'q bo'lsa guruh boshlangan kundan (ADR 0043)
      fixedFrom: g.teacherSalaryFrom ?? g.startDate,
    }));
    const rule: TeacherRule = {
      salaryType: t.salaryType,
      percent: t.revenueSharePercent,
      perStudent: t.perStudentSalary,
      fixed: t.fixedSalary,
      fixedFrom: teacherFixedFrom(
        t.salaryStartDate,
        tashkentDate(t.createdAt),
        mine.map((g) => g.startDate),
      ),
    };
    for (const g of own) payGroups.set(g.id, { rule, group: g });
    const accrual = teacherAccrual(rule, own, months, cash, month);
    return {
      kind: "teacher" as const,
      id: t.id,
      name: t.name,
      phone: localPhone(t.phone),
      role: t.kind,
      salaryType: t.salaryType,
      rule,
      mixed: own.some((g) => g.salaryType !== null && g.salaryType !== t.salaryType),
      accrual,
      balance: salaryBalance(accrual.total, moves.get(`teacher:${t.id}`) ?? []),
    };
  });
  return { rows, ctx: { groups: [...payGroups.values()], cash, months } };
}

/* ---------- Xodimlar (menejer KPI) ---------- */

/** O'quvchining birinchi faollashgan oyi (eng erta a'zolik) */
async function firstActivation(db: TenantDb, studentIds: readonly string[]) {
  const map = new Map<string, string>();
  if (!studentIds.length) return map;
  const rows = await db
    .select({ studentId: groupMemberships.studentId, activatedAt: groupMemberships.activatedAt })
    .from(groupMemberships)
    .where(and(inArray(groupMemberships.studentId, [...studentIds]), isNotNull(groupMemberships.activatedAt)));
  for (const r of rows) {
    const m = r.activatedAt!.slice(0, 7);
    const cur = map.get(r.studentId);
    if (!cur || m < cur) map.set(r.studentId, m);
  }
  return map;
}

async function staffRows(
  db: TenantDb,
  filter: readonly string[] | null,
  month: string,
  today: string,
  moves: Awaited<ReturnType<typeof movesFor>>,
): Promise<StaffPayrollRow[]> {
  let list = await db
    .select()
    .from(users)
    .where(and(isNull(users.archivedAt), ne(users.role, "director")))
    .orderBy(asc(users.name));
  if (filter) {
    const links = await db
      .select()
      .from(userBranches)
      .where(inArray(userBranches.branchId, [...filter]));
    const allowed = new Set(links.map((l) => l.userId));
    list = list.filter((u) => allowed.has(u.id));
  }
  if (!list.length) return [];

  // KPI: o'zi qo'shgan o'quvchilar — shu oyda birinchi faollashganlar va o'tgan oyda faollashib, o'sha oyni to'liq to'laganlar
  const kpiUsers = list.filter((u) => u.salaryType === "kpi").map((u) => u.id);
  const brought = kpiUsers.length
    ? await db
        .select({ id: students.id, createdBy: students.createdBy })
        .from(students)
        .where(inArray(students.createdBy, kpiUsers))
    : [];
  const first = await firstActivation(
    db,
    brought.map((s) => s.id),
  );
  const prevMonth = addMonths(month, -1);
  const candidates = brought.filter((s) => first.get(s.id) === prevMonth).map((s) => s.id);
  const accounts = await loadAccounts(db, candidates, today);
  const paidFirstMonth = (studentId: string) => {
    const acc = accounts.get(studentId);
    if (!acc) return false;
    const ms = acc.summary.groups.flatMap((g) => g.months).filter((m) => m.month === prevMonth);
    return ms.length > 0 && ms.every((m) => m.status === "paid" || m.status === "free");
  };

  return list.map((u) => {
    const mine = brought.filter((s) => s.createdBy === u.id);
    const accrual = managerAccrual(
      {
        salaryType: u.salaryType,
        monthlySalary: u.monthlySalary,
        kpiStudentAmount: u.kpiStudentAmount,
        kpiContractBonus: u.kpiContractBonus,
      },
      mine.filter((s) => first.get(s.id) === month).length,
      mine.filter((s) => first.get(s.id) === prevMonth && paidFirstMonth(s.id)).length,
    );
    return {
      kind: "user" as const,
      id: u.id,
      name: u.name,
      phone: localPhone(u.phoneNumber),
      salaryType: u.salaryType,
      accrual,
      balance: salaryBalance(accrual.total, moves.get(`user:${u.id}`) ?? []),
    };
  });
}

export async function loadPayroll(
  db: TenantDb,
  filter: readonly string[] | null,
  month: string,
  today: string,
): Promise<Payroll> {
  const moves = await movesFor(db, month);
  const [{ rows: t }, s] = await Promise.all([
    teacherRows(db, filter, month, today, moves),
    staffRows(db, filter, month, today, moves),
  ]);
  const revenue = t.reduce((sum, r) => sum + r.accrual.revenue, 0);
  const share = t.reduce((sum, r) => sum + r.accrual.total, 0);
  return { month, rows: [...t, ...s], totals: { revenue, share, center: revenue - share } };
}

/**
 * O'qituvchi profilidagi "To'lovlardan hisoblangan tushum" qatori (eski tizimdagidek): guruhga shu oy tushgan har
 * to'lov va undan ulush; belgilangan oyliklar alohida qator. Qatorlar yig'indisi — Ish haqi hisobidagi "hisoblangan".
 */
export interface ShareRow {
  key: string;
  kind: "payment" | "own" | "group";
  studentId: string | null;
  studentName: string | null;
  groupId: string | null;
  salaryType: SalaryType;
  /** Foiz — %, har o'quvchi — stavka, belgilangan — summa */
  value: number;
  /** To'lov summasi (qaytarish — manfiy) */
  amount: number | null;
  pay: number;
  date: string | null;
  /** Belgilangan oylik qaysi sanadan hisoblanadi (faqat own/group) */
  from: string | null;
  proration: Proration | null;
}

/** Bitta o'qituvchining oy hisobi (profildagi "Maosh" bo'limi), guruh nomlari va to'lovlardan ulush qatorlari */
export async function loadTeacherPayroll(db: TenantDb, teacherId: string, month: string, today: string) {
  const moves = await movesFor(db, month);
  const {
    rows: [row],
    ctx,
  } = await teacherRows(db, null, month, today, moves, teacherId);
  if (!row) return null;
  const ids = row.accrual.groups.map((g) => g.groupId);
  const names = ids.length
    ? await db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, ids))
    : [];
  const groupNames = Object.fromEntries(names.map((g) => [g.id, g.name])) as Record<string, string>;
  const studentIds = [...new Set(ctx.cash.map((c) => c.studentId))];
  const studentRows = studentIds.length
    ? await db.select({ id: students.id, name: students.name }).from(students).where(inArray(students.id, studentIds))
    : [];
  const studentNames = new Map(studentRows.map((s) => [s.id, s.name]));

  const shares: ShareRow[] = [];
  for (const { rule, group } of ctx.groups) {
    const terms = groupTerms(rule, group);
    for (const l of groupShares(rule, group, ctx.months, ctx.cash)) {
      shares.push({
        key: l.cash.id ?? `${group.id}:${shares.length}`,
        kind: "payment",
        studentId: l.cash.studentId,
        studentName: studentNames.get(l.cash.studentId) ?? null,
        groupId: group.id,
        salaryType: terms.type,
        value: terms.value,
        amount: l.cash.amount,
        pay: l.pay,
        date: l.cash.date ?? null,
        from: null,
        proration: null,
      });
    }
  }
  // Yangi to'lovlar tepada (eski tizimdagidek)
  shares.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  if (row.accrual.base || row.accrual.baseProration)
    shares.push({
      key: "own",
      kind: "own",
      studentId: null,
      studentName: null,
      groupId: null,
      salaryType: "fixed",
      value: row.rule.fixed,
      amount: null,
      pay: row.accrual.base,
      date: null,
      from: row.rule.fixedFrom ?? null,
      proration: row.accrual.baseProration ?? null,
    });
  for (const g of row.accrual.groups)
    if (g.salaryType === "fixed" && g.pay)
      shares.push({
        key: `group:${g.groupId}`,
        kind: "group",
        studentId: null,
        studentName: null,
        groupId: g.groupId,
        salaryType: "fixed",
        value: ctx.groups.find((x) => x.group.id === g.groupId)?.group.amount ?? 0,
        amount: null,
        pay: g.pay,
        date: null,
        from: ctx.groups.find((x) => x.group.id === g.groupId)?.group.fixedFrom ?? null,
        proration: g.proration ?? null,
      });
  return { row, groupNames, shares };
}
