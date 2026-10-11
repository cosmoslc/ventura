import { describe, expect, it } from "vitest";
import { type TemplateModule, dependentsOf, parseManifest, withRequirements } from "./manifest";

const mod: TemplateModule = {
  template: { key: "edu-crm", name: "O'quv markaz", category: "Ta'lim", version: "0.1.0" },
  features: [
    { key: "students", name: "O'quvchilar", group: "Asos", type: "permanent" },
    { key: "groups", name: "Guruhlar", group: "Asos", type: "core", requires: ["students"] },
    { key: "holidays", name: "Dam olish", group: "Davomat", type: "regular" },
    { key: "attendance", name: "Davomat", group: "Davomat", type: "regular", requires: ["groups", "holidays"] },
    { key: "coins", name: "Coinlar", group: "O'quv", type: "regular", requires: ["students"] },
  ],
};

describe("shablon manifesti", () => {
  it("to'g'ri manifest o'qiladi va standart qiymatlar qo'yiladi", () => {
    const { features } = parseManifest(mod);
    expect(features).toHaveLength(5);
    expect(features[0]!.requires).toEqual([]);
  });

  it("noma'lum bog'liqlikni rad etadi", () => {
    const bad = { ...mod, features: [{ key: "a", name: "A", group: "G", type: "regular" as const, requires: ["x"] }] };
    expect(() => parseManifest(bad)).toThrow(/noma'lum/);
  });

  it("takrorlangan kalitni rad etadi", () => {
    const f = { key: "a", name: "A", group: "G", type: "regular" as const };
    expect(() => parseManifest({ ...mod, features: [f, f] })).toThrow(/takrorlangan/);
  });

  it("bog'liqlik halqasini rad etadi", () => {
    const features = [
      { key: "a", name: "A", group: "G", type: "regular" as const, requires: ["b"] },
      { key: "b", name: "B", group: "G", type: "regular" as const, requires: ["a"] },
    ];
    expect(() => parseManifest({ ...mod, features })).toThrow(/halqasi/);
  });

  it("bo'lim yoqilganda kerakli bo'limlar ham (tranzitiv) va doimiylar yoqiladi", () => {
    const { features } = parseManifest(mod);
    expect([...withRequirements(features, ["attendance"])].sort()).toEqual(
      ["attendance", "groups", "holidays", "students"].sort(),
    );
  });

  it("bo'lim o'chirilganda unga tayanadiganlar ro'yxati", () => {
    const { features } = parseManifest(mod);
    expect(dependentsOf(features, "students").sort()).toEqual(["attendance", "coins", "groups"].sort());
    expect(dependentsOf(features, "holidays")).toEqual(["attendance"]);
  });
});
