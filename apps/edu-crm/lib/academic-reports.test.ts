import { describe, expect, it } from "vitest";
import {
  type LeaveRecord,
  type StudentSpan,
  churnStats,
  cohorts,
  daysBetween,
  leaveSummary,
  riskOf,
} from "./academic-reports";

const leave = (over: Partial<LeaveRecord>): LeaveRecord => ({
  membershipId: "m",
  studentId: "s1",
  groupId: "g1",
  enrolledAt: "2026-09-01",
  leftAt: "2026-09-11",
  trial: false,
  reason: "Narxi qimmat",
  attended: 0,
  marked: 0,
  ...over,
});

describe("guruhdan chiqish sabablari", () => {
  const sum = leaveSummary(
    [
      leave({ studentId: "s1", attended: 3, marked: 4 }),
      leave({ studentId: "s2", reason: "Narxi qimmat ", trial: true, enrolledAt: "2026-09-01", leftAt: "2026-09-21" }),
      leave({ studentId: "s1", groupId: "g2", reason: null, attended: 1, marked: 4 }),
      leave({ studentId: "s3", groupId: "g2", reason: "Ko'chib ketdi" }),
    ],
    "Sababsiz",
  );

  it("sabab bo'yicha (bo'sh joylar kesiladi), sinov va faol, o'rtacha muddat va davomat", () => {
    expect(sum).toMatchObject({ total: 4, students: 3, trial: 1, avgDays: 12.5 });
    expect(sum.byReason[0]).toEqual({
      reason: "Narxi qimmat",
      count: 2,
      share: 50,
      trial: 1,
      active: 1,
      avgDays: 15,
      rate: 75,
    });
    // Teng sonda — sababsiz oxirida
    expect(sum.byReason.map((r) => r.reason)).toEqual(["Narxi qimmat", "Ko'chib ketdi", "Sababsiz"]);
    expect(sum.byReason[1]!.rate).toBeNull();
  });

  it("guruh bo'yicha", () => {
    expect(sum.byGroup).toEqual([
      { groupId: "g1", count: 2, trial: 1, share: 50 },
      { groupId: "g2", count: 2, trial: 0, share: 50 },
    ]);
    expect(daysBetween("2026-01-31", "2026-03-01")).toBe(29);
  });
});

describe("xavfli o'quvchilar", () => {
  const base = { consecutive: 0, missedThisMonth: 0, rate: 100, marked: 8, contacted: true, debt: 0 };

  it("omil yo'q — xavf yo'q", () => {
    expect(riskOf(base)).toBeNull();
    // Chegaradagi qarz xavf emas
    expect(riskOf({ ...base, debt: 100_000 })).toBeNull();
  });

  it("ketma-ket 2 dars va bog'lanilmagan — yuqori; 3 dars — kritik", () => {
    expect(riskOf({ ...base, consecutive: 2, contacted: false })).toEqual({
      factors: ["consecutive", "uncontacted"],
      score: 80,
      level: "critical",
    });
    expect(riskOf({ ...base, consecutive: 2 })).toEqual({ factors: ["consecutive"], score: 60, level: "high" });
    expect(riskOf({ ...base, consecutive: 3 })!.level).toBe("critical");
  });

  it("past davomat (kamida 4 belgi) — har dars 15, kamida 15; qarz — 20", () => {
    expect(riskOf({ ...base, rate: 60, marked: 5 })).toEqual({ factors: ["missed"], score: 15, level: "medium" });
    expect(riskOf({ ...base, rate: 60, marked: 3 })).toBeNull();
    expect(riskOf({ ...base, missedThisMonth: 3, debt: 150_000 })).toEqual({
      factors: ["missed", "debt"],
      score: 65,
      level: "high",
    });
    // Faqat qarz: bog'lanish talab qilinmaydi
    expect(riskOf({ ...base, debt: 150_000, contacted: false })).toEqual({
      factors: ["debt"],
      score: 20,
      level: "medium",
    });
  });
});

describe("o'quvchini ushlab turish", () => {
  const span = (over: Partial<StudentSpan>): StudentSpan => ({
    studentId: "s",
    firstJoin: "2026-05-10",
    churned: false,
    lastLeft: null,
    lastReason: null,
    courseId: "c1",
    ...over,
  });
  const spans = [
    span({ studentId: "a" }),
    span({ studentId: "b", churned: true, lastLeft: "2026-10-05", firstJoin: "2026-08-03" }),
    span({ studentId: "c", churned: true, lastLeft: "2026-09-20", firstJoin: "2026-08-15" }),
    span({ studentId: "d", firstJoin: "2026-10-20" }),
    span({ studentId: "e", firstJoin: "2026-11-02" }),
  ];

  it("davr: baza va ketganlar", () => {
    const oct = churnStats(spans, { from: "2026-10-01", to: "2026-11-01" });
    expect(oct.base.map((s) => s.studentId)).toEqual(["a", "b", "d"]);
    expect(oct.churned.map((s) => s.studentId)).toEqual(["b"]);
    expect(oct.churnRate).toBeCloseTo(33.33, 1);
    expect(oct.retentionRate).toBeCloseTo(66.67, 1);
    const all = churnStats(spans, null);
    expect(all.churned).toHaveLength(2);
    expect(churnStats([], null).churnRate).toBeNull();
  });

  it("kohortalar: kelgan oyi bo'yicha, hali kelmagan oy bo'sh", () => {
    const rows = cohorts(spans, "2026-10-14", 3);
    expect(rows.map((r) => [r.month, r.size])).toEqual([
      ["2026-08", 2],
      ["2026-09", 0],
      ["2026-10", 1],
    ]);
    // Avgust: c sentyabrda ketdi (1 oydan keyin hali bor edi), b oktyabrda
    expect(rows[0]!.cells).toEqual([100, 100, 50]);
    expect(rows[1]!.cells).toEqual([null, null, null]);
    expect(rows[2]!.cells).toEqual([100, null, null]);
  });
});
