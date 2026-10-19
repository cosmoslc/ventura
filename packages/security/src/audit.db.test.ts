import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type PanelDb, createPanelDb } from "@ventura/db";
import { auditEvents, settings } from "@ventura/db/schema/panel";
import { AUDIT_CHECKPOINT_KEY, audit } from "./audit";

/*
 * Audit zanjirini bo'laklab va nazorat nuqtasidan tekshirish (ADR 0060) haqiqiy PostgreSQL'da. Buzishni superuser
 * qiladi (triggerni vaqtincha o'chirib) — production'da faqat u qila oladi. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "ventura_audit_verify_test";
const MIGRATIONS = fileURLToPath(new URL("../../db/migrations/panel", import.meta.url));

let db: PanelDb;

const url = () => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  return u.toString();
};

const add = async (n: number) => {
  for (let i = 0; i < n; i++)
    await audit.record(db, { actor: { type: "system" }, action: "test.event", metadata: { i } });
};

const checkpoint = async () =>
  (await db.select({ value: settings.value }).from(settings).where(eq(settings.key, AUDIT_CHECKPOINT_KEY)))[0]?.value;

/** Superuser triggerni o'chirib yozuvni o'zgartiradi yoki o'chiradi */
async function tamper(run: () => Promise<unknown>) {
  await db.$client.unsafe("alter table audit_events disable trigger audit_events_no_update_delete");
  try {
    await run();
  } finally {
    await db.$client.unsafe("alter table audit_events enable trigger audit_events_no_update_delete");
  }
}

describe.skipIf(!ADMIN_URL)("audit zanjirini tekshirish (haqiqiy PostgreSQL)", () => {
  beforeAll(async () => {
    const admin = createPanelDb(ADMIN_URL);
    try {
      await admin.$client.unsafe(`drop database if exists ${DB} with (force)`);
      await admin.$client.unsafe(`create database ${DB}`);
    } finally {
      await admin.$client.end();
    }
    db = createPanelDb(url());
    await migrate(db, { migrationsFolder: MIGRATIONS });
  }, 60_000);

  afterAll(async () => {
    await db?.$client.end();
  });

  it("bo'sh zanjir butun, nazorat nuqtasi yozilmaydi", async () => {
    expect(await audit.verify(db)).toEqual({ ok: true, count: 0 });
    expect(await checkpoint()).toBeUndefined();
  });

  it("bir necha bo'lakli zanjir tekshiriladi va nazorat nuqtasi yoziladi", async () => {
    await add(1_203);
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_203 });
    const [last] = await db.select().from(auditEvents).where(eq(auditEvents.seq, 1_203));
    expect(await checkpoint()).toEqual({ seq: 1_203, hash: last!.hash, count: 1_203 });
  }, 60_000);

  it("keyingi tekshiruv faqat yangi yozuvlarni o'qiydi va nuqtani suradi", async () => {
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_203 });
    await add(5);
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_208 });
    expect(await checkpoint()).toMatchObject({ seq: 1_208, count: 1_208 });
  });

  it("nuqtadan keyingi yozuv o'zgartirilsa aniqlanadi, nuqta surilmaydi", async () => {
    await add(3);
    await tamper(() => db.update(auditEvents).set({ action: "soxta" }).where(eq(auditEvents.seq, 1_210)));
    expect(await audit.verify(db)).toEqual({
      ok: false,
      count: 1_211,
      brokenAtSeq: 1_210,
      reason: "yozuv mazmuni o'zgartirilgan",
    });
    expect(await checkpoint()).toMatchObject({ seq: 1_208 });
    await tamper(() => db.update(auditEvents).set({ action: "test.event" }).where(eq(auditEvents.seq, 1_210)));
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_211 });
  });

  it("nuqtaning o'zi o'zgartirilsa butun zanjir tekshiriladi va buzilgan joy ko'rsatiladi", async () => {
    await tamper(() => db.update(auditEvents).set({ ip: "10.0.0.1" }).where(eq(auditEvents.seq, 1_211)));
    expect(await audit.verify(db)).toMatchObject({ ok: false, brokenAtSeq: 1_211 });
    await tamper(() => db.update(auditEvents).set({ ip: null }).where(eq(auditEvents.seq, 1_211)));
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_211 });
  });

  it("nuqtadan oldingi yozuvni kunlik to'liq tekshiruv topadi; keyin sahifa ham uzilishni ko'rsatadi", async () => {
    await tamper(() => db.update(auditEvents).set({ actorName: "soxta" }).where(eq(auditEvents.seq, 10)));
    // Sahifa tekshiruvi nuqtadan keyingisini ko'radi (ADR 0060 dagi kelishuv)
    expect(await audit.verify(db)).toEqual({ ok: true, count: 1_211 });
    expect(await audit.verifyFull(db)).toMatchObject({ ok: false, count: 1_211, brokenAtSeq: 10 });
    expect(await audit.verify(db)).toMatchObject({ ok: false, brokenAtSeq: 10 });
    // Parallel sahifa tekshiruvi "uzilgan" belgisini ustidan yozmaydi
    expect(await checkpoint()).toMatchObject({ brokenAtSeq: 10 });
    await tamper(() => db.update(auditEvents).set({ actorName: null }).where(eq(auditEvents.seq, 10)));
    expect(await audit.verifyFull(db)).toEqual({ ok: true, count: 1_211 });
    expect(await checkpoint()).toMatchObject({ seq: 1_211, count: 1_211 });
  });

  it("nuqtadan oldingi yozuv o'chirilsa (son kamaysa) butun zanjir tekshiriladi", async () => {
    await tamper(() => db.delete(auditEvents).where(eq(auditEvents.seq, 500)));
    expect(await audit.verify(db)).toEqual({
      ok: false,
      count: 1_210,
      brokenAtSeq: 501,
      reason: "prev_hash oldingi yozuv xeshiga mos emas",
    });
  });
});
