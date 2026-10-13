import { describe, expect, it } from "vitest";
import {
  type DayFlow,
  compact,
  compactStr,
  kpiDelta,
  monthRange,
  pctOf,
  resolvePeriod,
  topWithOther,
  totalsFor,
} from "./dashboard";

const flows: DayFlow[] = [
  { date: "2026-09-30", kind: "pay", amount: 100_000, count: 1 },
  { date: "2026-10-01", kind: "pay", amount: 300_000, count: 2 },
  { date: "2026-10-05", kind: "income", amount: 50_000, count: 1 },
  { date: "2026-10-06", kind: "refund", amount: 20_000, count: 1 },
  { date: "2026-10-07", kind: "expense", amount: 70_000, count: 1, category: "Ijara" },
  { date: "2026-10-08", kind: "expense", amount: 30_000, count: 2, category: "Reklama" },
  { date: "2026-10-31", kind: "expense", amount: 10_000, count: 1, category: "Ijara" },
  { date: "2026-10-10", kind: "salary", amount: 40_000, count: 1 },
  { date: "2026-10-11", kind: "advance", amount: 15_000, count: 2 },
  { date: "2026-11-01", kind: "pay", amount: 999_000, count: 1 },
];

describe("totalsFor", () => {
  it("oy oralig'i: tushum = to'lov + qo'shimcha daromad, chiqim = xarajat + qaytarish + ish haqi", () => {
    expect(totalsFor(flows, monthRange("2026-10"))).toEqual({
      income: 350_000,
      expense: 110_000,
      refund: 20_000,
      salary: 55_000,
      advance: 15_000,
      advanceCount: 2,
      outflow: 185_000,
      profit: 165_000,
      payCount: 2,
      categories: { Ijara: 80_000, Reklama: 30_000 },
    });
  });

  it("barcha davr", () => {
    expect(totalsFor(flows, null).income).toBe(1_449_000);
  });
});

describe("resolvePeriod", () => {
  const today = "2026-10-13";

  it("oy: oldingi davr — o'tgan oy, yil chegarasidan o'tadi", () => {
    const p = resolvePeriod(2026, 1, today);
    expect(p.cur).toEqual({ from: "2026-01-01", to: "2026-02-01" });
    expect(p.prev).toEqual({ from: "2025-12-01", to: "2026-01-01" });
    expect(p.focusMonth).toBe("2026-01");
    expect(p.anchor).toBe("2026-01-31");
  });

  it("joriy oy: kunlik grafik bugungacha", () => {
    expect(resolvePeriod(2026, 10, today).anchor).toBe(today);
  });

  it("faqat yil: joriy yilda fokus — joriy oy, o'tgan yilda — dekabr", () => {
    expect(resolvePeriod(2026, null, today)).toMatchObject({ focusMonth: "2026-10", kind: "year", anchor: today });
    expect(resolvePeriod(2025, null, today)).toMatchObject({
      focusMonth: "2025-12",
      prev: { from: "2024-01-01", to: "2025-01-01" },
      anchor: "2025-12-31",
    });
  });

  it("barcha davr: solishtirish yo'q", () => {
    expect(resolvePeriod(null, null, today)).toMatchObject({ cur: null, prev: null, focusMonth: "2026-10" });
  });

  it("oy tanlanib yil 'barcha' — joriy yildagi o'sha oy", () => {
    expect(resolvePeriod(null, 3, today).focusMonth).toBe("2026-03");
  });
});

describe("ko'rinish yordamchilari", () => {
  it("compact", () => {
    expect(compact(950)).toEqual({ v: "950", u: "" });
    expect(compact(1_250_000)).toEqual({ v: "1.3", u: "mln" });
    expect(compact(120_000)).toEqual({ v: "120", u: "ming" });
    expect(compact(-2_000_000_000)).toEqual({ v: "−2", u: "mlrd" });
    expect(compactStr(15_500)).toBe("15.5 ming");
  });

  it("kpiDelta: yaxshi yo'nalish bo'yicha rang", () => {
    expect(kpiDelta(120, 100, "up")).toEqual({ text: "+20.0%", tone: "up" });
    expect(kpiDelta(120, 100, "down")).toEqual({ text: "+20.0%", tone: "down" });
    expect(kpiDelta(80, 82.5, "up", "pp")).toEqual({ text: "−2.5 p.p.", tone: "down" });
    expect(kpiDelta(5, 3, "up", "count")).toEqual({ text: "+2", tone: "up" });
    expect(kpiDelta(5, 0, "up")).toEqual({ text: "—", tone: "flat" });
    expect(kpiDelta(5, null, "up")).toBeNull();
  });

  it("pctOf va topWithOther", () => {
    expect(pctOf(1, 3)).toBe("33.3%");
    expect(pctOf(1, 0)).toBe("");
    expect(
      topWithOther(
        [
          ["a", 5],
          ["b", 0],
          ["c", 9],
          ["d", 1],
          ["e", 2],
          ["f", 3],
        ],
        "Boshqa",
      ),
    ).toEqual([
      ["c", 9],
      ["a", 5],
      ["f", 3],
      ["Boshqa", 3],
    ]);
  });
});
