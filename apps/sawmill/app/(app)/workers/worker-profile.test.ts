import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import {
  materials,
  payments,
  wageAccruals,
  workerMaterialPrices,
  workers,
  workEntries,
} from "@ventura/db/schema/sawmill";
import { calculateWorkerBalance } from "@/lib/calc/balance";
import { resolveWorkerPrice } from "@/lib/calc/pay";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("worker profile, payments, wage accruals and balance operations", () => {
  it("to'lovlar, maosh hisoblash (K1), maxsus narxlar va balans hisob-kitobi to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Maoshli ishchi va material yaratish
      const [w] = await db
        .insert(workers)
        .values({
          name: "Test Usta Profil",
          phone: "+998905554433",
          salaryType: "monthly",
          wageAmount: 4000000,
        })
        .returning();

      const [mat] = await db
        .insert(materials)
        .values({
          name: "Test Kvadrat Profil",
          unit: "qator",
          pricingMode: "row",
        })
        .returning();

      if (!w || !mat) throw new Error("Worker yoki material yaratilmadi");

      // 2. To'lov berish (K6)
      const [pay1] = await db
        .insert(payments)
        .values({
          workerId: w.id,
          amount: 1000000,
          date: "2026-10-15",
          note: "Avans to'lovi",
        })
        .returning();

      expect(pay1).toBeDefined();
      if (!pay1) throw new Error("Payment saqlanmadi");
      expect(pay1.amount).toBe(1000000);
      expect(pay1.date).toBe("2026-10-15");

      await db.insert(payments).values({
        workerId: w.id,
        amount: 500000,
        date: "2026-10-20",
        note: "Qo'shimcha to'lov",
      });

      // 3. Maosh hisoblash (K1)
      const periodStart = "2026-10-01";
      const periodEnd = "2026-10-31";
      const units = 1;
      const rate = 4000000;
      const wageAmount = Math.round(units * rate);

      // Companion work_entries
      const [companionEntry] = await db
        .insert(workEntries)
        .values({
          workerId: w.id,
          kind: "regular",
          date: periodEnd,
          amount: wageAmount,
          note: `Maosh (${periodStart} — ${periodEnd})`,
        })
        .returning();

      if (!companionEntry) throw new Error("Companion work entry yaratilmadi");

      // wage_accruals
      const [accrual] = await db
        .insert(wageAccruals)
        .values({
          workerId: w.id,
          periodStart,
          periodEnd,
          units: String(units),
          rate,
          amount: wageAmount,
          workEntryId: companionEntry.id,
        })
        .returning();

      expect(accrual).toBeDefined();
      if (!accrual) throw new Error("Accrual saqlanmadi");
      expect(accrual.amount).toBe(4000000);

      // Takroriy davr rad etilishi tekshiruvi (K1)
      let duplicateFailed = false;
      try {
        await db.insert(wageAccruals).values({
          workerId: w.id,
          periodStart,
          periodEnd,
          units: "1",
          rate,
          amount: wageAmount,
          workEntryId: companionEntry.id,
        });
      } catch {
        duplicateFailed = true;
      }
      expect(duplicateFailed).toBe(true);

      // 4. Maxsus narx (worker_material_prices - K2)
      await db.insert(workerMaterialPrices).values({
        workerId: w.id,
        materialId: mat.id,
        price: 3500,
      });

      const [sp] = await db
        .select()
        .from(workerMaterialPrices)
        .where(and(eq(workerMaterialPrices.workerId, w.id), eq(workerMaterialPrices.materialId, mat.id)))
        .limit(1);

      expect(sp).toBeDefined();
      expect(sp?.price).toBe(3500);

      // Maxsus narx resolve funksiyasi bilan tekshirish
      const resolved = resolveWorkerPrice({
        salaryType: "piecework",
        baseWorkerPrice: 2000,
        specialPrice: sp?.price,
      });
      expect(resolved).toBe(3500); // Maxsus narx ustun turadi!

      // 5. Balans hisob-kitobi (SAWMILL-TAHLIL 7-qism)
      // Oddiy qo'shimcha ish ham qo'shamiz
      await db.insert(workEntries).values({
        workerId: w.id,
        kind: "regular",
        date: "2026-10-24",
        amount: 300000,
        note: "Qo'shimcha montaj ishi",
      });

      // Ishchining barcha ishlarini va to'lovlarini yig'amiz
      const workerWorks = await db
        .select({ amount: workEntries.amount })
        .from(workEntries)
        .where(eq(workEntries.workerId, w.id));

      const workerPayments = await db
        .select({ amount: payments.amount })
        .from(payments)
        .where(eq(payments.workerId, w.id));

      const totalEarnedSum = workerWorks.reduce((acc, r) => acc + Number(r.amount), 0);
      const totalPaidSum = workerPayments.reduce((acc, r) => acc + Number(r.amount), 0);

      expect(totalEarnedSum).toBe(4300000); // 4,000,000 (Maosh) + 300,000 (Ish)
      expect(totalPaidSum).toBe(1500000); // 1,000,000 + 500,000

      const balance = calculateWorkerBalance({
        totalWorkEarned: totalEarnedSum,
        totalWageAccruals: 0,
        totalPayments: totalPaidSum,
      });

      expect(balance.totalEarned).toBe(4300000);
      expect(balance.totalPaid).toBe(1500000);
      expect(balance.balance).toBe(2800000); // Korxona qarzdor: 2,800,000 so'm

      // 6. Tozalash
      await db.delete(wageAccruals).where(eq(wageAccruals.id, accrual.id));
      await db.delete(workEntries).where(eq(workEntries.workerId, w.id));
      await db.delete(payments).where(eq(payments.workerId, w.id));
      await db.delete(materials).where(eq(materials.id, mat.id));
      await db.delete(workers).where(eq(workers.id, w.id));
    } finally {
      await db.close();
    }
  });
});
