import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import {
  dispatches,
  expenseCategories,
  generalExpenses,
  materials,
  payments,
  terakCosts,
  terakMaterials,
  teraks,
  workers,
  workEntries,
} from "@ventura/db/schema/sawmill";
import {
  getDispatchReportData,
  getProfitReportData,
  getWagesReportData,
} from "./actions";

const DB_URL =
  "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("hisobotlar va tahlil (reports) data aggregation (S5)", () => {
  it("getProfitReportData, getWagesReportData va getDispatchReportData to'g'ri hisoblaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    const uid = Date.now().toString().slice(-6);

    let terakId: string | null = null;
    let materialId: string | null = null;
    let workerId: string | null = null;
    let expenseCatId: string | null = null;
    let generalExpId: string | null = null;
    let dispatchId: string | null = null;

    try {
      // 1. Terak yaratish: xarid narxi 10 000 000
      const [trk] = await db
        .insert(teraks)
        .values({
          name: `Test Terak Report S5 ${uid}`,
          purchaseDate: "2026-10-24",
          purchasePrice: 10000000,
        })
        .returning();
      terakId = trk!.id;

      // 2. Terakka qo'shimcha xarajat: 500 000
      await db.insert(terakCosts).values({
        terakId: trk!.id,
        kind: "transport",
        title: "Tashish",
        amount: 500000,
        date: "2026-10-24",
      });

      // 3. Ishchi va ish haqi: 300 000
      const [wrk] = await db
        .insert(workers)
        .values({
          name: `Test Worker Report ${uid}`,
          salaryType: "piecework",
          wageAmount: 10000,
        })
        .returning();
      workerId = wrk!.id;

      await db.insert(workEntries).values({
        terakId: trk!.id,
        workerId: wrk!.id,
        amount: 300000,
        date: "2026-10-24",
      });

      // Ishchiga to'lov: 100 000 (balans 200 000 bo'lishi kerak)
      await db.insert(payments).values({
        workerId: wrk!.id,
        amount: 100000,
        date: "2026-10-24",
      });

      // 4. Material va ombor qoldig'i
      const [mat] = await db
        .insert(materials)
        .values({
          name: `Test Material Report ${uid}`,
          unit: "dona",
          pricingMode: "piece",
          thicknessCm: "4",
          widthCm: "10",
          lengthCm: "400",
        })
        .returning();
      materialId = mat!.id;

      // Omborda 50 dona x 20 000 = 1 000 000 so'm
      await db.insert(terakMaterials).values({
        terakId: trk!.id,
        materialId: mat!.id,
        quantity: "50.0000",
        sellingPrice: 20000,
        cubePrice: 1250000,
      });

      // 5. Yuk chiqarish (sotuv): 50 dona x 20 000 = 1 000 000 so'm
      const [disp] = await db
        .insert(dispatches)
        .values({
          terakId: trk!.id,
          materialId: mat!.id,
          quantity: "50.0000",
          enteredUnit: "piece",
          enteredQty: "50.0000",
          totalAmount: 1000000,
          date: "2026-10-24",
          recipientName: "Test Xaridor",
        })
        .returning();
      dispatchId = disp!.id;

      // 6. K14 umumiy xarajat: 200 000
      const [cat] = await db
        .insert(expenseCategories)
        .values({ name: "Elektr energiyasi" })
        .returning();
      expenseCatId = cat!.id;

      const [genExp] = await db
        .insert(generalExpenses)
        .values({
          categoryId: cat!.id,
          amount: 200000,
          date: "2026-10-24",
        })
        .returning();
      generalExpId = genExp!.id;

      // --- SINOV 1: PROFIT REPORT ---
      const profitReport = await getProfitReportData(db);
      expect(profitReport.generalExpensesTotal).toBeGreaterThanOrEqual(200000);

      const targetRow = profitReport.rows.find((r) => r.terakId === trk!.id);
      expect(targetRow).toBeDefined();
      if (targetRow) {
        expect(targetRow.purchasePrice).toBe(10000000);
        expect(targetRow.additionalCosts).toBe(500000);
        expect(targetRow.workCosts).toBe(300000);
        // Jami xarajat: 10 000 000 + 500 000 + 300 000 = 10 800 000
        expect(targetRow.totalCosts).toBe(10800000);
        // Sotuv tushumi: 1 000 000
        expect(targetRow.dispatchRevenue).toBe(1000000);
        // Ombor qiymati: 1 000 000
        expect(targetRow.stockValue).toBe(1000000);
        // Taxminiy foyda: 1 000 000 + 1 000 000 - 10 800 000 = -8 800 000
        expect(targetRow.profitEstimated).toBe(-8800000);
        // Haqiqiy foyda: 1 000 000 - 10 800 000 = -9 800 000
        expect(targetRow.profitReal).toBe(-9800000);
      }

      // --- SINOV 2: WAGES REPORT ---
      const wagesReport = await getWagesReportData(db, {
        dateFrom: "2026-10-01",
        dateTo: "2026-10-31",
      });
      const targetWorker = wagesReport.find((w) => w.workerId === wrk!.id);
      expect(targetWorker).toBeDefined();
      if (targetWorker) {
        expect(targetWorker.totalEarned).toBe(300000);
        expect(targetWorker.totalPaid).toBe(100000);
        expect(targetWorker.currentBalance).toBe(200000);
      }

      // --- SINOV 3: DISPATCH REPORT ---
      const dispatchReport = await getDispatchReportData(db, {
        terakId: trk!.id,
      });
      expect(dispatchReport.length).toBe(1);
      const dispRow = dispatchReport[0]!;
      expect(dispRow.terakName).toBe(trk!.name);
      expect(dispRow.materialName).toBe(mat!.name);
      expect(dispRow.quantity).toBe(50);
      expect(dispRow.totalAmount).toBe(1000000);
      expect(dispRow.recipientName).toBe("Test Xaridor");
    } finally {
      // Tozalash
      if (dispatchId) {
        await db.delete(dispatches).where(eq(dispatches.id, dispatchId)).catch(() => {});
      }
      if (generalExpId) {
        await db.delete(generalExpenses).where(eq(generalExpenses.id, generalExpId)).catch(() => {});
      }
      if (expenseCatId) {
        await db.delete(expenseCategories).where(eq(expenseCategories.id, expenseCatId)).catch(() => {});
      }
      if (terakId) {
        await db.delete(terakMaterials).where(eq(terakMaterials.terakId, terakId)).catch(() => {});
        await db.delete(workEntries).where(eq(workEntries.terakId, terakId)).catch(() => {});
        await db.delete(terakCosts).where(eq(terakCosts.terakId, terakId)).catch(() => {});
        await db.delete(teraks).where(eq(teraks.id, terakId)).catch(() => {});
      }
      if (workerId) {
        await db.delete(payments).where(eq(payments.workerId, workerId)).catch(() => {});
        await db.delete(workEntries).where(eq(workEntries.workerId, workerId)).catch(() => {});
        await db.delete(workers).where(eq(workers.id, workerId)).catch(() => {});
      }
      if (materialId) {
        await db.delete(materials).where(eq(materials.id, materialId)).catch(() => {});
      }
    }
  });
});
