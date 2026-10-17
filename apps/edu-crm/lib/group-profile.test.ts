import { describe, expect, it } from "vitest";
import type { MonthCharge } from "./billing";
import {
  addMonths,
  attendanceStat,
  collectedPercent,
  compareMembers,
  daysAgo,
  groupEndDate,
  lessonMinutes,
  matchesFilter,
  memberMoney,
  monthState,
} from "./group-profile";
import { type LedgerEntry, summarize } from "./ledger";

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
): LedgerEntry => ({ id: `e${++n}`, kind, amount, groupId, month, date: "2026-10-01" });

describe("memberMoney", () => {
  it("qarz, shu oy hisobi va yig'ilgan pul faqat shu guruh bo'yicha", () => {
    const charges = [
      charge("g1", "2026-08", 400_000),
      charge("g1", "2026-09", 400_000),
      charge("g1", "2026-10", 400_000),
      charge("g2", "2026-10", 300_000),
    ];
    const entries = [entry("payment", 400_000, "g1", "2026-08"), entry("payment", 300_000, "g2", "2026-10")];
    const s = summarize(charges, entries);
    const m = memberMoney(s, entries, "g1", "2026-10");
    expect(m.due).toBe(800_000);
    expect(m.dueMonths).toBe(2);
    expect(m.monthCharged).toBe(400_000);
    expect(m.monthDue).toBe(400_000);
    expect(m.collected).toBe(0);
    expect(memberMoney(s, entries, "g2", "2026-10")).toMatchObject({ due: 0, dueMonths: 0, collected: 300_000 });
  });

  it("qaytarish yig'ilgan puldan ayriladi; guruhda yozuv bo'lmasa — nollar", () => {
    const entries = [entry("payment", 400_000, "g1", "2026-10"), entry("refund", 100_000, "g1", "2026-10")];
    const s = summarize([charge("g1", "2026-10", 400_000)], entries);
    expect(memberMoney(s, entries, "g1", "2026-10").collected).toBe(300_000);
    expect(memberMoney(s, entries, "yo'q", "2026-10")).toEqual({
      due: 0,
      dueMonths: 0,
      monthCharged: 0,
      monthDue: 0,
      collected: 0,
    });
  });
});

describe("monthState", () => {
  it("holatlar", () => {
    expect(monthState({ monthCharged: 0, monthDue: 0 })).toBe("none");
    expect(monthState({ monthCharged: 400, monthDue: 0 })).toBe("paid");
    expect(monthState({ monthCharged: 400, monthDue: 150 })).toBe("partial");
    expect(monthState({ monthCharged: 400, monthDue: 400 })).toBe("unpaid");
  });
});

describe("attendanceStat", () => {
  const marks = [
    { date: "2026-09-01", status: "absent" },
    { date: "2026-10-01", status: "present" },
    { date: "2026-10-03", status: "late" },
    { date: "2026-10-06", status: "excused" },
    { date: "2026-10-08", status: "absent" },
  ];
  it("faqat belgilangan darslar, kech ham kelgan hisoblanadi", () => {
    expect(attendanceStat(marks, "2026-10-01")).toEqual({ came: 2, marked: 4, rate: 50 });
  });
  it("sanadan oldingilar kirmaydi; belgi bo'lmasa foiz yo'q", () => {
    expect(attendanceStat(marks, "2026-09-01").marked).toBe(5);
    expect(attendanceStat(marks, "2026-12-01")).toEqual({ came: 0, marked: 0, rate: null });
  });
});

describe("sanalar", () => {
  it("daysAgo oy chegarasidan o'tadi", () => {
    expect(daysAgo("2026-10-16", 30)).toBe("2026-09-16");
    expect(daysAgo("2026-03-01", 1)).toBe("2026-02-28");
  });
  it("addMonths oy oxiriga tushadi", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-11-15", 3)).toBe("2027-02-15");
  });
  it("groupEndDate — davr tugaydigan kun", () => {
    expect(groupEndDate("2026-09-01", 6)).toBe("2027-02-28");
    expect(groupEndDate("2026-09-15", 1)).toBe("2026-10-14");
  });
  it("lessonMinutes", () => {
    expect(lessonMinutes("15:00", "16:30")).toBe(90);
  });
});

describe("filtr va saralash", () => {
  const rows = [
    { name: "Vali", status: "active" as const, enrolledAt: "2026-01-10", due: 0, rate: 90 },
    { name: "Ali", status: "trial" as const, enrolledAt: "2026-10-05", due: 0, rate: null },
    { name: "Dilnoza", status: "active" as const, enrolledAt: "2026-03-01", due: 800_000, rate: 40 },
    { name: "Bobur", status: "paused" as const, enrolledAt: "2026-02-01", due: 400_000, rate: 70 },
  ];
  const names = (sort: Parameters<typeof compareMembers>[0]) => [...rows].sort(compareMembers(sort)).map((r) => r.name);

  it("filtr", () => {
    expect(rows.filter((r) => matchesFilter(r, "debt")).map((r) => r.name)).toEqual(["Dilnoza", "Bobur"]);
    expect(rows.filter((r) => matchesFilter(r, "trial")).map((r) => r.name)).toEqual(["Ali"]);
    expect(rows.filter((r) => matchesFilter(r, "all"))).toHaveLength(4);
  });
  it("saralash", () => {
    expect(names("name")).toEqual(["Ali", "Bobur", "Dilnoza", "Vali"]);
    expect(names("debt")).toEqual(["Dilnoza", "Bobur", "Ali", "Vali"]);
    expect(names("joined")).toEqual(["Ali", "Dilnoza", "Bobur", "Vali"]);
    expect(names("attendance")).toEqual(["Dilnoza", "Bobur", "Vali", "Ali"]);
  });
});

describe("collectedPercent", () => {
  it("0–100 oralig'ida", () => {
    expect(collectedPercent(0, 100)).toBe(0);
    expect(collectedPercent(400, 100)).toBe(25);
    expect(collectedPercent(400, 900)).toBe(100);
    expect(collectedPercent(400, -50)).toBe(0);
  });
});
