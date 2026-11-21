import { describe, expect, it } from "vitest";
import { eq, isNull } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { materials, terakCosts, terakMaterials, teraks } from "@ventura/db/schema/sawmill";

const DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("teraks, stock and costs database operations", () => {
  it("terak yaratish, ombor narxlari, res xarajati va savat amallari to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Yangi terak yaratish
      const [trk] = await db
        .insert(teraks)
        .values({
          name: "Test Terak Partiyasi",
          purchaseDate: "2026-10-24",
          purchasePrice: 15000000,
          note: "Sinov partiyasi",
        })
        .returning();

      expect(trk).toBeDefined();
      if (!trk) throw new Error("Terak yaratilmadi");
      expect(trk.name).toBe("Test Terak Partiyasi");
      expect(trk.purchasePrice).toBe(15000000);
      expect(trk.deletedAt).toBeNull();

      // 2. Faol materiallar ushbu terakka biriktirilishi
      const activeMats = await db.select().from(materials).where(isNull(materials.archivedAt));

      if (activeMats.length > 0) {
        const mat = activeMats[0]!;
        const [tm] = await db
          .insert(terakMaterials)
          .values({
            terakId: trk.id,
            materialId: mat.id,
            quantity: "50",
            workerPrice: 1500,
            sellingPrice: 12000,
            goal: "100",
          })
          .returning();

        expect(tm).toBeDefined();
        if (!tm) throw new Error("Terak materiali ulanmadi");
        expect(tm.workerPrice).toBe(1500);
        expect(tm.sellingPrice).toBe(12000);

        // Narxlarni yangilash
        const [updatedTm] = await db
          .update(terakMaterials)
          .set({ sellingPrice: 13500 })
          .where(eq(terakMaterials.id, tm.id))
          .returning();

        expect(updatedTm).toBeDefined();
        if (!updatedTm) throw new Error("Narx yangilanmadi");
        expect(updatedTm.sellingPrice).toBe(13500);
      }

      // 3. Res olib kelish xarajatini kiritish (3 reys x 200 000 so'm = 600 000)
      const [cost] = await db
        .insert(terakCosts)
        .values({
          terakId: trk.id,
          kind: "res",
          title: "Res olib kelish",
          trips: 3,
          pricePerTrip: 200000,
          amount: 600000,
          date: "2026-10-24",
        })
        .returning();

      expect(cost).toBeDefined();
      if (!cost) throw new Error("Xarajat yaratilmadi");
      expect(cost.trips).toBe(3);
      expect(cost.amount).toBe(600000);

      // 4. Savatga tashlash va tiklash (K8)
      const [trashed] = await db.update(teraks).set({ deletedAt: new Date() }).where(eq(teraks.id, trk.id)).returning();

      expect(trashed).toBeDefined();
      if (!trashed) throw new Error("Savatga tushmadi");
      expect(trashed.deletedAt).not.toBeNull();

      const [restored] = await db.update(teraks).set({ deletedAt: null }).where(eq(teraks.id, trk.id)).returning();

      expect(restored).toBeDefined();
      if (!restored) throw new Error("Savatdan chiqmadi");
      expect(restored.deletedAt).toBeNull();

      // 5. Tozalash (cascade delete)
      await db.delete(teraks).where(eq(teraks.id, trk.id));
    } finally {
      await db.close();
    }
  });
});
