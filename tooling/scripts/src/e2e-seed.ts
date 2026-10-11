import { eq } from "drizzle-orm";
import { createAdminUser, findUserByPhone, normalizeUzPhone, revokeAllSessions } from "@ventura/auth";
import { users } from "@ventura/db/schema/panel";
import { context, done, fail } from "./lib";

/*
 * E2E test foydalanuvchisi (apps/panel/e2e). Faqat Playwright global-setup chaqiradi:
 * E2E_DATABASE_URL bo'lmasa ishlamaydi, shuning uchun haqiqiy bazaga tegmaydi.
 */

if (!process.env.E2E_DATABASE_URL || process.env.PANEL_DATABASE_URL !== process.env.E2E_DATABASE_URL) {
  fail("e2e:seed faqat test bazasida ishlaydi (E2E_DATABASE_URL)");
}

const phone = normalizeUzPhone(process.env.E2E_USER_PHONE ?? "");
const name = process.env.E2E_USER_NAME ?? "";
const password = process.env.E2E_USER_PASSWORD ?? "";
const chatId = process.env.E2E_USER_CHAT_ID ?? "";
if (!phone || !name || !password || !chatId) fail("E2E_USER_* o'zgaruvchilari to'liq emas");

const { db, auth } = context();
const existing = await findUserByPhone(db, phone);

if (existing) {
  // Oldingi ishga tushishdan qolgan holat: blok, xato urinishlar va ochiq sessiyalar tozalanadi
  await db.update(users).set({ failedAttempts: 0, lockedAt: null }).where(eq(users.id, existing.id));
  await revokeAllSessions(db, existing.id);
  done(`E2E foydalanuvchisi tayyor: ${name}`);
}

await createAdminUser(auth, {
  phone,
  name,
  password,
  role: "super_admin",
  telegramChatId: chatId,
  twoFactorEnabled: true,
});
done(`E2E foydalanuvchisi yaratildi: ${name}`);
