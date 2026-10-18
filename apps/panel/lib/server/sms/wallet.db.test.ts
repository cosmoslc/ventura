import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type PanelDb, createPanelDb } from "@ventura/db";
import { clients, projects, smsPackages, smsWalletEntries, templates } from "@ventura/db/schema/panel";
import {
  adjustWallet,
  decidePurchase,
  recordSent,
  release,
  requestPurchase,
  reserve,
  settle,
  walletBalance,
} from "./wallet";

/*
 * Ventura SMS hisobi haqiqiy PostgreSQL'da (ADR 0056): qoldiq yetmasa band qilinmaydi va manfiyga tushmaydi; to'lov
 * tasdiqlangach qismlar tushadi, so'rov ikki marta tasdiqlanmaydi; yetkazilmagan xabar qismlari bir marta qaytadi;
 * Eskiz boshqa qism sonini aytsa farqi tuzatiladi; har harakat jurnalda. TENANT_TEST_ADMIN_URL berilmasa o'tkaziladi.
 */

const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "ventura_sms_wallet_test";
const MIGRATIONS = fileURLToPath(new URL("../../../../../packages/db/migrations/panel", import.meta.url));

let db: PanelDb;
let projectId = "";
let packageId = "";

const url = () => {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  return u.toString();
};

const entries = () => db.select().from(smsWalletEntries).where(eq(smsWalletEntries.projectId, projectId));

describe.skipIf(!ADMIN_URL)("SMS hisobi (haqiqiy PostgreSQL)", () => {
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
    const [c] = await db.insert(clients).values({ name: "Mijoz" }).returning();
    await db
      .insert(templates)
      .values({ key: "edu-crm", name: "Edu", category: "edu", appPath: "apps/edu-crm", version: "1", manifest: {} });
    const [p] = await db
      .insert(projects)
      .values({
        clientId: c!.id,
        templateKey: "edu-crm",
        slug: "alfa",
        name: "Alfa",
        brand: { primary: "#3f6df6", appearance: "light" } as never,
      })
      .returning();
    projectId = p!.id;
    const [pkg] = await db.insert(smsPackages).values({ name: "Start", parts: 100, price: 9000 }).returning();
    packageId = pkg!.id;
  }, 60_000);

  afterAll(async () => {
    await db?.$client.end();
  });

  it("qoldiq yo'q — band qilinmaydi", async () => {
    expect(await reserve(db, projectId, 1)).toBe(false);
    expect(await walletBalance(db, projectId)).toBe(0);
  });

  it("to'lov tasdiqlansa qismlar tushadi, ikkinchi marta tasdiqlanmaydi", async () => {
    const req = await requestPurchase(db, projectId, packageId, "Xodim");
    expect(req).not.toBeNull();
    expect(await decidePurchase(db, req!.id, true, null as never)).toEqual({ projectId, parts: 100 });
    expect(await decidePurchase(db, req!.id, true, null as never)).toBeNull();
    expect(await walletBalance(db, projectId)).toBe(100);
    // Bekor qilingan so'rov qism qo'shmaydi
    const other = await requestPurchase(db, projectId, packageId, "Xodim");
    await decidePurchase(db, other!.id, false, null as never);
    expect(await walletBalance(db, projectId)).toBe(100);
  });

  it("band qilish, qaytarish va yetkazish natijasi", async () => {
    expect(await reserve(db, projectId, 2)).toBe(true);
    expect(await walletBalance(db, projectId)).toBe(98);
    // Eskiz qabul qilmadi — qaytadi
    await release(db, projectId, 2, "Eskiz xatosi");
    expect(await walletBalance(db, projectId)).toBe(100);

    // Qabul qildi, keyin yetkazilmadi — bir marta qaytadi
    await reserve(db, projectId, 1);
    await recordSent(db, projectId, "p-1", 1);
    await settle(db, projectId, "p-1", "failed", null);
    await settle(db, projectId, "p-1", "failed", null);
    expect(await walletBalance(db, projectId)).toBe(100);

    // Yetkazildi, lekin Eskiz 3 qism dedi (1 band qilingan edi) — farqi yechiladi
    await reserve(db, projectId, 1);
    await recordSent(db, projectId, "p-2", 1);
    await settle(db, projectId, "p-2", "delivered", 3);
    expect(await walletBalance(db, projectId)).toBe(97);
    // Oraliq holat hech narsani o'zgartirmaydi
    await settle(db, projectId, "p-2", "pending", null);
    expect(await walletBalance(db, projectId)).toBe(97);
  });

  it("qo'lda tuzatish manfiyga tushirmaydi; har harakat jurnalda", async () => {
    expect(await adjustWallet(db, projectId, -1000, "xato", null as never)).toBe(false);
    expect(await adjustWallet(db, projectId, -7, "tuzatish", null as never)).toBe(true);
    expect(await walletBalance(db, projectId)).toBe(90);
    const rows = await entries();
    expect(rows.reduce((s, r) => s + r.delta, 0)).toBe(90);
    expect(rows.map((r) => r.kind).sort()).toEqual(
      ["adjust", "purchase", "refund", "refund", "send", "send", "send", "send"].sort(),
    );
  });
});
