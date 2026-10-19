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
  isApprovable,
  normalizePermissions,
  permissionState,
} from "./policy";

describe("ruxsatlar katalogi", () => {
  it("11 toifa, 70 ruxsat (eski 69 + settings.coins, ADR 0061), takrorsiz", () => {
    expect(PERMISSION_CATEGORIES).toHaveLength(11);
    expect(ALL_PERMISSIONS).toHaveLength(70);
    expect(new Set(ALL_PERMISSIONS).size).toBe(70);
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
    expect(POSITION_TEMPLATES[0]!.permissions).toHaveLength(70);
    expect(POSITION_TEMPLATES[1]!.permissions).toHaveLength(67);
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

describe("tasdiq bilan (ADR 0019)", () => {
  it("ko'rish, eksport, chop etish, panel va ruxsatlarni boshqarish tasdiq bilan bo'lmaydi", () => {
    expect(isApprovable("finance.payment_create")).toBe(true);
    expect(isApprovable("students.delete")).toBe(true);
    expect(isApprovable("finance.payment_view")).toBe(false);
    expect(isApprovable("groups.attendance_view")).toBe(false);
    expect(isApprovable("attendance.export")).toBe(false);
    expect(isApprovable("finance.payment_receipt_print")).toBe(false);
    expect(isApprovable("dashboard.financial_stats")).toBe(false);
    expect(isApprovable("settings.roles_permissions")).toBe(false);
    expect(isApprovable("staff.roles_assign")).toBe(false);
    expect(isApprovable("noma'lum")).toBe(false);
  });

  it("boshqa lavozimi to'liq ruxsat bergan bo'lsa tasdiq kerak emas; tasdiqqa yaroqsizlari tushib qoladi", () => {
    const a = accessFor(
      "staff",
      ["finance.payment_create"],
      ["finance.payment_create", "finance.payment_delete", "finance.payment_view"],
    );
    expect([...a.approvals]).toEqual(["finance.payment_delete"]);
    expect(permissionState(a, ["finance.payment_create"])).toBe("allow");
    expect(permissionState(a, ["finance.payment_delete"])).toBe("approval");
    expect(permissionState(a, ["finance.payment_edit"])).toBe("deny");
    expect(permissionState(accessFor("director", null), ["finance.payment_edit"])).toBe("allow");
  });
});
