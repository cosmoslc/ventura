import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { approvalRequests, branches, students, users } from "@ventura/db/schema/tenant";
import { createApprovalRequest, listApprovalRequests, pendingApprovalCount } from "./approvals";
import type { BranchContext } from "./branch";
import type { Staff } from "./session";

/*
 * Tasdiq so'rovlari haqiqiy PostgreSQL'da (ADR 0019): so'rov sarlavhasi va mazmuni kirishdan yig'iladi, filial bo'sh
 * bo'lsa so'rovchining tanlovidan to'ldiriladi, ro'yxat va menyudagi son, CHECK himoyasi, boshqa mijoz ko'rmasligi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_approvals_test";
const ROLE = "edu_approvals_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
const ids = { manager: "", director: "", student: "", branch: "" };

describe.skipIf(!ADMIN_URL)("tasdiq so'rovlari (haqiqiy PostgreSQL)", () => {
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
    const [m] = await db.insert(users).values({ name: "Menejer", email: "m@appr.local", role: "staff" }).returning();
    const [d] = await db
      .insert(users)
      .values({ name: "Direktor", email: "d@appr.local", role: "director" })
      .returning();
    const [s] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali Valiyev", phone: "+998907770001" })
      .returning();
    Object.assign(ids, { manager: m!.id, director: d!.id, student: s!.id, branch: b!.id });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const branch = (): BranchContext => ({
    enabled: true,
    options: [{ id: ids.branch, name: "Markaz", color: "#000000", address: null }],
    selected: ids.branch,
    filter: [ids.branch],
  });

  it("sarlavha va mazmun kirishdan, bo'sh filial so'rovchining tanlovidan", async () => {
    const staff = { id: ids.manager, director: false } as Staff;
    const r = await createApprovalRequest(db, {
      staff,
      branch: branch(),
      permission: "finance.payment_create",
      action: "payments.record",
      input: { studentId: ids.student, amount: 300_000, month: "2026-10", date: "2026-10-05", note: "naqd" },
    });
    expect(r.title).toBe("Ali Valiyev: to'lov qabul qilish");
    const e = await createApprovalRequest(db, {
      staff,
      branch: branch(),
      permission: "expenses.create",
      action: "expenses.save",
      input: { branchId: null, reason: "Qog'oz", amount: 50_000 },
    });
    const [row] = await db.select().from(approvalRequests).where(eq(approvalRequests.id, e.id));
    expect(row!.payload).toMatchObject({ branchId: ids.branch, amount: 50_000 });

    const list = await listApprovalRequests(db, { mine: ids.manager });
    expect(list).toHaveLength(2);
    expect(list.find((x) => x.id === r.id)).toMatchObject({
      status: "pending",
      requestedByName: "Menejer",
      summary: expect.stringContaining("300 000"),
    });
    expect(await pendingApprovalCount(db, { id: ids.manager, director: false })).toBe(2);
    expect(await pendingApprovalCount(db, { id: ids.director, director: true })).toBe(2);
    expect(await listApprovalRequests(db, { mine: ids.director })).toEqual([]);
  });

  it("tasdiqlangan so'rovda kim va qachon majburiy; boshqa mijoz ko'rmaydi", async () => {
    await expect(
      db.insert(approvalRequests).values({
        requestedBy: ids.manager,
        permission: "students.delete",
        action: "students.archive",
        title: "x",
        payload: {},
        status: "approved",
      }),
    ).rejects.toThrow();
    expect(await listApprovalRequests(other)).toEqual([]);
    expect(await pendingApprovalCount(other, { id: ids.director, director: true })).toBe(0);
  });
});
