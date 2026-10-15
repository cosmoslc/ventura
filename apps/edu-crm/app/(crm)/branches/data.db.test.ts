import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, courses, groupMemberships, groups, students, teachers } from "@ventura/db/schema/tenant";
import type { Staff } from "@/lib/server/session";
import { listBranches } from "./data";

/*
 * Filial kartasidagi sonlar haqiqiy PostgreSQL'da (E6i): faol o'quvchi — arxivlanmagan, holati faol/qaytgan va ochiq
 * guruhi bor (bosh paneldagi bilan bir xil); guruh — arxivlanmaganlari. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_branches_test";
const ROLE = "edu_branches_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;

describe.skipIf(!ADMIN_URL)("filial sonlari (haqiqiy PostgreSQL)", () => {
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
  });

  afterAll(async () => {
    await db?.close();
  });

  it("faol o'quvchi va guruhlar soni filial bo'yicha", async () => {
    const [b1] = await db
      .insert(branches)
      .values([{ name: "Markaz" }, { name: "Chilonzor" }])
      .returning();
    const [c] = await db.insert(courses).values({ name: "Ingliz tili", price: 300_000 }).returning();
    const [tc] = await db
      .insert(teachers)
      .values({ branchId: b1!.id, name: "Ustoz", phone: "+998901112233" })
      .returning();
    const group = (name: string, branchId: string, archivedAt: Date | null = null) =>
      db
        .insert(groups)
        .values({
          branchId,
          courseId: c!.id,
          teacherId: tc!.id,
          name,
          price: 300_000,
          days: ["mon"],
          startTime: "15:00",
          endTime: "16:30",
          startDate: "2026-09-01",
          archivedAt,
        })
        .returning()
        .then((r) => r[0]!);
    const g1 = await group("A", b1!.id);
    const g2 = await group("B", b1!.id);
    await group("Arxiv", b1!.id, new Date());
    const student = (name: string, phone: string, status: "active" | "paused" | "returned", archivedAt?: Date) =>
      db
        .insert(students)
        .values({ branchId: b1!.id, name, phone, status, joinedAt: "2026-09-02", archivedAt })
        .returning()
        .then((r) => r[0]!);
    const join = (groupId: string, studentId: string) =>
      db
        .insert(groupMemberships)
        .values({ groupId, studentId, status: "active", enrolledAt: "2026-09-02", activatedAt: "2026-09-02" });
    const a = await student("Ali", "+998907770001", "active");
    const r = await student("Vali", "+998907770002", "returned");
    const p = await student("Sami", "+998907770003", "paused");
    const x = await student("Arxiv", "+998907770004", "active", new Date());
    await student("Guruhsiz", "+998907770005", "active");
    // Ali ikki guruhda — bir marta sanaladi
    await join(g1.id, a.id);
    await join(g2.id, a.id);
    await join(g1.id, r.id);
    await join(g1.id, p.id);
    await join(g1.id, x.id);

    const rows = await listBranches(db, { scope: "all" } as Staff);
    const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
    expect(byName["Markaz"]).toMatchObject({ activeStudents: 2, groups: 2 });
    expect(byName["Chilonzor"]).toMatchObject({ activeStudents: 0, groups: 0 });
  });
});
