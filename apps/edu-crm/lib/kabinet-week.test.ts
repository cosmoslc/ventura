import { describe, expect, it } from "vitest";
import { parseWeek, weekDays, weekItems, weekStart } from "./kabinet-week";

describe("kabinet haftasi", () => {
  it("hafta dushanbadan", () => {
    expect(weekStart("2026-10-19")).toBe("2026-10-19"); // dushanba
    expect(weekStart("2026-10-25")).toBe("2026-10-19"); // yakshanba
    expect(weekStart("2026-10-21")).toBe("2026-10-19");
    expect(weekDays("2026-10-19").map((d) => `${d.key}:${d.date}`)).toEqual([
      "mon:2026-10-19",
      "tue:2026-10-20",
      "wed:2026-10-21",
      "thu:2026-10-22",
      "fri:2026-10-23",
      "sat:2026-10-24",
      "sun:2026-10-25",
    ]);
  });

  it("manzildagi hafta: noto'g'ri — joriy hafta", () => {
    expect(parseWeek("2026-11-05", "2026-10-21")).toBe("2026-11-02");
    expect(parseWeek("yomon", "2026-10-21")).toBe("2026-10-19");
    expect(parseWeek(undefined, "2026-10-21")).toBe("2026-10-19");
  });

  it("har guruh dars kunlarida", () => {
    const items = weekItems([{ id: "g", days: ["mon", "wed"], startTime: "09:00", endTime: "10:30" }]);
    expect(items.map((i) => [i.slotId, i.day])).toEqual([
      ["g|mon", "mon"],
      ["g|wed", "wed"],
    ]);
  });
});
