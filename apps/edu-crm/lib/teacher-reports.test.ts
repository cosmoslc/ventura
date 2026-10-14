import { describe, expect, it } from "vitest";
import { type TeacherCounts, lessonMinutes, rankTeachers, teacherRow, teacherTotal } from "./teacher-reports";

const counts = (over: Partial<TeacherCounts>): TeacherCounts => ({
  teacherId: "t",
  name: "Ustoz",
  groups: 1,
  students: 10,
  lessons: 12,
  minutes: 12 * 90,
  markedLessons: 9,
  attended: 80,
  marks: 100,
  base: 10,
  left: 1,
  activated: 3,
  trialLeft: 1,
  firstCame: 4,
  firstWon: 1,
  salary: null,
  ...over,
});

describe("o'qituvchi reytingi", () => {
  it("foizlar sanoqlardan; maxraj nol — null", () => {
    expect(teacherRow(counts({}))).toMatchObject({
      hours: 18,
      markedRate: 75,
      attendance: 80,
      retention: 90,
      trialConv: 75,
      firstConv: 25,
    });
    expect(
      teacherRow(counts({ lessons: 0, marks: 0, base: 0, activated: 0, trialLeft: 0, firstCame: 0 })),
    ).toMatchObject({
      markedRate: null,
      attendance: null,
      retention: null,
      trialConv: null,
      firstConv: null,
    });
  });

  it("jami — sanoqlar yig'indisidan, maosh faqat bor bo'lsa", () => {
    const total = teacherTotal(
      [counts({ base: 10, left: 1, salary: 100 }), counts({ base: 30, left: 9, salary: 50 })],
      "Jami",
    );
    // (40 − 10) / 40, o'rtachalar o'rtachasi (80) emas
    expect(total.retention).toBe(75);
    expect(total.salary).toBe(150);
    expect(teacherTotal([counts({})], "Jami").salary).toBeNull();
  });

  it("tartib: ushlab turish, keyin davomat; hisoblanmagan oxirida", () => {
    const rows = rankTeachers([
      teacherRow(counts({ name: "A", base: 0 })),
      teacherRow(counts({ name: "B", left: 2 })),
      teacherRow(counts({ name: "C", left: 2, attended: 95 })),
      teacherRow(counts({ name: "D", left: 0 })),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["D", "C", "B", "A"]);
    expect(lessonMinutes("15:00", "16:30")).toBe(90);
  });
});
