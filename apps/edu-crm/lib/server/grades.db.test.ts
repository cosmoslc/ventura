import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, courses, groups, lessonGrades, settings, students, teachers } from "@ventura/db/schema/tenant";
import { GRADING_KEY } from "@/lib/grades";
import { coinBalance, syncHomeworkCoin } from "./coins";
import { getGradingSettings, groupGradeMarks, studentGrades } from "./grades";

/*
 * Dars baholari haqiqiy PostgreSQL'da (ADR 0061): jadval cheklovlari (shkala, bo'sh qator), guruh-oy baholari,
 * o'quvchi xulosasi, uy vazifasi coini va mijozlar ajratilgani. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_grades_test";
const ROLE = "edu_grades_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

let seq = 0;
async function seed(t: TenantDb) {
  const n = ++seq;
  const [b] = await t
    .insert(branches)
    .values({ name: `Markaz ${n}` })
    .returning();
  const [c] = await t
    .insert(courses)
    .values({ name: `Kurs ${n}`, price: 300_000 })
    .returning();
  const [tc] = await t
    .insert(teachers)
    .values({ branchId: b!.id, name: `Ustoz ${n}`, phone: `+9989011144${String(n).padStart(2, "0")}` })
    .returning();
  const [g] = await t
    .insert(groups)
    .values({
      branchId: b!.id,
      courseId: c!.id,
      teacherId: tc!.id,
      name: `Guruh ${n}`,
      price: 300_000,
      days: ["mon", "wed", "fri"],
      startTime: "15:00",
      endTime: "16:30",
      startDate: "2026-01-10",
    })
    .returning();
  const [s] = await t
    .insert(students)
    .values({ branchId: b!.id, name: `O'quvchi ${n}`, phone: `+9989076545${String(n).padStart(2, "0")}` })
    .returning();
  return { group: g!, student: s! };
}

describe.skipIf(!ADMIN_URL)("dars baholari (haqiqiy PostgreSQL)", () => {
  beforeAll(async () => {
    const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
    try {
      await admin.unsafe(`drop database if exists ${DB} with (force)`);
      await admin.unsafe(`drop role if exists ${ROLE}`);
      await admin.unsafe(`create role ${ROLE} login password '${ROLE}' nosuperuser nobypassrls`);
      await admin.unsafe(`create database ${DB} owner ${ROLE}`);
    } finally {
      await admin.end();
    }
    await migrateTenantDb(appUrl());
    db = createTenantDb(appUrl(), "alfa", { max: 2 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("cheklovlar: baho shkaladan oshmaydi, shkala faqat 5/10/100, bo'sh qator yo'q, kun noyob", async () => {
    const { group, student } = await seed(db);
    const base = { groupId: group.id, studentId: student.id };
    await expect(db.insert(lessonGrades).values({ ...base, date: "2026-11-02", score: 6, scale: 5 })).rejects.toThrow();
    await expect(db.insert(lessonGrades).values({ ...base, date: "2026-11-02", score: 3, scale: 7 })).rejects.toThrow();
    await expect(db.insert(lessonGrades).values({ ...base, date: "2026-11-02", scale: 5 })).rejects.toThrow();
    await db.insert(lessonGrades).values({ ...base, date: "2026-11-02", score: 5, scale: 5 });
    await expect(
      db.insert(lessonGrades).values({ ...base, date: "2026-11-02", homework: true, scale: 5 }),
    ).rejects.toThrow();
  });

  it("guruh-oy baholari va o'quvchi xulosasi (turli shkalalar foizda)", async () => {
    const { group, student } = await seed(db);
    const base = { groupId: group.id, studentId: student.id };
    await db.insert(lessonGrades).values([
      { ...base, date: "2026-10-30", score: 4, scale: 5, homework: true },
      { ...base, date: "2026-11-02", score: 6, scale: 10, homework: false },
      { ...base, date: "2026-11-04", scale: 10, homework: true },
    ]);
    const marks = await groupGradeMarks(db, group.id, "2026-11-01", "2026-11-30", [student.id]);
    expect(Object.keys(marks).sort()).toEqual([`${student.id}|2026-11-02`, `${student.id}|2026-11-04`]);
    expect(marks[`${student.id}|2026-11-02`]).toEqual({ score: 6, scale: 10, homework: false });
    expect(await groupGradeMarks(db, group.id, "2026-11-01", "2026-11-30", [])).toEqual({});

    const [summary] = await studentGrades(db, student.id);
    expect(summary).toMatchObject({
      groupId: group.id,
      groupName: group.name,
      average: 70,
      graded: 2,
      homeworkDone: 2,
      homeworkMarked: 3,
    });
    expect(summary!.recent.map((r) => r.date)).toEqual(["2026-11-04", "2026-11-02", "2026-10-30"]);
  });

  it("uy vazifasi coini: bajardi — beriladi, bajarmadi — olinadi", async () => {
    const { group, student } = await seed(db);
    const rt = {
      active: true,
      settings: {
        prepay: { enabled: false, amount: 10 },
        attendance: { enabled: false, amount: 1 },
        homework: { enabled: true, amount: 3 },
        manual: { enabled: false, dailyLimit: 5 },
      },
    };
    const mark = (homework: boolean | null) =>
      syncHomeworkCoin(db, rt, { studentId: student.id, groupId: group.id, date: "2026-11-02", homework });
    expect(await mark(true)).toEqual({ rule: "homework", action: "award", amount: 3 });
    expect(await mark(true)).toBeNull();
    expect(await coinBalance(db, student.id)).toBe(3);
    expect(await mark(false)).toEqual({ rule: "homework", action: "revoke", amount: 3 });
    expect(await mark(null)).toBeNull();
    expect(await coinBalance(db, student.id)).toBe(0);
  });

  it("shkala sozlamasi va boshqa mijoz ajratilgan", async () => {
    expect(await getGradingSettings(db)).toEqual({ scale: 5 });
    await db.insert(settings).values({ key: GRADING_KEY, value: { scale: 100 } });
    expect(await getGradingSettings(db)).toEqual({ scale: 100 });
    expect(await getGradingSettings(other)).toEqual({ scale: 5 });
    expect(await other.select().from(lessonGrades)).toEqual([]);
  });
});
