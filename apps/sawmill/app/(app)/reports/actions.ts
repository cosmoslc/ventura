"use server";

import { and, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import {
  dispatches,
  generalExpenses,
  materials,
  payments,
  terakCosts,
  terakMaterials,
  teraks,
  trucks,
  workers,
  workEntries,
} from "@ventura/db/schema/sawmill";
import { calculateTerakProfit } from "@/lib/calc/profit";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { can } from "@/lib/auth/roles";
import { type currentDeps, requireUser } from "@/lib/server/session";

export interface TerakProfitReportRow {
  terakId: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  additionalCosts: number;
  workCosts: number;
  totalCosts: number;
  dispatchRevenue: number;
  stockValue: number;
  profitEstimated: number;
  profitReal: number;
  marginEstimated: number;
  marginReal: number;
}

export async function getProfitReportData(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const activeTeraks = await db
    .select({
      id: teraks.id,
      name: teraks.name,
      purchaseDate: teraks.purchaseDate,
      purchasePrice: teraks.purchasePrice,
    })
    .from(teraks)
    .where(isNull(teraks.deletedAt))
    .orderBy(desc(teraks.purchaseDate));

  const rows: TerakProfitReportRow[] = await Promise.all(
    activeTeraks.map(async (tr) => {
      // Qo'shimcha xarajatlar
      const [costsRow] = await db
        .select({ total: sql<number>`coalesce(sum(${terakCosts.amount}), 0)` })
        .from(terakCosts)
        .where(eq(terakCosts.terakId, tr.id));
      const additionalCosts = Number(costsRow?.total ?? 0);

      // Ish haqi
      const [workRow] = await db
        .select({ total: sql<number>`coalesce(sum(${workEntries.amount}), 0)` })
        .from(workEntries)
        .where(eq(workEntries.terakId, tr.id));
      const workCosts = Number(workRow?.total ?? 0);

      // Yuk chiqarish tushumi
      const [dispRow] = await db
        .select({ total: sql<number>`coalesce(sum(${dispatches.totalAmount}), 0)` })
        .from(dispatches)
        .where(eq(dispatches.terakId, tr.id));
      const dispatchRevenue = Number(dispRow?.total ?? 0);

      // Ombor qiymati
      const stockRows = await db
        .select({
          quantity: terakMaterials.quantity,
          sellingPrice: terakMaterials.sellingPrice,
          cubePrice: terakMaterials.cubePrice,
          thicknessCm: materials.thicknessCm,
          widthCm: materials.widthCm,
          lengthCm: materials.lengthCm,
        })
        .from(terakMaterials)
        .innerJoin(materials, eq(materials.id, terakMaterials.materialId))
        .where(eq(terakMaterials.terakId, tr.id));

      let stockValue = 0;
      for (const s of stockRows) {
        const qty = Number(s.quantity ?? 0);
        const vol = pieceVolumeM3({
          thicknessCm: s.thicknessCm ? Number(s.thicknessCm) : null,
          widthCm: s.widthCm ? Number(s.widthCm) : null,
          lengthCm: s.lengthCm ? Number(s.lengthCm) : null,
        });
        if (s.sellingPrice > 0) {
          stockValue += qty * s.sellingPrice;
        } else if (s.cubePrice > 0 && vol) {
          stockValue += qty * vol * s.cubePrice;
        }
      }

      const p = calculateTerakProfit({
        purchasePrice: Number(tr.purchasePrice),
        additionalCosts,
        workCosts,
        dispatchRevenue,
        stockValue: Math.round(stockValue),
      });

      return {
        terakId: tr.id,
        name: tr.name,
        purchaseDate: tr.purchaseDate,
        purchasePrice: Number(tr.purchasePrice),
        additionalCosts,
        workCosts,
        totalCosts: p.totalCosts,
        dispatchRevenue: p.dispatchRevenue,
        stockValue: p.stockValue,
        profitEstimated: p.profitEstimated,
        profitReal: p.profitReal,
        marginEstimated: p.marginEstimated,
        marginReal: p.marginReal,
      };
    }),
  );

  // Umumiy xarajatlar (K14)
  const [genExpRow] = await db
    .select({ total: sql<number>`coalesce(sum(${generalExpenses.amount}), 0)` })
    .from(generalExpenses);
  const generalExpensesTotal = Number(genExpRow?.total ?? 0);

  return { rows, generalExpensesTotal };
}

export interface WorkerWageReportRow {
  workerId: string;
  name: string;
  salaryType: string;
  totalEarned: number;
  totalPaid: number;
  currentBalance: number;
}

export async function getWagesReportData(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    dateFrom?: string;
    dateTo?: string;
  },
) {
  const activeWorkers = await db
    .select({
      id: workers.id,
      name: workers.name,
      salaryType: workers.salaryType,
    })
    .from(workers)
    .where(isNull(workers.archivedAt))
    .orderBy(workers.name);

  const rows: WorkerWageReportRow[] = await Promise.all(
    activeWorkers.map(async (w) => {
      // Ishlar (workEntries)
      const workConds = [eq(workEntries.workerId, w.id)];
      if (filters?.dateFrom) workConds.push(gte(workEntries.date, filters.dateFrom));
      if (filters?.dateTo) workConds.push(lte(workEntries.date, filters.dateTo));

      const [earnedRow] = await db
        .select({ total: sql<number>`coalesce(sum(${workEntries.amount}), 0)` })
        .from(workEntries)
        .where(and(...workConds));
      const totalEarned = Number(earnedRow?.total ?? 0);

      // To'lovlar (payments)
      const payConds = [eq(payments.workerId, w.id)];
      if (filters?.dateFrom) payConds.push(gte(payments.date, filters.dateFrom));
      if (filters?.dateTo) payConds.push(lte(payments.date, filters.dateTo));

      const [paidRow] = await db
        .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)` })
        .from(payments)
        .where(and(...payConds));
      const totalPaid = Number(paidRow?.total ?? 0);

      const currentBalance = totalEarned - totalPaid;

      return {
        workerId: w.id,
        name: w.name,
        salaryType: w.salaryType,
        totalEarned,
        totalPaid,
        currentBalance,
      };
    }),
  );

  return rows;
}

export interface DispatchReportRow {
  id: string;
  date: string;
  terakName: string;
  materialName: string;
  materialUnit: string;
  quantity: number;
  volumeTotalM3: number | null;
  totalAmount: number;
  recipientName: string | null;
  phone: string | null;
  truckName: string | null;
}

export async function getDispatchReportData(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    terakId?: string;
  },
) {
  const conds = [];
  if (filters?.dateFrom) conds.push(gte(dispatches.date, filters.dateFrom));
  if (filters?.dateTo) conds.push(lte(dispatches.date, filters.dateTo));
  if (filters?.terakId) conds.push(eq(dispatches.terakId, filters.terakId));

  const list = await db
    .select({
      id: dispatches.id,
      date: dispatches.date,
      terakName: teraks.name,
      materialName: materials.name,
      materialUnit: materials.unit,
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
      quantity: dispatches.quantity,
      totalAmount: dispatches.totalAmount,
      recipientName: dispatches.recipientName,
      phone: dispatches.phone,
      truckName: trucks.name,
    })
    .from(dispatches)
    .innerJoin(teraks, eq(teraks.id, dispatches.terakId))
    .innerJoin(materials, eq(materials.id, dispatches.materialId))
    .leftJoin(trucks, eq(trucks.id, dispatches.truckId))
    .where(conds.length > 0 ? and(...conds) : undefined)
    .orderBy(desc(dispatches.date), desc(dispatches.createdAt));

  return list.map((d) => {
    const vol = pieceVolumeM3({
      thicknessCm: d.thicknessCm ? Number(d.thicknessCm) : null,
      widthCm: d.widthCm ? Number(d.widthCm) : null,
      lengthCm: d.lengthCm ? Number(d.lengthCm) : null,
    });
    const qty = Number(d.quantity);
    const volumeTotalM3 = vol ? Math.round(qty * vol * 1000) / 1000 : null;

    return {
      id: d.id,
      date: d.date,
      terakName: d.terakName,
      materialName: d.materialName,
      materialUnit: d.materialUnit,
      quantity: qty,
      volumeTotalM3,
      totalAmount: Number(d.totalAmount),
      recipientName: d.recipientName,
      phone: d.phone,
      truckName: d.truckName,
    };
  });
}

export async function getFilteredWagesReportAction(filters: { dateFrom?: string; dateTo?: string }) {
  const { user, deps } = await requireUser();
  if (!can(user.role, "reports.view")) {
    throw new Error("Ruxsat berilmagan");
  }
  return getWagesReportData(deps.db, filters);
}

export async function getFilteredDispatchReportAction(filters: {
  dateFrom?: string;
  dateTo?: string;
  terakId?: string;
}) {
  const { user, deps } = await requireUser();
  if (!can(user.role, "reports.view")) {
    throw new Error("Ruxsat berilmagan");
  }
  return getDispatchReportData(deps.db, filters);
}
