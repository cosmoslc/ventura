import { beforeEach, describe, expect, it } from "vitest";
import { TENANT_POOL, closeTenantClients, createTenantDb } from "./tenant";

/*
 * Mijoz bazasi pul chegaralari (ADR 0060): bo'sh ulanish yopiladi, ulanish umri cheklangan, bitta mijozga oz ulanish.
 * Ulanish birinchi so'rovda ochiladi — bu test bazaga ulanmaydi.
 */

const URL = "postgres://app:app@127.0.0.1:1/edu";

describe("mijoz bazasi puli", () => {
  beforeEach(async () => {
    await closeTenantClients();
  });
  it("standart: max 10, bo'sh ulanish 30 soniyada, umri 30 daqiqada yopiladi", () => {
    const db = createTenantDb(URL, "alfa");
    expect(db.$client.options).toMatchObject({ max: 10, idle_timeout: 30, max_lifetime: 1800 });
    expect(TENANT_POOL).toEqual({ max: 10, idleTimeoutSec: 30, maxLifetimeSec: 1800 });
  });

  it("chegaralarni chaqiruvchi o'zgartira oladi (skriptlar, testlar)", () => {
    const db = createTenantDb(URL, "alfa", { max: 1, idleTimeoutSec: 5, maxLifetimeSec: 60 });
    expect(db.$client.options).toMatchObject({ max: 1, idle_timeout: 5, max_lifetime: 60 });
  });

  it("manzil yoki mijoz berilmasa ulanish yaratilmaydi", () => {
    expect(() => createTenantDb("", "alfa")).toThrow();
    expect(() => createTenantDb(URL, "")).toThrow();
  });
});
