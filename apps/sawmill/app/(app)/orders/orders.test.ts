import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { materials, orders, terakMaterials, teraks } from "@ventura/db/schema/sawmill";
import { getOrderStatus, isOrderDueSoon } from "@/lib/calc/orders";

const DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("zakazlar (orders) database operations and business logic (S4)", () => {
  it("zakaz yaratish, holatlar (tayyor/kutilmoqda/bajarildi), K20 bayroqlari saqlanishi va o'chirish to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Test uchun terak va material
      const [terak] = await db
        .insert(teraks)
        .values({
          name: "Test Terak Orders",
          purchaseDate: "2026-10-24",
          purchasePrice: 5000000,
        })
        .returning();
      if (!terak) throw new Error("Terak yaratilmadi");

      const [mat] = await db
        .insert(materials)
        .values({
          name: "Test Reyka Orders",
          unit: "dona",
          pricingMode: "piece",
        })
        .returning();
      if (!mat) throw new Error("Material yaratilmadi");

      // Omborda 50 dona qoldiq
      const [tm] = await db
        .insert(terakMaterials)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          quantity: "50.0000",
          sellingPrice: 15000,
          cubePrice: 0,
        })
        .returning();
      if (!tm) throw new Error("TerakMaterial yaratilmadi");

      // 2. Zakaz 1: 50 dona (ombordagi 50 dona qoplaydi -> "ready")
      const [order1] = await db
        .insert(orders)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          quantity: "50.0000",
          customerName: "Test Buyurtmachi 1",
          phone: "+998909998877",
          dueDate: "2026-10-25",
        })
        .returning();
      if (!order1) throw new Error("Order 1 yaratilmadi");

      // 3. Zakaz 2: 80 dona (ombordagi 50 dona yetmaydi -> "pending")
      const [order2] = await db
        .insert(orders)
        .values({
          terakId: terak.id,
          materialId: mat.id,
          quantity: "80.0000",
          customerName: "Test Buyurtmachi 2",
          dueDate: "2026-11-01",
        })
        .returning();
      if (!order2) throw new Error("Order 2 yaratilmadi");

      // Holatlarni tekshirish
      const status1 = getOrderStatus(
        { quantity: Number(order1.quantity), completedAt: order1.completedAt },
        Number(tm.quantity),
      );
      expect(status1).toBe("ready");

      const status2 = getOrderStatus(
        { quantity: Number(order2.quantity), completedAt: order2.completedAt },
        Number(tm.quantity),
      );
      expect(status2).toBe("pending");

      // Muddat yaqinligini tekshirish (order1 muddati: 2026-10-25)
      const dueSoon1 = isOrderDueSoon(order1.dueDate, new Date("2026-10-24"));
      expect(dueSoon1).toBe(true);

      // 4. Bajarildi holatini o'zgartirish (Toggle completed)
      const completedDate = new Date();
      const [completedOrder] = await db
        .update(orders)
        .set({ completedAt: completedDate })
        .where(eq(orders.id, order1.id))
        .returning();

      expect(completedOrder?.completedAt).not.toBeNull();
      const statusCompleted = getOrderStatus(
        { quantity: Number(completedOrder?.quantity), completedAt: completedOrder?.completedAt },
        Number(tm.quantity),
      );
      expect(statusCompleted).toBe("completed");

      // 5. K20: Eslatma bayrog'i (readyNotifiedAt) qo'yilganidan keyin tahrirlashda o'chib ketmasligi
      const readyDate = new Date();
      await db.update(orders).set({ readyNotifiedAt: readyDate }).where(eq(orders.id, order1.id));

      // Zakazni tahrirlash
      const [updatedOrder] = await db
        .update(orders)
        .set({
          customerName: "Yangilangan Mijoz Nomi",
          quantity: "55.0000",
          updatedAt: new Date(),
        })
        .where(eq(orders.id, order1.id))
        .returning();

      expect(updatedOrder?.customerName).toBe("Yangilangan Mijoz Nomi");
      expect(Number(updatedOrder?.quantity)).toBe(55);
      // K20 tekshiruvi: readyNotifiedAt saqlanib qolishi shart
      expect(updatedOrder?.readyNotifiedAt).not.toBeNull();

      // 6. Zakazlarni o'chirish
      await db.delete(orders).where(eq(orders.id, order1.id));
      await db.delete(orders).where(eq(orders.id, order2.id));

      const remainingOrders = await db.select().from(orders).where(eq(orders.terakId, terak.id));
      expect(remainingOrders).toHaveLength(0);

      // 7. Tozalash (Cleanup)
      await db.delete(terakMaterials).where(eq(terakMaterials.id, tm.id));
      await db.delete(materials).where(eq(materials.id, mat.id));
      await db.delete(teraks).where(eq(teraks.id, terak.id));
    } catch (err) {
      console.error(err);
      throw err;
    }
  });
});
