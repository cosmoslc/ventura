import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type StaffDeps,
  deviceHash,
  endOtherSessions,
  findStaffById,
  isDeviceBlocked,
  onStaffLoginSuccess,
} from "@ventura/auth/staff";
import { type TenantDb, createTenantDb } from "@ventura/db";
import { migrateTenantDb } from "@ventura/db/migrate";
import { knownDevices, sessions, users } from "@ventura/db/schema/tenant";
import { deviceOwners, listDevices, ownDevices, setDeviceBlocked } from "./devices";

/*
 * Qurilmalar haqiqiy PostgreSQL'da (E6g, ADR 0040): bloklangan qurilmadan kirish rad etiladi (kirishlar soni
 * oshmaydi), ochilgach yana kiradi; boshqa xodim va boshqa mijoz qurilmasiga ta'sir qilmaydi; direktor o'z
 * qurilmasini bloklay olmaydi; bloklash ochiq sessiyalarni yopadi; "boshqa seanslarni yopish" joriysini qoldiradi.
 * TENANT_TEST_ADMIN_URL berilmasa o'tkazib yuboriladi.
 */

// Joriy sessiya — sessions.id uuid ustuni; bazada bunday sessiya yo'q (hech biri istisno qilinmaydi)
const ACTOR_SESSION = "00000000-0000-4000-8000-000000000000";
const ADMIN_URL = process.env.TENANT_TEST_ADMIN_URL ?? "";
const DB = "edu_devices_test";
const ROLE = "edu_devices_app";
const UA_A = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
const UA_B = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";

function appUrl() {
  const u = new URL(ADMIN_URL);
  u.pathname = `/${DB}`;
  u.username = ROLE;
  u.password = ROLE;
  return u.toString();
}

let db: TenantDb;
let other: TenantDb;
let deps: StaffDeps;
let phoneSeq = 0;
let tokenSeq = 0;
const ids = { director: "", director2: "", staff: "", otherStaff: "" };

async function mk(target: TenantDb, name: string, role: "director" | "staff") {
  const [u] = await target
    .insert(users)
    .values({
      name,
      email: `${name}@devices.local`,
      role,
      phoneNumber: `+998905560${String(++phoneSeq).padStart(3, "0")}`,
    })
    .returning();
  return u!.id;
}

async function login(userId: string, deviceId: string, userAgent = UA_A) {
  const user = (await findStaffById(deps.db, userId))!;
  return onStaffLoginSuccess(deps, user, { ip: "10.0.0.1", userAgent, deviceId });
}

async function openSession(userId: string, userAgent: string) {
  const [s] = await db
    .insert(sessions)
    .values({ userId, userAgent, token: `tok-${++tokenSeq}`, expiresAt: new Date(Date.now() + 3_600_000) })
    .returning();
  return s!.id;
}

const deviceOf = async (userId: string, deviceId: string) => {
  const [row] = await db
    .select()
    .from(knownDevices)
    .where(eq(knownDevices.deviceHash, deviceHash(deviceId)));
  expect(row?.userId).toBe(userId);
  return row!;
};

describe.skipIf(!ADMIN_URL)("qurilmalar (haqiqiy PostgreSQL)", () => {
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
    deps = { db, telegram: null, appName: "Alfa" };
    ids.director = await mk(db, "Direktor", "director");
    ids.director2 = await mk(db, "Direktor 2", "director");
    ids.staff = await mk(db, "Xodim", "staff");
    ids.otherStaff = await mk(other, "Beta xodimi", "staff");
  }, 60_000);

  afterAll(async () => {
    await db?.close();
    await other?.close();
  });

  it("birinchi kirish qurilmani yozadi, keyingilari kirishlar sonini oshiradi", async () => {
    expect(await login(ids.staff, "dev-s1")).toEqual({ blocked: false });
    let row = await deviceOf(ids.staff, "dev-s1");
    expect(row.loginCount).toBe(1);
    expect(row.deviceName).toBe("Chrome · Windows");
    expect(row.blockedAt).toBeNull();
    await login(ids.staff, "dev-s1");
    row = await deviceOf(ids.staff, "dev-s1");
    expect(row.loginCount).toBe(2);
  });

  it("bloklangan qurilmadan kirish rad etiladi va sanalmaydi; ochilgach yana kiradi", async () => {
    const row = await deviceOf(ids.staff, "dev-s1");
    const before = row.loginCount;
    const r = await setDeviceBlocked(db, {
      id: row.id,
      blocked: true,
      actorId: ids.director,
      actorSessionId: ACTOR_SESSION,
      currentDeviceId: "dir-dev",
    });
    expect(r.ok).toBe(true);
    expect(await isDeviceBlocked(db, ids.staff, "dev-s1")).toBe(true);

    expect(await login(ids.staff, "dev-s1")).toEqual({ blocked: true });
    const after = await deviceOf(ids.staff, "dev-s1");
    expect(after.loginCount).toBe(before);
    expect(after.blockedBy).toBe(ids.director);

    // Boshqa qurilma o'sha xodim uchun ishlayveradi
    expect(await login(ids.staff, "dev-s2", UA_B)).toEqual({ blocked: false });
    expect(await isDeviceBlocked(db, ids.staff, "dev-s2")).toBe(false);
    // Cookie yo'q — aniqlab bo'lmaydi, bloklanmagan hisoblanadi
    expect(await isDeviceBlocked(db, ids.staff, null)).toBe(false);

    const un = await setDeviceBlocked(db, {
      id: row.id,
      blocked: false,
      actorId: ids.director,
      actorSessionId: ACTOR_SESSION,
      currentDeviceId: "dir-dev",
    });
    expect(un.ok).toBe(true);
    expect(await isDeviceBlocked(db, ids.staff, "dev-s1")).toBe(false);
    expect(await login(ids.staff, "dev-s1")).toEqual({ blocked: false });
  });

  it("blok boshqa xodimning o'sha cookie'li qurilmasiga tegmaydi", async () => {
    // Bitta brauzerdan ikki xodim kirgan: xeshi bir xil, qatorlari alohida
    await login(ids.director2, "shared-dev");
    await login(ids.staff, "shared-dev");
    const [staffRow] = (await db.select().from(knownDevices).where(eq(knownDevices.userId, ids.staff))).filter(
      (r) => r.deviceHash === deviceHash("shared-dev"),
    );
    await setDeviceBlocked(db, {
      id: staffRow!.id,
      blocked: true,
      actorId: ids.director,
      actorSessionId: ACTOR_SESSION,
      currentDeviceId: "dir-dev",
    });
    expect(await isDeviceBlocked(db, ids.staff, "shared-dev")).toBe(true);
    expect(await isDeviceBlocked(db, ids.director2, "shared-dev")).toBe(false);
  });

  it("direktor o'zi ishlayotgan qurilmani bloklay olmaydi; aniqlanmasa o'z qurilmalarini ham", async () => {
    await login(ids.director, "dir-dev");
    const mine = await deviceOf(ids.director, "dir-dev");
    const self = { id: mine.id, blocked: true, actorId: ids.director, actorSessionId: ACTOR_SESSION };
    expect(await setDeviceBlocked(db, { ...self, currentDeviceId: "dir-dev" })).toMatchObject({
      ok: false,
      failure: "self",
    });
    expect(await setDeviceBlocked(db, { ...self, currentDeviceId: null })).toMatchObject({
      ok: false,
      failure: "self",
    });
    expect(await isDeviceBlocked(db, ids.director, "dir-dev")).toBe(false);

    // O'z hisobining boshqa qurilmasini bloklasa bo'ladi (joriysi bilan qulflanmaydi)
    await login(ids.director, "dir-phone", UA_B);
    const phone = await deviceOf(ids.director, "dir-phone");
    expect(
      await setDeviceBlocked(db, {
        id: phone.id,
        blocked: true,
        actorId: ids.director,
        actorSessionId: ACTOR_SESSION,
        currentDeviceId: "dir-dev",
      }),
    ).toMatchObject({ ok: true });
  });

  it("bloklash xodimning shu brauzer belgisidagi sessiyalarini yopadi, boshqasini emas", async () => {
    await login(ids.staff, "dev-s3", UA_B);
    const phone = await deviceOf(ids.staff, "dev-s3");
    const onPhone = await openSession(ids.staff, UA_B);
    const onPc = await openSession(ids.staff, UA_A);
    const r = await setDeviceBlocked(db, {
      id: phone.id,
      blocked: true,
      actorId: ids.director,
      actorSessionId: ACTOR_SESSION,
      currentDeviceId: "dir-dev",
    });
    expect(r.endedSessions).toBe(1);
    const left = (await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, ids.staff))).map(
      (s) => s.id,
    );
    expect(left).toContain(onPc);
    expect(left).not.toContain(onPhone);
  });

  it("holat o'zgarmagan yoki yozuv yo'q bo'lsa — rad", async () => {
    const row = await deviceOf(ids.staff, "dev-s3");
    const input = { actorId: ids.director, actorSessionId: ACTOR_SESSION, currentDeviceId: "dir-dev" };
    expect(await setDeviceBlocked(db, { ...input, id: row.id, blocked: true })).toMatchObject({
      failure: "unchanged",
    });
    expect(
      await setDeviceBlocked(db, { ...input, id: "00000000-0000-4000-8000-000000000000", blocked: true }),
    ).toMatchObject({ failure: "not_found" });
  });

  it("ro'yxat: filtr (xodim, holat), qidiruv, joriy qurilma belgisi; boshqa mijoz ko'rinmaydi", async () => {
    const all = await listDevices(db, {}, "dir-dev");
    expect(all.rows.every((r) => r.userId !== ids.otherStaff)).toBe(true);
    expect(all.rows.find((r) => r.userId === ids.director && r.current)).toBeTruthy();
    const blocked = await listDevices(db, { status: "blocked" }, null);
    expect(blocked.rows.length).toBeGreaterThan(0);
    expect(blocked.rows.every((r) => r.blockedAt && r.blockedByName === "Direktor")).toBe(true);
    const active = await listDevices(db, { status: "active" }, null);
    expect(active.rows.every((r) => !r.blockedAt)).toBe(true);
    expect(active.total + blocked.total).toBe(all.total);
    const byStaff = await listDevices(db, { userId: ids.staff }, null);
    expect(byStaff.rows.every((r) => r.userId === ids.staff)).toBe(true);
    const search = await listDevices(db, { q: "xodim" }, null);
    expect(search.rows.length).toBeGreaterThan(0);
    expect(search.rows.every((r) => r.userName === "Xodim")).toBe(true);
    expect((await listDevices(db, { q: "10.0.0.1" }, null)).total).toBe(all.total);
    expect((await listDevices(db, { q: "%" }, null)).total).toBe(0);

    await login(ids.director, "dir-dev"); // o'z bazasida
    const owners = await deviceOwners(db);
    expect(owners.map((o) => o.id)).not.toContain(ids.otherStaff);
    expect((await listDevices(other, {}, null)).rows).toEqual([]);
  });

  it("boshqa mijoz qurilmasini bloklay olmaydi", async () => {
    await onStaffLoginSuccess(
      { db: other, telegram: null, appName: "Beta" },
      (await findStaffById(other, ids.otherStaff))!,
      { ip: "10.0.0.9", userAgent: UA_A, deviceId: "beta-dev" },
    );
    const [row] = await other.select().from(knownDevices);
    const r = await setDeviceBlocked(db, {
      id: row!.id,
      blocked: true,
      actorId: ids.director,
      actorSessionId: ACTOR_SESSION,
      currentDeviceId: "dir-dev",
    });
    expect(r.failure).toBe("not_found");
    expect(await isDeviceBlocked(other, ids.otherStaff, "beta-dev")).toBe(false);
  });

  it("o'z qurilmalari va boshqa seanslarni yopish: joriysi qoladi", async () => {
    const mine = await openSession(ids.director2, UA_A);
    await openSession(ids.director2, UA_B);
    await openSession(ids.director2, UA_B);
    const own = await ownDevices(db, ids.director2, "shared-dev");
    expect(own.sessionCount).toBe(3);
    expect(own.devices.find((d) => d.current)).toBeTruthy();
    expect(await endOtherSessions(db, ids.director2, mine)).toBe(2);
    expect((await ownDevices(db, ids.director2, null)).sessionCount).toBe(1);
    // Boshqa xodim sessiyalariga tegmaydi
    expect((await ownDevices(db, ids.staff, null)).sessionCount).toBeGreaterThan(0);
  });
});
