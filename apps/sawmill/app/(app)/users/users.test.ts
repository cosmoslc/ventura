import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { users } from "@ventura/db/schema/sawmill";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("xodimlar va rollar (users) database operations (S6)", () => {
  it("foydalanuvchi yaratish, rol o'zgartirish, bloklash va arxivlash to'g'ri ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    const uid = Date.now().toString().slice(-6);
    let createdUserId: string | null = null;

    try {
      // 1. Yangi foydalanuvchi qo'shish
      const phone = `+99890${uid.padStart(7, "1")}`;
      const [u] = await db
        .insert(users)
        .values({
          name: `Test Hisobchi ${uid}`,
          email: `${phone}@sawmill.local`,
          phoneNumber: phone,
          role: "accountant",
          locale: "uz",
        })
        .returning();

      expect(u).toBeDefined();
      expect(u?.role).toBe("accountant");
      createdUserId = u!.id;

      // 2. Rolni o'zgartirish (accountant -> viewer)
      await db.update(users).set({ role: "viewer" }).where(eq(users.id, u!.id));
      const [updatedRole] = await db.select({ role: users.role }).from(users).where(eq(users.id, u!.id));
      expect(updatedRole?.role).toBe("viewer");

      // 3. Bloklash (lock)
      const lockDate = new Date();
      await db.update(users).set({ lockedAt: lockDate }).where(eq(users.id, u!.id));
      const [locked] = await db.select({ lockedAt: users.lockedAt }).from(users).where(eq(users.id, u!.id));
      expect(locked?.lockedAt).toBeDefined();

      // 4. Arxivlash (soft delete)
      await db.update(users).set({ archivedAt: new Date() }).where(eq(users.id, u!.id));
      const [archived] = await db.select({ archivedAt: users.archivedAt }).from(users).where(eq(users.id, u!.id));
      expect(archived?.archivedAt).not.toBeNull();
    } finally {
      if (createdUserId) {
        await db
          .delete(users)
          .where(eq(users.id, createdUserId))
          .catch(() => {});
      }
    }
  });
});
