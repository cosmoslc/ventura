import "server-only";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import { additionalIncomes, branches, financeCategories, paymentMethods, users } from "@ventura/db/schema/tenant";

export interface IncomeRow {
  id: string;
  branchId: string;
  branchName: string;
  categoryId: string;
  categoryName: string;
  title: string;
  amount: number;
  date: string;
  methodId: string;
  methodName: string;
  payer: string | null;
  createdByName: string | null;
  voided: { at: string; by: string | null; reason: string | null } | null;
}

const creator = alias(users, "creator");
const voider = alias(users, "voider");

/** Sana oralig'idagi qo'shimcha daromadlar (bekor qilinganlari ham) */
export async function listIncomes(
  db: TenantDb,
  filter: readonly string[] | null,
  range: { from: string; to: string },
): Promise<IncomeRow[]> {
  const rows = await db
    .select({
      i: additionalIncomes,
      branchName: branches.name,
      categoryName: financeCategories.name,
      methodName: paymentMethods.name,
      createdByName: creator.name,
      voidedByName: voider.name,
    })
    .from(additionalIncomes)
    .innerJoin(branches, eq(branches.id, additionalIncomes.branchId))
    .innerJoin(financeCategories, eq(financeCategories.id, additionalIncomes.categoryId))
    .innerJoin(paymentMethods, eq(paymentMethods.id, additionalIncomes.methodId))
    .leftJoin(creator, eq(creator.id, additionalIncomes.createdBy))
    .leftJoin(voider, eq(voider.id, additionalIncomes.voidedBy))
    .where(
      and(
        gte(additionalIncomes.date, range.from),
        lte(additionalIncomes.date, range.to),
        filter ? inArray(additionalIncomes.branchId, [...filter]) : undefined,
      ),
    )
    .orderBy(desc(additionalIncomes.date), desc(additionalIncomes.createdAt));
  return rows.map((r) => ({
    id: r.i.id,
    branchId: r.i.branchId,
    branchName: r.branchName,
    categoryId: r.i.categoryId,
    categoryName: r.categoryName,
    title: r.i.title,
    amount: r.i.amount,
    date: r.i.date,
    methodId: r.i.methodId,
    methodName: r.methodName,
    payer: r.i.payer,
    createdByName: r.createdByName,
    voided: r.i.voidedAt ? { at: r.i.voidedAt.toISOString(), by: r.voidedByName, reason: r.i.voidReason } : null,
  }));
}
