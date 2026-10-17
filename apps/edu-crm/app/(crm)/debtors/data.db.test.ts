import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import {
  branches,
  courses,
  groupMemberships,
  groups,
  studentNotes,
  students,
  teachers,
} from "@ventura/db/schema/tenant";
import { getFinanceSettings } from "@/lib/server/finance";
import { listDebtors } from "./data";

/*
 * Qarzdorlar ro'yxatidagi "Izoh" (EDU-CRM-FIXES 5.2) haqiqiy PostgreSQL'da: har qarzdorga eng oxirgi bog'lanish
 * izohi chiqadi; bog'lanishga aloqasi yo'q tur (oddiy eslatma, natija) hisobga olinmaydi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_debtors_test";
const ROLE = "edu_debtors_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;

describe.skipIf(!ADMIN_URL)("qarzdorlar izohi (haqiqiy PostgreSQL)", () => {
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
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("jadvalga faqat eng oxirgi bog'lanish izohi chiqadi", async () => {
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
        startDate: "2026-08-01",
      })
      .returning();
    const [withNotes, noNotes] = await db
      .insert(students)
      .values([
        { branchId: b!.id, name: "Ali", phone: "+998907654301" },
        { branchId: b!.id, name: "Vali", phone: "+998907654302" },
      ])
      .returning();
    await db.insert(groupMemberships).values(
      [withNotes!, noNotes!].map((s) => ({
        groupId: g!.id,
        studentId: s.id,
        status: "active" as const,
        enrolledAt: "2026-09-01",
        activatedAt: "2026-09-01",
      })),
    );
    const note = (kind: "call" | "message" | "note", text: string, at: string) => ({
      studentId: withNotes!.id,
      kind,
      text,
      authorName: "Menejer",
      createdAt: new Date(at),
    });
    await db.insert(studentNotes).values([
      note("call", "Dushanbagacha to'laydi", "2026-10-01T09:00:00Z"),
      note("message", "Ertaga to'layman dedi", "2026-10-05T09:00:00Z"),
      // Bog'lanish emas — hisobga kirmaydi, garchi eng yangisi bo'lsa ham
      note("note", "Yaxshi o'quvchi", "2026-10-09T09:00:00Z"),
    ]);

    const today = "2026-10-12";
    const rows = await listDebtors(db, null, today, await getFinanceSettings(db));
    const byName = new Map(rows.map((r) => [r.name, r]));
    expect(byName.get("Ali")!.note).toMatchObject({
      kind: "message",
      text: "Ertaga to'layman dedi",
      authorName: "Menejer",
    });
    expect(byName.get("Vali")!.note).toBeNull();
  });
});
