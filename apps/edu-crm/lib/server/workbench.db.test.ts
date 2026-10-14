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
  payments,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { listStages } from "@/app/(crm)/leads/data";
import { resolvePeriod } from "@/lib/dashboard";
import { ensurePaymentMethods } from "./finance";
import { loadLeadDashboard } from "./lead-stats";
import { loadWorkbench } from "./workbench";

/*
 * "Bugungi ishlar" va bosh paneldagi lid kartalari haqiqiy PostgreSQL'da (ADR 0027): yangi lidlar Toshkent kuni
 * bo'yicha, konversiya va birinchi to'lov (bekor qilingan to'lov kirmaydi), yo'qotilgan bosqich, filial bo'yicha;
 * bog'lanish kerak, bugungi birinchi dars, mas'ulsiz lidlar, bugun kelmaganlar va darslar soni, qarzdorlar,
 * tugayotgan guruh; boshqa mijoz ko'rmaydi. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_workbench_test";
const ROLE = "edu_workbench_app";
// Chorshanba
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
const ids = { a: "", b: "", group: "", lost: "" };
const ALL_BLOCKS = new Set(["leads", "absent", "debtors", "groups"] as const);

describe.skipIf(!ADMIN_URL)("bugungi ishlar va lid kartalari (haqiqiy PostgreSQL)", () => {
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

    const [a] = await db.insert(branches).values({ name: "A" }).returning();
    const [b] = await db.insert(branches).values({ name: "B" }).returning();
    const [c] = await db.insert(courses).values({ name: "Ingliz", price: 300_000, durationMonths: 2 }).returning();
    const [tc] = await db
      .insert(teachers)
      .values({ branchId: a!.id, name: "Ustoz", phone: "+998901112233" })
      .returning();
    const [g] = await db
      .insert(groups)
      .values({
        branchId: a!.id,
        courseId: c!.id,
        teacherId: tc!.id,
        name: "IELTS",
        price: 300_000,
        days: ["mon", "wed", "fri"],
        startTime: "15:00",
        endTime: "16:30",
        startDate: "2026-09-01",
        durationMonths: 2,
      })
      .returning();
    const [s1] = await db
      .insert(students)
      .values({ branchId: a!.id, name: "Ali", phone: "+998907770001", status: "active", joinedAt: "2026-09-01" })
      .returning();
    const [s2] = await db
      .insert(students)
      .values({ branchId: a!.id, name: "Vali", phone: "+998907770002", status: "active", joinedAt: "2026-10-01" })
      .returning();
    await db.insert(groupMemberships).values([
      { groupId: g!.id, studentId: s1!.id, status: "active", enrolledAt: "2026-09-01", activatedAt: "2026-09-01" },
      { groupId: g!.id, studentId: s2!.id, status: "active", enrolledAt: "2026-10-01", activatedAt: "2026-10-01" },
    ]);
    const [cash] = await ensurePaymentMethods(db);
    await db.insert(payments).values([
      // Ali to'lagan; Valining to'lovi bekor qilingan
      {
        studentId: s1!.id,
        groupId: g!.id,
        kind: "payment",
        amount: 600_000,
        date: "2026-10-02",
        methodId: cash!.id,
        receiptNo: 1,
      },
      {
        studentId: s2!.id,
        groupId: g!.id,
        kind: "payment",
        amount: 300_000,
        date: "2026-10-03",
        methodId: cash!.id,
        receiptNo: 2,
        voidedAt: new Date(),
      },
    ]);
    await db.insert(attendance).values([
      { groupId: g!.id, studentId: s1!.id, date: TODAY, status: "present" },
      { groupId: g!.id, studentId: s2!.id, date: TODAY, status: "absent", reason: "Kasal" },
    ]);

    const stages = await listStages(db);
    const open = stages.filter((s) => s.kind === "open");
    const won = stages.find((s) => s.kind === "won")!;
    const lost = stages.find((s) => s.kind === "lost")!;
    const at = (d: string) => new Date(`${d}T10:00:00+05:00`);
    const [l1] = await db
      .insert(leads)
      .values([
        // Bugun bog'lanish kerak (kechikkan), birinchi ustun, mas'ulsiz, saytdan
        {
          branchId: a!.id,
          name: "Kechikkan",
          phone: "+998931110001",
          stageId: open[0]!.id,
          targetDate: "2026-10-10",
          source: "Veb-sayt forma",
          createdAt: at("2026-10-01"),
        },
      ])
      .returning();
    const [l2] = await db
      .insert(leads)
      .values({
        branchId: a!.id,
        name: "Sinovchi",
        phone: "+998931110002",
        stageId: open[1]!.id,
        targetDate: "2026-10-20",
        createdAt: at("2026-10-05"),
      })
      .returning();
    await db.insert(leadFirstLessons).values({ leadId: l2!.id, groupId: g!.id, lessonDate: TODAY });
    await db.insert(leads).values([
      // O'quvchi bo'lgan va to'lagan (Ali)
      {
        branchId: a!.id,
        name: "Ali",
        phone: "+998907770001",
        stageId: won.id,
        studentId: s1!.id,
        source: "Instagram",
        createdAt: at("2026-10-03"),
      },
      // O'quvchi bo'lgan, to'lovi bekor qilingan (Vali)
      {
        branchId: a!.id,
        name: "Vali",
        phone: "+998907770002",
        stageId: won.id,
        studentId: s2!.id,
        source: "Instagram",
        createdAt: at("2026-10-04"),
      },
      // Yo'qotilgan
      {
        branchId: a!.id,
        name: "Ketgan",
        phone: "+998931110003",
        stageId: lost.id,
        lostFromStageId: open[1]!.id,
        lostReason: "Qimmat",
        createdAt: at("2026-10-06"),
      },
      // O'tgan oy
      { branchId: a!.id, name: "Eski", phone: "+998931110004", stageId: open[0]!.id, createdAt: at("2026-09-15") },
      // Boshqa filial
      { branchId: b!.id, name: "B lid", phone: "+998931110005", stageId: open[0]!.id, createdAt: at("2026-10-07") },
    ]);
    Object.assign(ids, { a: a!.id, b: b!.id, group: g!.id, lost: open[1]!.id });
    void l1;
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const period = resolvePeriod(2026, 10, TODAY);
  const months = ["2026-08", "2026-09", "2026-10"];

  it("lid kartalari: son, solishtirish, manbalar, konversiya, birinchi to'lov, yo'qotilgan bosqich", async () => {
    const d = await loadLeadDashboard(db, [ids.a], period, months);
    expect(d.stats.count).toBe(5);
    expect(d.stats.prevCount).toBe(1);
    expect(d.stats.spark).toEqual([0, 1, 5]);
    expect(Object.fromEntries(d.stats.sources)).toEqual({ Boshqa: 2, Instagram: 2, "Veb-sayt forma": 1 });
    expect(d.stats.converted).toBe(2);
    expect(d.stats.conv).toBeCloseTo((2 / 5) * 100);
    expect(d.stats.firstPaid).toBe(1);
    expect(d.stats.lostTop).toMatchObject({ stageId: ids.lost, count: 1 });
    expect(d.recent[0]!.name).toBe("Ketgan");
    // Hamma filial
    expect((await loadLeadDashboard(db, null, period, months)).stats.count).toBe(6);
  });

  it("bugungi ishlar: lidlar, kelmaganlar, qarzdorlar, tugayotgan guruh", async () => {
    const w = await loadWorkbench(db, ALL_BLOCKS, [ids.a], TODAY);
    expect(w.leads!.followUps.map((l) => [l.name, l.overdue])).toEqual([["Kechikkan", 4]]);
    expect(w.leads!.firstLessons).toMatchObject([
      { name: "Sinovchi", group: "IELTS", time: "15:00", status: "scheduled" },
    ]);
    expect(w.leads!.unassigned.map((l) => l.name)).toEqual(["Kechikkan", "Eski"]);
    expect(w.absent).toMatchObject({
      lessons: 1,
      marked: 1,
      list: [{ name: "Vali", reason: "Kasal", status: "absent" }],
    });
    expect(w.debtors!.top.map((d) => d.name)).toContain("Vali");
    expect(w.ending).toMatchObject([{ name: "IELTS", endDate: "2026-11-01", daysLeft: 18 }]);
  });

  it("ruxsat bo'lmagan blok o'qilmaydi; boshqa mijoz hech narsa ko'rmaydi", async () => {
    const only = await loadWorkbench(db, new Set(["groups"] as const), [ids.a], TODAY);
    expect(only).toMatchObject({ leads: null, absent: null, debtors: null });
    const foreign = await loadWorkbench(other, ALL_BLOCKS, null, TODAY);
    expect(foreign.leads!.followUps).toHaveLength(0);
    expect(foreign.absent!.list).toHaveLength(0);
    expect(foreign.debtors!.count).toBe(0);
    expect(foreign.ending).toHaveLength(0);
    expect((await loadLeadDashboard(other, null, period, months)).stats.count).toBe(0);
  });
});
