import { describe, expect, it } from "vitest";
import { addTo, change, monthBounds, previousMonths, signedPercent, sumMonths, trendMonths } from "./finance-views";

describe("trendMonths", () => {
  it("oy tanlansa: shu oy oxirgi bo'lgan 6 oy", () => {
    expect(trendMonths({ year: 2026, month: 2 }, "2026-10-14")).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
  it("joriy yil: kelmagan oylar yo'q", () => {
    expect(trendMonths({ year: 2026, month: null }, "2026-03-05")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
  it("o'tgan yil: 12 oy", () => {
    expect(trendMonths({ year: 2025, month: null }, "2026-03-05")).toHaveLength(12);
  });
  it("barcha davr: oxirgi 12 oy", () => {
    const m = trendMonths({ year: null, month: null }, "2026-10-14");
    expect(m[0]).toBe("2025-11");
    expect(m[11]).toBe("2026-10");
  });
});

describe("previousMonths va monthBounds", () => {
  it("oy, yil va barcha davr", () => {
    expect(previousMonths({ year: 2026, month: 1 })).toEqual(["2025-12"]);
    expect(previousMonths({ year: 2026, month: null })?.[0]).toBe("2025-01");
    expect(previousMonths({ year: null, month: null })).toBeNull();
  });
  it("sanalar oralig'i oxirgi oydan keyingi oyning 1-kunigacha", () => {
    expect(monthBounds(["2025-12", "2025-11"])).toEqual({ from: "2025-11-01", to: "2026-01-01" });
  });
});

describe("yig'indi va o'zgarish", () => {
  it("oylar bo'yicha yig'indi", () => {
    const m = new Map<string, number>();
    addTo(m, "2026-01", 10);
    addTo(m, "2026-01", 5);
    addTo(m, "2026-02", 7);
    expect(sumMonths(m, ["2026-01"])).toBe(15);
    expect(sumMonths(m, null)).toBe(22);
  });
  it("o'zgarish foizi", () => {
    expect(change(150, 100)).toBe(50);
    expect(change(50, 100)).toBe(-50);
    expect(change(10, 0)).toBeNull();
    expect(change(10, null)).toBeNull();
    expect(signedPercent(12.34)).toBe("+12.3%");
    expect(signedPercent(-3)).toBe("−3.0%");
  });
});
