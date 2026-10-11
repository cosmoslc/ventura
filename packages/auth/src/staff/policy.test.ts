import { describe, expect, it } from "vitest";
import { branchScope, can, inScope } from "./policy";

describe("xodim ruxsatlari", () => {
  it("direktor hamma narsani qila oladi", () => {
    expect(can("director", "salaries.write")).toBe(true);
    expect(can("director", "staff.manage")).toBe(true);
    expect(can("director", "settings.manage")).toBe(true);
  });

  it("menejer o'quv jarayoni va to'lovlar bilan ishlaydi, ish haqi va xodimlarga yopiq", () => {
    expect(can("manager", "students.write")).toBe(true);
    expect(can("manager", "payments.write")).toBe(true);
    expect(can("manager", "salaries.view")).toBe(false);
    expect(can("manager", "expenses.view")).toBe(false);
    expect(can("manager", "staff.manage")).toBe(false);
    expect(can("manager", "settings.manage")).toBe(false);
  });

  it("kassir faqat pul bo'limlarida yozadi, o'quvchi va guruhlarni ko'radi", () => {
    expect(can("cashier", "payments.write")).toBe(true);
    expect(can("cashier", "expenses.write")).toBe(true);
    expect(can("cashier", "students.view")).toBe(true);
    expect(can("cashier", "students.write")).toBe(false);
    expect(can("cashier", "leads.view")).toBe(false);
    expect(can("cashier", "salaries.view")).toBe(false);
  });

  it("kuzatuvchi faqat ko'radi", () => {
    expect(can("viewer", "students.view")).toBe(true);
    expect(can("viewer", "students.write")).toBe(false);
    expect(can("viewer", "salaries.view")).toBe(false);
  });

  it("bo'lim kalitida nuqta bo'lsa ham amal oxirgi qismdan olinadi", () => {
    expect(can("viewer", "reports.finance.view")).toBe(true);
    expect(can("viewer", "reports.finance.write")).toBe(false);
  });
});

describe("filial bo'yicha cheklov", () => {
  it("direktor barcha filiallarni ko'radi", () => {
    expect(branchScope("director", [])).toBe("all");
    expect(inScope("all", "b1")).toBe(true);
  });

  it("qolganlar faqat biriktirilgan filiallarni", () => {
    const scope = branchScope("manager", ["b1", "b2", "b1"]);
    expect(scope).toEqual(["b1", "b2"]);
    expect(inScope(scope, "b2")).toBe(true);
    expect(inScope(scope, "b3")).toBe(false);
    expect(inScope(scope, null)).toBe(false);
    expect(inScope(branchScope("cashier", []), "b1")).toBe(false);
  });
});
