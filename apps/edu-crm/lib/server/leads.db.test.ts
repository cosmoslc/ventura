import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { branches, leadEvents, leadNotes, leadStages, leads, userBranches, users } from "@ventura/db/schema/tenant";
import { leadHistory, leadNotesOf, listLeads, listStages, staffOptions } from "@/app/(crm)/leads/data";

/*
 * Lidlar haqiqiy PostgreSQL'da (ADR 0022): standart bosqichlar bir marta yaratiladi (bir vaqtdagi so'rovlarda ham),
 * ro'yxat filial bo'yicha va arxivsiz, tarix va izohlar, mas'ul xodimlar ro'yxati, bosqichni o'chirib bo'lmasligi
 * (lidi bor), boshqa mijoz ma'lumoti ko'rinmasligi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi (CI'da "mijoz bazasi" vazifasi beradi).
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_leads_test";
const ROLE = "edu_leads_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
const ids = { a: "", b: "", manager: "", outsider: "", director: "" };

describe.skipIf(!ADMIN_URL)("lidlar (haqiqiy PostgreSQL)", () => {
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
    db = createTenantDb(appUrl(), "alfa", { max: 4 });
    other = createTenantDb(appUrl(), "beta", { max: 2 });
    const [a] = await db.insert(branches).values({ name: "A filial" }).returning();
    const [b] = await db.insert(branches).values({ name: "B filial" }).returning();
    const [m] = await db.insert(users).values({ name: "Menejer", email: "m@lead.local", role: "staff" }).returning();
    const [o] = await db.insert(users).values({ name: "Begona", email: "o@lead.local", role: "staff" }).returning();
    const [d] = await db
      .insert(users)
      .values({ name: "Direktor", email: "d@lead.local", role: "director" })
      .returning();
    await db.insert(userBranches).values([
      { userId: m!.id, branchId: a!.id },
      { userId: o!.id, branchId: b!.id },
    ]);
    Object.assign(ids, { a: a!.id, b: b!.id, manager: m!.id, outsider: o!.id, director: d!.id });
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("standart bosqichlar bir marta yaratiladi — bir vaqtda kelgan so'rovlarda ham", async () => {
    const [x, y, z] = await Promise.all([listStages(db), listStages(db), listStages(db)]);
    expect(x.map((s) => s.kind)).toEqual(["open", "open", "open", "won", "lost"]);
    expect(y).toEqual(x);
    expect(z).toEqual(x);
    expect(await db.select().from(leadStages)).toHaveLength(5);
  });

  it("ro'yxat filial bo'yicha va arxivsiz; tarix va izohlar", async () => {
    const [first] = await listStages(db);
    const [l1] = await db
      .insert(leads)
      .values({ branchId: ids.a, name: "Aziz", phone: "+998901110001", stageId: first!.id, assignedTo: ids.manager })
      .returning();
    await db.insert(leads).values({ branchId: ids.b, name: "Bobur", phone: "+998901110002", stageId: first!.id });
    await db
      .insert(leads)
      .values({ branchId: ids.a, name: "Arxiv", phone: "+998901110003", stageId: first!.id, archivedAt: new Date() });
    await db.insert(leadEvents).values({ leadId: l1!.id, toStageId: first!.id, actorName: "Menejer" });
    await db.insert(leadNotes).values({ leadId: l1!.id, kind: "call", text: "Qo'ng'iroq", authorName: "Menejer" });

    const inA = await listLeads(db, [ids.a]);
    expect(inA.map((l) => l.name)).toEqual(["Aziz"]);
    expect(inA[0]).toMatchObject({ phone: "901110001", assignedName: "Menejer" });
    expect((await listLeads(db, null)).map((l) => l.name).sort()).toEqual(["Aziz", "Bobur"]);
    expect(await leadHistory(db, l1!.id)).toMatchObject([{ fromStageId: null, toStageId: first!.id }]);
    expect(await leadNotesOf(db, l1!.id)).toMatchObject([{ kind: "call", text: "Qo'ng'iroq" }]);
  });

  it("mas'ul xodimlar: filialdagilar va direktor", async () => {
    const names = (await staffOptions(db, [ids.a])).map((s) => s.name).sort();
    expect(names).toEqual(["Direktor", "Menejer"]);
    expect((await staffOptions(db, null)).length).toBe(3);
  });

  it("lidi bor bosqich o'chirilmaydi (FK)", async () => {
    const [first] = await listStages(db);
    await expect(db.delete(leadStages).where(eq(leadStages.id, first!.id))).rejects.toThrow();
  });

  it("boshqa mijoz lid va bosqichlarni ko'rmaydi", async () => {
    expect(await other.select().from(leads)).toEqual([]);
    expect(await other.select().from(leadEvents)).toEqual([]);
    expect(await other.select().from(leadNotes)).toEqual([]);
    // Beta o'z standart bosqichlarini oladi, alfaga tegmaydi
    expect(await listStages(other)).toHaveLength(5);
    expect(await db.select().from(leadStages)).toHaveLength(5);
  });
});
