import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { accessFor } from "@ventura/auth/staff";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, students, users } from "@ventura/db/schema/tenant";
import { tenantAudit } from "@ventura/security";
import { archivedStaff } from "../../app/(crm)/staff/data";
import { activityActors, listActivity, staffActivity } from "./activity";

/*
 * Faoliyat jurnali ko'rinishi va arxivdagi xodimlar haqiqiy PostgreSQL'da (ADR 0037): filtrlar, aks yozuvlar,
 * nishon nomi, mijozlar ajratilishi va xodimni tiklash uchun ro'yxat. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_activity_test";
const ROLE = "edu_activity_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tashkent" }).format(new Date());
const range = { from: day, to: day };

let db: TenantDb;
let other: TenantDb;
const ids = { aziz: "", dilshod: "", student: "" };

describe.skipIf(!ADMIN_URL)("faoliyat jurnali (haqiqiy PostgreSQL)", () => {
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
    const [a] = await db
      .insert(users)
      .values({ name: "Aziz Karimov", email: "a@act.local", role: "staff", phoneNumber: "+998901110001" })
      .returning();
    const [d] = await db
      .insert(users)
      .values({
        name: "Dilshod Rahimov",
        email: "d@act.local",
        role: "staff",
        phoneNumber: "+998901110002",
        archivedAt: new Date(),
      })
      .returning();
    const [s] = await db
      .insert(students)
      .values({ branchId: b!.id, name: "Ali Valiyev", phone: "+998907770001" })
      .returning();
    Object.assign(ids, { aziz: a!.id, dilshod: d!.id, student: s!.id });

    const actor = { type: "user" as const, id: a!.id, name: "Aziz Karimov" };
    await tenantAudit.record(db, {
      actor,
      action: "payment.create",
      target: { type: "student", id: s!.id },
      metadata: { amount: 300000 },
    });
    await tenantAudit.record(db, {
      actor,
      action: "student.enroll",
      target: { type: "student", id: s!.id },
      metadata: { group: "IELTS" },
    });
    await tenantAudit.record(db, {
      actor,
      action: "staff.archive",
      target: { type: "user", id: d!.id },
      metadata: { name: "Dilshod Rahimov" },
    });
    await tenantAudit.record(other, { actor: { type: "user", id: "x", name: "Begona" }, action: "payment.create" });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  const query = { ...range, actorId: null, section: null, q: "", page: 1 } as const;

  it("jumla nishon nomi bilan, aks yozuv ro'yxatda yo'q, boshqa mijoz ko'rinmaydi", async () => {
    const { rows, total } = await listActivity(db, query);
    expect(total).toBe(2);
    expect(rows.map((r) => r.action)).toEqual(["staff.archive", "payment.create"]);
    expect(rows[1]!.sentence).toBe("Aziz Karimov to'lov qabul qildi: 300 000 so'm — Ali Valiyev");
  });

  it("bo'lim, xodim va qidiruv filtrlari", async () => {
    expect((await listActivity(db, { ...query, section: "payment" })).total).toBe(1);
    expect((await listActivity(db, { ...query, section: "other" })).total).toBe(0);
    expect((await listActivity(db, { ...query, actorId: "yo'q" })).total).toBe(0);
    expect((await listActivity(db, { ...query, q: "300000" })).total).toBe(1);
    expect((await listActivity(db, { ...query, q: "50%" })).total).toBe(0);
  });

  it("sana oralig'i tashqarisi bo'sh; sahifa chegaraga tushadi", async () => {
    const past = await listActivity(db, { ...query, from: "2020-01-01", to: "2020-01-02", page: 9 });
    expect(past).toMatchObject({ total: 0, page: 1 });
  });

  it("xodimlar bo'yicha sanash va xodimlar ro'yxati", async () => {
    const staff = await staffActivity(db, range);
    expect(staff).toHaveLength(1);
    expect(staff[0]).toMatchObject({ actorName: "Aziz Karimov", total: 2 });
    expect(await activityActors(db)).toEqual([{ id: ids.aziz, name: "Aziz Karimov" }]);
  });

  it("arxivdagi xodim: kim bo'shatgani jurnaldan, ko'rinish filiali bo'yicha", async () => {
    const viewer = { access: accessFor("director", null, []) };
    const rows = await archivedStaff(db, viewer, null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: ids.dilshod, archivedByName: "Aziz Karimov", manageable: true });
    // Faol xodim ro'yxatda yo'q; filial cheklovi bor, xodimning filiali yo'q bo'lsa — ko'rinmaydi
    expect(await archivedStaff(db, viewer, ["boshqa-filial"])).toHaveLength(0);
    expect(await archivedStaff(other, viewer, null)).toHaveLength(0);
  });
});
