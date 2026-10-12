import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  POSITION_TEMPLATES,
  accessFor,
  branchScope,
  can,
  canAny,
  inScope,
  normalizePermissions,
} from "./policy";

describe("ruxsatlar katalogi", () => {
  it("eski tizimdagidek 11 toifa, 69 ruxsat, takrorsiz", () => {
    expect(PERMISSION_CATEGORIES).toHaveLength(11);
    expect(ALL_PERMISSIONS).toHaveLength(69);
    expect(new Set(ALL_PERMISSIONS).size).toBe(69);
  });

  it("7 ta shablon; faqat Bosh Direktor tizim lavozimi va unda hamma ruxsat", () => {
    expect(POSITION_TEMPLATES.map((t) => t.code)).toEqual([
      "super_admin",
      "branch_manager",
      "senior_admin",
      "teacher",
      "accountant",
      "sales_lead_manager",
      "hr_manager",
    ]);
    expect(POSITION_TEMPLATES.filter((t) => t.system).map((t) => t.code)).toEqual(["super_admin"]);
    expect(POSITION_TEMPLATES[0]!.permissions).toHaveLength(69);
    expect(POSITION_TEMPLATES[1]!.permissions).toHaveLength(66);
    for (const t of POSITION_TEMPLATES) for (const p of t.permissions) expect(ALL_PERMISSIONS).toContain(p);
  });

  it("noma'lum ruxsatlar tashlanadi, tartib katalogdagidek", () => {
    expect(normalizePermissions(["staff.view", "yoq.narsa", "dashboard.view", "staff.view"])).toEqual([
      "dashboard.view",
      "staff.view",
    ]);
  });
});

describe("xodim ruxsatlari", () => {
  it("direktor hamma narsani qila oladi", () => {
    const d = accessFor("director", null);
    expect(can(d, "settings.roles_permissions")).toBe(true);
    expect(can(d, "archive.permanent_delete")).toBe(true);
  });

  it("xodim faqat lavozimidagi ruxsatlarni oladi", () => {
    const a = accessFor("staff", ["students.view", "students.create"]);
    expect(can(a, "students.create")).toBe(true);
    expect(can(a, "students.delete")).toBe(false);
    expect(canAny(a, ["groups.view", "students.view"])).toBe(true);
    expect(canAny(a, ["groups.view"])).toBe(false);
  });

  it("lavozimsiz eski xodim: menejer — Filial menejeri, kassir — Buxgalter, kuzatuvchi — faqat ko'rish", () => {
    expect(can(accessFor("manager", null), "students.create")).toBe(true);
    expect(can(accessFor("manager", null), "settings.roles_permissions")).toBe(false);
    expect(can(accessFor("cashier", null), "finance.payment_create")).toBe(true);
    expect(can(accessFor("cashier", null), "students.create")).toBe(false);
    expect(can(accessFor("viewer", null), "students.view")).toBe(true);
    expect(can(accessFor("viewer", null), "students.create")).toBe(false);
    expect(can(accessFor("staff", null), "students.view")).toBe(false);
  });
});

describe("filial bo'yicha cheklov", () => {
  it("direktor barcha filiallarni ko'radi", () => {
    expect(branchScope(true, [])).toBe("all");
    expect(inScope("all", "b1")).toBe(true);
  });

  it("qolganlar faqat biriktirilgan filiallarni", () => {
    const scope = branchScope(false, ["b1", "b2", "b1"]);
    expect(scope).toEqual(["b1", "b2"]);
    expect(inScope(scope, "b2")).toBe(true);
    expect(inScope(scope, "b3")).toBe(false);
    expect(inScope(scope, null)).toBe(false);
  });
});
