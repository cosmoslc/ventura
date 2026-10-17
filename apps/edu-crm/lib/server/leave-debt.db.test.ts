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
  students,
  teachers,
  users,
} from "@ventura/db/schema/tenant";
import { groupDebt } from "@/lib/ledger";
import { ensurePaymentMethods, loadAccount } from "./finance";
import { applyLeave, projectedGroupDebt, settlePendingLeaves } from "./leave-debt";
import { syncMembershipsWithStatus } from "./memberships";

/*
 * Qarzi bor o'quvchini guruhdan chiqarish (ADR 0050) haqiqiy PostgreSQL'da: qarzdan kechish, qarz bilan
 * (to'languncha muzlatish) va qarz yopilganda avtomatik chiqish. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_leave_debt_test";
const ROLE = "edu_leave_debt_app";
const TODAY = "2026-10-12";
const LEAVE = "2026-10-12";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let staffId = "";
let methodId = "";
let receipt = 0;
let seq = 0;

/** 300 000 so'mlik guruh (du, chor, ju), o'quvchi sentabrdan faol, hech narsa to'lamagan */
async function seed() {
  const n = ++seq;
  const [b] = await db
    .insert(branches)
    .values({ name: `Markaz ${n}` })
    .returning();
  const [c] = await db
    .insert(courses)
    .values({ name: `Kurs ${n}`, price: 300_000 })
    .returning();
  const [t] = await db
    .insert(teachers)
    .values({ branchId: b!.id, name: `Ustoz ${n}`, phone: `+9989011133${String(n).padStart(2, "0")}` })
    .returning();
  const [g] = await db
    .insert(groups)
    .values({
      branchId: b!.id,
      courseId: c!.id,
      teacherId: t!.id,
      name: `Guruh ${n}`,
      price: 300_000,
      days: ["mon", "wed", "fri"],
      startTime: "15:00",
      endTime: "16:30",
      startDate: "2026-01-10",
    })
    .returning();
  const [s] = await db
    .insert(students)
    .values({ branchId: b!.id, name: `O'quvchi ${n}`, phone: `+9989076544${String(n).padStart(2, "0")}` })
    .returning();
  const [m] = await db
    .insert(groupMemberships)
    .values({ groupId: g!.id, studentId: s!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" })
    .returning();
  return { group: g!, student: s!, membership: m! };
}

async function pay(studentId: string, groupId: string, amount: number) {
  await db.insert(payments).values({
    studentId,
    groupId,
    kind: "payment",
    amount,
    month: "2026-10",
    date: TODAY,
    methodId,
    receiptNo: ++receipt,
  });
}

const membership = async (id: string) =>
  (await db.select().from(groupMemberships).where(eq(groupMemberships.id, id)))[0]!;

describe.skipIf(!ADMIN_URL)("qarzi bor o'quvchini guruhdan chiqarish (haqiqiy PostgreSQL)", () => {
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
    const [u] = await db.insert(users).values({ name: "Admin", email: "admin@test.local" }).returning();
    staffId = u!.id;
    methodId = (await ensurePaymentMethods(db))[0]!.id;
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("qarz bo'lsa va variant tanlanmasa — chiqarilmaydi", async () => {
    const { membership: m } = await seed();
    const out = await db.transaction((tx) =>
      applyLeave(tx, m, { date: LEAVE, reason: "Ko'chdi", note: "", mode: "auto" }, TODAY, staffId),
    );
    expect(out.kind).toBe("debt");
    expect(await membership(m.id)).toMatchObject({ status: "active", leftAt: null, leavePendingAt: null });
  });

  it("qarz bo'lmasa — oddiy chiqarish", async () => {
    const { group, student, membership: m } = await seed();
    const debt = await db.transaction((tx) => projectedGroupDebt(tx, m, LEAVE, TODAY));
    await pay(student.id, group.id, debt);
    const out = await db.transaction((tx) =>
      applyLeave(tx, m, { date: LEAVE, reason: "Ko'chdi", note: "", mode: "auto" }, TODAY, staffId),
    );
    expect(out).toEqual({ kind: "left" });
    expect(await membership(m.id)).toMatchObject({ status: "left", leftAt: LEAVE });
  });

  it("qarzdan kechib: qarz `writeoff` bilan yopiladi, kassaga tushmaydi, darhol chiqadi", async () => {
    const { group, student, membership: m } = await seed();
    await pay(student.id, group.id, 100_000);
    const debt = await db.transaction((tx) => projectedGroupDebt(tx, m, LEAVE, TODAY));
    expect(debt).toBeGreaterThan(0);
    const out = await db.transaction((tx) =>
      applyLeave(tx, m, { date: LEAVE, reason: "Ko'chdi", note: "", mode: "forgive" }, TODAY, staffId),
    );
    expect(out).toMatchObject({ kind: "forgiven", debt });
    expect(await membership(m.id)).toMatchObject({ status: "left", leftAt: LEAVE, leftReason: "Ko'chdi" });
    const entries = await db.select().from(payments).where(eq(payments.studentId, student.id));
    expect(entries.filter((e) => e.kind === "writeoff").map((e) => [e.amount, e.groupId, e.methodId])).toEqual([
      [debt, group.id, null],
    ]);
    const { summary } = await loadAccount(db, student.id, TODAY);
    expect(summary.balance).toBe(0);
  });

  it("qarz bilan: muzlatiladi, qarz to'liq yopilgandagina shu sana bilan chiqadi", async () => {
    const { group, student, membership: m } = await seed();
    const debt = await db.transaction((tx) => projectedGroupDebt(tx, m, LEAVE, TODAY));
    const out = await db.transaction((tx) =>
      applyLeave(tx, m, { date: LEAVE, reason: "Ko'chdi", note: "Telefon qildi", mode: "pending" }, TODAY, staffId),
    );
    expect(out).toEqual({ kind: "pending", debt });
    expect(await membership(m.id)).toMatchObject({
      status: "paused",
      pausedAt: LEAVE,
      leavePendingAt: LEAVE,
      leftAt: null,
      leftReason: "Ko'chdi",
      leftNote: "Telefon qildi",
    });
    // Muzlatilgan holatdagi qarz chiqarishdagi qarz bilan bir xil (yangi hisob yozilmaydi)
    expect(groupDebt((await loadAccount(db, student.id, TODAY)).summary, group.id)).toBe(debt);

    // Qisman to'lov — hali chiqmaydi
    await pay(student.id, group.id, debt - 1);
    expect(await db.transaction((tx) => settlePendingLeaves(tx, student.id, TODAY))).toEqual([]);
    expect((await membership(m.id)).status).toBe("paused");

    // O'quvchi holati "faol"ga qaytsa ham kutayotgan a'zolik muzlatilganicha qoladi
    await db.transaction((tx) => syncMembershipsWithStatus(tx, student.id, "paused", "active", null));
    expect(await membership(m.id)).toMatchObject({ status: "paused", leavePendingAt: LEAVE });

    // Qolgan 1 so'm — chiqadi, sana o'sha
    await pay(student.id, group.id, 1);
    const done = await db.transaction((tx) => settlePendingLeaves(tx, student.id, TODAY));
    expect(done).toEqual([{ membershipId: m.id, groupId: group.id, leftAt: LEAVE }]);
    expect(await membership(m.id)).toMatchObject({ status: "left", leftAt: LEAVE, leavePendingAt: null });
    expect((await loadAccount(db, student.id, TODAY)).summary.balance).toBe(0);
  });

  it("kutayotgan a'zolikni keyin qarzdan kechib yopish", async () => {
    const { student, membership: m } = await seed();
    await db.transaction((tx) =>
      applyLeave(tx, m, { date: LEAVE, reason: "Ko'chdi", note: "", mode: "pending" }, TODAY, staffId),
    );
    const waiting = await membership(m.id);
    const out = await db.transaction((tx) =>
      applyLeave(tx, waiting, { date: LEAVE, reason: "Ko'chdi", note: "", mode: "forgive" }, TODAY, staffId),
    );
    expect(out.kind).toBe("forgiven");
    expect(await membership(m.id)).toMatchObject({ status: "left", leftAt: LEAVE, leavePendingAt: null });
    expect((await loadAccount(db, student.id, TODAY)).summary.balance).toBe(0);
  });

  it("baza cheklovi: kutish belgisi faqat muzlatilgan, yopilmagan a'zolikda", async () => {
    const { membership: m } = await seed();
    await expect(
      db.update(groupMemberships).set({ leavePendingAt: LEAVE }).where(eq(groupMemberships.id, m.id)),
    ).rejects.toThrow();
  });
});
