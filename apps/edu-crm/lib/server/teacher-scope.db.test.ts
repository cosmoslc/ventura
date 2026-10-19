import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, courses, groupMemberships, groups, students, teachers, users } from "@ventura/db/schema/tenant";
import { canSeeStudent, teacherGroupIds, teacherHasStudent } from "./teacher-scope";

/*
 * "Faqat o'z guruhlari" haqiqiy PostgreSQL'da (ADR 0062): o'qituvchi faqat o'zi o'qituvchi bo'lgan (arxivlanmagan)
 * guruhlarni va ulardagi o'quvchilarni ko'radi; o'qituvchi hisobi bog'lanishi noyob.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_teacher_scope_test";
const ROLE = "edu_teacher_scope_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
const ids = { a: "", b: "", groupA: "", groupB: "", archived: "", sA: "", sB: "", sOld: "" };

describe.skipIf(!ADMIN_URL)("o'qituvchi ko'rinishi (haqiqiy PostgreSQL)", () => {
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
        { branchId: b!.id, name: "Aziza", phone: "+998901110001" },
        { branchId: b!.id, name: "Bobur", phone: "+998901110002" },
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
    const [gA, gB, gOld] = await db
      .insert(groups)
      .values([group(ta!.id, "A guruh"), group(tb!.id, "B guruh"), group(ta!.id, "Eski guruh")])
      .returning();
    await db.update(groups).set({ archivedAt: new Date() }).where(eqId(gOld!.id));
    const [sA, sB, sOld] = await db
      .insert(students)
      .values([
        { branchId: b!.id, name: "Ali", phone: "+998907770001" },
        { branchId: b!.id, name: "Vali", phone: "+998907770002" },
        { branchId: b!.id, name: "Sami", phone: "+998907770003" },
      ])
      .returning();
    await db.insert(groupMemberships).values([
      { groupId: gA!.id, studentId: sA!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: gB!.id, studentId: sB!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: gOld!.id, studentId: sOld!.id, status: "active", enrolledAt: "2026-02-01", activatedAt: "2026-02-01" },
    ]);
    Object.assign(ids, {
      a: ta!.id,
      b: tb!.id,
      groupA: gA!.id,
      groupB: gB!.id,
      archived: gOld!.id,
      sA: sA!.id,
      sB: sB!.id,
      sOld: sOld!.id,
    });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("guruhlar: faqat o'ziniki va arxivlanmagan", async () => {
    expect(await teacherGroupIds(db, ids.a)).toEqual([ids.groupA]);
    expect(await teacherGroupIds(db, ids.b)).toEqual([ids.groupB]);
    expect(await teacherGroupIds(other, ids.a)).toEqual([]);
  });

  it("o'quvchilar: o'z guruhidagisi ko'rinadi, boshqasi va arxiv guruhdagisi — yo'q", async () => {
    expect(await teacherHasStudent(db, ids.a, ids.sA)).toBe(true);
    expect(await teacherHasStudent(db, ids.a, ids.sB)).toBe(false);
    expect(await teacherHasStudent(db, ids.a, ids.sOld)).toBe(false);
    const teacher = { kind: "teacher" as const, teacherId: ids.a };
    expect(await canSeeStudent(db, teacher, ids.sB)).toBe(false);
    expect(await canSeeStudent(db, { kind: "staff", teacherId: null }, ids.sB)).toBe(true);
    expect(await canSeeStudent(db, { kind: "teacher", teacherId: null }, ids.sA)).toBe(false);
  });

  it("kirish hisobi: users.kind standart 'staff', bitta hisob bitta o'qituvchiga", async () => {
    const [u] = await db.insert(users).values({ name: "Aziza", email: "a@scope.local", kind: "teacher" }).returning();
    const [plain] = await db.insert(users).values({ name: "Admin", email: "admin@scope.local" }).returning();
    expect(plain!.kind).toBe("staff");
    await db.update(teachers).set({ userId: u!.id }).where(eqId(ids.a, teachers));
    await expect(db.update(teachers).set({ userId: u!.id }).where(eqId(ids.b, teachers))).rejects.toThrow();
  });

  it("boshqa markaz: o'qituvchi, hisob va guruhlar ko'rinmaydi, boshqa markaz hisobiga bog'lab bo'lmaydi", async () => {
    // beta markazi alfa'ning o'qituvchilari, hisoblari, guruhlari va a'zoliklarini ko'rmaydi (RLS)
    expect(await other.select().from(teachers)).toEqual([]);
    expect(await other.select().from(users)).toEqual([]);
    expect(await other.select().from(groups)).toEqual([]);
    expect(await teacherHasStudent(other, ids.a, ids.sA)).toBe(false);
    // beta'dagi o'qituvchini alfa hisobiga bog'lash: FK (tenant_id, user_id) bo'yicha — rad etiladi
    const [alfaUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, "a@scope.local"));
    const [bb] = await other.insert(branches).values({ name: "Beta markaz" }).returning();
    const [betaTeacher] = await other
      .insert(teachers)
      .values({ branchId: bb!.id, name: "Beta ustoz", phone: "+998901110009" })
      .returning();
    await expect(
      other.update(teachers).set({ userId: alfaUser!.id }).where(eqId(betaTeacher!.id, teachers)),
    ).rejects.toThrow();
    // alfa ham beta'ning o'qituvchisini o'zgartira olmaydi (qator ko'rinmaydi — 0 ta yangilanadi)
    const changed = await db
      .update(teachers)
      .set({ name: "Buzildi" })
      .where(eqId(betaTeacher!.id, teachers))
      .returning();
    expect(changed).toEqual([]);
  });
});

function eqId(id: string, table: typeof groups | typeof teachers = groups) {
  return eq(table.id, id);
}
