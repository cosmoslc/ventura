import { describe, expect, it } from "vitest";
import type { DayFlow } from "./dashboard";
import { cashflowTable, chargeBase, chargeDiscount, expenseRows, percent, yearMonths } from "./reports";
import { reportPeriod } from "./server/reports";

const L = {
  label: "K",
  total: "Jami",
  income: "Kirim",
  pay: "To'lov",
  extra: "Qo'shimcha",
  incomeTotal: "Jami kirim",
  outflow: "Chiqim",
  salary: "Ish haqi",
  advance: "Avans",
  refund: "Qaytarish",
  noCategory: "Toifasiz",
  outflowTotal: "Jami chiqim",
  net: "Sof",
  cumulative: "Yig'ma",
  months: ["Yan", "Fev", "Mar", "Apr", "May", "Iyn", "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek"],
};

const flow = (date: string, kind: DayFlow["kind"], amount: number, category?: string): DayFlow => ({
  date,
  kind,
  amount,
  count: 1,
  category,
});

describe("pul oqimi", () => {
  const flows = [
    flow("2026-01-05", "pay", 1000),
    flow("2026-01-20", "income", 200),
    flow("2026-01-10", "expense", 300, "Ijara"),
    flow("2026-02-03", "pay", 500),
    flow("2026-02-04", "expense", 100, "Kommunal"),
    flow("2026-02-04", "expense", 50, "Ijara"),
    flow("2026-02-05", "salary", 400),
    flow("2026-02-06", "advance", 100),
    flow("2026-02-07", "refund", 70),
    flow("2025-12-31", "pay", 9999),
  ];
  const table = cashflowTable(flows, 2026, "2026-02-15", L);
  const row = (label: string) => table.rows.find((r) => r.cells.label === label)!.cells;

  it("kirim, chiqim toifalari, sof oqim va yig'ma qoldiq; boshqa yil kirmaydi", () => {
    expect(row("Jami kirim")).toMatchObject({ "2026-01": 1200, "2026-02": 500, total: 1700 });
    expect(row("Jami chiqim")).toMatchObject({ "2026-01": 300, "2026-02": 720, total: 1020 });
    expect(row("Sof")).toMatchObject({ "2026-01": 900, "2026-02": -220, total: 680 });
    expect(row("Yig'ma")).toMatchObject({ "2026-01": 900, "2026-02": 680, total: null });
  });

  it("hali kelmagan oylar bo'sh; toifalar yillik summa bo'yicha", () => {
    expect(row("Jami kirim")["2026-03"]).toBeNull();
    const cats = table.rows.filter((r) => ["Ijara", "Kommunal"].includes(String(r.cells.label)));
    expect(cats.map((r) => r.cells.label)).toEqual(["Ijara", "Kommunal"]);
    expect(table.columns).toHaveLength(14);
  });
});

describe("xarajatlar tahlili", () => {
  it("reja va fakt, farq, bajarilish va ulush; faqat rejasi bor toifa ham chiqadi", () => {
    const rows = expenseRows(
      [
        { categoryId: "a", category: "Ijara", amount: 600 },
        { categoryId: "a", category: "Ijara", amount: 200 },
        { categoryId: "b", category: "Kommunal", amount: 200 },
      ],
      [
        { categoryId: "a", amount: 1000 },
        { categoryId: "c", amount: 300 },
      ],
      new Map([
        ["a", "Ijara"],
        ["b", "Kommunal"],
        ["c", "Reklama"],
      ]),
    );
    expect(rows).toEqual([
      { categoryId: "a", category: "Ijara", plan: 1000, fact: 800, diff: 200, done: 80, share: 80 },
      { categoryId: "b", category: "Kommunal", plan: null, fact: 200, diff: null, done: null, share: 20 },
      { categoryId: "c", category: "Reklama", plan: 300, fact: 0, diff: 300, done: 0, share: 0 },
    ]);
  });
});

describe("chegirma va asl narx (oy hisobi ulushi)", () => {
  it("to'lanadigan darslar ulushida", () => {
    const c = { basePrice: 400_000, fullPrice: 300_000, lessons: 12, charged: 6 };
    expect(chargeDiscount(c)).toBe(50_000);
    expect(chargeBase(c)).toBe(200_000);
    expect(chargeDiscount({ ...c, charged: 0 })).toBe(0);
    expect(chargeDiscount({ ...c, fullPrice: 400_000 })).toBe(0);
    expect(percent(1, 0)).toBeNull();
  });
});

describe("hisobot davri", () => {
  const today = "2026-10-14";
  it("standart — joriy oy (davrli) yoki joriy yil", () => {
    expect(reportPeriod({}, today, "period")).toMatchObject({
      year: 2026,
      month: 10,
      months: ["2026-10"],
      range: { from: "2026-10-01", to: "2026-11-01" },
    });
    expect(reportPeriod({ oy: "10" }, today, "year")).toMatchObject({ year: 2026, month: null });
    expect(reportPeriod({}, today, "year").months).toEqual(yearMonths(2026));
  });

  it("butun yil, dekabr va barcha davr", () => {
    expect(reportPeriod({ yil: "2025", oy: "all" }, today, "period")).toMatchObject({
      month: null,
      range: { from: "2025-01-01", to: "2026-01-01" },
    });
    expect(reportPeriod({ yil: "2025", oy: "12" }, today, "period").range).toEqual({
      from: "2025-12-01",
      to: "2026-01-01",
    });
    expect(reportPeriod({ yil: "all" }, today, "period")).toMatchObject({ year: null, months: null, range: null });
    // Yillik hisobotda "barcha" yo'q — joriy yil
    expect(reportPeriod({ yil: "all" }, today, "year").year).toBe(2026);
  });
});
