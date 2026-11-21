import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { trucks } from "@ventura/db/schema/sawmill";

const DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("trucks database operations", () => {
  it("mashina yaratish, tahrirlash va arxivlash to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Yangi mashina
      const [tr] = await db
        .insert(trucks)
        .values({
          name: "Test ZIL 130",
          amount: 250000,
        })
        .returning();

      expect(tr).toBeDefined();
      if (!tr) throw new Error("Truck yaratilmadi");
      expect(tr.name).toBe("Test ZIL 130");
      expect(tr.amount).toBe(250000);

      // 2. Tahrirlash
      const [updated] = await db.update(trucks).set({ amount: 300000 }).where(eq(trucks.id, tr.id)).returning();

      expect(updated).toBeDefined();
      if (!updated) throw new Error("Truck yangilanmadi");
      expect(updated.amount).toBe(300000);

      // 3. Arxivlash
      const [archived] = await db
        .update(trucks)
        .set({ archivedAt: new Date() })
        .where(eq(trucks.id, tr.id))
        .returning();

      expect(archived).toBeDefined();
      if (!archived) throw new Error("Truck arxivlanmadi");
      expect(archived.archivedAt).not.toBeNull();

      // 4. Tozalash
      await db.delete(trucks).where(eq(trucks.id, tr.id));
    } finally {
      await db.close();
    }
  });
});
