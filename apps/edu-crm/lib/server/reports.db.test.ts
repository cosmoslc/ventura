import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  additionalIncomes,
  branches,
  courses,
  expensePlans,
  expenses,
  financePlans,
  groupMemberships,
  groups,
  payments,
  studentDiscounts,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { resolvePeriod } from "@/lib/dashboard";
import { chargeDiscount } from "@/lib/reports";
import { loadDashboard } from "./dashboard";
import { listCategories } from "./expenses";
import { ensurePaymentMethods, loadAccounts } from "./finance";
import { REPORTS, reportPeriod } from "./reports";

/*
 * Hisobotlar haqiqiy PostgreSQL'da (ADR 0030) — EDU-CRM-PLAN E5 qabul sharti: hisobot raqami tegishli sahifadagi
 * yig'indi bilan bir xil. Pul oqimi — bosh panel bilan, kurs daromadi va chegirma — o'quvchi hisobi bilan, xarajat —
 * xarajatlar va rejalar bilan. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_reports_test";
const ROLE = "edu_reports_app";
const TODAY = "2026-10-14";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
let studentId = "";
let branchId = "";

describe.skipIf(!ADMIN_URL)("hisobotlar (haqiqiy PostgreSQL)", () => {
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
    db = createTenantDb(appUrl(), "alfa", { max: 3 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });

    const [b] = await db.insert(branches).values({ name: "Markaz" }).returning();
    branchId = b!.id;
    const [staff] = await db.insert(users).values({ name: "Kassir", email: "k@rep.local" }).returning();
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
    const [s] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali", phone: "+998907770001", status: "active", joinedAt: "2026-10-01" })
      .returning();
    studentId = s!.id;
    await db.insert(groupMemberships).values({
      groupId: g!.id,
      studentId: s!.id,
      status: "active",
      enrolledAt: "2026-10-01",
      activatedAt: "2026-10-01",
    });
    await db
      .insert(studentDiscounts)
      .values({ studentId: s!.id, groupId: null, kind: "percent", value: 20, fromMonth: "2026-10", reason: "aka-uka" });
    const [cash] = await ensurePaymentMethods(db);
    await db.insert(payments).values([
      {
        studentId: s!.id,
        groupId: g!.id,
        kind: "payment",
        amount: 200_000,
        month: "2026-10",
        date: "2026-10-05",
        methodId: cash!.id,
        receiptNo: 1,
      },
      // Bir martalik chegirma
      { studentId: s!.id, groupId: g!.id, kind: "discount", amount: 10_000, month: "2026-10", date: "2026-10-05" },
    ]);
    const cats = await listCategories(db);
    const rent = cats.find((x) => x.kind === "expense")!;
    await db.insert(expenses).values({
      branchId: b!.id,
      kind: "fixed",
      categoryId: rent.id,
      reason: "Ijara",
      amount: 80_000,
      date: "2026-10-03",
      methodId: cash!.id,
      userId: staff!.id,
      createdBy: staff!.id,
    });
    await db.insert(expensePlans).values({ branchId: b!.id, categoryId: rent.id, month: "2026-10", amount: 100_000 });
    await db.insert(additionalIncomes).values({
      branchId: b!.id,
      categoryId: cats.find((x) => x.kind === "income")!.id,
      title: "Kitob",
      amount: 50_000,
      date: "2026-10-09",
      methodId: cash!.id,
    });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const month = reportPeriod({ yil: "2026", oy: "10" }, TODAY, "period");
  const load = (key: keyof typeof REPORTS, d = db) =>
    REPORTS[key].load({
      db: d,
      filter: null,
      period: REPORTS[key].periodMode === "year" ? reportPeriod({ yil: "2026" }, TODAY, "year") : month,
      today: TODAY,
    });

  it("pul oqimi — bosh paneldagi bilan bir xil", async () => {
    const dash = await loadDashboard(db, null, resolvePeriod(2026, 10, TODAY), TODAY);
    const cf = await load("cashflow");
    const cell = (label: string) => cf.table.rows.find((r) => r.cells.label === label)!.cells["2026-10"];
    expect(cell("Jami kirim")).toBe(dash.cur.income);
    expect(cell("Jami chiqim")).toBe(dash.cur.outflow);
    expect(cell("Jami kirim")).toBe(250_000);
    expect(cf.table.rows.find((r) => r.cells.label === "Jami kirim")!.cells["2026-11"]).toBeNull();
  });

  it("xarajatlar — reja va fakt", async () => {
    const r = await load("expenses");
    expect(r.metrics.map((m) => m.value)).toEqual([80_000, 100_000, 80, (80_000 / 250_000) * 100]);
  });

  it("chegirma va kurs daromadi — o'quvchi hisobi bilan bir xil", async () => {
    const acc = (await loadAccounts(db, [studentId], TODAY)).get(studentId)!;
    const oct = acc.charges.filter((c) => c.month === "2026-10");
    const permanent = oct.reduce((s, c) => s + chargeDiscount(c), 0);
    expect(permanent).toBeGreaterThan(0);

    const d = await load("discounts");
    expect(d.metrics[0]!.value).toBe(permanent + 10_000);
    expect(d.metrics[1]!.value).toBe(1);
    expect(d.table.rows[0]!.cells).toMatchObject({ student: "Ali", permanent, once: 10_000 });

    const k = await load("courses");
    expect(k.metrics[0]!.value).toBe(oct.reduce((s, c) => s + c.amount, 0));
    expect(k.metrics[1]!.value).toBe(200_000);
    expect(k.table.rows[0]!.cells).toMatchObject({ course: "Ingliz tili", groups: 1, students: 1 });
  });

  it("reja, fakt va prognoz — kirim rejasi, xarajat rejasi va o'quvchi hisobidan kutilgan to'lov", async () => {
    await db.insert(financePlans).values([
      { branchId, month: "2026-10", line: "payments", amount: 300_000 },
      { branchId, month: "2026-10", line: "salary", amount: 40_000 },
      { branchId, month: "2026-11", line: "income", amount: 70_000 },
    ]);
    const acc = (await loadAccounts(db, [studentId], TODAY)).get(studentId)!;
    const expected = acc.charges.filter((c) => c.month === "2026-10").reduce((s, c) => s + c.amount, 0);
    const r = await load("plan");
    const cells = (label: string) => r.table.rows.find((x) => x.cells.label === label)!.cells;
    expect(cells("O'quvchi to'lovlari")).toMatchObject({
      plan: 300_000,
      fact: 200_000,
      forecast: Math.max(200_000, expected),
    });
    expect(cells("Qo'shimcha daromad")).toMatchObject({ plan: null, fact: 50_000 });
    expect(cells("Xarajatlar")).toMatchObject({ plan: 100_000, fact: 80_000, forecast: 100_000 });
    expect(cells("Ish haqi va avans")).toMatchObject({ plan: 40_000, fact: 0, forecast: 40_000 });
    // Fakt — pul oqimi hisoboti bilan bir xil
    expect(cells("Jami kirim").fact).toBe(250_000);

    // Butun yil: noyabr rejasi va kelgusi oylar prognozi qo'shiladi
    const year = await REPORTS.plan.load({
      db,
      filter: null,
      period: reportPeriod({ yil: "2026", oy: "all" }, TODAY, "month"),
      today: TODAY,
    });
    const extra = year.table.rows.find((x) => x.cells.label === "Qo'shimcha daromad")!.cells;
    expect(extra.plan).toBe(70_000);
    expect(extra.fact).toBe(50_000);

    // Bazadagi himoya: summa musbat, qator ro'yxatdan, bitta katak — bitta qator
    await expect(
      db.insert(financePlans).values({ branchId, month: "2026-12", line: "payments", amount: 0 }),
    ).rejects.toThrow();
    await expect(
      db.insert(financePlans).values({ branchId, month: "2026-12", line: "rent" as "payments", amount: 1 }),
    ).rejects.toThrow();
    await expect(
      db.insert(financePlans).values({ branchId, month: "2026-10", line: "payments", amount: 1 }),
    ).rejects.toThrow();
    expect(await other.select().from(financePlans)).toEqual([]);
  });

  it("boshqa mijoz hech narsa ko'rmaydi", async () => {
    expect((await load("discounts", other)).metrics[0]!.value).toBe(0);
    expect((await load("courses", other)).metrics[0]!.value).toBe(0);
    expect((await load("expenses", other)).metrics[0]!.value).toBe(0);
  });
});
