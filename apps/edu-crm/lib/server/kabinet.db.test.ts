import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  attendance,
  branches,
  courses,
  groupMemberships,
  groups,
  lessonGrades,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { kabinetGroup, kabinetGroups } from "./kabinet";

/*
 * O'qituvchi kabineti ma'lumotlari haqiqiy PostgreSQL'da (ADR 0062): guruh sahifasi faqat o'z guruhiga ochiladi,
 * statistika davomat va baholardan, boshqa markaz hech narsa ko'rmaydi. TENANT_TEST_ADMIN_URL berilmasa
 * o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_kabinet_test";
const ROLE = "edu_kabinet_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
const ids = { a: "", b: "", groupA: "", groupB: "", ali: "", vali: "" };
const ALL = { features: ["attendance", "grades", "coins"] };

describe.skipIf(!ADMIN_URL)("o'qituvchi kabineti (haqiqiy PostgreSQL)", () => {
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

    const [b] = await db.insert(branches).values({ name: "Markaz" }).returning();
    const [c] = await db.insert(courses).values({ name: "Ingliz tili", price: 300_000 }).returning();
    const [ta, tb] = await db
      .insert(teachers)
      .values([
        { branchId: b!.id, name: "Aziza", phone: "+998901120001" },
        { branchId: b!.id, name: "Bobur", phone: "+998901120002" },
      ])
      .returning();
    const group = (teacherId: string, name: string) => ({
      branchId: b!.id,
      courseId: c!.id,
      teacherId,
      name,
      price: 300_000,
      days: ["mon", "wed", "fri"],
      startTime: "15:00",
      endTime: "16:30",
      startDate: "2026-01-10",
    });
    const [gA, gB] = await db
      .insert(groups)
      .values([group(ta!.id, "A guruh"), group(tb!.id, "B guruh")])
      .returning();
    const [ali, vali] = await db
      .insert(students)
      .values([
        { branchId: b!.id, name: "Ali", phone: "+998907780001" },
        { branchId: b!.id, name: "Vali", phone: "+998907780002" },
      ])
      .returning();
    await db.insert(groupMemberships).values([
      { groupId: gA!.id, studentId: ali!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: gA!.id, studentId: vali!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
    ]);
    await db.insert(attendance).values([
      { groupId: gA!.id, studentId: ali!.id, date: "2026-11-02", status: "present" },
      { groupId: gA!.id, studentId: vali!.id, date: "2026-11-02", status: "absent" },
    ]);
    await db.insert(lessonGrades).values([
      { groupId: gA!.id, studentId: ali!.id, date: "2026-11-02", score: 5, scale: 5, homework: true },
      { groupId: gA!.id, studentId: vali!.id, date: "2026-11-02", scale: 5, homework: false },
      { groupId: gA!.id, studentId: vali!.id, date: "2026-11-04", score: 2, scale: 5 },
    ]);
    Object.assign(ids, { a: ta!.id, b: tb!.id, groupA: gA!.id, groupB: gB!.id, ali: ali!.id, vali: vali!.id });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("guruhlar ro'yxati: faqat o'ziniki", async () => {
    expect((await kabinetGroups(db, ids.a)).map((g) => g.id)).toEqual([ids.groupA]);
    expect((await kabinetGroups(db, ids.b)).map((g) => g.id)).toEqual([ids.groupB]);
  });

  it("boshqa o'qituvchining guruhi va boshqa markaz — null", async () => {
    expect(await kabinetGroup(ALL, db, ids.a, ids.groupB, "2026-11")).toBeNull();
    expect(await kabinetGroup(ALL, other, ids.a, ids.groupA, "2026-11")).toBeNull();
  });

  it("o'z guruhi: a'zolar, davomat, baholar va statistika", async () => {
    const d = (await kabinetGroup(ALL, db, ids.a, ids.groupA, "2026-11"))!;
    expect(d.members.map((m) => m.name)).toEqual(["Ali", "Vali"]);
    expect(d.attendance?.guests).toEqual([]);
    expect(d.grades?.scale).toBe(5);
    expect(d.stats.mastery).toBe(70);
    expect(d.stats.attendance).toBe(50);
    expect(d.stats.best?.name).toBe("Ali");
    expect(d.stats.worst?.name).toBe("Vali");
    expect(d.coins).toEqual({});
    expect(d.manualCoins).toBeNull();
  });

  it("bo'lim o'chiq bo'lsa tab ma'lumoti yo'q", async () => {
    const d = (await kabinetGroup({ features: [] }, db, ids.a, ids.groupA, "2026-11"))!;
    expect(d.attendance).toBeNull();
    expect(d.grades).toBeNull();
    expect(d.coins).toBeNull();
  });
});
