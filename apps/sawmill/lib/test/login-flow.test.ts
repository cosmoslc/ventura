import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createSawmillDb } from "@ventura/db";
import { users } from "@ventura/db/schema/sawmill";
import { createSawmillAuth } from "../server/auth";

const DB_URL =
  "postgres://ventura:5XWBxJfHkvKkSLLT87q9NqMn@localhost:5432/edu_dev?options=-csearch_path%3Dsawmill";

describe("sawmill login flow verification", () => {
  it("baza va Better Auth egasi bilan to'liq ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");
    try {
      const [owner] = await db
        .select()
        .from(users)
        .where(eq(users.role, "owner"))
        .limit(1);

      expect(owner).toBeDefined();
      if (!owner) throw new Error("Owner topilmadi");
      expect(owner.name).toBe("Alisher Ega");
      expect(owner.phoneNumber).toBe("+998901234567");

      const auth = createSawmillAuth({
        db,
        appName: "Baraka Pilorama",
        secret: "Gw4mPds8XLuWxErfMvJdBcD_3r3P5CHTpXyOb3rZ8n0",
        baseURL: "http://localhost:3003",
      });

      // Parol bilan kirishni tekshirish
      const res = await auth.api.signInEmail({
        body: {
          email: "+998901234567@sawmill.local",
          password: "Password123!",
        },
      });

      expect(res.user.id).toBe(owner.id);
      expect(res.user.role).toBe("owner");
      expect(res.token).toBeDefined();
    } finally {
      await db.close();
    }
  });
});
