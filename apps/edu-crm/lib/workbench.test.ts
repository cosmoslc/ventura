import { describe, expect, it } from "vitest";
import { type LeadStatRow, leadStats } from "./lead-stats";
import { daysBetween, dueFollowUps, endingGroups, groupEndDate, todayTitle } from "./workbench";

describe("guruh tugash sanasi", () => {
  it("oylar qo'shiladi, qisqa oyda oxirgi kun", () => {
    expect(groupEndDate("2026-01-31", 1)).toBe("2026-02-28");
    expect(groupEndDate("2024-01-31", 1)).toBe("2024-02-29");
    expect(groupEndDate("2026-09-15", 3)).toBe("2026-12-15");
    expect(groupEndDate("2026-11-10", 2)).toBe("2027-01-10");
    expect(groupEndDate("2026-09-15", 0)).toBeNull();
  });

  it("30 kun ichida tugaydigan va muddati o'tganlar, eng yaqini birinchi; boshlanmagan va muddatsiz kirmaydi", () => {
    const list = [
      { id: "a", startDate: "2026-08-01", durationMonths: 3 }, // 2026-11-01 → 18 kun
      { id: "b", startDate: "2026-07-01", durationMonths: 3 }, // 2026-10-01 → −13
      { id: "c", startDate: "2026-09-01", durationMonths: 6 }, // uzoq
      { id: "d", startDate: "2026-10-20", durationMonths: 1 }, // hali boshlanmagan
      { id: "e", startDate: "2026-01-01", durationMonths: 0 }, // muddatsiz
    ];
    const out = endingGroups(list, "2026-10-14");
    expect(out.map((g) => [g.group.id, g.daysLeft])).toEqual([
      ["b", -13],
      ["a", 18],
    ]);
    expect(out[0]!.progress).toBe(100);
    expect(out[1]!.progress).toBeGreaterThan(70);
  });
});

describe("bog'lanish kerak", () => {
  it("bugungi va kechikkanlar, eng ko'p kechikkani birinchi", () => {
    const out = dueFollowUps(
      [
        { id: "x", targetDate: "2026-10-14" },
        { id: "y", targetDate: "2026-10-10" },
        { id: "z", targetDate: "2026-10-15" },
        { id: "w", targetDate: null },
      ],
      "2026-10-14",
    );
    expect(out.map((l) => [l.id, l.overdue])).toEqual([
      ["y", 4],
      ["x", 0],
    ]);
  });

  it("kunlar farqi va sarlavha", () => {
    expect(daysBetween("2026-10-01", "2026-10-14")).toBe(13);
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    const months = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr"];
    const days = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    expect(todayTitle("2026-10-14", months, days)).toBe("14-oktabr, 2026 · Chorshanba");
  });
});

describe("bosh paneldagi lid kartalari", () => {
  const row = (date: string, kind: LeadStatRow["kind"], extra: Partial<LeadStatRow> = {}): LeadStatRow => ({
    date,
    source: null,
    kind,
    lostFromStageId: null,
    paid: false,
    ...extra,
  });
  const months = ["2026-08", "2026-09", "2026-10"];
  const period = {
    cur: { from: "2026-10-01", to: "2026-11-01" },
    prev: { from: "2026-09-01", to: "2026-10-01" },
  };

  it("son, oylar, manbalar va konversiya", () => {
    const rows = [
      row("2026-10-02", "won", { source: "Instagram", paid: true }),
      row("2026-10-05", "won", { source: "Instagram" }),
      row("2026-10-06", "open", { source: "Veb-sayt forma" }),
      row("2026-10-07", "lost", { source: " ", lostFromStageId: "s2" }),
      row("2026-09-20", "won"),
      row("2026-09-21", "open"),
      row("2026-08-01", "open"),
    ];
    const s = leadStats(rows, period, months);
    expect(s.count).toBe(4);
    expect(s.prevCount).toBe(2);
    expect(s.spark).toEqual([1, 2, 4]);
    expect(s.sources).toEqual([
      ["Instagram", 2],
      ["Veb-sayt forma", 1],
      ["Boshqa", 1],
    ]);
    expect(s.conv).toBe(50);
    expect(s.prevConv).toBe(50);
    expect(s.converted).toBe(2);
    expect(s.firstPaid).toBe(1);
    expect(s.lostTop).toEqual({ stageId: "s2", count: 1, pct: 25 });
  });

  it("davrda lid bo'lmasa konversiya yo'q; 'barcha davr'da solishtirish yo'q", () => {
    const s = leadStats([row("2026-08-01", "won")], { cur: null, prev: null }, months);
    expect(s.count).toBe(1);
    expect(s.prevCount).toBeNull();
    expect(s.prevConv).toBeNull();
    expect(leadStats([], period, months).conv).toBeNull();
  });
});
