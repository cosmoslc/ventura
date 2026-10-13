import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  branches,
  courses,
  groupMemberships,
  groups,
  payments,
  salaryEntries,
  studentDiscounts,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { ensurePaymentMethods } from "./finance";
import { loadPayroll } from "./payroll";

/*
 * Ish haqi haqiqiy PostgreSQL'da (ADR 0018): o'qituvchi foizi guruhga shu oy tushgan puldan (qaytarish ayiriladi,
 * o'qituvchiga ta'sir qilmaydigan chegirma koeffitsient bilan), menejer KPI o'zi qo'shgan o'quvchilardan, qoldiq
 * yozuvlardan (bekor qilingani kirmaydi), CHECK himoyasi va boshqa mijoz ma'lumoti ko'rinmasligi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_payroll_test";
const ROLE = "edu_payroll_app";
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
const ids = { teacher: "", manager: "", group: "", cash: "" };

describe.skipIf(!ADMIN_URL)("ish haqi (haqiqiy PostgreSQL)", () => {
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
      .values({
        branchId: b!.id,
        name: "Ustoz",
        phone: "+998901112233",
        salaryType: "percent",
        revenueSharePercent: 40,
      })
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
        startDate: "2026-08-01",
      })
      .returning();
    const [mgr] = await db
      .insert(users)
      .values({
        name: "Menejer",
        email: "m@payroll.local",
        role: "manager",
        salaryType: "kpi",
        monthlySalary: 3_000_000,
        kpiStudentAmount: 50_000,
        kpiContractBonus: 100_000,
      })
      .returning();
    const [cash] = await ensurePaymentMethods(db);
    Object.assign(ids, { teacher: tc!.id, manager: mgr!.id, group: g!.id, cash: cash!.id });

    // Ali — sentabrda faollashgan, sentabrni to'liq to'lagan (1 oylik bonus oktyabrda)
    // Vali — oktyabrda faollashgan (yangi o'quvchi), 50% chegirma o'qituvchiga ta'sir qilmaydi
    const [ali] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali", phone: "+998907770001", status: "active", createdBy: mgr!.id })
      .returning();
    const [vali] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Vali", phone: "+998907770002", status: "active", createdBy: mgr!.id })
      .returning();
    await db.insert(groupMemberships).values([
      { groupId: g!.id, studentId: ali!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: g!.id, studentId: vali!.id, status: "active", enrolledAt: "2026-10-01", activatedAt: "2026-10-01" },
    ]);
    await db.insert(studentDiscounts).values({
      studentId: vali!.id,
      groupId: g!.id,
      kind: "percent",
      value: 50,
      fromMonth: "2026-10",
      affectsTeacher: false,
      reason: "Aka-uka",
    });
    const pay = (studentId: string, amount: number, month: string, receiptNo: number, kind = "payment" as const) => ({
      studentId,
      groupId: g!.id,
      kind,
      amount,
      month,
      date: `${month}-05`,
      methodId: cash!.id,
      receiptNo,
    });
    await db
      .insert(payments)
      .values([
        pay(ali!.id, 300_000, "2026-09", 1),
        pay(ali!.id, 300_000, "2026-10", 2),
        pay(vali!.id, 150_000, "2026-10", 3),
      ]);
    await db.insert(payments).values({
      studentId: ali!.id,
      groupId: g!.id,
      kind: "refund",
      amount: 50_000,
      month: "2026-10",
      date: "2026-10-06",
      methodId: cash!.id,
    });

    await db.insert(salaryEntries).values([
      { teacherId: tc!.id, kind: "advance", amount: 100_000, month: "2026-10", date: "2026-10-10", methodId: cash!.id },
      { teacherId: tc!.id, kind: "bonus", amount: 20_000, month: "2026-10", date: "2026-10-10" },
      {
        teacherId: tc!.id,
        kind: "salary",
        amount: 999_000,
        month: "2026-10",
        date: "2026-10-10",
        methodId: cash!.id,
        voidedAt: new Date(),
        voidedBy: mgr!.id,
      },
      { userId: mgr!.id, kind: "salary", amount: 1_000_000, month: "2026-10", date: "2026-10-11", methodId: cash!.id },
    ]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("o'qituvchi: foiz, qaytarish, koeffitsient va qoldiq", async () => {
    const p = await loadPayroll(db, null, "2026-10", TODAY);
    const tr = p.rows.find((r) => r.kind === "teacher")!;
    // Ali: (300 000 − 50 000) × 40% = 100 000; Vali: 150 000 × (300/150) × 40% = 120 000
    expect(tr.accrual).toMatchObject({ revenue: 400_000, total: 220_000 });
    expect(tr.balance).toMatchObject({
      accrued: 220_000,
      bonus: 20_000,
      advance: 100_000,
      salary: 0,
      remaining: 140_000,
    });
    expect(p.totals).toEqual({ revenue: 400_000, share: 220_000, center: 180_000 });
  });

  it("menejer KPI: shu oy yangi o'quvchi va o'tgan oyini to'liq to'lagani", async () => {
    const p = await loadPayroll(db, null, "2026-10", TODAY);
    const mr = p.rows.find((r) => r.kind === "user")!;
    expect(mr.kind === "user" && mr.accrual).toMatchObject({
      base: 3_000_000,
      newStudents: 1,
      oneMonthStudents: 1,
      total: 3_150_000,
    });
    expect(mr.balance.remaining).toBe(2_150_000);
  });

  it("baza himoyasi: bitta shaxs, maoshda to'lov usuli majburiy, bonusda yo'q", async () => {
    await expect(
      db.insert(salaryEntries).values({ kind: "bonus", amount: 1, month: "2026-10", date: "2026-10-10" }),
    ).rejects.toThrow();
    await expect(
      db
        .insert(salaryEntries)
        .values({ teacherId: ids.teacher, kind: "salary", amount: 1, month: "2026-10", date: "2026-10-10" }),
    ).rejects.toThrow();
    await expect(
      db.insert(salaryEntries).values({
        teacherId: ids.teacher,
        kind: "penalty",
        amount: 1,
        month: "2026-10",
        date: "2026-10-10",
        methodId: ids.cash,
      }),
    ).rejects.toThrow();
  });

  it("boshqa mijoz ma'lumoti ko'rinmaydi", async () => {
    const p = await loadPayroll(other, null, "2026-10", TODAY);
    expect(p.rows).toEqual([]);
    expect(await other.select().from(salaryEntries)).toEqual([]);
    expect(await other.select().from(students).where(eq(students.createdBy, ids.manager))).toEqual([]);
  });
});
