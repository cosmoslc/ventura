import { sql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { tenantAudit } from "./tenant-audit";

/*
 * Mijoz faoliyat jurnali: umumiy bazada har mijozning o'z xesh zanjiri. Haqiqiy PostgreSQL kerak
 * (TENANT_TEST_ADMIN_URL, packages/db dagi ajratish testi bilan bir xil); berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_audit_test";
const ROLE = "edu_audit_app";

/** Bazaga ilova roli nomidan (superuser emas — aks holda RLS chetlab o'tiladi). */
function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

const opened: TenantDb[] = [];

describe.skipIf(!ADMIN_URL)("mijoz faoliyat jurnali (haqiqiy PostgreSQL)", () => {
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
  }, 60_000);

  afterAll(async () => {
    await Promise.all(opened.map((db) => db.close()));
  });

  const open = (tenant: string) => {
    const db = createTenantDb(appUrl(), tenant, { max: 2 });
    opened.push(db);
    return db;
  };

  it("har mijoz zanjiri alohida boshlanadi va butun qoladi, parallel yozuvda ham", async () => {
    const a = open("alfa");
    const b = open("beta");
    await Promise.all([
      ...Array.from({ length: 5 }, (_, i) => tenantAudit.record(a, { actor: { type: "system" }, action: `a.${i}` })),
      ...Array.from({ length: 3 }, (_, i) => tenantAudit.record(b, { actor: { type: "system" }, action: `b.${i}` })),
    ]);
    expect(await tenantAudit.verify(a)).toEqual({ ok: true, count: 5 });
    expect(await tenantAudit.verify(b)).toEqual({ ok: true, count: 3 });
    // Har mijozda bittadan zanjir boshi (oldingi xeshi yo'q yozuv)
    const firsts = (await a.execute(
      sql`select count(*)::int as n from audit_events where prev_hash is null`,
    )) as unknown as {
      n: number;
    }[];
    expect(firsts[0]!.n).toBe(1);
  });
});
