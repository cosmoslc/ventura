import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { workers } from "@ventura/db/schema/sawmill";

const DB_URL =
  "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("workers database and schema operations", () => {
  it("ishchi qo'shish, o'qish, tahrirlash va arxivlash to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Ishchi yaratish
      const [w] = await db
        .insert(workers)
        .values({
          name: "Test Ishchi",
          phone: "+998909998877",
          salaryType: "daily",
          wageAmount: 150000,
        })
        .returning();

      expect(w).toBeDefined();
      if (!w) throw new Error("Worker yaratilmadi");
      expect(w.name).toBe("Test Ishchi");
      expect(w.salaryType).toBe("daily");
      expect(w.wageAmount).toBe(150000);
      expect(w.archivedAt).toBeNull();

      // 2. Tahrirlash
      const [updated] = await db
        .update(workers)
        .set({
          name: "Test Ishchi Yangilangan",
          salaryType: "monthly",
          wageAmount: 4000000,
        })
        .where(eq(workers.id, w.id))
        .returning();

      expect(updated).toBeDefined();
      if (!updated) throw new Error("Worker yangilanmadi");
      expect(updated.name).toBe("Test Ishchi Yangilangan");
      expect(updated.salaryType).toBe("monthly");
      expect(updated.wageAmount).toBe(4000000);

      // 3. Arxivlash
      const [archived] = await db
        .update(workers)
        .set({ archivedAt: new Date() })
        .where(eq(workers.id, w.id))
        .returning();

      expect(archived).toBeDefined();
      if (!archived) throw new Error("Worker arxivlanmadi");
      expect(archived.archivedAt).not.toBeNull();

      // 4. Tozalash (test ma'lumotini o'chirish)
      await db.delete(workers).where(eq(workers.id, w.id));
    } finally {
      await db.close();
    }
  });
});
