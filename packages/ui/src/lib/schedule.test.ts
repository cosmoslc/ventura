import { describe, expect, it } from "vitest";
import { hourRange, placeDay, toMinutes } from "./schedule";

const slot = (id: string, start: string, end: string) => ({ id, day: "mon", start, end });

describe("haftalik jadval joylashuvi", () => {
  it("daqiqalar va soat oralig'i", () => {
    expect(toMinutes("09:30")).toBe(570);
    expect(hourRange([])).toEqual([9, 18]);
    expect(hourRange([slot("a", "08:30", "10:00"), slot("b", "15:00", "16:20")])).toEqual([8, 17]);
  });

  it("kesishmaydigan darslar — bitta ustun", () => {
    const p = placeDay([slot("a", "09:00", "10:30"), slot("b", "10:30", "12:00")], 9);
    expect(p.map((x) => [x.slot.id, x.top, x.height, x.column, x.columns])).toEqual([
      ["a", 0, 90, 0, 1],
      ["b", 90, 90, 0, 1],
    ]);
  });

  it("kesishganlar yonma-yon, bo'shagan ustun qayta ishlatiladi", () => {
    const p = placeDay([slot("a", "09:00", "11:00"), slot("b", "09:30", "10:00"), slot("c", "10:00", "10:30")], 9);
    expect(p.map((x) => [x.slot.id, x.column, x.columns])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 1, 2],
    ]);
  });
});
