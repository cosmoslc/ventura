import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { users } from "@ventura/db/schema/tenant";
import { CENTER_KEY, DEFAULT_CENTER, centerInput } from "@/lib/center-settings";
import { DEFAULT_RECEIPT, RECEIPT_KEY, receiptConfigInput } from "@/lib/receipt-config";
import { getCenterSettings, getReceiptConfig, putSetting } from "./center";

/*
 * Markaz va chek sozlamalari haqiqiy PostgreSQL'da (ADR 0036): saqlanmagan bo'lsa — standart; saqlangach o'qiladi;
 * qayta saqlash oldingi qiymatni qaytaradi (jurnal uchun); boshqa mijoz ko'rmaydi. TENANT_TEST_ADMIN_URL
 * berilmasa o'tkazib yuboriladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_center_test";
const ROLE = "edu_center_app";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
let staffId = "";

describe.skipIf(!ADMIN_URL)("markaz va chek sozlamalari (haqiqiy PostgreSQL)", () => {
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
    const [u] = await db.insert(users).values({ name: "Direktor", email: "d@test.local" }).returning();
    staffId = u!.id;
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("saqlanmagan bo'lsa — standart", async () => {
    expect(await getCenterSettings(db)).toEqual(DEFAULT_CENTER);
    expect(await getReceiptConfig(db)).toEqual(DEFAULT_RECEIPT);
  });

  it("markaz sozlamasi saqlanadi, qayta saqlashda oldingisi qaytadi", async () => {
    const first = centerInput.parse({ phone: "901234567", website: "markaz.uz", workDays: ["tue", "mon"] });
    expect(await putSetting(db, CENTER_KEY, first, staffId)).toBeNull();
    expect(await getCenterSettings(db)).toMatchObject({
      phone: "901234567",
      website: "https://markaz.uz",
      workDays: ["mon", "tue"],
    });
    const second = centerInput.parse({ ...first, address: "Chilonzor" });
    expect(await putSetting(db, CENTER_KEY, second, staffId)).toMatchObject({ address: "" });
    expect((await getCenterSettings(db)).address).toBe("Chilonzor");
  });

  it("chek sozlamasi saqlanadi", async () => {
    await putSetting(
      db,
      RECEIPT_KEY,
      receiptConfigInput.parse({ paper: "58mm", showQr: true, footer: "Rahmat" }),
      staffId,
    );
    expect(await getReceiptConfig(db)).toMatchObject({ paper: "58mm", showQr: true, footer: "Rahmat" });
  });

  it("boshqa mijoz ko'rmaydi", async () => {
    expect(await getCenterSettings(other)).toEqual(DEFAULT_CENTER);
    expect(await getReceiptConfig(other)).toEqual(DEFAULT_RECEIPT);
  });
});
