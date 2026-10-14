import { and, eq, isNull } from "drizzle-orm";
import { normalizeUzPhone } from "@ventura/auth";
import { createStaffUser, findStaffByPhone } from "@ventura/auth/staff";
import { branches, courses, groups, teachers, users } from "@ventura/db/schema/tenant";
import { done, fail } from "./lib";
import { flag, readSecrets, secretsFile, tenantContext } from "./edu-lib";

/*
 * edu-crm E2E (apps/edu-crm/e2e, ADR 0029): sinov markazidagi direktor (ma'lum parol, Telegram ulangan, 2FA) va
 * lidni o'quvchiga aylantirish uchun kurs, o'qituvchi va guruh. Faqat Playwright global-setup chaqiradi:
 * markaz bazasi E2E_EDU_DATABASE_URL bilan bir xil bo'lmasa ishlamaydi — haqiqiy bazaga tegmaydi.
 * Qayta ishga tushirilsa: bor yozuvlar qayta yaratilmaydi, direktorning bloki va xato urinishlari tozalanadi.
 */

const slug = flag("tenant") ?? "";
const { tenant, db, auth } = tenantContext(slug);
const target = process.env.E2E_EDU_DATABASE_URL;
if (!target || readSecrets(secretsFile()).tenants[slug]?.databaseUrl !== target)
  fail("edu:e2e-seed faqat E2E test bazasida ishlaydi (E2E_EDU_DATABASE_URL)");

const phone = normalizeUzPhone(process.env.E2E_USER_PHONE ?? "");
const name = process.env.E2E_USER_NAME ?? "";
const password = process.env.E2E_USER_PASSWORD ?? "";
const chatId = process.env.E2E_USER_CHAT_ID ?? "";
if (!phone || !name || !password || !chatId) fail("E2E_USER_* o'zgaruvchilari to'liq emas");

// 1. Direktor
const existing = await findStaffByPhone(db, phone);
const userId = existing
  ? existing.id
  : (await createStaffUser(auth, db, { phone, name, password, role: "director", mustChangePassword: false })).id;
await db
  .update(users)
  .set({ telegramChatId: chatId, twoFactorEnabled: true, failedAttempts: 0, lockedAt: null, mustChangePassword: false })
  .where(eq(users.id, userId));

// 2. Kurs, o'qituvchi va guruh (birinchi filialda)
const [branch] = await db.select({ id: branches.id }).from(branches).limit(1);
if (!branch) fail("Markazda filial yo'q (avval edu:tenant)");

const COURSE = "E2E kurs";
const [course] = await db
  .select({ id: courses.id })
  .from(courses)
  .where(and(eq(courses.name, COURSE), isNull(courses.archivedAt)));
const courseId =
  course?.id ??
  (
    await db.insert(courses).values({ name: COURSE, price: 400_000, durationMonths: 3 }).returning({ id: courses.id })
  )[0]!.id;

const TEACHER = "E2E ustoz";
const [teacher] = await db
  .select({ id: teachers.id })
  .from(teachers)
  .where(and(eq(teachers.name, TEACHER), isNull(teachers.archivedAt)));
const teacherId =
  teacher?.id ??
  (
    await db
      .insert(teachers)
      .values({ branchId: branch.id, name: TEACHER, phone: "+998900000002" })
      .returning({ id: teachers.id })
  )[0]!.id;

const GROUP = "E2E guruh";
const [group] = await db
  .select({ id: groups.id })
  .from(groups)
  .where(and(eq(groups.name, GROUP), isNull(groups.archivedAt)));
if (!group) {
  await db.insert(groups).values({
    branchId: branch.id,
    courseId,
    teacherId,
    name: GROUP,
    price: 400_000,
    durationMonths: 3,
    days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    startTime: "09:00",
    endTime: "10:30",
    startDate: "2026-01-01",
  });
}

await db.close();
done(`${tenant.name}: E2E direktori va guruh tayyor`);
