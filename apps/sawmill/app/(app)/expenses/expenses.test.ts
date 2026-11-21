import { describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { expenseCategories, generalExpenses } from "@ventura/db/schema/sawmill";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("umumiy xarajatlar (general expenses) database operations (S5 - K14)", () => {
  it("toifa yaratish, umumiy xarajat qo'shish, hisoblash va tozalash to'g'ri ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    const uid = Date.now().toString().slice(-6);
    let categoryId: string | null = null;
    let expenseId: string | null = null;

    try {
      // 1. Yangi toifa yaratish
      const catName = `Test Bino ijarasi Toifasi ${uid}`;
      const [cat] = await db
        .insert(expenseCategories)
        .values({
          name: catName,
        })
        .returning();

      expect(cat).toBeDefined();
      expect(cat?.name).toBe(catName);
      categoryId = cat!.id;

      // 2. Yangi umumiy xarajat kiritish (K14: terakka bog'lanmagan xarajat)
      const [exp] = await db
        .insert(generalExpenses)
        .values({
          categoryId: cat!.id,
          amount: 2500000,
          date: "2026-10-24",
          note: "Oylik ijara to'lovi",
        })
        .returning();

      expect(exp).toBeDefined();
      expect(exp?.amount).toBe(2500000);
      expect(exp?.date).toBe("2026-10-24");
      expenseId = exp!.id;

      // 3. Jami umumiy xarajatlarni hisoblash
      const [sumRow] = await db
        .select({ total: sql<number>`sum(${generalExpenses.amount})` })
        .from(generalExpenses)
        .where(eq(generalExpenses.id, exp!.id));

      expect(Number(sumRow?.total)).toBe(2500000);

      // 4. Xarajatni o'chirish
      await db.delete(generalExpenses).where(eq(generalExpenses.id, exp!.id));
      const [deletedExp] = await db.select().from(generalExpenses).where(eq(generalExpenses.id, exp!.id));
      expect(deletedExp).toBeUndefined();
    } finally {
      if (expenseId) {
        await db
          .delete(generalExpenses)
          .where(eq(generalExpenses.id, expenseId))
          .catch(() => {});
      }
      if (categoryId) {
        await db
          .delete(expenseCategories)
          .where(eq(expenseCategories.id, categoryId))
          .catch(() => {});
      }
    }
  });
});
