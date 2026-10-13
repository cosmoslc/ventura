import { asc, count } from "drizzle-orm";
import { branches, courses, groupMemberships, groups, rooms, students, teachers } from "@ventura/db/schema/tenant";
import { done, fail } from "./lib";
import { flag, tenantContext } from "./edu-lib";
import { SEED_GROUPS, seedPlan } from "./edu-seed-plan";

/*
 * pnpm edu:seed -- --tenant sinov
 *
 * Faqat mahalliy sinov uchun: bo'sh markazga namuna ma'lumot — 10 ta xona, 20 ta kurs, 10 ta o'qituvchi,
 * 20 ta guruh (xona va o'qituvchi vaqti to'qnashmaydi), 20 ta o'quvchi va ularning a'zoliklari — faqat joriy va o'tgan
 * oy (sanalar: edu-seed-plan.ts). Markazda kurs allaqachon bo'lsa, hech narsa yozilmaydi.
 */

const slug = flag("tenant") ?? "";
const { tenant, db } = tenantContext(slug);

const [{ n }] = (await db.select({ n: count() }).from(courses)) as [{ n: number }];
if (n > 0) fail(`${tenant.name}: kurslar allaqachon bor (${n} ta) — namuna ma'lumot faqat bo'sh markazga yoziladi`);
const [branch] = await db.select({ id: branches.id }).from(branches).orderBy(asc(branches.createdAt)).limit(1);
if (!branch) fail("Filial topilmadi (avval pnpm edu:tenant)");

const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
const plan = seedPlan(today);

// Takrorlanadigan tasodif: har ishga tushirishda bir xil natija
let seed = 20261013;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
const usedPhones = new Set<string>();
const phone = () => {
  for (;;) {
    const p = `+99890${String(Math.floor(rand() * 10_000_000)).padStart(7, "0")}`;
    if (!usedPhones.has(p)) return (usedPhones.add(p), p);
  }
};

const COLORS = ["#6366f1", "#16a34a", "#e11d48", "#0284c7", "#d97706", "#7c3aed", "#0d9488", "#db2777"];
const COURSES = [
  ["General English", 350_000],
  ["IELTS", 550_000],
  ["Rus tili", 300_000],
  ["Matematika", 400_000],
  ["Fizika", 400_000],
  ["Kimyo", 380_000],
  ["Biologiya", 380_000],
  ["Ona tili va adabiyot", 300_000],
  ["Tarix", 300_000],
  ["Informatika", 450_000],
  ["Python dasturlash", 650_000],
  ["Frontend (React)", 700_000],
  ["Grafik dizayn", 600_000],
  ["Koreys tili", 450_000],
  ["Arab tili", 400_000],
  ["Nemis tili", 450_000],
  ["SAT Math", 600_000],
  ["Mental arifmetika", 280_000],
  ["Robototexnika", 550_000],
  ["Chess (shaxmat)", 250_000],
] as const;
const MALE = ["Aziz", "Bekzod", "Doniyor", "Jasur", "Sardor", "Otabek", "Sherzod", "Javohir", "Akmal", "Ulug'bek"];
const FEMALE = [
  "Dilnoza",
  "Madina",
  "Nilufar",
  "Sevara",
  "Malika",
  "Kamola",
  "Gulnoza",
  "Shahnoza",
  "Zarina",
  "Mohira",
];
const SURNAMES = ["Karimov", "Rahimov", "Tursunov", "Aliyev", "Yusupov", "Ergashev", "Nazarov", "Saidov", "Qodirov"];
const fullName = (male: boolean) => `${pick(male ? MALE : FEMALE)} ${pick(SURNAMES)}${male ? "" : "a"}`;

// 1. Xonalar
const roomRows = await db
  .insert(rooms)
  .values(
    Array.from({ length: 10 }, (_, i) => ({
      branchId: branch.id,
      name: `${101 + i}-xona`,
      capacity: 12 + Math.floor(rand() * 9),
    })),
  )
  .returning({ id: rooms.id });

// 2. Kurslar (markaz bo'yicha umumiy)
const courseRows = await db
  .insert(courses)
  .values(
    COURSES.map(([name, price], i) => ({
      name,
      price,
      durationMonths: pick([3, 6, 9, 12]),
      color: COLORS[i % COLORS.length]!,
    })),
  )
  .returning({ id: courses.id, name: courses.name, price: courses.price, durationMonths: courses.durationMonths });

// 3. O'qituvchilar: maosh turlari aralash
const teacherRows = await db
  .insert(teachers)
  .values(
    Array.from({ length: 10 }, (_, i) => {
      const male = i % 3 !== 2;
      const type = (["percent", "per_student", "fixed"] as const)[i % 3]!;
      return {
        branchId: branch.id,
        name: fullName(male),
        phone: phone(),
        gender: male ? ("male" as const) : ("female" as const),
        birthDate: `19${85 + Math.floor(rand() * 15)}-0${1 + Math.floor(rand() * 9)}-1${Math.floor(rand() * 9)}`,
        salaryType: type,
        revenueSharePercent: type === "percent" ? pick([30, 35, 40, 45, 50]) : 0,
        perStudentSalary: type === "per_student" ? pick([80_000, 100_000, 120_000]) : 0,
        fixedSalary: type === "fixed" ? pick([3_000_000, 4_000_000, 5_000_000]) : 0,
        workingDays: ["mon", "tue", "wed", "thu", "fri", "sat"],
      };
    }),
  )
  .returning({ id: teachers.id });

// 4. Guruhlar: o'qituvchi va xona i — ertalab (toq kunlar) va kunduzi (juft kunlar); to'qnashuv yo'q
const SLOTS = [
  { days: ["mon", "wed", "fri"], start: "09:00", end: "10:30" },
  { days: ["tue", "thu", "sat"], start: "14:00", end: "15:30" },
];
const groupRows = await db
  .insert(groups)
  .values(
    Array.from({ length: SEED_GROUPS }, (_, i) => {
      const c = courseRows[i]!;
      const slot = SLOTS[i < 10 ? 0 : 1]!;
      return {
        branchId: branch.id,
        courseId: c.id,
        teacherId: teacherRows[i % 10]!.id,
        roomId: roomRows[i % 10]!.id,
        name: `${c.name} ${i < 10 ? "A" : "B"}`,
        price: c.price,
        durationMonths: c.durationMonths,
        days: slot.days,
        startTime: slot.start,
        endTime: slot.end,
        startDate: plan.groupStart[i]!,
        color: COLORS[i % COLORS.length]!,
      };
    }),
  )
  .returning({ id: groups.id });

// 5. O'quvchilar va a'zoliklar (sanalar rejadan)
for (const p of plan.students) {
  const male = rand() < 0.5;
  const [s] = await db
    .insert(students)
    .values({
      branchId: branch.id,
      name: fullName(male),
      phone: phone(),
      gender: male ? "male" : "female",
      status: p.trial ? "trial" : "active",
      joinedAt: p.start,
      source: pick(["Instagram", "Telegram", "Tanish / Tavsiya", "Banner / Reklama"]),
    })
    .returning({ id: students.id });
  for (const g of p.groups) {
    await db.insert(groupMemberships).values({
      groupId: groupRows[g]!.id,
      studentId: s!.id,
      status: p.trial ? "trial" : "active",
      enrolledAt: p.start,
      activatedAt: p.trial ? null : p.start,
    });
  }
}

await db.close();
done(`${tenant.name}: 10 ta xona, 20 ta kurs, 10 ta o'qituvchi, 20 ta guruh va 20 ta o'quvchi qo'shildi`);
