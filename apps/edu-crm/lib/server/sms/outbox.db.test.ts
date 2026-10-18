import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { smsMessages } from "@ventura/db/schema/tenant";
import { applyDelivery, enqueue, flush, poll } from "./outbox";
import { type DeliveryState, type SmsSender, SmsRejected } from "./sender";

/*
 * SMS navbati haqiqiy PostgreSQL'da (S3, ADR 0055): raqam formatlanadi, noto'g'risi va takror (dedupe) tashlanadi;
 * yuborilgani `sent` + provayder id; xatoda kechikish bilan qayta urinish, 3-xatodan keyin `failed`; yetkazish
 * natijasi yakuniy holatni qayta yozmaydi; to'xtab qolgan `sending` navbatga qaytadi; boshqa mijoz xabarlari
 * ko'rinmaydi. TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_sms_outbox_test";
const ROLE = "edu_sms_outbox_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;

/** Soxta yuboruvchi: `fail` to'plamidagi raqamlarga xato, qolganlarga `p-<n>` id */
function fakeSender(fail = new Set<string>(), states = new Map<string, DeliveryState>()) {
  const sent: string[] = [];
  let n = 0;
  const sender: SmsSender = {
    from: null,
    async send({ phone }) {
      if (fail.has(phone)) throw new Error("Eskiz xatosi");
      sent.push(phone);
      return { providerId: `p-${++n}` };
    },
    async status(id) {
      return { state: states.get(id) ?? "pending", parts: 2, cost: 190 };
    },
  };
  return { sender, sent };
}

const rowsOf = (target: TenantDb) => target.select().from(smsMessages).orderBy(smsMessages.phone);
const later = (min: number) => new Date(Date.now() + min * 60_000);

describe.skipIf(!ADMIN_URL)("SMS navbati (haqiqiy PostgreSQL)", () => {
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
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  beforeEach(async () => {
    await db.delete(smsMessages);
    await other.delete(smsMessages);
  });

  it("raqamni formatlaydi, noto'g'risini va takrorni tashlaydi", async () => {
    const base = { kind: "custom" as const, recipient: "student" as const, text: "Salom" };
    const n = await enqueue(db, [
      { ...base, phone: "+998 90 111 22 33", dedupeKey: "k1" },
      { ...base, phone: "901112234" },
      { ...base, phone: "12345" },
      { ...base, phone: "+998 90 111 22 35", dedupeKey: "k1" },
    ]);
    expect(n).toBe(2);
    expect(await enqueue(db, [{ ...base, phone: "901112299", dedupeKey: "k1" }])).toBe(0);
    expect((await rowsOf(db)).map((r) => r.phone)).toEqual(["998901112233", "998901112234"]);
    // Boshqa mijoz ko'rmaydi
    expect(await rowsOf(other)).toEqual([]);
  });

  it("yuboradi; xatoda qayta urinadi, 3-xatodan keyin failed", async () => {
    const base = { kind: "custom" as const, recipient: "parent" as const, text: "Eslatma" };
    await enqueue(db, [
      { ...base, phone: "901110001" },
      { ...base, phone: "901110002" },
      { ...base, phone: "901110003", sendAfter: later(30) },
    ]);
    const { sender, sent } = fakeSender(new Set(["998901110002"]));

    expect(await flush(db, sender)).toEqual({ sent: 1, failed: 0, retried: 1 });
    expect(sent).toEqual(["998901110001"]);
    let rows = await rowsOf(db);
    expect(rows[0]).toMatchObject({ status: "sent", providerId: "p-1", attempts: 1 });
    expect(rows[1]).toMatchObject({ status: "queued", attempts: 1, error: "Eskiz xatosi" });
    expect(rows[1]!.sendAfter.getTime()).toBeGreaterThan(Date.now());
    // Vaqti kelmagani tegilmaydi
    expect(rows[2]).toMatchObject({ status: "queued", attempts: 0 });

    // 2- va 3-urinish (vaqtni oldinga surib)
    expect(await flush(db, sender, later(2))).toMatchObject({ retried: 1 });
    expect(await flush(db, sender, later(20))).toMatchObject({ failed: 1 });
    rows = await rowsOf(db);
    expect(rows[1]).toMatchObject({ status: "failed", attempts: 3 });
  });

  it("provayder rad etsa qayta urinmaydi", async () => {
    await enqueue(db, [{ kind: "custom", recipient: "student", phone: "901110040", text: "x" }]);
    const sender: SmsSender = {
      from: null,
      send: async () => {
        throw new SmsRejected("Test holatida faqat test matni");
      },
      status: async () => ({ state: "pending", parts: null, cost: null }),
    };
    expect(await flush(db, sender)).toEqual({ sent: 0, failed: 1, retried: 0 });
    expect((await rowsOf(db))[0]).toMatchObject({
      status: "failed",
      attempts: 1,
      error: "Test holatida faqat test matni",
    });
  });

  it("yetkazish natijasi: delivered narx bilan; yakuniy holat qayta yozilmaydi", async () => {
    await enqueue(db, [{ kind: "custom", recipient: "student", phone: "901110010", text: "x" }]);
    await flush(db, fakeSender().sender);
    expect(await applyDelivery(db, "p-1", "delivered", { parts: 2, cost: 190 })).toBe(true);
    const [row] = await rowsOf(db);
    expect(row).toMatchObject({ status: "delivered", parts: 2, cost: 190 });
    expect(row!.deliveredAt).not.toBeNull();
    expect(await applyDelivery(db, "p-1", "failed")).toBe(false);
    expect((await rowsOf(db))[0]!.status).toBe("delivered");
    // Boshqa mijoz nomidan o'zgartirib bo'lmaydi
    expect(await applyDelivery(other, "p-1", "failed")).toBe(false);
  });

  it("callback kelmaganini so'raydi", async () => {
    await enqueue(db, [{ kind: "custom", recipient: "student", phone: "901110020", text: "x" }]);
    const states = new Map<string, DeliveryState>([["p-1", "failed"]]);
    const { sender } = fakeSender(new Set(), states);
    await flush(db, sender);
    // Endigina yuborilgan — hali so'ralmaydi
    expect(await poll(db, sender)).toBe(0);
    expect(await poll(db, sender, later(10))).toBe(1);
    expect((await rowsOf(db))[0]).toMatchObject({ status: "failed", error: "Yetkazilmadi" });
  });

  it("to'xtab qolgan sending navbatga qaytadi", async () => {
    await enqueue(db, [{ kind: "custom", recipient: "student", phone: "901110030", text: "x" }]);
    await db.update(smsMessages).set({ status: "sending", lockedAt: new Date(Date.now() - 11 * 60_000), attempts: 1 });
    const { sender, sent } = fakeSender();
    expect(await flush(db, sender)).toMatchObject({ sent: 1 });
    expect(sent).toEqual(["998901110030"]);
    const [row] = await db.select().from(smsMessages).where(eq(smsMessages.phone, "998901110030"));
    expect(row).toMatchObject({ status: "sent", attempts: 2 });
  });
});
