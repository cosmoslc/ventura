// Muallif / Agent: Google Gemini
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  const envPath = resolve(process.cwd(), "../../.env");
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
});

import { checkCrmSlugAvailability, checkTrialProvisionStatus } from "./actions";

describe("checkCrmSlugAvailability", () => {
  it("bo'sh yoki qisqa subdomenni rad etadi", async () => {
    const resEmpty = await checkCrmSlugAvailability("");
    expect(resEmpty.available).toBe(false);
    expect(resEmpty.error).toContain("Subdomen");

    const resShort = await checkCrmSlugAvailability("ab");
    expect(resShort.available).toBe(false);
    expect(resShort.error).toContain("kamida 3 ta");
  });

  it("tizim tomonidan band qilingan (reserved) subdomenlarni rad etadi", async () => {
    const reserved = ["admin", "crm", "panel", "api", "app", "auth", "login", "www", "mail", "storage"];
    for (const r of reserved) {
      const res = await checkCrmSlugAvailability(r);
      expect(res.available).toBe(false);
      expect(res.error).toContain("tizim tomonidan band qilingan");
    }
  });

  it("noto'g'ri belgilarni rad etadi", async () => {
    const invalid = ["sub domain", "markaz_crm", "markaz!", "-boshida", "oxirida-"];
    for (const inv of invalid) {
      const res = await checkCrmSlugAvailability(inv);
      expect(res.available).toBe(false);
    }
  });

  it("mavjud band subdomenni (cosmos) rad etadi", async () => {
    const res = await checkCrmSlugAvailability("cosmos");
    expect(res.available).toBe(false);
    expect(res.error).toContain("band qilingan");
  });

  it("yangi to'g'ri subdomenga ruxsat beradi", async () => {
    const uniqueSlug = `sinov-${Date.now()}`;
    const res = await checkCrmSlugAvailability(uniqueSlug);
    expect(res.available).toBe(true);
    expect(res.error).toBeUndefined();
  });
});

describe("checkTrialProvisionStatus", () => {
  it("noto'g'ri yoki bo'sh slug uchun xatolik qaytaradi", async () => {
    const resEmpty = await checkTrialProvisionStatus({ slug: "" });
    expect(resEmpty.ok).toBe(false);
    expect((resEmpty as { error: string }).error).toContain("Noto'g'ri");

    const resInvalid = await checkTrialProvisionStatus({ slug: "invalid slug!" });
    expect(resInvalid.ok).toBe(false);
  });

  it("mavjud bo'lmagan loyiha uchun loyiha topilmadi deb qaytaradi", async () => {
    const res = await checkTrialProvisionStatus({ slug: "nonexistent-center-12345" });
    expect(res.ok).toBe(false);
    expect((res as { error: string }).error).toContain("topilmadi");
  });
});
