import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import {
  dispatches,
  materials,
  stockMovements,
  terakCosts,
  terakMaterials,
  teraks,
  trucks,
} from "@ventura/db/schema/sawmill";
import { validateAndCalculateDispatch } from "@/lib/calc/dispatch";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("yuk chiqarish (dispatch) database operations and business logic (S4)", () => {
  it("yuk chiqarish, ombor qoldig'i kamayishi, K5 yuk mashinasi xarajati va bekor qilish to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Test uchun terak, material va yuk mashinasi yaratish
      const [terak] = await db
        .insert(teraks)
        .values({
          name: "Test Terak Dispatch",
          purchaseDate: "2026-10-24",
          purchasePrice: 10000000,
        })
        .returning();
      if (!terak) throw new Error("Terak yaratilmadi");

      const [mat] = await db
        .insert(materials)
        .values({
          name: "Test Vassa Dispatch",
          unit: "dona",
          pricingMode: "piece",
          thicknessCm: "4",
          widthCm: "10",
          lengthCm: "400",
        })
        .returning();
      if (!mat) throw new Error("Material yaratilmadi");

      // Omborda 100 dona boshlang'ich qoldiq
      const [tm] = await db
        .insert(terakMaterials)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          quantity: "100.0000",
          sellingPrice: 20000,
          cubePrice: 1250000,
        })
        .returning();
      if (!tm) throw new Error("TerakMaterial yaratilmadi");

      const [truck] = await db
        .insert(trucks)
        .values({
          name: "Test Isuzu 5T",
          amount: 200000,
        })
        .returning();
      if (!truck) throw new Error("Truck yaratilmadi");

      // 2. Hisob-kitob tekshiruvi: 40 dona x 20 000 so'm = 800 000 so'm
      const calc = validateAndCalculateDispatch({
        unit: "piece",
        quantityInput: 40,
        priceInput: 20000,
        currentStock: 100,
      });

      expect(calc.valid).toBe(true);
      expect(calc.quantityPiece).toBe(40);
      expect(calc.totalAmount).toBe(800000);

      // 3. Bazaga yuk chiqarish yozuvi kiritish va omborni yangilash
      const newStock = 100 - calc.quantityPiece; // 60
      await db
        .update(terakMaterials)
        .set({ quantity: newStock.toFixed(4) })
        .where(eq(terakMaterials.id, tm.id));

      const [disp] = await db
        .insert(dispatches)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          quantity: calc.quantityPiece.toFixed(4),
          enteredUnit: "piece",
          enteredQty: "40.0000",
          totalAmount: calc.totalAmount,
          date: "2026-10-24",
          recipientName: "Test Xaridor",
          phone: "+998901234567",
          truckId: truck.id,
        })
        .returning();
      if (!disp) throw new Error("Dispatch yaratilmadi");

      // 4. Ombor harakati
      const [movement] = await db
        .insert(stockMovements)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          delta: (-calc.quantityPiece).toFixed(4),
          source: "dispatch",
          sourceId: disp.id,
          note: "Yuk chiqarish: Test Xaridor",
        })
        .returning();
      if (!movement) throw new Error("Stock movement yaratilmadi");

      // 5. K5: Terak xarajatiga mashina narxini qo'shish
      const [truckCost] = await db
        .insert(terakCosts)
        .values({
          terakId: terak.id,
          kind: "truck",
          title: `Yuk mashina xarajati: ${truck.name}`,
          amount: truck.amount,
          date: "2026-10-24",
          dispatchId: disp.id,
          truckId: truck.id,
        })
        .returning();
      if (!truckCost) throw new Error("Truck cost yaratilmadi");

      // 6. Tekshiruvlar:
      // 6.1. Ombor qoldig'i 60 bo'ldi
      const [checkTm] = await db.select().from(terakMaterials).where(eq(terakMaterials.id, tm.id));
      expect(Number(checkTm?.quantity)).toBe(60);

      // 6.2. K5 xarajati mavjud
      expect(truckCost.kind).toBe("truck");
      expect(truckCost.amount).toBe(200000);
      expect(truckCost.dispatchId).toBe(disp.id);

      // 7. Bekor qilish (O'chirish):
      // 7.1. Qoldiqni qaytarish: 60 + 40 = 100
      await db
        .update(terakMaterials)
        .set({ quantity: (60 + Number(disp.quantity)).toFixed(4) })
        .where(eq(terakMaterials.id, tm.id));

      // 7.2. Movement, Cost va Dispatch o'chirish
      await db
        .delete(stockMovements)
        .where(and(eq(stockMovements.source, "dispatch"), eq(stockMovements.sourceId, disp.id)));
      await db.delete(terakCosts).where(eq(terakCosts.dispatchId, disp.id));
      await db.delete(dispatches).where(eq(dispatches.id, disp.id));

      // 8. Qayta tiklangan qoldiqni tekshirish
      const [restoredTm] = await db.select().from(terakMaterials).where(eq(terakMaterials.id, tm.id));
      expect(Number(restoredTm?.quantity)).toBe(100);

      // Cost ham o'chganini tekshirish
      const remainingCosts = await db.select().from(terakCosts).where(eq(terakCosts.dispatchId, disp.id));
      expect(remainingCosts).toHaveLength(0);

      // 9. Tozalash (Cleanup)
      await db.delete(terakMaterials).where(eq(terakMaterials.id, tm.id));
      await db.delete(materials).where(eq(materials.id, mat.id));
      await db.delete(trucks).where(eq(trucks.id, truck.id));
      await db.delete(teraks).where(eq(teraks.id, terak.id));
    } catch (err) {
      // Agar xatolik bo'lsa
      console.error(err);
      throw err;
    }
  });
});
