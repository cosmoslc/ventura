import { eq, sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditEvents, branches, courses, rooms } from "./schema/tenant";
import { type TenantDb, createTenantDb } from "./tenant";
import { migrateTenantDb } from "./tenant-migrate";

/*
 * Mijozlarni ajratish testi (EDU-CRM-PLAN E0 qabuli): A mijoz B mijoz ma'lumotini ololmaydi —
 * umumiy bazada (shared_db) ham, alohida bazalarda (db_per_tenant) ham.
 *
 * Haqiqiy PostgreSQL kerak: TENANT_TEST_ADMIN_URL — baza va rol yarata oladigan foydalanuvchi
 * (masalan postgres://postgres:...@localhost:5432/postgres). Berilmasa test o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const APP_ROLE = "edu_iso_app";
const APP_PASSWORD = "edu-iso-test";
const DBS = { shared: "edu_iso_shared", a: "edu_iso_a", b: "edu_iso_b" } as const;

function urlFor(database: string, user?: { name: string; password: string }) {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${database}`;
  if (user) {
    u.username = user.name;
    u.password = user.password;
  }
  return u.toString();
}

const app = { name: APP_ROLE, password: APP_PASSWORD };
const opened: TenantDb[] = [];
const open = (url: string, tenant: string) => {
  const db = createTenantDb(url, tenant, { max: 2 });
  opened.push(db);
  return db;
};

describe.skipIf(!ADMIN_URL)("mijozlarni ajratish (haqiqiy PostgreSQL)", () => {
  beforeAll(async () => {
    const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
    try {
      for (const name of Object.values(DBS)) await admin.unsafe(`drop database if exists ${name} with (force)`);
      await admin.unsafe(`drop role if exists ${APP_ROLE}`);
      // Oddiy rol: superuser ham, BYPASSRLS ham emas — production'dagi ilova foydalanuvchisi kabi
      await admin.unsafe(`create role ${APP_ROLE} login password '${APP_PASSWORD}' nosuperuser nobypassrls`);
      // Umumiy baza: jadvallar egasi — migratsiya foydalanuvchisi, ilova faqat huquq oladi
      await admin.unsafe(`create database ${DBS.shared}`);
      // Alohida bazalar: ilova foydalanuvchisi bazaning egasi (FORCE RLS egaga ham amal qiladi)
      await admin.unsafe(`create database ${DBS.a} owner ${APP_ROLE}`);
      await admin.unsafe(`create database ${DBS.b} owner ${APP_ROLE}`);
    } finally {
      await admin.end();
    }

    await migrateTenantDb(urlFor(DBS.shared));
    const shared = postgres(urlFor(DBS.shared), { max: 1, onnotice: () => {} });
    try {
      await shared.unsafe(`grant usage on schema public to ${APP_ROLE}`);
      await shared.unsafe(`grant select, insert, update, delete on all tables in schema public to ${APP_ROLE}`);
      await shared.unsafe(`grant usage on all sequences in schema public to ${APP_ROLE}`);
    } finally {
      await shared.end();
    }
    await migrateTenantDb(urlFor(DBS.a, app));
    await migrateTenantDb(urlFor(DBS.b, app));
  }, 60_000);

  afterAll(async () => {
    await Promise.all(opened.map((db) => db.close()));
  });

  describe("umumiy baza (shared_db)", () => {
    it("har mijoz faqat o'z qatorlarini ko'radi; tenant_id avtomatik qo'yiladi", async () => {
      const a = open(urlFor(DBS.shared, app), "alfa");
      const b = open(urlFor(DBS.shared, app), "beta");
      const [rowA] = await a.insert(branches).values({ name: "Markaziy" }).returning();
      await b.insert(branches).values({ name: "Markaziy" }); // bir xil nom boshqa mijozda — ruxsat
      expect(rowA!.tenantId).toBe("alfa");

      expect((await a.select().from(branches)).map((r) => r.tenantId)).toEqual(["alfa"]);
      expect((await b.select().from(branches)).map((r) => r.tenantId)).toEqual(["beta"]);
      // id ma'lum bo'lsa ham boshqa mijoz qatori topilmaydi
      expect(await b.select().from(branches).where(eq(branches.id, rowA!.id))).toEqual([]);
    });

    it("boshqa mijoz qatorini o'zgartirib ham, o'chirib ham bo'lmaydi", async () => {
      const a = open(urlFor(DBS.shared, app), "alfa");
      const b = open(urlFor(DBS.shared, app), "beta");
      const [rowA] = await a.select().from(branches);
      expect(await b.update(branches).set({ name: "Buzildi" }).where(eq(branches.id, rowA!.id)).returning()).toEqual(
        [],
      );
      expect(await b.delete(branches).where(eq(branches.id, rowA!.id)).returning()).toEqual([]);
      const [still] = await a.select().from(branches).where(eq(branches.id, rowA!.id));
      expect(still?.name).toBe("Markaziy");
    });

    it("boshqa mijoz nomidan yozib bo'lmaydi", async () => {
      const b = open(urlFor(DBS.shared, app), "beta");
      await expect(b.insert(branches).values({ name: "Soxta", tenantId: "alfa" })).rejects.toThrow();
      const [rowB] = await b.select().from(branches);
      await expect(b.update(branches).set({ tenantId: "alfa" }).where(eq(branches.id, rowB!.id))).rejects.toThrow();
    });

    it("boshqa mijoz filialiga bog'lab bo'lmaydi (kompozit kalit), o'zinikiga — mumkin", async () => {
      const a = open(urlFor(DBS.shared, app), "alfa");
      const b = open(urlFor(DBS.shared, app), "beta");
      const [branchA] = await a.select().from(branches);
      // B mijoz A filialining id sini bilsa ham kurs yoki xonani unga bog'lay olmaydi
      await expect(b.insert(courses).values({ name: "Soxta kurs", branchId: branchA!.id })).rejects.toThrow();
      await expect(b.insert(rooms).values({ name: "Soxta xona", branchId: branchA!.id })).rejects.toThrow();
      const [course] = await a.insert(courses).values({ name: "Matematika", branchId: branchA!.id }).returning();
      expect(course!.branchId).toBe(branchA!.id);
      // Umumiy (filialsiz) kurs ham mumkin
      await a.insert(courses).values({ name: "IELTS" });
      // Kursi bor filialni o'chirib bo'lmaydi
      await expect(a.delete(branches).where(eq(branches.id, branchA!.id))).rejects.toThrow();
      await a.delete(courses);
      expect(await b.select().from(courses)).toEqual([]);
    });

    it("mijozi berilmagan ulanish hech narsa ko'rmaydi va yoza olmaydi", async () => {
      const raw = postgres(urlFor(DBS.shared, app), { max: 1, onnotice: () => {} });
      try {
        expect(await raw`select count(*)::int as n from branches`).toEqual([{ n: 0 }]);
        await expect(raw`insert into branches (name) values ('Hech kim')`).rejects.toThrow();
      } finally {
        await raw.end();
      }
    });

    it("tenant_id li har jadvalda RLS yoqilgan va egaga ham majburiy", async () => {
      const admin = postgres(urlFor(DBS.shared), { max: 1 });
      try {
        const rows = await admin<{ relname: string; rls: boolean; force: boolean }[]>`
          select c.relname, c.relrowsecurity as rls, c.relforcerowsecurity as force
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
          where n.nspname = 'public' and c.relkind = 'r'`;
        expect(rows.length).toBeGreaterThanOrEqual(10);
        for (const r of rows)
          expect({ table: r.relname, rls: r.rls, force: r.force }).toEqual({
            table: r.relname,
            rls: true,
            force: true,
          });
        // Har jadvalda tenant_id bo'lishi shart (drizzle jurnali bundan mustasno — u boshqa sxemada)
        const missing = await admin<{ relname: string }[]>`
          select c.relname from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r'
            and not exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id')`;
        expect(missing).toEqual([]);
      } finally {
        await admin.end();
      }
    });

    it("faoliyat jurnalini o'zgartirib ham, o'chirib ham bo'lmaydi", async () => {
      const a = open(urlFor(DBS.shared, app), "alfa");
      const [ev] = await a.insert(auditEvents).values({ actorType: "system", action: "test", hash: "h" }).returning();
      await expect(a.update(auditEvents).set({ action: "boshqa" }).where(eq(auditEvents.id, ev!.id))).rejects.toThrow();
      await expect(a.delete(auditEvents).where(eq(auditEvents.id, ev!.id))).rejects.toThrow();
    });
  });

  describe("alohida bazalar (db_per_tenant)", () => {
    it("har mijoz o'z bazasida, boshqasini ko'rmaydi", async () => {
      const a = open(urlFor(DBS.a, app), "alfa");
      const b = open(urlFor(DBS.b, app), "beta");
      await a.insert(branches).values({ name: "Alfa filiali" });
      await b.insert(branches).values({ name: "Beta filiali" });
      expect((await a.select().from(branches)).map((r) => r.name)).toEqual(["Alfa filiali"]);
      expect((await b.select().from(branches)).map((r) => r.name)).toEqual(["Beta filiali"]);
    });

    it("sozlama xato bo'lsa (boshqa mijoz nomi bilan ulanilsa) ham egasi ma'lumotni ko'rmaydi", async () => {
      const wrong = open(urlFor(DBS.a, app), "beta");
      expect(await wrong.select().from(branches)).toEqual([]);
      const [{ owner }] = (await wrong.execute(
        sql`select tableowner as owner from pg_tables where tablename = 'branches'`,
      )) as unknown as [{ owner: string }];
      expect(owner).toBe(APP_ROLE);
    });
  });
});
