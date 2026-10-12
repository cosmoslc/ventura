import { describe, expect, it } from "vitest";
import { type ReportMark, matchesFilter, studentStats } from "./attendance-report";
import { lessonDates } from "./lessons";

// Oktyabr 2026: Du/Ch/Ju guruhi — 13 dars (1-oktyabr payshanba)
const group = { days: ["mon", "wed", "fri"], startDate: "2026-09-01", branchId: "b1" };
const dates = lessonDates(group, "2026-09-01", "2026-10-31", []);
const period = { membershipId: "m", enrolledAt: "2026-09-01", leftAt: null, status: "active" as const, pausedAt: null };
const marks = (list: [string, ReportMark["status"], string?][]) =>
  new Map(list.map(([d, status, reason]) => [d, { status, reason: reason ?? null }]));

const base = {
  lessonDates: dates,
  periods: [period],
  contacts: [],
  from: "2026-10-01",
  to: "2026-10-31",
  today: "2026-10-31",
};

describe("davomat hisoboti", () => {
  it("bir oylik davomat: bor, kech, sababli, yo'q va belgilanmagan to'g'ri sanaladi", () => {
    const s = studentStats({
      ...base,
      marks: marks([
        ["2026-10-02", "present"],
        ["2026-10-05", "present"],
        ["2026-10-07", "late"],
        ["2026-10-09", "absent"],
        ["2026-10-12", "excused", "Kasal"],
        ["2026-10-14", "present"],
        ["2026-10-16", "present"],
        ["2026-10-19", "present"],
        ["2026-10-21", "present"],
        ["2026-10-23", "absent"],
        ["2026-10-26", "present"],
        ["2026-10-28", "present"],
      ]),
    });
    expect(s.lessons).toBe(13);
    expect(s).toMatchObject({ present: 8, late: 1, missed: 3, excused: 1, unmarked: 1 });
    // (8 + 1) / 12 belgilangan
    expect(s.rate).toBe(75);
    expect(s.previous).toEqual({ date: "2026-10-30", status: null });
    expect(s.lastMissed).toEqual({ date: "2026-10-23", status: "absent", reason: null });
    expect(s.consecutive).toBe(0);
    expect(s.missedThisMonth).toBe(3);
  });

  it("kelajak, guruhga qo'shilishdan oldingi va muzlatilgan kunlar sanalmaydi", () => {
    const s = studentStats({
      ...base,
      today: "2026-10-16",
      periods: [{ ...period, enrolledAt: "2026-10-07", status: "paused", pausedAt: "2026-10-14" }],
      marks: new Map(),
    });
    // 07, 09, 12 — 14 dan muzlatilgan, 16 dan keyingisi kelajak
    expect(s.lessons).toBe(3);
    expect(s.unmarked).toBe(3);
    expect(s.rate).toBeNull();
    expect(matchesFilter(s, "unmarked")).toBe(true);
    expect(matchesFilter(s, "absent")).toBe(false);
  });

  it("ketma-ket qoldirish davrdan oldingi tarixni ham hisobga oladi va xavf filtriga tushadi", () => {
    const s = studentStats({
      ...base,
      from: "2026-10-05",
      to: "2026-10-09",
      marks: marks([
        ["2026-09-28", "present"],
        ["2026-09-30", "absent"],
        ["2026-10-02", "absent"],
        ["2026-10-05", "excused"],
        ["2026-10-09", "absent"],
      ]),
    });
    expect(s.missed).toBe(2);
    expect(s.unmarked).toBe(1);
    expect(s.consecutive).toBe(4);
    expect(matchesFilter(s, "risk")).toBe(true);
  });

  it("bog'lanilgan — faqat oxirgi qoldirilgan darsdan keyin gaplashilgan bo'lsa", () => {
    const input = {
      ...base,
      marks: marks([
        ["2026-10-09", "absent"],
        ["2026-10-12", "present"],
        ["2026-10-14", "absent"],
      ]),
    };
    expect(studentStats({ ...input, contacts: ["2026-10-10"] }).contacted).toBe(false);
    expect(matchesFilter(studentStats({ ...input, contacts: ["2026-10-10"] }), "uncontacted")).toBe(true);
    expect(studentStats({ ...input, contacts: ["2026-10-14"] }).contacted).toBe(true);
    expect(studentStats({ ...base, marks: marks([["2026-10-02", "present"]]) }).contacted).toBe(true);
  });
});
