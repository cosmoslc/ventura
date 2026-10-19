import "server-only";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { groups, lessonGrades, settings } from "@ventura/db/schema/tenant";
import {
  GRADING_KEY,
  type GradeMark,
  type GradeSummary,
  type GradingSettings,
  parseGradingSettings,
  summarizeGrades,
} from "@/lib/grades";
import type { Db } from "./memberships";

/* Dars baholari (ADR 0061): sozlama, guruh-oy baholari va o'quvchi bo'yicha xulosa. */

export async function getGradingSettings(db: Db): Promise<GradingSettings> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, GRADING_KEY));
  return parseGradingSettings(row?.value);
}

/** Guruhning oraliqdagi baholari: `${studentId}|${date}` → baho */
export async function groupGradeMarks(
  db: Db,
  groupId: string,
  from: string,
  to: string,
  studentIds: readonly string[],
): Promise<Record<string, GradeMark>> {
  const out: Record<string, GradeMark> = {};
  if (!studentIds.length) return out;
  const rows = await db
    .select({
      studentId: lessonGrades.studentId,
      date: lessonGrades.date,
      score: lessonGrades.score,
      scale: lessonGrades.scale,
      homework: lessonGrades.homework,
    })
    .from(lessonGrades)
    .where(
      and(
        eq(lessonGrades.groupId, groupId),
        gte(lessonGrades.date, from),
        lte(lessonGrades.date, to),
        inArray(lessonGrades.studentId, [...studentIds]),
      ),
    );
  for (const r of rows) out[`${r.studentId}|${r.date}`] = { score: r.score, scale: r.scale, homework: r.homework };
  return out;
}

export interface StudentGradeGroup extends GradeSummary {
  groupId: string;
  groupName: string;
  /** Oxirgi baholar (yangidan eskiga) */
  recent: { date: string; score: number | null; scale: number; homework: boolean | null }[];
}

/** O'quvchi profili: guruhlar bo'yicha o'rtacha baho va uy vazifasi */
export async function studentGrades(db: Db, studentId: string, recent = 8): Promise<StudentGradeGroup[]> {
  const rows = await db
    .select({
      groupId: lessonGrades.groupId,
      groupName: groups.name,
      date: lessonGrades.date,
      score: lessonGrades.score,
      scale: lessonGrades.scale,
      homework: lessonGrades.homework,
    })
    .from(lessonGrades)
    .innerJoin(groups, eq(groups.id, lessonGrades.groupId))
    .where(eq(lessonGrades.studentId, studentId))
    .orderBy(asc(groups.name), asc(lessonGrades.date));
  const byGroup = new Map<string, { name: string; marks: typeof rows }>();
  for (const r of rows) {
    const g = byGroup.get(r.groupId) ?? { name: r.groupName, marks: [] };
    g.marks.push(r);
    byGroup.set(r.groupId, g);
  }
  return [...byGroup.entries()].map(([groupId, g]) => ({
    groupId,
    groupName: g.name,
    ...summarizeGrades(g.marks),
    recent: g.marks
      .slice(-recent)
      .reverse()
      .map(({ date, score, scale, homework }) => ({ date, score, scale, homework })),
  }));
}
