import { describe, expect, it } from "vitest";
import { eachDay, isHoliday, lessonDates, memberOn, monthRange, weekdayOf } from "./lessons";

const group = { days: ["mon", "wed", "fri"], startDate: "2026-10-01", branchId: "b1" };

describe("taqvim", () => {
  it("hafta kuni va oy chegaralari (UTC siljishisiz)", () => {
    expect(weekdayOf("2026-10-12")).toBe("mon");
    expect(weekdayOf("2026-10-18")).toBe("sun");
    expect(monthRange("2026-02")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(monthRange("2028-02")).toEqual(["2028-02-01", "2028-02-29"]);
    expect(eachDay("2026-12-30", "2027-01-02")).toEqual(["2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02"]);
  });

  it("guruh boshlanishidan oldingi kunlar kirmaydi", () => {
    // 2026-10-01 — payshanba. Du/Chor/Jum: 2,5,7,9,12,14,16,19,21,23,26,28,30 → 13 ta
    expect(lessonDates(group, "2026-10-01", "2026-10-31", [])).toHaveLength(13);
    expect(lessonDates({ ...group, startDate: "2026-10-15" }, "2026-10-01", "2026-10-31", [])[0]).toBe("2026-10-16");
  });

  it("dam olish kunlari: shu filial yoki hamma filiallar uchun", () => {
    const holidays = [
      { startDate: "2026-10-05", endDate: "2026-10-07", branchIds: null, affectsLessons: true },
      { startDate: "2026-10-09", endDate: "2026-10-09", branchIds: ["b2"], affectsLessons: true },
      // "Yo'q" tanlangan bayram darslarga ta'sir qilmaydi
      { startDate: "2026-10-12", endDate: "2026-10-12", branchIds: null, affectsLessons: false },
    ];
    const dates = lessonDates(group, "2026-10-01", "2026-10-12", holidays);
    expect(dates).toEqual(["2026-10-02", "2026-10-09", "2026-10-12"]);
    expect(isHoliday("2026-10-09", "b2", holidays)).toBe(true);
    expect(isHoliday("2026-10-09", "b1", holidays)).toBe(false);
  });

  it("a'zolik davri: chiqqan kun kirmaydi", () => {
    const m = { enrolledAt: "2026-10-05", leftAt: "2026-10-12" };
    expect(memberOn(m, "2026-10-04")).toBe(false);
    expect(memberOn(m, "2026-10-05")).toBe(true);
    expect(memberOn(m, "2026-10-12")).toBe(false);
    expect(memberOn({ enrolledAt: "2026-10-05", leftAt: null }, "2027-01-01")).toBe(true);
  });
});
