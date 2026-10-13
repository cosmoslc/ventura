import { describe, expect, it } from "vitest";
import { type PlanScope, type SpendEntry, planMatches, planState, planUsage, plansTotal } from "./expense-plans";

const plan: PlanScope = {
  branchId: "b1",
  categoryId: "rent",
  month: "2026-10",
  amount: 1_000_000,
  methodId: null,
  userId: null,
  teacherId: null,
};

const spend = (over: Partial<SpendEntry> = {}): SpendEntry => ({
  branchId: "b1",
  categoryId: "rent",
  date: "2026-10-05",
  amount: 100_000,
  methodId: "cash",
  userId: null,
  teacherId: null,
  voided: false,
  ...over,
});

describe("planMatches", () => {
  it("filial, toifa va oy mos kelishi kerak", () => {
    expect(planMatches(plan, spend())).toBe(true);
    expect(planMatches(plan, spend({ branchId: "b2" }))).toBe(false);
    expect(planMatches(plan, spend({ categoryId: "ads" }))).toBe(false);
    expect(planMatches(plan, spend({ date: "2026-09-30" }))).toBe(false);
    expect(planMatches(plan, spend({ date: "2026-11-01" }))).toBe(false);
    expect(planMatches(plan, spend({ date: "2026-10-31" }))).toBe(true);
  });

  it("bekor qilingan xarajat rejaga tushmaydi", () => {
    expect(planMatches(plan, spend({ voided: true }))).toBe(false);
  });

  it("to'lov usuli tanlangan rejada faqat shu usul", () => {
    const p = { ...plan, methodId: "card" };
    expect(planMatches(p, spend({ methodId: "card" }))).toBe(true);
    expect(planMatches(p, spend({ methodId: "cash" }))).toBe(false);
  });

  it("xodim tanlangan rejada faqat shu xodim (id bo'yicha), o'qituvchi alohida", () => {
    const p = { ...plan, userId: "u1" };
    expect(planMatches(p, spend({ userId: "u1" }))).toBe(true);
    expect(planMatches(p, spend({ userId: "u2" }))).toBe(false);
    expect(planMatches(p, spend())).toBe(false);
    const t = { ...plan, teacherId: "t1" };
    expect(planMatches(t, spend({ teacherId: "t1" }))).toBe(true);
    expect(planMatches(t, spend({ userId: "t1" }))).toBe(false);
  });
});

describe("planUsage", () => {
  it("sarf, qoldiq va foiz", () => {
    const u = planUsage(plan, [
      spend({ amount: 300_000 }),
      spend({ amount: 200_000 }),
      spend({ amount: 999_999, voided: true }),
      spend({ amount: 50_000, categoryId: "ads" }),
    ]);
    expect(u).toEqual({ spent: 500_000, count: 2, percent: 50, remaining: 500_000, state: "ok" });
  });

  it("80% dan sariq, limitdan oshsa qizil", () => {
    expect(planUsage(plan, [spend({ amount: 799_999 })]).state).toBe("ok");
    expect(planUsage(plan, [spend({ amount: 800_000 })]).state).toBe("near");
    expect(planUsage(plan, [spend({ amount: 1_000_000 })]).state).toBe("near");
    const over = planUsage(plan, [spend({ amount: 1_004_000 })]);
    // Yaxlitlangan foiz 100, lekin limitdan oshgan — qizil (eski tizimda sariq edi)
    expect(over).toMatchObject({ percent: 100, remaining: -4_000, state: "over" });
  });

  it("sarf yo'q", () => {
    expect(planUsage(plan, [])).toEqual({ spent: 0, count: 0, percent: 0, remaining: 1_000_000, state: "ok" });
  });
});

describe("plansTotal", () => {
  it("rejalar yig'indisi", () => {
    const a = { amount: 1_000_000, usage: planUsage(plan, [spend({ amount: 900_000 })]) };
    const b = { amount: 500_000, usage: planUsage({ ...plan, categoryId: "ads", amount: 500_000 }, []) };
    expect(plansTotal([a, b])).toEqual({ planned: 1_500_000, spent: 900_000, percent: 60, state: "ok" });
    expect(plansTotal([])).toEqual({ planned: 0, spent: 0, percent: 0, state: "ok" });
  });

  it("planState chegaralari", () => {
    expect(planState(0, 0)).toBe("ok");
    expect(planState(1, 0)).toBe("over");
  });
});
