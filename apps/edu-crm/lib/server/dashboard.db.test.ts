import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  additionalIncomes,
  attendance,
  branches,
  courses,
  expenses,
  groupMemberships,
  groups,
  payments,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { resolvePeriod } from "@/lib/dashboard";
import { loadDashboard } from "./dashboard";
import { listCategories } from "./expenses";
import { ensurePaymentMethods } from "./finance";

/*
 * Bosh panel haqiqiy PostgreSQL'da (ADR 0017): pul oqimi (to'lov + qo'shimcha daromad − xarajat − qaytarish,
 * bekor qilinganlar kirmaydi), davomat foizi, o'quvchi holatlari, guruh jadvali va boshqa mijoz ma'lumoti
 * ko'rinmasligi. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_dashboard_test";
const ROLE = "edu_dashboard_app";
const TODAY = "2026-10-13";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

describe.skipIf(!ADMIN_URL)("bosh panel (haqiqiy PostgreSQL)", () => {
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
    const [tc] = await db
      .insert(teachers)
      .values({ branchId: b!.id, name: "Ustoz", phone: "+998901112233" })
      .returning();
    const [g] = await db
      .insert(groups)
      .values({
        branchId: b!.id,
        courseId: c!.id,
        teacherId: tc!.id,
        name: "IELTS",
        price: 300_000,
        days: ["mon", "wed", "fri"],
        startTime: "15:00",
        endTime: "16:30",
        startDate: "2026-09-01",
      })
      .returning();
    const [s1] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali", phone: "+998907770001", status: "active", joinedAt: "2026-10-02" })
      .returning();
    await db
      .insert(students)
      .values({ branchId: b!.id, name: "Vali", phone: "+998907770002", status: "paused", joinedAt: "2026-09-02" });
    await db.insert(groupMemberships).values({
      groupId: g!.id,
      studentId: s1!.id,
      status: "active",
      enrolledAt: "2026-10-01",
      activatedAt: "2026-10-01",
    });
    const [cash] = await ensurePaymentMethods(db);
    const [staff] = await db.insert(users).values({ name: "Kassir", email: "k@dash.local" }).returning();
    await db.insert(payments).values([
      {
        studentId: s1!.id,
        groupId: g!.id,
        kind: "payment",
        amount: 200_000,
        month: "2026-10",
        date: "2026-10-05",
        methodId: cash!.id,
        receiptNo: 1,
      },
      {
        studentId: s1!.id,
        kind: "payment",
        amount: 999_000,
        date: "2026-10-06",
        methodId: cash!.id,
        receiptNo: 2,
        voidedAt: new Date(),
        voidedBy: staff!.id,
      },
      { studentId: s1!.id, kind: "refund", amount: 20_000, date: "2026-10-07", methodId: cash!.id },
      { studentId: s1!.id, kind: "payment", amount: 150_000, date: "2026-09-20", methodId: cash!.id, receiptNo: 3 },
    ]);
    const cats = await listCategories(db);
    await db.insert(expenses).values({
      branchId: b!.id,
      kind: "fixed",
      categoryId: cats.find((x) => x.name === "Kommunal to'lovlar")!.id,
      reason: "Svet",
      amount: 80_000,
      date: "2026-10-08",
      methodId: cash!.id,
    });
    await db.insert(additionalIncomes).values({
      branchId: b!.id,
      categoryId: cats.find((x) => x.name === "Kitoblar")!.id,
      title: "Kitob",
      amount: 50_000,
      date: "2026-10-09",
      methodId: cash!.id,
    });
    await db.insert(attendance).values([
      { groupId: g!.id, studentId: s1!.id, date: "2026-10-05", status: "present" },
      { groupId: g!.id, studentId: s1!.id, date: "2026-10-07", status: "late" },
      { groupId: g!.id, studentId: s1!.id, date: "2026-10-09", status: "absent" },
      { groupId: g!.id, studentId: s1!.id, date: "2026-10-12", status: "present" },
    ]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("oy ko'rsatkichlari: tushum, chiqim, davomat, o'quvchilar, guruh", async () => {
    const d = await loadDashboard(db, null, resolvePeriod(2026, 10, TODAY), TODAY);
    expect(d.cur).toMatchObject({
      income: 250_000,
      refund: 20_000,
      expense: 80_000,
      outflow: 100_000,
      profit: 150_000,
    });
    expect(d.cur.payCount).toBe(1);
    expect(d.prev).toMatchObject({ income: 150_000, outflow: 0 });
    expect(d.attendance.cur).toBe(75);
    expect(d.students).toMatchObject({ active: 1, paused: 1, newInPeriod: 1 });
    expect(d.groups).toHaveLength(1);
    const g = d.groups[0]!;
    expect(g).toMatchObject({ name: "IELTS", count: 1, teacherName: "Ustoz", att: 75 });
    expect(g.expected).toBeGreaterThan(0);
    expect(d.expected).toBe(g.expected);
    expect(d.months.at(-1)).toMatchObject({ month: "2026-10", income: 250_000, outflow: 100_000 });
    expect(d.days.at(-1)!.date).toBe(TODAY);
    expect(d.events.map((e) => e.amount)).not.toContain(999_000);
    expect(d.years).toEqual([2026]);
  });

  it("barcha davr va boshqa mijoz", async () => {
    const all = await loadDashboard(db, null, resolvePeriod(null, null, TODAY), TODAY);
    expect(all.cur.income).toBe(400_000);
    expect(all.prev).toBeNull();
    const foreign = await loadDashboard(other, null, resolvePeriod(2026, 10, TODAY), TODAY);
    expect(foreign.cur.income).toBe(0);
    expect(foreign.groups).toEqual([]);
    expect(foreign.events).toEqual([]);
  });
});
