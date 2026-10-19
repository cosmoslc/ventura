import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRADING,
  gradePercent,
  gradingSettingsInput,
  parseGradingSettings,
  scoreBlocked,
  scoreLabel,
  summarizeGrades,
  validScore,
} from "./grades";

describe("baholash sozlamasi", () => {
  it("standart — 5 ballik; buzilgan qiymat — standart", () => {
    expect(DEFAULT_GRADING).toEqual({ scale: 5 });
    expect(parseGradingSettings({ scale: 7 })).toEqual(DEFAULT_GRADING);
    expect(parseGradingSettings({ scale: 100 })).toEqual({ scale: 100 });
  });

  it("forma: faqat 5, 10, 100; ortiqcha kalit rad etiladi", () => {
    expect(gradingSettingsInput.safeParse({ scale: 10 }).success).toBe(true);
    expect(gradingSettingsInput.safeParse({ scale: 12 }).success).toBe(false);
    expect(gradingSettingsInput.safeParse({ scale: 10, x: 1 }).success).toBe(false);
  });
});

describe("baho", () => {
  it("shkala chegarasi", () => {
    expect(validScore(5, 5)).toBe(true);
    expect(validScore(6, 5)).toBe(false);
    expect(validScore(0, 10)).toBe(false);
    expect(validScore(2.5, 10)).toBe(false);
    expect(validScore(100, 100)).toBe(true);
  });

  it("foiz va katak yozuvi", () => {
    expect(gradePercent(4, 5)).toBe(80);
    expect(gradePercent(7, 10)).toBe(70);
    expect(scoreLabel(4, 5, 5)).toBe("4");
    expect(scoreLabel(4, 5, 10)).toBe("4/5");
  });

  it("kelmagan va sababli — baho yo'q", () => {
    expect(scoreBlocked("absent")).toBe(true);
    expect(scoreBlocked("excused")).toBe(true);
    expect(scoreBlocked("present")).toBe(false);
    expect(scoreBlocked(undefined)).toBe(false);
  });

  it("o'rtacha turli shkalalarda foizda; uy vazifasi alohida", () => {
    expect(
      summarizeGrades([
        { score: 5, scale: 5, homework: true },
        { score: 6, scale: 10, homework: false },
        { score: null, scale: 5, homework: true },
      ]),
    ).toEqual({ average: 80, graded: 2, homeworkDone: 2, homeworkMarked: 3 });
    expect(summarizeGrades([])).toEqual({ average: null, graded: 0, homeworkDone: 0, homeworkMarked: 0 });
  });
});
