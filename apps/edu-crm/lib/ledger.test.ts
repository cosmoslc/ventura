import { describe, expect, it } from "vitest";
import type { MonthCharge } from "./billing";
import { type LedgerEntry, cash, overdueDays, signed, suggestedAmount, suggestedMonth, summarize } from "./ledger";

const charge = (groupId: string, month: string, amount: number): MonthCharge => ({
  membershipId: `m-${groupId}`,
  groupId,
  month,
  basePrice: amount,
  fullPrice: amount,
  lessons: 12,
  billable: 12,
  excused: 0,
  charged: 12,
  amount,
});
let n = 0;
const entry = (
  kind: LedgerEntry["kind"],
  amount: number,
  groupId: string | null = null,
  month: string | null = null,
): LedgerEntry => ({
  id: `e${++n}`,
  kind,
  amount,
  groupId,
  month,
  date: "2026-10-01",
});
const statusOf = (s: ReturnType<typeof summarize>, groupId: string) =>
  s.groups.find((g) => g.groupId === groupId)!.months.map((m) => [m.month, m.status, m.covered, m.due]);

describe("o'quvchi balansi", () => {
  it("to'lanmagan oy keyingi oyga o'tadi (yig'iladi)", () => {
    const s = summarize(
      [charge("A", "2026-09", 300_000), charge("A", "2026-10", 300_000)],
      [entry("payment", 300_000, "A", "2026-09")],
    );
    expect(s).toMatchObject({
      charged: 600_000,
      credited: 300_000,
      balance: -300_000,
      debt: 300_000,
      otherDebt: 0,
      oldestUnpaid: "2026-10",
    });
    expect(statusOf(s, "A")).toEqual([
      ["2026-09", "paid", 300_000, 0],
      ["2026-10", "unpaid", 0, 300_000],
    ]);
  });

  it("ortiqcha to'lov keyingi oyni yopadi (eski tizimda yo'qolar edi)", () => {
    const s = summarize(
      [charge("A", "2026-09", 300_000), charge("A", "2026-10", 300_000)],
      [entry("payment", 450_000, "A", "2026-09")],
    );
    expect(s.balance).toBe(-150_000);
    expect(statusOf(s, "A")).toEqual([
      ["2026-09", "paid", 300_000, 0],
      ["2026-10", "partial", 150_000, 150_000],
    ]);
  });

  it("oy belgisidan qat'i nazar eng eski oy birinchi yopiladi", () => {
    const s = summarize(
      [charge("A", "2026-09", 300_000), charge("A", "2026-10", 300_000)],
      [entry("payment", 300_000, "A", "2026-10")],
    );
    expect(s.oldestUnpaid).toBe("2026-10");
    expect(statusOf(s, "A")[0]).toEqual(["2026-09", "paid", 300_000, 0]);
  });

  it("bir guruhdagi ortiqcha boshqa guruh qarzini yopadi, umumiy balans 0", () => {
    const s = summarize(
      [charge("A", "2026-10", 300_000), charge("B", "2026-10", 200_000)],
      [entry("payment", 500_000, "A", "2026-10")],
    );
    expect(s).toMatchObject({ balance: 0, debt: 0, oldestUnpaid: null });
    expect(statusOf(s, "B")).toEqual([["2026-10", "paid", 200_000, 0]]);
    const a = s.groups.find((g) => g.groupId === "A")!;
    expect(a).toMatchObject({ charged: 300_000, credited: 500_000, balance: 200_000 });
  });

  it("guruhsiz to'lov eng eski oyga tushadi", () => {
    const s = summarize(
      [charge("A", "2026-09", 100_000), charge("B", "2026-10", 200_000)],
      [entry("payment", 150_000)],
    );
    expect(statusOf(s, "A")).toEqual([["2026-09", "paid", 100_000, 0]]);
    expect(statusOf(s, "B")).toEqual([["2026-10", "partial", 50_000, 150_000]]);
    expect(s.debt).toBe(150_000);
  });

  it("chegirma (bir martalik) kredit sifatida oyni yopadi", () => {
    const s = summarize(
      [charge("A", "2026-10", 300_000)],
      [entry("payment", 250_000, "A", "2026-10"), entry("discount", 50_000, "A", "2026-10")],
    );
    expect(s).toMatchObject({ balance: 0, debt: 0 });
  });

  it("qaytarish balansni kamaytiradi", () => {
    const s = summarize(
      [charge("A", "2026-10", 300_000)],
      [entry("payment", 300_000, "A", "2026-10"), entry("refund", 100_000, "A")],
    );
    expect(s).toMatchObject({ balance: -100_000, debt: 100_000, otherDebt: 0 });
    expect(statusOf(s, "A")).toEqual([["2026-10", "partial", 200_000, 100_000]]);
  });

  it("manfiy tuzatish oylar to'langan bo'lsa ham qarz bo'ladi (boshqa qarz)", () => {
    const s = summarize(
      [charge("A", "2026-10", 300_000)],
      [entry("payment", 300_000, "A", "2026-10"), entry("correction", -50_000)],
    );
    expect(s).toMatchObject({ balance: -50_000, debt: 50_000, otherDebt: 50_000, oldestUnpaid: null });
  });

  it("musbat balans (avans) — qarz yo'q", () => {
    const s = summarize([charge("A", "2026-10", 300_000)], [entry("payment", 1_000_000, "A", "2026-10")]);
    expect(s).toMatchObject({ balance: 700_000, debt: 0 });
  });

  it("0 so'mlik oy (muzlatilgan) — 'free'", () => {
    const s = summarize([charge("A", "2026-10", 0)], []);
    expect(statusOf(s, "A")).toEqual([["2026-10", "free", 0, 0]]);
  });

  it("taklif: eng eski yopilmagan oy va guruh qarzi", () => {
    const s = summarize(
      [charge("A", "2026-08", 300_000), charge("A", "2026-09", 300_000), charge("A", "2026-10", 300_000)],
      [entry("payment", 400_000, "A", "2026-08")],
    );
    expect(suggestedMonth(s, "A", "2026-10")).toBe("2026-09");
    expect(suggestedAmount(s, "A")).toBe(500_000);
    expect(suggestedMonth(summarize([], []), "A", "2026-10")).toBe("2026-10");
  });

  it("naqd harakat: to'lov +, qaytarish −, chegirma va tuzatish — 0", () => {
    expect([entry("payment", 5), entry("refund", 5), entry("discount", 5), entry("correction", -5)].map(cash)).toEqual([
      5, -5, 0, 0,
    ]);
    expect(
      [entry("payment", 5), entry("refund", 5), entry("discount", 5), entry("correction", -5)].map(signed),
    ).toEqual([5, -5, 5, -5]);
  });
});

describe("tasodifiy sinov: balans va oylar har doim mos", () => {
  // Deterministik tasodif (mulberry32)
  function rng(seed: number) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  it("5000 ta holat", () => {
    const r = rng(42);
    const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
    const groups = ["A", "B", "C"];
    const months = ["2026-07", "2026-08", "2026-09", "2026-10"];
    for (let i = 0; i < 5000; i++) {
      const charges: MonthCharge[] = [];
      for (const g of groups)
        for (const m of months) if (r() < 0.6) charges.push(charge(g, m, Math.floor(r() * 5) * 75_000));
      const entries: LedgerEntry[] = [];
      const count = Math.floor(r() * 6);
      for (let k = 0; k < count; k++) {
        const kind = pick(["payment", "payment", "payment", "refund", "discount", "correction"] as const);
        const amount = Math.floor(r() * 8) * 50_000 + 1;
        entries.push(
          entry(
            kind,
            kind === "correction" && r() < 0.5 ? -amount : amount,
            r() < 0.7 ? pick(groups) : null,
            pick(months),
          ),
        );
      }
      const s = summarize(charges, entries);
      const all = s.groups.flatMap((g) => g.months);
      const due = all.reduce((x, m) => x + m.due, 0);
      expect(s.balance).toBe(s.credited - s.charged);
      expect(s.charged).toBe(charges.reduce((x, c) => x + c.amount, 0));
      expect(all.length).toBe(charges.length);
      expect(s.debt).toBe(due + s.otherDebt);
      for (const m of all) {
        expect(m.covered + m.due).toBe(m.amount);
        expect(m.covered).toBeGreaterThanOrEqual(0);
        expect(m.due).toBeGreaterThanOrEqual(0);
      }
      if (s.balance >= 0) expect(due).toBe(0);
      expect(s.groups.reduce((x, g) => x + g.charged, 0)).toBe(s.charged);
    }
  });
});

describe("muddat", () => {
  it("eng eski yopilmagan oy muddatidan o'tgan kunlar", () => {
    expect(overdueDays(null, 10, "2026-10-12")).toBe(0);
    expect(overdueDays("2026-10", 10, "2026-10-10")).toBe(0);
    expect(overdueDays("2026-10", 10, "2026-10-12")).toBe(2);
    expect(overdueDays("2026-09", 10, "2026-10-12")).toBe(32);
    expect(overdueDays("2026-10", 15, "2026-10-12")).toBe(0);
    expect(overdueDays("2026-02", 28, "2026-03-01")).toBe(1);
  });
});
