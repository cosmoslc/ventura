import { describe, expect, it } from "vitest";
import type { DayFlow } from "./dashboard";
import {
  cashflowTable,
  chargeBase,
  chargeDiscount,
  expenseRows,
  forecastCell,
  percent,
  planTable,
  yearMonths,
} from "./reports";
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

describe("reja, fakt va prognoz", () => {
  const today = "2026-10-14";
  const flows = [
    flow("2026-07-10", "expense", 300, "Ijara"),
    flow("2026-08-10", "expense", 600, "Ijara"),
    flow("2026-09-10", "expense", 900, "Ijara"),
    flow("2026-09-05", "pay", 5000),
    flow("2026-10-03", "pay", 1000),
    flow("2026-10-04", "expense", 100, "Ijara"),
    flow("2026-10-05", "salary", 700),
    flow("2026-10-06", "advance", 100),
  ];
  const input = {
    flows,
    plans: {
      payments: new Map([["2026-10", 4000]]),
      salary: new Map([
        ["2026-10", 500],
        ["2026-11", 900],
      ]),
    },
    expectedPayments: 3000,
    today,
  };

  it("o'tgan oy — fakt; joriy oy — fakt va kutilgandan kattasi; kelgusi — kutilgan", () => {
    expect(forecastCell("payments", "2026-09", input)).toEqual({ plan: null, fact: 5000, forecast: 5000 });
    // To'lov: kutilgan — o'quvchi hisobidagi joriy oy summasi (reja emas)
    expect(forecastCell("payments", "2026-10", input)).toEqual({ plan: 4000, fact: 1000, forecast: 3000 });
    expect(forecastCell("payments", "2026-12", input)).toEqual({ plan: null, fact: null, forecast: 3000 });
    // Ish haqi + avans; fakt rejadan oshgan — fakt
    expect(forecastCell("salary", "2026-10", input)).toEqual({ plan: 500, fact: 800, forecast: 800 });
    expect(forecastCell("salary", "2026-11", input).forecast).toBe(900);
    // Reja yo'q — oxirgi 3 to'liq oy o'rtachasi (iyul–sentyabr)
    expect(forecastCell("expenses", "2026-10", input)).toEqual({ plan: null, fact: 100, forecast: 600 });
    expect(forecastCell("refunds", "2026-11", input).forecast).toBe(0);
  });

  it("jami: reja faqat kiritilgan bo'lsa, sof oqim, kelmagan oy faktsiz", () => {
    const oct = planTable(["2026-10"], input);
    expect(oct.income).toEqual({ plan: 4000, fact: 1000, forecast: 3000 });
    expect(oct.outflow).toEqual({ plan: 500, fact: 900, forecast: 1400 });
    expect(oct.net).toEqual({ plan: 3500, fact: 100, forecast: 1600 });
    const later = planTable(["2026-11", "2026-12"], input);
    expect(later.lines.payments).toEqual({ plan: null, fact: null, forecast: 6000 });
    expect(later.lines.salary.plan).toBe(900);
    expect(later.net.fact).toBeNull();
    expect(later.net.plan).toBeNull();
  });

  it("oylik hisobotda barcha davr yo'q", () => {
    expect(reportPeriod({ yil: "all" }, today, "month")).toMatchObject({ year: 2026, month: 10 });
    expect(reportPeriod({ yil: "2026", oy: "all" }, today, "month").months).toHaveLength(12);
  });
});
