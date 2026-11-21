import { describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import {
  materials,
  stockMovements,
  terakCosts,
  terakMaterials,
  teraks,
  workers,
  workEntries,
  workGroups,
  workTypes,
} from "@ventura/db/schema/sawmill";
import { calculateGroupWork, calculateSingleWork } from "@/lib/calc/pay";
import { getRemainingRes } from "./actions";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("kunlik ishlar (work) database operations and business logic", () => {
  it("yakka va guruh ishlari, sartirofka/res nazorati va ombor o'zgarishi to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Test uchun ishchi, terak, material va ish turlari yaratish
      const [w1] = await db
        .insert(workers)
        .values({
          name: "Test Ishchi 1",
          phone: "+998901112233",
          salaryType: "piecework",
          wageAmount: 0,
        })
        .returning();

      const [w2] = await db
        .insert(workers)
        .values({
          name: "Test Ishchi 2",
          phone: "+998901112244",
          salaryType: "piecework",
          wageAmount: 0,
        })
        .returning();

      const [w3] = await db
        .insert(workers)
        .values({
          name: "Test Ishchi 3 (Maoshli)",
          phone: "+998901112255",
          salaryType: "monthly",
          wageAmount: 3000000,
        })
        .returning();

      const [trk] = await db
        .insert(teraks)
        .values({
          name: "Test Terak S3",
          purchaseDate: "2026-10-24",
          purchasePrice: 10000000,
        })
        .returning();

      const [mat] = await db
        .insert(materials)
        .values({
          name: "Test Vassa S3",
          unit: "dona",
          pricingMode: "piece",
        })
        .returning();

      if (!w1 || !w2 || !w3 || !trk || !mat) throw new Error("Tayyorgarlikda xatolik");

      // Terak material narxi
      const [tm] = await db
        .insert(terakMaterials)
        .values({
          terakId: trk.id,
          materialId: mat.id,
          quantity: "0",
          workerPrice: 2000,
          sellingPrice: 15000,
        })
        .returning();
      if (!tm) throw new Error("Terak materiali ulanmadi");

      // 2. Res va Sartirofka nazorati (K4)
      // Boshida res = 0 bo'lishi kerak
      const initRes = await getRemainingRes(db, trk.id);
      expect(initRes).toBe(0);

      // Terakka 2 ta res xarajati qo'shamiz
      await db.insert(terakCosts).values({
        terakId: trk.id,
        kind: "res",
        title: "2 ta reys olib kelindi",
        trips: 2,
        pricePerTrip: 300000,
        amount: 600000,
        date: "2026-10-24",
      });

      const resAfterCost = await getRemainingRes(db, trk.id);
      expect(resAfterCost).toBe(2);

      // Sartirofka ish turini topamiz
      let [sortingType] = await db.select().from(workTypes).where(eq(workTypes.kind, "sorting")).limit(1);

      if (!sortingType) {
        const [insertedSt] = await db
          .insert(workTypes)
          .values({
            name: "Sartirofka Test",
            kind: "sorting",
            isSystem: true,
          })
          .returning();
        sortingType = insertedSt;
      }
      if (!sortingType) throw new Error("Sorting work type topilmadi");

      // Sartirofka ishi qo'shish
      const [sortingEntry] = await db
        .insert(workEntries)
        .values({
          workerId: w1.id,
          terakId: trk.id,
          workTypeId: sortingType.id,
          kind: "regular",
          date: "2026-10-24",
          amount: 50000,
          note: "1-sartirofka",
        })
        .returning();

      expect(sortingEntry).toBeDefined();

      // Endi qolgan res 1 bo'lishi kerak (2 - 1 = 1)
      const resAfter1Sorting = await getRemainingRes(db, trk.id);
      expect(resAfter1Sorting).toBe(1);

      // 3. Yakka material ishi va ombor harakati
      const singleCalc = calculateSingleWork({
        kind: "material",
        payUnit: "piece",
        workerPrice: tm.workerPrice,
        workerCubePrice: 0,
        quantity: 50,
      });
      expect(singleCalc.amount).toBe(100000); // 50 * 2000
      expect(singleCalc.stockDelta).toBe(50);

      const [singleWork] = await db
        .insert(workEntries)
        .values({
          workerId: w1.id,
          terakId: trk.id,
          kind: "material",
          date: "2026-10-24",
          amount: singleCalc.amount,
          materialId: mat.id,
          quantity: "50",
          payUnit: "piece",
        })
        .returning();

      expect(singleWork).toBeDefined();
      if (!singleWork) throw new Error("Single work saqlanmadi");

      // Ombor qoldig'ini yangilaymiz va harakat yozamiz
      await db
        .update(terakMaterials)
        .set({
          quantity: sql`${terakMaterials.quantity} + ${singleCalc.stockDelta}`,
        })
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));

      const [sm1] = await db
        .insert(stockMovements)
        .values({
          terakId: trk.id,
          materialId: mat.id,
          delta: String(singleCalc.stockDelta),
          source: "work",
          sourceId: singleWork.id,
        })
        .returning();

      expect(sm1).toBeDefined();

      // Terakdagi qoldiq 50 bo'lishi kerak
      const [tmAfterSingle] = await db
        .select({ quantity: terakMaterials.quantity })
        .from(terakMaterials)
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));
      expect(Number(tmAfterSingle?.quantity)).toBe(50);

      // 4. Guruh ishi (K3, K15): 2 ta piecework va 1 ta maoshli ishchi
      // Miqdor: 60 dona, jami = 60 * 2000 = 120,000 so'm.
      // Maoshli ishchi ulush olmaydi (0). 2 ta piecework o'rtasida bo'linadi: 60,000 dan.
      // Omborga faqat 1 marta (+60) qo'shiladi!
      const groupCalc = calculateGroupWork({
        kind: "material",
        payUnit: "piece",
        baseWorkerPrice: tm.workerPrice,
        baseCubeWorkerPrice: 0,
        quantity: 60,
        payFullToEach: false,
        workers: [
          { workerId: w1.id, salaryType: "piecework" },
          { workerId: w2.id, salaryType: "piecework" },
          { workerId: w3.id, salaryType: "monthly" },
        ],
      });

      expect(groupCalc.totalAmount).toBe(120000);
      expect(groupCalc.stockDelta).toBe(60);
      expect(groupCalc.distributions).toEqual([
        { workerId: w1.id, amount: 60000 },
        { workerId: w2.id, amount: 60000 },
        { workerId: w3.id, amount: 0 },
      ]);

      const [group] = await db
        .insert(workGroups)
        .values({
          terakId: trk.id,
          date: "2026-10-24",
          totalAmount: groupCalc.totalAmount,
          payFullToEach: false,
          materialId: mat.id,
          quantity: "60",
          payUnit: "piece",
        })
        .returning();

      if (!group) throw new Error("Group saqlanmadi");

      for (const dist of groupCalc.distributions) {
        await db.insert(workEntries).values({
          workerId: dist.workerId,
          terakId: trk.id,
          kind: "material",
          groupId: group.id,
          date: "2026-10-24",
          amount: dist.amount,
          materialId: mat.id,
          quantity: "60",
          payUnit: "piece",
        });
      }

      // Omborga FAQAT 1 marta qo'shamiz
      await db
        .update(terakMaterials)
        .set({
          quantity: sql`${terakMaterials.quantity} + ${groupCalc.stockDelta}`,
        })
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));

      await db.insert(stockMovements).values({
        terakId: trk.id,
        materialId: mat.id,
        delta: String(groupCalc.stockDelta),
        source: "work",
        sourceId: group.id,
      });

      // Terakdagi qoldiq endi: 50 + 60 = 110 bo'lishi kerak
      const [tmAfterGroup] = await db
        .select({ quantity: terakMaterials.quantity })
        .from(terakMaterials)
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));
      expect(Number(tmAfterGroup?.quantity)).toBe(110);

      // 5. Guruh ishi o'chirilganda ombor harakati qaytarilishi
      // Ombor harakatidan 60 ayirilishi va 50 ga qaytishi kerak
      await db
        .update(terakMaterials)
        .set({
          quantity: sql`${terakMaterials.quantity} - ${groupCalc.stockDelta}`,
        })
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));

      await db.delete(workGroups).where(eq(workGroups.id, group.id));

      const [tmAfterGroupDelete] = await db
        .select({ quantity: terakMaterials.quantity })
        .from(terakMaterials)
        .where(and(eq(terakMaterials.terakId, trk.id), eq(terakMaterials.materialId, mat.id)));
      expect(Number(tmAfterGroupDelete?.quantity)).toBe(50);

      // 6. Tozalash
      await db.delete(teraks).where(eq(teraks.id, trk.id));
      await db.delete(materials).where(eq(materials.id, mat.id));
      await db.delete(workers).where(eq(workers.id, w1.id));
      await db.delete(workers).where(eq(workers.id, w2.id));
      await db.delete(workers).where(eq(workers.id, w3.id));
    } finally {
      await db.close();
    }
  });
});
