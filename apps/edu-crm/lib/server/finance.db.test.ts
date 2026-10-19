import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  attendance,
  branches,
  courses,
  groupMemberships,
  groupPrices,
  groups,
  holidayBranches,
  holidays,
  paymentMethods,
  payments,
  settings,
  studentDiscounts,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import {
  FINANCE_SETTINGS_KEY,
  ensurePaymentMethods,
  financeSettingsSchema,
  getFinanceSettings,
  loadAccount,
  loadAccountCached,
  loadAccounts,
  loadAccountsCached,
} from "./finance";
import { closePauses, openPauses } from "./memberships";

/*
 * Moliya hisobi haqiqiy PostgreSQL'da (ADR 0015): bazadagi yozuvlardan (narx tarixi, muzlatish oraliqlari,
 * bayram, sababli davomat, chegirma, to'lov, qaytarish, bekor qilingan yozuv) qo'lda hisoblangan natija chiqishi
 * kerak. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_finance_test";
const ROLE = "edu_finance_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

const TODAY = "2026-10-12";
let db: TenantDb;
let other: TenantDb;

let seq = 0;
async function seedGroup(t: TenantDb, price = 300_000) {
  const n = ++seq;
  const [b] = await t
    .insert(branches)
    .values({ name: `Markaz ${n}` })
    .returning();
  const [c] = await t
    .insert(courses)
    .values({ name: `Ingliz tili ${n}`, price })
    .returning();
  const [tc] = await t
    .insert(teachers)
    .values({ branchId: b!.id, name: `Ustoz ${n}`, phone: `+9989011122${String(n).padStart(2, "0")}` })
    .returning();
  const [g] = await t
    .insert(groups)
    .values({
      branchId: b!.id,
      courseId: c!.id,
      teacherId: tc!.id,
      name: `IELTS ${n}`,
      price,
      days: ["mon", "wed", "fri"],
      startTime: "15:00",
      endTime: "16:30",
      startDate: "2026-01-10",
    })
    .returning();
  return { branch: b!, group: g! };
}

async function seedStudent(t: TenantDb, branchId: string, name: string) {
  const [s] = await t
    .insert(students)
    .values({ branchId, name, phone: `+9989076543${String(++seq).padStart(2, "0")}` })
    .returning();
  return s!;
}

describe.skipIf(!ADMIN_URL)("o'quvchi hisobi (haqiqiy PostgreSQL)", () => {
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

  it("uch oylik hisob: kech faollashish, bayram, sababli dars, to'lov va bekor qilingan to'lov", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Ali");
    await db.insert(groupMemberships).values({
      groupId: group.id,
      studentId: s.id,
      status: "active",
      enrolledAt: "2026-08-10",
      activatedAt: "2026-08-14",
    });
    // Bayram faqat shu filialga (boshqa testlardagi guruhlarga ta'sir qilmasin — bu ham tekshiriladi)
    const [h] = await db
      .insert(holidays)
      .values({ name: "Bayram", startDate: "2026-10-09", endDate: "2026-10-09", affectsLessons: true })
      .returning();
    await db.insert(holidayBranches).values({ holidayId: h!.id, branchId: branch.id });
    await db.insert(attendance).values({ groupId: group.id, studentId: s.id, date: "2026-10-07", status: "excused" });
    await db.insert(attendance).values({ groupId: group.id, studentId: s.id, date: "2026-10-05", status: "absent" });
    const [cashMethod] = await ensurePaymentMethods(db);
    await db.insert(payments).values([
      {
        studentId: s.id,
        groupId: group.id,
        kind: "payment",
        amount: 184_615,
        month: "2026-08",
        date: "2026-08-15",
        methodId: cashMethod!.id,
        receiptNo: 1,
      },
      {
        studentId: s.id,
        groupId: group.id,
        kind: "payment",
        amount: 300_000,
        month: "2026-09",
        date: "2026-09-05",
        methodId: cashMethod!.id,
        receiptNo: 2,
      },
    ]);
    const { charges, summary } = await loadAccount(db, s.id, TODAY);
    // Avgust 14-dan 8/13; sentabr to'liq; oktyabr: bayram (9) va sababli (7) chiqadi — 11/13, sababsiz yo'q (5) to'lanadi
    expect(charges.map((c) => [c.month, c.billable, c.excused, c.amount])).toEqual([
      ["2026-08", 8, 0, 184_615],
      ["2026-09", 13, 0, 300_000],
      ["2026-10", 12, 1, 253_846],
    ]);
    expect(summary).toMatchObject({
      charged: 738_461,
      credited: 484_615,
      balance: -253_846,
      debt: 253_846,
      oldestUnpaid: "2026-10",
    });
    expect(summary.groups[0]!.months.map((m) => m.status)).toEqual(["paid", "paid", "unpaid"]);
  });

  it("bekor qilingan yozuv hisobga kirmaydi, qaytarish va tuzatish balansga ta'sir qiladi", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Vali");
    await db.insert(groupMemberships).values({
      groupId: group.id,
      studentId: s.id,
      status: "active",
      enrolledAt: "2026-10-01",
      activatedAt: "2026-10-01",
    });
    const [m] = await ensurePaymentMethods(db);
    const [staff] = await db.insert(users).values({ name: "Kassir", email: "kassir@test.local" }).returning();
    const [voided] = await db
      .insert(payments)
      .values({
        studentId: s.id,
        groupId: group.id,
        kind: "payment",
        amount: 500_000,
        month: "2026-10",
        date: "2026-10-02",
        methodId: m!.id,
        receiptNo: 101,
      })
      .returning();
    await db.insert(payments).values({
      studentId: s.id,
      groupId: group.id,
      kind: "payment",
      amount: 500_000,
      month: "2026-10",
      date: "2026-10-03",
      methodId: m!.id,
      receiptNo: 102,
    });
    let summary = (await loadAccount(db, s.id, TODAY)).summary;
    expect(summary.credited).toBe(1_000_000);
    await db
      .update(payments)
      .set({ voidedAt: new Date(), voidedBy: staff!.id, voidReason: "xato" })
      .where(eq(payments.id, voided!.id));
    // CHECK: bekor qilgan xodimsiz bekor qilib bo'lmaydi
    await expect(
      db.update(payments).set({ voidedAt: new Date() }).where(eq(payments.receiptNo, 102)),
    ).rejects.toThrow();
    summary = (await loadAccount(db, s.id, TODAY)).summary;
    expect(summary).toMatchObject({ charged: 300_000, credited: 500_000, balance: 200_000 });

    await db.insert(payments).values([
      { studentId: s.id, kind: "refund", amount: 150_000, date: "2026-10-05", methodId: m!.id, note: "qaytarildi" },
      { studentId: s.id, kind: "correction", amount: -20_000, date: "2026-10-05", note: "eski qarz" },
      {
        studentId: s.id,
        groupId: group.id,
        kind: "discount",
        amount: 10_000,
        month: "2026-10",
        date: "2026-10-05",
        note: "aksiya",
      },
    ]);
    summary = (await loadAccount(db, s.id, TODAY)).summary;
    // 500 000 − 150 000 − 20 000 + 10 000 − 300 000
    expect(summary.balance).toBe(40_000);
    expect(summary.debt).toBe(0);
  });

  it("muzlatish tarixi saqlanadi: muzlatishdan chiqqandan keyin ham o'tgan oy qayta hisoblanmaydi", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Soli");
    const [mem] = await db
      .insert(groupMemberships)
      .values({
        groupId: group.id,
        studentId: s.id,
        status: "active",
        enrolledAt: "2026-09-01",
        activatedAt: "2026-09-01",
      })
      .returning();
    // 12-oktyabrda muzlatildi, 19-oktyabrda chiqarildi
    await db
      .update(groupMemberships)
      .set({ status: "paused", pausedAt: "2026-10-12" })
      .where(eq(groupMemberships.id, mem!.id));
    await openPauses(db, [mem!.id], "2026-10-12");
    let oct = (await loadAccount(db, s.id, "2026-10-15")).charges.find((c) => c.month === "2026-10")!;
    // 12-dan oy oxirigacha muzlatilgan: 2,5,7,9 — 4/13
    expect(oct).toMatchObject({ billable: 4, amount: 92_308 });

    await closePauses(db, [{ id: mem!.id, pausedAt: "2026-10-12" }], "2026-10-19");
    await db.update(groupMemberships).set({ status: "active", pausedAt: null }).where(eq(groupMemberships.id, mem!.id));
    oct = (await loadAccount(db, s.id, "2026-10-20")).charges.find((c) => c.month === "2026-10")!;
    // [12, 19) muzlatilgan: 12, 14, 16 chiqadi — 10/13 (eski tizim muzlatishni butunlay unutib, 13/13 qilardi)
    expect(oct).toMatchObject({ billable: 10, amount: 230_769 });
  });

  it("E3 dan oldin muzlatilgan (oraliq yozuvi yo'q) a'zo paused_at dan hisoblanadi", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Eski");
    await db.insert(groupMemberships).values({
      groupId: group.id,
      studentId: s.id,
      status: "paused",
      enrolledAt: "2026-09-01",
      activatedAt: "2026-09-01",
      pausedAt: "2026-10-12",
    });
    const oct = (await loadAccount(db, s.id, TODAY)).charges.find((c) => c.month === "2026-10")!;
    expect(oct).toMatchObject({ billable: 4, amount: 92_308 });
  });

  it("narx tarixi: yangi narx tanlangan oydan, tarix bo'lmasa guruhning joriy narxi", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Narx");
    await db.insert(groupMemberships).values({
      groupId: group.id,
      studentId: s.id,
      status: "active",
      enrolledAt: "2026-08-01",
      activatedAt: "2026-08-03",
    });
    let charges = (await loadAccount(db, s.id, TODAY)).charges;
    expect(charges.map((c) => c.basePrice)).toEqual([300_000, 300_000, 300_000]);
    await db.insert(groupPrices).values([
      { groupId: group.id, fromMonth: "0000-01", price: 300_000 },
      { groupId: group.id, fromMonth: "2026-10", price: 360_000 },
    ]);
    await db.update(groups).set({ price: 360_000 }).where(eq(groups.id, group.id));
    charges = (await loadAccount(db, s.id, TODAY)).charges;
    expect(charges.map((c) => [c.month, c.basePrice, c.amount])).toEqual([
      // Avgust 2026: 3-dan — 3,5,7,10,12,14,17,19,21,24,26,28,31 = 13/13
      ["2026-08", 300_000, 300_000],
      ["2026-09", 300_000, 300_000],
      ["2026-10", 360_000, 360_000],
    ]);
  });

  it("chegirma, dars rejimi va sozlama bazadan o'qiladi", async () => {
    const { branch, group } = await seedGroup(db);
    const s = await seedStudent(db, branch.id, "Rejim");
    await db.insert(groupMemberships).values({
      groupId: group.id,
      studentId: s.id,
      status: "active",
      enrolledAt: "2026-10-01",
      activatedAt: "2026-10-01",
    });
    await db
      .insert(studentDiscounts)
      .values({ studentId: s.id, groupId: null, kind: "percent", value: 10, fromMonth: "2026-10", reason: "aka-uka" });
    await db.insert(attendance).values([
      { groupId: group.id, studentId: s.id, date: "2026-10-02", status: "present" },
      { groupId: group.id, studentId: s.id, date: "2026-10-05", status: "late" },
      { groupId: group.id, studentId: s.id, date: "2026-10-07", status: "excused" },
      { groupId: group.id, studentId: s.id, date: "2026-10-09", status: "absent" },
    ]);
    expect((await loadAccount(db, s.id, TODAY)).charges[0]).toMatchObject({
      fullPrice: 270_000,
      excused: 1,
      amount: 249_231,
    });
    await db.insert(settings).values({
      key: FINANCE_SETTINGS_KEY,
      value: { mode: "per_lesson", excusedRefund: true, dueDay: 5, maxDiscountPercent: 30 },
    });
    expect(await getFinanceSettings(db)).toEqual({
      mode: "per_lesson",
      excusedRefund: true,
      dueDay: 5,
      maxDiscountPercent: 30,
    });
    // Dars rejimi: bor, kech, sababsiz yo'q — 3/13 × 270 000 = 62 307.69
    expect((await loadAccount(db, s.id, TODAY)).charges[0]).toMatchObject({ charged: 3, amount: 62_308 });
    await db.delete(settings).where(eq(settings.key, FINANCE_SETTINGS_KEY));
  });

  it("ko'p o'quvchi bir yo'la, boshqa mijoz ma'lumoti ko'rinmaydi", async () => {
    const { branch, group } = await seedGroup(db);
    const a = await seedStudent(db, branch.id, "A");
    const b = await seedStudent(db, branch.id, "B");
    await db.insert(groupMemberships).values([
      { groupId: group.id, studentId: a.id, status: "active", enrolledAt: "2026-10-01", activatedAt: "2026-10-01" },
      { groupId: group.id, studentId: b.id, status: "trial", enrolledAt: "2026-10-01" },
    ]);
    const map = await loadAccounts(db, [a.id, b.id], TODAY);
    expect(map.get(a.id)!.summary.debt).toBe(300_000);
    expect(map.get(b.id)!.summary).toMatchObject({ charged: 0, debt: 0 });
    // Boshqa mijoz: o'quvchi ko'rinmaydi — hisob bo'sh
    const foreign = await loadAccounts(other, [a.id], TODAY);
    expect(foreign.get(a.id)!.summary).toMatchObject({ charged: 0, credited: 0 });
    expect(await other.select().from(paymentMethods)).toEqual([]);
  });

  it("so'rov keshi va toraytirilgan so'rovlar natijani o'zgartirmaydi (ADR 0060)", async () => {
    const { branch, group } = await seedGroup(db);
    const a = await seedStudent(db, branch.id, "Kesh A");
    const b = await seedStudent(db, branch.id, "Kesh B");
    const c = await seedStudent(db, branch.id, "Kesh C");
    await db.insert(groupMemberships).values([
      { groupId: group.id, studentId: a.id, status: "active", enrolledAt: "2026-08-01", activatedAt: "2026-08-03" },
      { groupId: group.id, studentId: b.id, status: "trial", enrolledAt: "2026-10-01" },
      { groupId: group.id, studentId: c.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
    ]);
    await db.insert(groupPrices).values({ groupId: group.id, fromMonth: "2026-10", price: 330_000 });
    await db.insert(attendance).values([
      { groupId: group.id, studentId: a.id, date: "2026-10-02", status: "present" },
      { groupId: group.id, studentId: a.id, date: "2026-10-05", status: "excused" },
      { groupId: group.id, studentId: a.id, date: "2026-10-07", status: "absent" },
      { groupId: group.id, studentId: c.id, date: "2026-09-02", status: "excused" },
    ]);
    const [method] = await ensurePaymentMethods(db);
    await db.insert(payments).values({
      studentId: a.id,
      groupId: group.id,
      kind: "payment",
      amount: 250_000,
      month: "2026-08",
      date: "2026-08-04",
      methodId: method!.id,
      receiptNo: 900,
    });
    const ids = [c.id, a.id, b.id, a.id];
    const base = financeSettingsSchema.parse({});
    for (const fs of [
      base,
      { ...base, excusedRefund: false },
      { ...base, mode: "per_lesson" as const },
      { ...base, mode: "per_lesson" as const, excusedRefund: false },
    ]) {
      const plain = await loadAccounts(db, ids, TODAY, fs);
      const cached = await loadAccountsCached(db, ids, TODAY, fs);
      expect(cached).toEqual(plain);
      // Tartib ham bir xil (kirish tartibi, takrorlarsiz)
      expect([...cached.keys()]).toEqual([c.id, a.id, b.id]);
    }
    // Sozlama berilmasa bazadagisi olinadi
    expect(await loadAccountCached(db, a.id, TODAY)).toEqual(await loadAccount(db, a.id, TODAY));
    expect(await loadAccountsCached(db, [], TODAY)).toEqual(new Map());
  });
});
