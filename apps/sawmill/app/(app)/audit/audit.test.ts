import { describe, expect, it } from "vitest";
import { createSawmillDb } from "@ventura/db";
import { tenantAudit } from "@ventura/security";

// Haqiqiy PostgreSQL (sawmill sxemasi migratsiya qilingan); berilmasa test o'tkazib yuboriladi
const DB_URL = process.env.SAWMILL_TEST_DATABASE_URL ?? "";

describe.skipIf(!DB_URL)("faoliyat jurnali (audit log) va xesh zanjiri (S6)", () => {
  it("audit yozuvlarini qayd etish va xesh zanjiri butunligini tekshirish to'g'ri ishlaydi", async () => {
    const db = createSawmillDb(DB_URL, "pilorama");

    // 1. Audit yozuvi yozish
    const row = await tenantAudit.record(db, {
      actor: { type: "system", name: "Vitest S6" },
      action: "test.audit_event",
      target: { type: "system", id: "s6-test" },
      metadata: { test: true },
    });

    expect(row).toBeDefined();
    expect(row?.seq).toBeGreaterThan(0);

    // 2. Zanjir butunligini tekshirish
    const verdict = await tenantAudit.verify(db);
    expect(verdict.ok).toBe(true);
    if (verdict.ok) {
      expect(verdict.count).toBeGreaterThanOrEqual(1);
    }
  });
});
