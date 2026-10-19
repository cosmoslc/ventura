import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import {
  type LedgerKind,
  branches,
  courses,
  groupMemberships,
  groups,
  paymentMethods,
  payments,
  studentDiscounts,
  students,
  users,
} from "@ventura/db/schema/tenant";
import { cash } from "@/lib/ledger";
import { type StudentAccount, loadAccountCached, loadAccountsCached } from "@/lib/server/finance";

export interface PaymentRow {
  id: string;
  kind: LedgerKind;
  amount: number;
  /** Kassaga ta'siri: to'lov +, qaytarish −, qolganlari 0 */
  cash: number;
  date: string;
  month: string | null;
  receiptNo: number | null;
  note: string | null;
  studentId: string;
  studentName: string;
  studentPhone: string;
  branchId: string;
  groupId: string | null;
  groupName: string | null;
  methodId: string | null;
  methodName: string | null;
  createdByName: string | null;
  createdAt: string;
  voided: { at: string; by: string | null; reason: string | null } | null;
}

const creator = alias(users, "creator");
const voider = alias(users, "voider");
const localPhone = (p: string) => p.replace(/\D/g, "").slice(-9);

function baseQuery(db: TenantDb) {
  return db
    .select({
      p: payments,
      studentName: students.name,
      studentPhone: students.phone,
      branchId: students.branchId,
      groupName: groups.name,
      methodName: paymentMethods.name,
      createdByName: creator.name,
      voidedByName: voider.name,
    })
    .from(payments)
    .innerJoin(students, eq(students.id, payments.studentId))
    .leftJoin(groups, eq(groups.id, payments.groupId))
    .leftJoin(paymentMethods, eq(paymentMethods.id, payments.methodId))
    .leftJoin(creator, eq(creator.id, payments.createdBy))
    .leftJoin(voider, eq(voider.id, payments.voidedBy));
}

type BaseRow = Awaited<ReturnType<ReturnType<typeof baseQuery>["where"]>>[number];

function toRow(r: BaseRow): PaymentRow {
  const p = r.p;
  return {
    id: p.id,
    kind: p.kind,
    amount: p.amount,
    cash: cash(p),
    date: p.date,
    month: p.month,
    receiptNo: p.receiptNo,
    note: p.note,
    studentId: p.studentId,
    studentName: r.studentName,
    studentPhone: localPhone(r.studentPhone),
    branchId: r.branchId,
    groupId: p.groupId,
    groupName: r.groupName,
    methodId: p.methodId,
    methodName: r.methodName,
    createdByName: r.createdByName,
    createdAt: p.createdAt.toISOString(),
    voided: p.voidedAt ? { at: p.voidedAt.toISOString(), by: r.voidedByName, reason: p.voidReason } : null,
  };
}

/** Sana oralig'idagi yozuvlar (bekor qilinganlari ham — sahifada alohida ko'rsatiladi); filial — o'quvchi filiali */
export async function listPayments(
  db: TenantDb,
  filter: readonly string[] | null,
  range: { from: string; to: string },
): Promise<PaymentRow[]> {
  const rows = await baseQuery(db)
    .where(
      and(
        gte(payments.date, range.from),
        lte(payments.date, range.to),
        filter ? inArray(students.branchId, [...filter]) : undefined,
      ),
    )
    .orderBy(desc(payments.date), desc(payments.createdAt));
  return rows.map(toRow);
}

export async function studentEntries(db: TenantDb, studentId: string): Promise<PaymentRow[]> {
  const rows = await baseQuery(db)
    .where(eq(payments.studentId, studentId))
    .orderBy(desc(payments.date), desc(payments.createdAt));
  return rows.map(toRow);
}

export interface ReceiptData extends PaymentRow {
  courseName: string | null;
  branchName: string;
  branchAddress: string | null;
}

export async function receiptData(db: TenantDb, id: string): Promise<ReceiptData | null> {
  const [r] = await baseQuery(db).where(eq(payments.id, id));
  if (!r) return null;
  const row = toRow(r);
  const [course] = row.groupId
    ? await db
        .select({ name: courses.name })
        .from(groups)
        .innerJoin(courses, eq(courses.id, groups.courseId))
        .where(eq(groups.id, row.groupId))
    : [];
  const [b] = await db
    .select({ name: branches.name, address: branches.address })
    .from(branches)
    .where(eq(branches.id, row.branchId));
  return { ...row, courseName: course?.name ?? null, branchName: b?.name ?? "", branchAddress: b?.address ?? null };
}

/* ---------- O'quvchi moliyasi (profil tabi va to'lov oynasi) ---------- */

export interface StudentGroupOption {
  id: string;
  name: string;
  /** Hozir guruhda emas (chiqqan) */
  left: boolean;
}

/** O'quvchi a'zo bo'lgan (hozir yoki avval) guruhlar — to'lov shu guruhlarga yoziladi */
export async function studentGroupOptions(db: TenantDb, studentId: string): Promise<StudentGroupOption[]> {
  const rows = await db
    .select({ id: groups.id, name: groups.name, leftAt: groupMemberships.leftAt })
    .from(groupMemberships)
    .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
    .where(eq(groupMemberships.studentId, studentId))
    .orderBy(asc(groups.name));
  const map = new Map<string, StudentGroupOption>();
  for (const r of rows) {
    const prev = map.get(r.id);
    const left = r.leftAt !== null;
    map.set(r.id, { id: r.id, name: r.name, left: prev ? prev.left && left : left });
  }
  return [...map.values()];
}

export interface DiscountRow {
  id: string;
  groupId: string | null;
  groupName: string | null;
  kind: "fixed" | "percent";
  value: number;
  fromMonth: string;
  toMonth: string | null;
  affectsTeacher: boolean;
  reason: string;
}

export async function studentDiscountRows(db: TenantDb, studentId: string): Promise<DiscountRow[]> {
  const rows = await db
    .select({ d: studentDiscounts, groupName: groups.name })
    .from(studentDiscounts)
    .leftJoin(groups, eq(groups.id, studentDiscounts.groupId))
    .where(eq(studentDiscounts.studentId, studentId))
    .orderBy(desc(studentDiscounts.fromMonth));
  return rows.map(({ d, groupName }) => ({
    id: d.id,
    groupId: d.groupId,
    groupName,
    kind: d.kind,
    value: d.value,
    fromMonth: d.fromMonth,
    toMonth: d.toMonth,
    affectsTeacher: d.affectsTeacher,
    reason: d.reason,
  }));
}

export interface StudentFinance {
  account: Pick<StudentAccount, "summary">;
  groups: StudentGroupOption[];
  entries: PaymentRow[];
  discounts: DiscountRow[];
}

export async function studentFinance(db: TenantDb, studentId: string, today: string): Promise<StudentFinance> {
  const [account, groupList, entries, discounts] = await Promise.all([
    loadAccountCached(db, studentId, today),
    studentGroupOptions(db, studentId),
    studentEntries(db, studentId),
    studentDiscountRows(db, studentId),
  ]);
  return { account: { summary: account.summary }, groups: groupList, entries, discounts };
}

/* ---------- Guruh moliyasi (guruh profili kartalari) ---------- */

export interface GroupFinance {
  month: string;
  /** Shu oy a'zolarga hisoblangan */
  charged: number;
  /** Shu oy uchun (oy belgisi) shu guruhga kelgan naqd pul: to'lov − qaytarish */
  collected: number;
  /** Shu guruh bo'yicha yopilmagan oylar qoldig'i (barcha oylar) */
  due: number;
}

export async function groupFinance(db: TenantDb, groupId: string, today: string): Promise<GroupFinance> {
  const month = today.slice(0, 7);
  const memberRows = await db
    .select({ studentId: groupMemberships.studentId })
    .from(groupMemberships)
    .where(eq(groupMemberships.groupId, groupId));
  const accounts = await loadAccountsCached(
    db,
    memberRows.map((r) => r.studentId),
    today,
  );
  let charged = 0;
  let collected = 0;
  let due = 0;
  for (const { summary, entries } of accounts.values()) {
    const g = summary.groups.find((x) => x.groupId === groupId);
    if (g) {
      charged += g.months.filter((m) => m.month === month).reduce((s, m) => s + m.amount, 0);
      due += g.months.reduce((s, m) => s + m.due, 0);
    }
    collected += entries.filter((e) => e.groupId === groupId && e.month === month).reduce((s, e) => s + cash(e), 0);
  }
  return { month, charged, collected, due };
}
