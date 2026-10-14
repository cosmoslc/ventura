import { describe, expect, it } from "vitest";
import {
  type LeaveRecord,
  type StudentSpan,
  churnStats,
  cohorts,
  daysBetween,
  leaveSummary,
  leaveTrend,
  monthlyRetention,
  riskBreakdown,
  riskOf,
  tenureBuckets,
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

describe("ko'rinish uchun hisoblar", () => {
  it("muddat guruhlari: chegaralar kiritiladi, sinov va faol alohida", () => {
    const b = tenureBuckets([
      { days: 0, trial: true },
      { days: 7, trial: false },
      { days: 8, trial: false },
      { days: 90, trial: true },
      { days: 181, trial: false },
    ]);
    expect(b.map((x) => [x.key, x.trial, x.active])).toEqual([
      ["week", 1, 1],
      ["month", 0, 1],
      ["quarter", 1, 0],
      ["half", 0, 0],
      ["long", 0, 1],
    ]);
  });

  it("chiqishlar dinamikasi: oy — kunlar bugungacha, yil — oylar bugungi oygacha", () => {
    const dates = ["2026-10-02", "2026-10-02", "2026-10-05", "2026-09-20"];
    const days = leaveTrend(dates, { from: "2026-10-01", to: "2026-11-01" }, false, "2026-10-04");
    expect(days.map((d) => d.key)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(days.map((d) => d.count)).toEqual([0, 2, 0, 0]);
    const months = leaveTrend(dates, { from: "2026-01-01", to: "2027-01-01" }, true, "2026-10-04");
    expect(months).toHaveLength(10);
    expect(months.at(-1)).toEqual({ key: "2026-10", count: 3 });
    expect(months.at(-2)).toEqual({ key: "2026-09", count: 1 });
    // barcha davr: birinchi chiqishdan joriy oygacha
    expect(leaveTrend(dates, null, true, "2026-10-04").map((m) => m.key)).toEqual(["2026-09", "2026-10"]);
    expect(leaveTrend([], null, true, "2026-10-04").map((m) => m.key)).toEqual(["2026-10"]);
  });

  it("oylik ushlab turish: har oy o'z bazasi bilan", () => {
    const span = (over: Partial<StudentSpan>): StudentSpan => ({
      studentId: "s",
      firstJoin: "2026-08-10",
      churned: false,
      lastLeft: null,
      lastReason: null,
      courseId: null,
      ...over,
    });
    const pts = monthlyRetention(
      [span({ studentId: "a" }), span({ studentId: "b", churned: true, lastLeft: "2026-10-03" })],
      "2026-10-14",
      3,
    );
    expect(pts.map((p) => p.month)).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(pts.map((p) => [p.base, p.churned, p.rate])).toEqual([
      [2, 0, 100],
      [2, 0, 100],
      [2, 1, 50],
    ]);
  });

  it("xavf taqsimoti: o'quvchi bir marta (eng yuqori darajada), omillar va guruhlar", () => {
    const r = riskBreakdown([
      { studentId: "a", groupId: "g1", level: "medium", factors: ["debt"] },
      { studentId: "a", groupId: "g2", level: "critical", factors: ["consecutive", "uncontacted"] },
      { studentId: "b", groupId: "g1", level: "high", factors: ["missed", "debt"] },
    ]);
    expect(r.students).toBe(2);
    expect(r.levels).toEqual([
      { level: "critical", count: 1 },
      { level: "high", count: 1 },
      { level: "medium", count: 0 },
    ]);
    expect(r.factors.map((f) => f.count)).toEqual([1, 1, 1, 2]);
    expect(r.groups[0]).toEqual({ groupId: "g1", count: 2 });
  });
});
