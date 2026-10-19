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
import { loadPayroll, loadTeacherPayroll } from "./payroll";

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

  it("profil ro'yxati: har to'lovdan ulush, yig'indi hisobdagi bilan bir xil", async () => {
    const r = (await loadTeacherPayroll(db, ids.teacher, "2026-10", TODAY))!;
    // Faqat shu oy to'lovlari (sentabr kirmaydi); yangisi (qaytarish) tepada
    expect(r.shares[0]!.date).toBe("2026-10-06");
    expect(r.shares.map((x) => [x.studentName, x.amount!, x.pay] as const).sort((x, y) => x[1] - y[1])).toEqual([
      ["Ali", -50_000, -20_000],
      ["Vali", 150_000, 120_000],
      ["Ali", 300_000, 120_000],
    ]);
    expect(r.shares.reduce((sum, x) => sum + x.pay, 0)).toBe(r.row.accrual.total);
    expect(r.shares.every((x) => x.kind === "payment" && x.salaryType === "percent" && x.value === 40)).toBe(true);
  });

  it("belgilangan oylik ish boshlagan sanadan: oldingi oylar 0, birinchi oy kunlarga mutanosib", async () => {
    const [b] = await db.select().from(branches);
    const [c] = await db.select().from(courses);
    // Aniq sana berilgan: 16-oktabrdan (oktabrda 16/31 kun)
    const [explicit] = await db
      .insert(teachers)
      .values({
        branchId: b!.id,
        name: "Yordamchi A",
        phone: "+998901110001",
        kind: "support",
        salaryType: "fixed",
        fixedSalary: 3_100_000,
        salaryStartDate: "2026-10-16",
      })
      .returning();
    // Sana yo'q: tizimga 10-sentabrda qo'shilgan, lekin guruhi 20-avgustda boshlangan — shu sanadan
    const [auto] = await db
      .insert(teachers)
      .values({
        branchId: b!.id,
        name: "Yordamchi B",
        phone: "+998901110002",
        salaryType: "fixed",
        fixedSalary: 3_100_000,
        createdAt: new Date("2026-09-10T08:00:00Z"),
      })
      .returning();
    // Guruhdagi belgilangan summa: aniq sana yo'q — guruh boshlangan sanadan (20-avgust)
    const [fg] = await db
      .insert(groups)
      .values({
        branchId: b!.id,
        courseId: c!.id,
        teacherId: auto!.id,
        name: "Fiks guruh",
        price: 300_000,
        days: ["tue", "thu"],
        startTime: "10:00",
        endTime: "11:30",
        startDate: "2026-08-20",
        teacherSalaryType: "fixed",
        teacherSalaryAmount: 620_000,
      })
      .returning();
    const pay = async (id: string, month: string) => {
      const p = await loadPayroll(db, null, month, TODAY);
      return p.rows.find((x) => x.id === id && x.kind === "teacher")!.accrual;
    };
    expect((await pay(explicit!.id, "2026-09")).total).toBe(0);
    expect((await pay(explicit!.id, "2026-10")).base).toBe(1_600_000);
    expect((await pay(explicit!.id, "2026-11")).base).toBe(3_100_000);
    // Avgust: 12/31 kun — o'z oyligi 1 200 000, guruh summasi 240 000
    expect(await pay(auto!.id, "2026-07")).toMatchObject({ base: 0, total: 0 });
    expect(await pay(auto!.id, "2026-08")).toMatchObject({ base: 1_200_000, total: 1_440_000 });
    expect(await pay(auto!.id, "2026-09")).toMatchObject({ base: 3_100_000, total: 3_720_000 });
    const prof = (await loadTeacherPayroll(db, auto!.id, "2026-08", TODAY))!;
    expect(prof.shares.map((x) => [x.kind, x.pay, x.proration])).toEqual([
      ["own", 1_200_000, { days: 12, total: 31 }],
      ["group", 240_000, { days: 12, total: 31 }],
    ]);
    // Boshqa testlarga tegmasin
    await db.delete(groups).where(eq(groups.id, fg!.id));
    await db.delete(teachers).where(eq(teachers.id, explicit!.id));
    await db.delete(teachers).where(eq(teachers.id, auto!.id));
  });

  it("baza himoyasi: ish boshlagan sana faqat belgilangan oylikda", async () => {
    const [b] = await db.select().from(branches);
    const [c] = await db.select().from(courses);
    await expect(
      db.insert(teachers).values({
        branchId: b!.id,
        name: "Xato",
        phone: "+998901110009",
        salaryType: "percent",
        salaryStartDate: "2026-10-01",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(groups).values({
        branchId: b!.id,
        courseId: c!.id,
        teacherId: ids.teacher,
        name: "Xato guruh",
        days: ["mon"],
        startTime: "10:00",
        endTime: "11:00",
        startDate: "2026-10-01",
        teacherSalaryType: "percent",
        teacherSalaryPercent: 10,
        teacherSalaryFrom: "2026-10-01",
      }),
    ).rejects.toThrow();
  });

  it("o'qituvchi kabineti hisobi (ADR 0062) xodimlar oyligiga tushmaydi", async () => {
    const [acc] = await db
      .insert(users)
      .values({ name: "Kabinet hisobi", email: "kabinet@payroll.local", role: "staff", kind: "teacher" })
      .returning();
    const p = await loadPayroll(db, null, "2026-10", TODAY);
    expect(p.rows.some((r) => r.kind === "user" && r.id === acc!.id)).toBe(false);
    expect(p.rows.some((r) => r.kind === "user" && r.id === ids.manager)).toBe(true);
  });

  it("boshqa mijoz ma'lumoti ko'rinmaydi", async () => {
    const p = await loadPayroll(other, null, "2026-10", TODAY);
    expect(p.rows).toEqual([]);
    expect(await other.select().from(salaryEntries)).toEqual([]);
    expect(await other.select().from(students).where(eq(students.createdBy, ids.manager))).toEqual([]);
  });
});
