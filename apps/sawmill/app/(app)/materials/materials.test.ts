import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { materialSizes, materials } from "@ventura/db/schema/sawmill";
import { pieceVolumeM3 } from "@/lib/calc/units";

const DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("materials catalog database operations", () => {
  it("material yaratish, hajm hisoblash, o'lcham varianti qo'shish va tozalash ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Yangi material yaratish (masalan Brus 10x10x600)
      const [m] = await db
        .insert(materials)
        .values({
          name: "Test Brus 10x10",
          unit: "dona",
          pricingMode: "piece",
          thicknessCm: "10.00",
          widthCm: "10.00",
          lengthCm: "600.00",
        })
        .returning();

      expect(m).toBeDefined();
      if (!m) throw new Error("Material yaratilmadi");
      expect(m.name).toBe("Test Brus 10x10");

      // 1 dona hajmini tekshirish: 0.1m * 0.1m * 6m = 0.06 m³
      const vol = pieceVolumeM3({
        thicknessCm: Number(m.thicknessCm),
        widthCm: Number(m.widthCm),
        lengthCm: Number(m.lengthCm),
      });
      expect(vol).toBe(0.06);

      // 2. O'lcham varianti qo'shish (Brus 10x10x400)
      const [size] = await db
        .insert(materialSizes)
        .values({
          materialId: m.id,
          thicknessCm: "10.00",
          widthCm: "10.00",
          lengthCm: "400.00",
        })
        .returning();

      expect(size).toBeDefined();
      if (!size) throw new Error("Size yaratilmadi");
      expect(size.materialId).toBe(m.id);

      const sizeVol = pieceVolumeM3({
        thicknessCm: Number(size.thicknessCm),
        widthCm: Number(size.widthCm),
        lengthCm: Number(size.lengthCm),
      });
      expect(sizeVol).toBe(0.04);

      // 3. Tozalash (cascade orqali size ham o'chadi)
      await db.delete(materials).where(eq(materials.id, m.id));
    } finally {
      await db.close();
    }
  });
});
