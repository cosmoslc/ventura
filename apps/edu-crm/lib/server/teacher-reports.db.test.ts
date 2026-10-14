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
  leadFirstLessons,
  leads,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { listStages } from "@/app/(crm)/leads/data";
import { REPORTS, reportPeriod } from "./reports";

/*
 * O'qituvchi reytingi haqiqiy PostgreSQL'da (ADR 0033): jadvaldan darslar, davomat belgilari, ushlab turish,
 * sinovdan o'tish, birinchi darsdan o'quvchi, maosh ustuni faqat moliyaviy ruxsat bilan, boshqa mijoz ko'rmaydi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_teacher_reports_test";
const ROLE = "edu_teacher_reports_app";
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

describe.skipIf(!ADMIN_URL)("o'qituvchi reytingi (haqiqiy PostgreSQL)", () => {
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
    const add = async (name: string, n: number) =>
      (
        await db
          .insert(students)
          .values({ branchId: b!.id, name, phone: `+99890777000${n}`, status: "active", joinedAt: "2026-09-01" })
          .returning()
      )[0]!;
    const [a, bb, cc, d, e] = [
      await add("A", 1),
      await add("B", 2),
      await add("C", 3),
      await add("D", 4),
      await add("E", 5),
    ];
    await db.insert(groupMemberships).values([
      // Davr boshida bor edi: biri qoldi, biri chiqdi
      { groupId: g!.id, studentId: a.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      {
        groupId: g!.id,
        studentId: bb.id,
        status: "left",
        enrolledAt: "2026-09-01",
        activatedAt: "2026-09-01",
        leftAt: "2026-10-09",
      },
      // Davrda qo'shildi: hali sinovda, faollashtirildi, sinovda chiqdi
      { groupId: g!.id, studentId: cc.id, status: "trial", enrolledAt: "2026-10-03" },
      { groupId: g!.id, studentId: d.id, status: "active", enrolledAt: "2026-10-02", activatedAt: "2026-10-06" },
      { groupId: g!.id, studentId: e.id, status: "left", enrolledAt: "2026-10-03", leftAt: "2026-10-05" },
    ]);
    await db.insert(attendance).values([
      { groupId: g!.id, studentId: a.id, date: "2026-10-05", status: "present" },
      { groupId: g!.id, studentId: bb.id, date: "2026-10-05", status: "late" },
      { groupId: g!.id, studentId: a.id, date: "2026-10-07", status: "present" },
      { groupId: g!.id, studentId: bb.id, date: "2026-10-07", status: "absent" },
    ]);
    const stages = await listStages(db);
    const [l] = await db
      .insert(leads)
      .values({
        branchId: b!.id,
        name: "Lid",
        phone: "+998901110001",
        stageId: stages.find((s) => s.kind === "won")!.id,
        studentId: d.id,
      })
      .returning();
    await db
      .insert(leadFirstLessons)
      .values({
        leadId: l!.id,
        groupId: g!.id,
        lessonDate: "2026-10-07",
        status: "came",
        markedAt: new Date("2026-10-07T16:00:00+05:00"),
      });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const load = (finance: boolean, d = db) =>
    REPORTS.teachers.load({
      db: d,
      filter: null,
      period: reportPeriod({ yil: "2026", oy: "10" }, TODAY, "period"),
      today: TODAY,
      finance,
    });

  it("darslar, davomat, ushlab turish, sinovdan o'tish va birinchi dars", async () => {
    const r = await load(true);
    // Oktyabr 1–14: juma 2, 9; dushanba 5, 12; chorshanba 7, 14 — 6 dars × 1.5 soat
    expect(r.table.rows[0]!.cells).toMatchObject({
      name: "Ustoz",
      groups: 1,
      students: 3,
      lessons: 6,
      hours: 9,
      left: 1,
      retention: 50,
      trialConv: 50,
      firstConv: 100,
      attendance: 75,
    });
    expect(r.table.rows[0]!.cells.markedRate).toBeCloseTo(33.33, 1);
    expect(r.table.columns.some((c) => c.key === "salary")).toBe(true);
  });

  it("maosh faqat moliyaviy ruxsat bilan; boshqa mijoz ko'rmaydi", async () => {
    expect((await load(false)).table.columns.some((c) => c.key === "salary")).toBe(false);
    const o = await load(true, other);
    expect(o.metrics[0]!.value).toBe(0);
    expect(o.table.rows.filter((x) => x.kind !== "total")).toEqual([]);
  });
});
