import { describe, expect, it } from "vitest";
import { groupStats, masteryLevel } from "./kabinet-stats";

const members = [
  { studentId: "a", name: "Ali" },
  { studentId: "b", name: "Vali" },
  { studentId: "c", name: "Sami" },
];

describe("guruh statistikasi (kabinet)", () => {
  it("davomat, o'rtacha baho (turli shkala), uy vazifasi, eng yuqori va eng past", () => {
    const s = groupStats({
      members,
      attendance: {
        "a|2026-11-02": { status: "present" },
        "a|2026-11-04": { status: "late" },
        "b|2026-11-02": { status: "absent" },
        "b|2026-11-04": { status: "present" },
        "x|2026-11-02": { status: "present" },
      },
      grades: {
        "a|2026-11-02": { score: 5, scale: 5, homework: true },
        "a|2026-11-04": { score: 9, scale: 10, homework: true },
        "b|2026-11-04": { score: 3, scale: 5, homework: false },
        "x|2026-11-04": { score: 1, scale: 5, homework: false },
      },
    });
    expect(s.students.map((x) => [x.studentId, x.attendance, x.average, x.homeworkDone, x.homeworkMarked])).toEqual([
      ["a", 100, 95, 2, 2],
      ["b", 50, 60, 0, 1],
      ["c", null, null, 0, 0],
    ]);
    // Guruhda yo'q o'quvchi ("x") hisobga kirmaydi
    expect(s.mastery).toBe(83);
    expect(s.attendance).toBe(75);
    expect(s.homework).toBe(67);
    expect(s.best?.studentId).toBe("a");
    expect(s.worst?.studentId).toBe("b");
  });

  it("baho yo'q — null; bitta bahoda eng past yo'q", () => {
    const empty = groupStats({ members, attendance: {}, grades: {} });
    expect([empty.mastery, empty.attendance, empty.homework, empty.best, empty.worst]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
    const one = groupStats({
      members,
      attendance: {},
      grades: { "a|2026-11-02": { score: 4, scale: 5, homework: null } },
    });
    expect(one.best?.studentId).toBe("a");
    expect(one.worst).toBeNull();
  });

  it("o'zlashtirish darajalari", () => {
    expect([masteryLevel(90), masteryLevel(85), masteryLevel(70), masteryLevel(50), masteryLevel(49)]).toEqual([
      "excellent",
      "excellent",
      "good",
      "fair",
      "low",
    ]);
  });
});
