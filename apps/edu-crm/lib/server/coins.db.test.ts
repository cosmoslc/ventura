import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  branches,
  coinEntries,
  courses,
  groups,
  paymentMethods,
  payments,
  settings,
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { COINS_KEY, type CoinSettings, DEFAULT_COINS } from "@/lib/coins";
import {
  type CoinRuntime,
  awardAttendanceMany,
  coinBalance,
  coinHistory,
  coinLeaders,
  coinRuntime,
  syncAttendanceCoin,
  syncPrepayCoin,
} from "./coins";

/*
 * Coin daftari haqiqiy PostgreSQL'da (ADR 0061): berish/olish idempotent, qoida o'chiq bo'lsa berilmaydi lekin
 * olinadi, oldindan to'lov sharti, balans va reyting, mijozlar ajratilgani (RLS).
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_coins_test";
const ROLE = "edu_coins_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

const ON: CoinSettings = {
  prepay: { enabled: true, amount: 10 },
  attendance: { enabled: true, amount: 2 },
  homework: { enabled: true, amount: 1 },
};
const rt = (s: CoinSettings = ON, active = true): CoinRuntime => ({ active, settings: s });

let seq = 0;
let receipt = 0;
async function seed(t: TenantDb, price = 300_000) {
  const n = ++seq;
  const [b] = await t
    .insert(branches)
    .values({ name: `Markaz ${n}` })
    .returning();
  const [c] = await t
    .insert(courses)
    .values({ name: `Kurs ${n}`, price })
    .returning();
  const [tc] = await t
    .insert(teachers)
    .values({ branchId: b!.id, name: `Ustoz ${n}`, phone: `+9989011133${String(n).padStart(2, "0")}` })
    .returning();
  const [g] = await t
    .insert(groups)
    .values({
      branchId: b!.id,
      courseId: c!.id,
      teacherId: tc!.id,
      name: `Guruh ${n}`,
      price,
      days: ["mon", "wed", "fri"],
      startTime: "15:00",
      endTime: "16:30",
      startDate: "2026-01-10",
    })
    .returning();
  const student = async (name: string) => {
    const [s] = await t
      .insert(students)
      .values({ branchId: b!.id, name, phone: `+9989076544${String(++seq).padStart(2, "0")}` })
      .returning();
    return s!;
  };
  return { branch: b!, group: g!, student };
}

describe.skipIf(!ADMIN_URL)("coinlar (haqiqiy PostgreSQL)", () => {
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

  it("davomat: berish bir marta, olish, qayta berish; qoida o'chiq — berilmaydi, lekin olinadi", async () => {
    const { group, student } = await seed(db);
    const s = await student("Ali");
    const mark = (status: string | null, r = rt()) =>
      syncAttendanceCoin(db, r, { studentId: s.id, groupId: group.id, date: "2026-11-02", status });

    expect(await mark("present")).toEqual({ rule: "attendance", action: "award", amount: 2 });
    expect(await mark("present")).toBeNull();
    expect(await mark("late")).toBeNull();
    expect(await coinBalance(db, s.id)).toBe(2);

    expect(await mark("absent")).toEqual({ rule: "attendance", action: "revoke", amount: 2 });
    expect(await mark(null)).toBeNull();
    expect(await coinBalance(db, s.id)).toBe(0);

    // Qayta berilganda — joriy miqdor, qator bitta qoladi
    expect(await mark("present", rt({ ...ON, attendance: { enabled: true, amount: 5 } }))).toEqual({
      rule: "attendance",
      action: "award",
      amount: 5,
    });
    const rows = await db.select().from(coinEntries).where(eq(coinEntries.studentId, s.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.revokedAt).toBeNull();

    // Qoida o'chiq yoki bo'lim o'chiq: olish ishlaydi, berish — yo'q
    expect(await mark("absent", rt(DEFAULT_COINS))).toEqual({ rule: "attendance", action: "revoke", amount: 5 });
    expect(await mark("present", rt(DEFAULT_COINS))).toBeNull();
    expect(await mark("present", rt(ON, false))).toBeNull();
    expect(await coinBalance(db, s.id)).toBe(0);
  });

  it("'Hammasi bor': faqat yangilariga, takrorda — 0", async () => {
    const { group, student } = await seed(db);
    const a = await student("A");
    const b = await student("B");
    await syncAttendanceCoin(db, rt(), { studentId: a.id, groupId: group.id, date: "2026-11-04", status: "present" });
    expect(await awardAttendanceMany(db, rt(), group.id, "2026-11-04", [a.id, b.id])).toEqual({ count: 1, amount: 2 });
    expect(await awardAttendanceMany(db, rt(), group.id, "2026-11-04", [a.id, b.id])).toEqual({ count: 0, amount: 0 });
    expect(await awardAttendanceMany(db, rt(DEFAULT_COINS), group.id, "2026-11-06", [a.id])).toEqual({
      count: 0,
      amount: 0,
    });
    expect(await coinBalance(db, b.id)).toBe(2);
  });

  it("oldindan to'lov: oy boshidan oldin to'liq — beriladi, bekor qilinsa olinadi, tiklansa qaytadi", async () => {
    const { group, student } = await seed(db, 300_000);
    const s = await student("Vali");
    const target = { studentId: s.id, groupId: group.id, month: "2026-11" };
    const [method] = await db.insert(paymentMethods).values({ name: "Naqd" }).returning();
    const [staff] = await db.insert(users).values({ name: "Kassir", email: "kassir@coins.test" }).returning();
    const pay = async (amount: number, date: string) => {
      const [p] = await db
        .insert(payments)
        .values({
          studentId: s.id,
          groupId: group.id,
          month: "2026-11",
          kind: "payment",
          amount,
          date,
          methodId: method!.id,
          receiptNo: ++receipt,
        })
        .returning();
      return p!;
    };

    await pay(200_000, "2026-10-20");
    expect(await syncPrepayCoin(db, rt(), target)).toBeNull();
    // Oy ichidagi to'lov shartni bajarmaydi
    await pay(100_000, "2026-11-02");
    expect(await syncPrepayCoin(db, rt(), target)).toBeNull();
    const last = await pay(100_000, "2026-10-28");
    expect(await syncPrepayCoin(db, rt(), target)).toEqual({ rule: "prepay", action: "award", amount: 10 });
    expect(await syncPrepayCoin(db, rt(), target)).toBeNull();

    // Bekor qilish — qoida o'chiq bo'lsa ham coin olinadi
    await db
      .update(payments)
      .set({ voidedAt: new Date(), voidedBy: staff!.id, voidReason: "xato" })
      .where(eq(payments.id, last.id));
    expect(await syncPrepayCoin(db, rt(DEFAULT_COINS), target)).toEqual({
      rule: "prepay",
      action: "revoke",
      amount: 10,
    });
    expect(await syncPrepayCoin(db, rt(DEFAULT_COINS), target)).toBeNull();

    await db.update(payments).set({ voidedAt: null, voidedBy: null, voidReason: null }).where(eq(payments.id, last.id));
    expect(await syncPrepayCoin(db, rt(), target)).toEqual({ rule: "prepay", action: "award", amount: 10 });
    expect(await coinBalance(db, s.id)).toBe(10);
  });

  it("balans, reyting (filial va oy bo'yicha) va tarix", async () => {
    const { branch, group, student } = await seed(db);
    const a = await student("Aziza");
    const b = await student("Bobur");
    for (const date of ["2026-10-30", "2026-11-02", "2026-11-04"])
      await syncAttendanceCoin(db, rt(), { studentId: a.id, groupId: group.id, date, status: "present" });
    await syncAttendanceCoin(db, rt(), { studentId: b.id, groupId: group.id, date: "2026-11-02", status: "present" });
    await syncAttendanceCoin(db, rt(), { studentId: b.id, groupId: group.id, date: "2026-11-02", status: "absent" });

    const leaders = await coinLeaders(db, { branchIds: [branch.id], month: "2026-11" });
    expect(leaders.map((l) => [l.name, l.balance, l.month])).toEqual([["Aziza", 6, 4]]);
    expect(await coinLeaders(db, { branchIds: [], month: "2026-11" })).toEqual([]);

    const history = await coinHistory(db, b.id);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ rule: "attendance", revoked: true, groupName: group.name });
  });

  it("sozlama bazadan o'qiladi; boshqa mijoz yozuvlari ko'rinmaydi", async () => {
    await db.insert(settings).values({ key: COINS_KEY, value: ON });
    expect((await coinRuntime({ features: ["coins"] }, db)).settings).toEqual(ON);
    expect(await coinRuntime({ features: [] }, other)).toEqual({ active: false, settings: DEFAULT_COINS });
    expect(await other.select().from(coinEntries)).toEqual([]);
    expect((await db.select().from(coinEntries)).length).toBeGreaterThan(0);
  });
});
