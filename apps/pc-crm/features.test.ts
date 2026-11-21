import { describe, expect, it } from "vitest";
import { parseManifest } from "@ventura/tenants";
import { features, template } from "./features";

describe("pc-crm features manifest", () => {
  it("manifest to'g'ri va xatolarsiz parse bo'ladi", () => {
    const parsed = parseManifest({ template, features });
    expect(parsed.template.key).toBe("pc-crm");
    expect(parsed.features.length).toBe(features.length);
  });

  it("bog'liqliklar mavjud bo'limlarga ishora qiladi va halqa yo'q", () => {
    const keys = new Set(features.map((f) => f.key));
    for (const f of features) {
      for (const r of f.requires ?? []) {
        expect(keys.has(r), `${f.key} dagi ${r} mavjud bo'lishi kerak`).toBe(true);
      }
    }
  });
});
