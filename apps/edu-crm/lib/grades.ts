import { z } from "zod";

/*
 * Dars baholari (ADR 0061). Toza qism: shkala sozlamasi (`settings` jadvalida kalit `grading`), baho tekshiruvi va
 * o'rtacha. Shkalalar turlicha bo'lgan baholar foizda solishtiriladi.
 */

export const GRADING_KEY = "grading";

export const GRADE_SCALES = [5, 10, 100] as const;
export type GradeScale = (typeof GRADE_SCALES)[number];

export const gradingSettingsSchema = z.object({
  scale: z.union([z.literal(5), z.literal(10), z.literal(100)]).default(5),
});
export type GradingSettings = z.infer<typeof gradingSettingsSchema>;

export const gradingSettingsInput = gradingSettingsSchema.strict();
export const DEFAULT_GRADING: GradingSettings = gradingSettingsSchema.parse({});

export function parseGradingSettings(value: unknown): GradingSettings {
  const parsed = gradingSettingsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : DEFAULT_GRADING;
}

/** Baho shkalada: 1 dan shkala chegarasigacha butun son */
export const validScore = (score: number, scale: number) => Number.isInteger(score) && score > 0 && score <= scale;

/** Baho foizda (butun) */
export const gradePercent = (score: number, scale: number) => Math.round((score / scale) * 100);

export interface GradeMark {
  score: number | null;
  scale: number;
  homework: boolean | null;
}

export interface GradeSummary {
  /** O'rtacha baho foizda; baho yo'q — null */
  average: number | null;
  graded: number;
  homeworkDone: number;
  /** Uy vazifasi belgilangan darslar */
  homeworkMarked: number;
}

export function summarizeGrades(marks: readonly GradeMark[]): GradeSummary {
  const scored = marks.filter((m): m is GradeMark & { score: number } => m.score !== null);
  const hw = marks.filter((m) => m.homework !== null);
  return {
    average: scored.length
      ? Math.round(scored.reduce((s, m) => s + (m.score / m.scale) * 100, 0) / scored.length)
      : null,
    graded: scored.length,
    homeworkDone: hw.filter((m) => m.homework).length,
    homeworkMarked: hw.length,
  };
}

/** Katakdagi yozuv: joriy shkalada — faqat raqam, boshqa shkalada — "4/5" */
export const scoreLabel = (score: number, scale: number, current: number) =>
  scale === current ? String(score) : `${score}/${scale}`;

/** Davomatda kelmagan yoki sababli bo'lsa baho qo'yilmaydi (uy vazifasi belgisi qo'yiladi) */
export const scoreBlocked = (attendanceStatus: string | null | undefined) =>
  attendanceStatus === "absent" || attendanceStatus === "excused";
