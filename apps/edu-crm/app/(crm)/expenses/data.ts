import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import {
  type ExpenseKind,
  branches,
  expensePlans,
  expenses,
  financeCategories,
  paymentMethods,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { type PlanUsage, type SpendEntry, planUsage } from "@/lib/expense-plans";
import { personValue } from "@/lib/server/expenses";

export interface ExpenseRow {
  id: string;
  kind: ExpenseKind;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  reason: string;
  amount: number;
  date: string;
  methodId: string;
  methodName: string;
  /** "user:<id>" / "teacher:<id>" / null */
  person: string | null;
  personName: string | null;
  createdByName: string | null;
  voided: { at: string; by: string | null; reason: string | null } | null;
}

const creator = alias(users, "creator");
const voider = alias(users, "voider");
const person = alias(users, "person");

const monthEnd = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
};

/** Sana oralig'idagi xarajatlar (bekor qilinganlari ham — sahifada alohida ko'rsatiladi) */
export async function listExpenses(
  db: TenantDb,
  filter: readonly string[] | null,
  range: { from: string; to: string },
): Promise<ExpenseRow[]> {
  const rows = await db
    .select({
      e: expenses,
      branchName: branches.name,
      categoryName: financeCategories.name,
      methodName: paymentMethods.name,
      userName: person.name,
      teacherName: teachers.name,
      createdByName: creator.name,
      voidedByName: voider.name,
    })
    .from(expenses)
    .innerJoin(branches, eq(branches.id, expenses.branchId))
    .innerJoin(financeCategories, eq(financeCategories.id, expenses.categoryId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, expenses.methodId))
    .leftJoin(person, eq(person.id, expenses.userId))
    .leftJoin(teachers, eq(teachers.id, expenses.teacherId))
    .leftJoin(creator, eq(creator.id, expenses.createdBy))
    .leftJoin(voider, eq(voider.id, expenses.voidedBy))
    .where(
      and(
        gte(expenses.date, range.from),
        lte(expenses.date, range.to),
        filter ? inArray(expenses.branchId, [...filter]) : undefined,
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.createdAt));
  return rows.map((r) => ({
    id: r.e.id,
    kind: r.e.kind,
    branchId: r.e.branchId,
    branchName: r.branchName,
    categoryId: r.e.categoryId,
    categoryName: r.categoryName,
    reason: r.e.reason,
    amount: r.e.amount,
    date: r.e.date,
    methodId: r.e.methodId,
    methodName: r.methodName,
    person: personValue(r.e),
    personName: r.userName ?? r.teacherName,
    createdByName: r.createdByName,
    voided: r.e.voidedAt ? { at: r.e.voidedAt.toISOString(), by: r.voidedByName, reason: r.e.voidReason } : null,
  }));
}

export interface PlanRow {
  id: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  month: string;
  amount: number;
  methodId: string | null;
  methodName: string | null;
  person: string | null;
  personName: string | null;
  note: string | null;
  usage: PlanUsage;
}

/** Oy rejalari va har birining bajarilishi (shu oy xarajatlaridan hisoblanadi) */
export async function listPlans(db: TenantDb, filter: readonly string[] | null, month: string): Promise<PlanRow[]> {
  const branchScope = (col: typeof expensePlans.branchId | typeof expenses.branchId) =>
    filter ? inArray(col, [...filter]) : undefined;
  const [plans, spent] = await Promise.all([
    db
      .select({
        p: expensePlans,
        branchName: branches.name,
        categoryName: financeCategories.name,
        methodName: paymentMethods.name,
        userName: person.name,
        teacherName: teachers.name,
      })
      .from(expensePlans)
      .innerJoin(branches, eq(branches.id, expensePlans.branchId))
      .innerJoin(financeCategories, eq(financeCategories.id, expensePlans.categoryId))
      .leftJoin(paymentMethods, eq(paymentMethods.id, expensePlans.methodId))
      .leftJoin(person, eq(person.id, expensePlans.userId))
      .leftJoin(teachers, eq(teachers.id, expensePlans.teacherId))
      .where(and(eq(expensePlans.month, month), branchScope(expensePlans.branchId)))
      .orderBy(asc(financeCategories.sortOrder), asc(financeCategories.name), asc(expensePlans.createdAt)),
    db
      .select()
      .from(expenses)
      .where(
        and(gte(expenses.date, `${month}-01`), lte(expenses.date, monthEnd(month)), branchScope(expenses.branchId)),
      ),
  ]);
  const entries: SpendEntry[] = spent.map((e) => ({ ...e, voided: e.voidedAt !== null }));
  return plans.map((r) => ({
    id: r.p.id,
    branchId: r.p.branchId,
    branchName: r.branchName,
    categoryId: r.p.categoryId,
    categoryName: r.categoryName,
    month: r.p.month,
    amount: r.p.amount,
    methodId: r.p.methodId,
    methodName: r.methodName,
    person: personValue(r.p),
    personName: r.userName ?? r.teacherName,
    note: r.p.note,
    usage: planUsage(r.p, entries),
  }));
}
