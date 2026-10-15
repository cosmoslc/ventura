import { describe, expect, it } from "vitest";
import type { DayFlow } from "./dashboard";
import { cumulativeBalance, openingBalanceInput, openingSummary, parseOpeningBalances } from "./opening-balance";

const flow = (date: string, kind: DayFlow["kind"], amount: number): DayFlow => ({ date, kind, amount, count: 1 });
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

describe("yig'ma qoldiq", () => {
  const flows = [
    flow("2025-12-20", "pay", 5000),
    flow("2026-01-05", "pay", 1000),
    flow("2026-01-10", "expense", 300),
    flow("2026-02-03", "pay", 500),
    flow("2026-02-07", "refund", 70),
  ];

  it("qoldiq yo'q: yil boshidan sof oqim (oldingidek), kelmagan oylar null", () => {
    const r = cumulativeBalance([{ opening: null, flows }], 2026, "2026-02-15");
    expect(r.slice(0, 3)).toEqual([700, 1130, null]);
  });

  it("qoldiq oldingi yil sanasidan: qoldiq + sanadan keyingi barcha harakat", () => {
    const r = cumulativeBalance([{ opening: { amount: 10_000, date: "2025-12-31" }, flows }], 2026, "2026-02-15");
    expect(r.slice(0, 2)).toEqual([10_700, 11_130]);
  });

  it("sana yil ichida: qoldiq o'sha oydan boshlab, sanadan oldingi harakat qoldiqqa kirgan", () => {
    const r = cumulativeBalance([{ opening: { amount: 2000, date: "2026-02-01" }, flows }], 2026, "2026-03-15");
    // yanvarda hali qoldiq yo'q (0), fevralda 2000 + 500 - 70
    expect(r.slice(0, 3)).toEqual([0, 2430, 2430]);
  });

  it("bir necha oqim yig'iladi", () => {
    const r = cumulativeBalance(
      [
        { opening: { amount: 100, date: "2026-01-01" }, flows: [flow("2026-01-02", "pay", 50)] },
        { opening: null, flows: [flow("2026-01-03", "expense", 20)] },
      ],
      2026,
      "2026-01-31",
    );
    expect(r[0]).toBe(130);
  });
});

describe("qoldiq sozlamasi", () => {
  it("buzilgan yozuvlar tashlanadi", () => {
    const v = parseOpeningBalances({
      [A]: { amount: 5000, date: "2026-01-01" },
      [B]: { amount: -1, date: "2026-01-01" },
      nope: { amount: 1, date: "2026-01-01" },
    });
    expect(Object.keys(v)).toEqual([A]);
    expect(parseOpeningBalances(null)).toEqual({});
  });

  it("jami va eng erta sana", () => {
    const o = { [A]: { amount: 100, date: "2026-03-01" }, [B]: { amount: 50, date: "2026-01-15" } };
    expect(openingSummary(o, [A, B])).toEqual({ amount: 150, date: "2026-01-15", count: 2 });
    expect(openingSummary(o, [])).toBeNull();
  });

  it("forma: manfiy yoki kasr summa rad etiladi, null — olib tashlash", () => {
    const ok = openingBalanceInput.safeParse({ entries: [{ branchId: A, amount: null, date: "" }] });
    expect(ok.success).toBe(true);
    expect(openingBalanceInput.safeParse({ entries: [{ branchId: A, amount: -5, date: "2026-01-01" }] }).success).toBe(
      false,
    );
    expect(openingBalanceInput.safeParse({ entries: [{ branchId: A, amount: 1.5, date: "2026-01-01" }] }).success).toBe(
      false,
    );
  });
});
