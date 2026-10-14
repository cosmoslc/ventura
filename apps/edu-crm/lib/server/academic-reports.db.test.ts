import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { attendance, branches, courses, groupMemberships, groups, students, teachers } from "@ventura/db/schema/tenant";
import { REPORTS, reportPeriod } from "./reports";

/*
 * O'quv hisobotlari haqiqiy PostgreSQL'da (ADR 0031): chiqishlar sababi va a'zolik davridagi davomat, davomat
 * hisoboti bilan bir xil ko'rsatkichlardan xavf, ushlab turish bazasi. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_academic_reports_test";
const ROLE = "edu_academic_reports_app";
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
let membershipA = "";

describe.skipIf(!ADMIN_URL)("o'quv hisobotlari (haqiqiy PostgreSQL)", () => {
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
    const add = async (name: string, phone: string) =>
      (
        await db
          .insert(students)
          .values({ branchId: b!.id, name, phone, status: "active", joinedAt: "2026-09-01" })
          .returning()
      )[0]!;
    const [a, t, r, ok] = [
      await add("Ali", "+998907770001"),
      await add("Vali", "+998907770002"),
      await add("Soli", "+998907770003"),
      await add("Gani", "+998907770004"),
    ];
    const [mA] = await db
      .insert(groupMemberships)
      .values({
        groupId: g!.id,
        studentId: a.id,
        status: "left",
        enrolledAt: "2026-09-01",
        activatedAt: "2026-09-01",
        leftAt: "2026-10-09",
        leftReason: "Narxi qimmat",
        leftNote: "Boshqa markaz arzonroq",
      })
      .returning();
    membershipA = mA!.id;
    await db.insert(groupMemberships).values([
      // Sinovda chiqqan, sababsiz
      { groupId: g!.id, studentId: t.id, status: "left", enrolledAt: "2026-10-05", leftAt: "2026-10-07" },
      { groupId: g!.id, studentId: r.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: g!.id, studentId: ok.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
    ]);
    await db.insert(attendance).values([
      // Ali: a'zolik davrida 2 dan 1; chiqqandan keyingi belgi hisobga kirmaydi
      { groupId: g!.id, studentId: a.id, date: "2026-10-05", status: "present" },
      { groupId: g!.id, studentId: a.id, date: "2026-10-07", status: "absent" },
      { groupId: g!.id, studentId: a.id, date: "2026-10-12", status: "present" },
      // Soli: oxirgi 3 dars ketma-ket kelmagan, bog'lanilmagan
      { groupId: g!.id, studentId: r.id, date: "2026-10-09", status: "absent" },
      { groupId: g!.id, studentId: r.id, date: "2026-10-12", status: "absent" },
      { groupId: g!.id, studentId: r.id, date: "2026-10-14", status: "excused" },
      { groupId: g!.id, studentId: ok.id, date: "2026-10-14", status: "present" },
    ]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const load = (key: "leaves" | "risk" | "retention", d = db) =>
    REPORTS[key].load({
      db: d,
      filter: null,
      period: reportPeriod({ yil: "2026", oy: "10" }, TODAY, REPORTS[key].periodMode),
      today: TODAY,
    });

  it("guruhdan chiqish: sabab, sinov, a'zolik davridagi davomat va izoh", async () => {
    const r = await load("leaves");
    // O'rtacha muddat: (38 + 2) / 2
    expect(r.metrics.map((m) => m.value)).toEqual([2, 2, 1, 20]);
    expect(r.table.rows[0]!.cells).toMatchObject({ reason: "Narxi qimmat", count: 1, active: 1, rate: 50 });
    expect(r.table.rows[1]!.cells).toMatchObject({ reason: "Sabab ko'rsatilmagan", trial: 1 });
    const list = r.extra!.find((x) => x.title === "Chiqishlar ro'yxati")!.table.rows;
    expect(list[0]!.cells).toMatchObject({ student: "Ali", note: "Boshqa markaz arzonroq", status: "Faol" });
  });

  it("xavfli o'quvchilar: 3 dars ketma-ket va bog'lanilmagan — kritik; to'lamagan — qarzdor; chiqqanlar yo'q", async () => {
    const r = await load("risk");
    // Hech kim to'lamagan — ikkalasida ham qarz (o'quvchi hisobidan)
    expect(r.table.rows.map((x) => x.cells.student)).toEqual(["Soli", "Gani"]);
    expect(r.table.rows[0]!.cells).toMatchObject({ level: "Kritik", consecutive: 3, monthMissed: 3 });
    expect(r.table.rows[0]!.cells.factors).toContain("Bog'lanilmagan");
    expect(r.table.rows[1]!.cells).toMatchObject({ level: "O'rta", factors: "Qarzdor", score: 20 });
    expect(r.metrics.map((m) => m.value)).toEqual([2, 1, 1, 2]);
  });

  it("ushlab turish: sinovda chiqqan hisobga kirmaydi, oktyabrda bittasi ketdi", async () => {
    const r = await load("retention");
    expect(r.metrics[1]!.value).toBe(1);
    const total = r.table.rows.find((x) => x.kind === "total")!.cells;
    expect(total).toMatchObject({ base: 3, churned: 1 });
  });

  it("izoh uzunligi bazada cheklangan; boshqa mijoz hech narsa ko'rmaydi", async () => {
    await expect(
      db
        .update(groupMemberships)
        .set({ leftNote: "x".repeat(501) })
        .where(eq(groupMemberships.id, membershipA)),
    ).rejects.toThrow();
    expect((await load("leaves", other)).metrics[0]!.value).toBe(0);
    expect((await load("risk", other)).table.rows).toEqual([]);
  });
});
