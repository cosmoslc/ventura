import { describe, expect, it } from "vitest";
import { attendanceRate, monthBounds, retentionRate } from "./teacher-stats";

describe("o'qituvchi ko'rsatkichlari", () => {
  it("oy oralig'i: o'tgan oy — oxirgi kungacha, joriy oy — bugungacha", () => {
    expect(monthBounds("2026-09", "2026-10-13")).toEqual({ start: "2026-09-01", end: "2026-09-30" });
    expect(monthBounds("2026-10", "2026-10-13")).toEqual({ start: "2026-10-01", end: "2026-10-13" });
    expect(monthBounds("2028-02", "2028-12-01")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
  });

  it("retention: oy boshidagilardan oy davomida chiqmaganlar", () => {
    const spans = [
      { enrolledAt: "2026-08-01", leftAt: null },
      { enrolledAt: "2026-08-10", leftAt: "2026-09-15" }, // oy ichida chiqdi
      { enrolledAt: "2026-07-01", leftAt: "2026-08-20" }, // oy boshidan oldin chiqqan — hisobda yo'q
      { enrolledAt: "2026-09-05", leftAt: null }, // oy ichida qo'shilgan — hisobda yo'q
      { enrolledAt: "2026-06-01", leftAt: "2026-10-02" }, // keyingi oyda chiqdi — qoldi
    ];
    expect(retentionRate(spans, "2026-09", "2026-10-13")).toBe(67);
  });

  it("oy boshida hech kim bo'lmasa — hisoblanmaydi", () => {
    expect(retentionRate([{ enrolledAt: "2026-10-05", leftAt: null }], "2026-10", "2026-10-13")).toBeNull();
  });

  it("davomat foizi", () => {
    expect(attendanceRate(47, 50)).toBe(94);
    expect(attendanceRate(0, 0)).toBeNull();
  });
});
