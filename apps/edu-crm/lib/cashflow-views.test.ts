import { describe, expect, it } from "vitest";
import {
  barScale,
  barShare,
  flowHighlights,
  hasForecastGap,
  monthlyFlows,
  outflowBreakdown,
  planMonths,
  planPoints,
  shortMonth,
} from "./cashflow-views";
import type { DayFlow } from "./dashboard";
import { cashflowTable, planTable } from "./reports";

const flow = (date: string, kind: DayFlow["kind"], amount: number, category?: string): DayFlow => ({
  date,
  kind,
  amount,
  count: 1,
  category,
});

const FLOWS: DayFlow[] = [
  flow("2026-01-05", "pay", 1000),
  flow("2026-01-10", "income", 200),
  flow("2026-01-12", "expense", 300, "Ijara"),
  flow("2026-01-15", "salary", 400),
  flow("2026-02-03", "pay", 500),
  flow("2026-02-04", "expense", 100, "Ijara"),
  flow("2026-02-05", "expense", 50, "Reklama"),
  flow("2026-02-06", "advance", 150),
  flow("2026-02-07", "refund", 25),
  flow("2026-03-01", "pay", 9999),
];
const TODAY = "2026-02-20";

describe("monthlyFlows", () => {
  const m = monthlyFlows(FLOWS, 2026, TODAY);

  it("12 oy, kelmagan oylar null", () => {
    expect(m).toHaveLength(12);
    expect(m[2]).toMatchObject({ income: null, outflow: null, net: null, cumulative: null });
  });

  it("kirim, chiqim, sof va yig'ma qoldiq", () => {
    expect(m[0]).toMatchObject({ income: 1200, outflow: 700, net: 500, cumulative: 500 });
    expect(m[1]).toMatchObject({ income: 500, outflow: 325, net: 175, cumulative: 675 });
  });

  it("jadval bilan bir xil raqam", () => {
    const l = {
      label: "",
      total: "Jami",
      income: "",
      pay: "",
      extra: "",
      incomeTotal: "Jami kirim",
      outflow: "",
      salary: "",
      advance: "",
      refund: "",
      noCategory: "",
      outflowTotal: "Jami chiqim",
      net: "Sof",
      cumulative: "",
      months: Array.from({ length: 12 }, (_, i) => String(i)),
    };
    const t = cashflowTable(FLOWS, 2026, TODAY, l);
    const row = (label: string) => t.rows.find((r) => r.cells.label === label)!;
    expect(row("Jami kirim").cells.total).toBe(m.reduce((s, x) => s + (x.income ?? 0), 0));
    expect(row("Jami chiqim").cells.total).toBe(m.reduce((s, x) => s + (x.outflow ?? 0), 0));
  });

  it("boshqa yil — bo'sh", () => {
    expect(monthlyFlows(FLOWS, 2025, TODAY).every((x) => x.income === 0 && x.outflow === 0)).toBe(true);
    expect(monthlyFlows(FLOWS, 2027, TODAY).every((x) => x.income === null)).toBe(true);
  });
});

describe("outflowBreakdown", () => {
  const l = { noCategory: "Toifasiz", salaryAdvance: "Ish haqi", refund: "Qaytarish" };

  it("toifalar, ish haqi + avans va qaytarish; kamayish tartibida", () => {
    expect(outflowBreakdown(FLOWS, 2026, TODAY, l)).toEqual([
      ["Ish haqi", 550],
      ["Ijara", 400],
      ["Reklama", 50],
      ["Qaytarish", 25],
    ]);
  });

  it("toifasiz xarajat va bo'sh yil", () => {
    expect(outflowBreakdown([flow("2026-01-01", "expense", 5)], 2026, TODAY, l)).toEqual([["Toifasiz", 5]]);
    expect(outflowBreakdown(FLOWS, 2025, TODAY, l)).toEqual([]);
  });
});

describe("flowHighlights", () => {
  it("eng yuqori oylar va chiqim ulushi", () => {
    const h = flowHighlights(monthlyFlows(FLOWS, 2026, TODAY));
    expect(h.bestIncome).toEqual({ month: "2026-01", amount: 1200 });
    expect(h.bestOutflow).toEqual({ month: "2026-01", amount: 700 });
    expect(h.income).toBe(1700);
    expect(h.outflow).toBe(1025);
    expect(h.outflowShare).toBeCloseTo((1025 / 1700) * 100);
  });

  it("kirim yo'q — ulush null", () => {
    const h = flowHighlights(monthlyFlows([], 2026, TODAY));
    expect(h.bestIncome).toBeNull();
    expect(h.outflowShare).toBeNull();
  });
});

describe("reja ko'rinishi", () => {
  const input = {
    flows: FLOWS,
    plans: { payments: new Map([["2026-01", 2000]]) },
    expectedPayments: 700,
    today: TODAY,
  };
  const months = ["2026-01", "2026-02", "2026-03"];
  const pm = planMonths(months, input);

  it("oyma-oy jami planTable bilan mos", () => {
    const total = planTable(months, input);
    expect(pm.reduce((s, m) => s + m.income.forecast, 0)).toBe(total.income.forecast);
    expect(pm.reduce((s, m) => s + m.outflow.forecast, 0)).toBe(total.outflow.forecast);
  });

  it("grafik nuqtalari: prognoz faqat joriy va kelgusi oylarda", () => {
    const p = planPoints(pm, "income", TODAY);
    expect(p[0]).toEqual({ month: "2026-01", fact: 1200, plan: 2000, forecast: 0 });
    expect(p[1]!.forecast).toBeGreaterThanOrEqual(p[1]!.fact);
    expect(p[2]).toMatchObject({ fact: 0, plan: 0 });
    // 700 kutilgan to'lov + qo'shimcha daromadning oxirgi 3 oy o'rtachasi (200 / 3)
    expect(p[2]!.forecast).toBe(767);
  });

  it("shkala va ulushlar", () => {
    const cell = { plan: 200, fact: 50, forecast: 150 };
    expect(barScale([cell, { plan: null, fact: 300, forecast: 300 }])).toBe(300);
    const s = barShare(cell, 400);
    expect(s).toEqual({ fact: 12.5, forecast: 37.5, plan: 50 });
    expect(barShare({ plan: null, fact: null, forecast: 0 }, 0)).toEqual({ fact: 0, forecast: 0, plan: null });
    expect(barShare({ plan: 10, fact: 20, forecast: 5 }, 10).forecast).toBe(100);
  });

  it("prognoz farqi", () => {
    expect(hasForecastGap({ plan: null, fact: 100, forecast: 100 })).toBe(false);
    expect(hasForecastGap({ plan: null, fact: null, forecast: 100 })).toBe(true);
  });
});

describe("shortMonth", () => {
  it("iyun va iyul farqlanadi", () => {
    expect(shortMonth("Iyun")).toBe("Iyn");
    expect(shortMonth("Iyul")).toBe("Iyl");
    expect(shortMonth("Yanvar")).toBe("Yan");
  });
});
