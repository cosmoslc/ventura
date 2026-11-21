import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { workTypes } from "@ventura/db/schema/sawmill";
import { getSawmillSettings, saveSawmillSettings } from "@/lib/settings/schema";

const DB_URL = "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("settings and work types database operations", () => {
  it("sozlamalarni saqlash va o'qish to'g'ri ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Sozlamani o'zgartirish
      const saved = await saveSawmillSettings(db, "test-user-id", {
        profitMode: "actual",
        dimensionUnit: "mm",
        qtyDisplay: "cube",
        cubeInputMode: "calculated",
      });

      expect(saved.profitMode).toBe("actual");
      expect(saved.dimensionUnit).toBe("mm");

      // 2. Qayta o'qish
      const loaded = await getSawmillSettings(db);
      expect(loaded.profitMode).toBe("actual");
      expect(loaded.dimensionUnit).toBe("mm");
      expect(loaded.qtyDisplay).toBe("cube");

      // 3. Standart holatga qaytarish
      await saveSawmillSettings(db, "test-user-id", {
        profitMode: "estimated",
        dimensionUnit: "sm",
        qtyDisplay: "piece",
        cubeInputMode: "direct",
      });
    } finally {
      await db.close();
    }
  });

  it("ish turi qo'shish va o'chirish ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      // 1. Yangi ish turi
      const [wt] = await db
        .insert(workTypes)
        .values({
          name: "Test Maydalash",
          kind: "regular",
          isSystem: false,
        })
        .returning();

      expect(wt).toBeDefined();
      if (!wt) throw new Error("WorkType yaratilmadi");
      expect(wt.name).toBe("Test Maydalash");
      expect(wt.isSystem).toBe(false);

      // 2. O'chirish
      await db.delete(workTypes).where(eq(workTypes.id, wt.id));
    } finally {
      await db.close();
    }
  });
});
