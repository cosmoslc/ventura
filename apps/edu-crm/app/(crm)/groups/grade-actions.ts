"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { groups, lessonGrades } from "@ventura/db/schema/tenant";
import { coinMeta } from "@/lib/coins";
import { scoreBlocked, validScore } from "@/lib/grades";
import { markable } from "@/lib/lessons";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { groupAttendance } from "@/lib/server/attendance";
import { coinRuntime, syncHomeworkCoin } from "@/lib/server/coins";
import { getGradingSettings } from "@/lib/server/grades";
import { todayTashkent } from "@/lib/server/memberships";
import { ownsGroup } from "@/lib/server/teacher-scope";
import { uz } from "@/lib/uz";

/*
 * Dars bahosi va uy vazifasi (ADR 0061). Qoidalar davomat bilan bir xil: bugungi dars — grades.mark, o'tgan
 * kunlar — grades.edit_past; kelajakdagi, dars bo'lmagan kun, guruhda bo'lmagan yoki muzlatilgan o'quvchi
 * baholanmaydi. Davomatda "Yo'q"/"Sababli" bo'lsa baho qo'yilmaydi, uy vazifasi belgisi qo'yiladi.
 * Uy vazifasi "bajardi" — coin (c) qoidasi, baho bilan bitta tranzaksiyada.
 */

const FEATURE = "grades";
const PERMS = ["grades.mark", "grades.edit_past"] as const;

const gradeInput = z.object({
  groupId: z.uuid(),
  studentId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** null — baho yo'q */
  score: z.number().int().min(1).max(100).nullable(),
  /** null — belgilanmagan */
  homework: z.boolean().nullable(),
});

export async function saveGradeAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    PERMS,
    async (ctx) => {
      const parsed = gradeInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const v = parsed.data;
      const [g] = await ctx.db
        .select()
        .from(groups)
        .where(and(eq(groups.id, v.groupId), isNull(groups.archivedAt)));
      if (!g || !ctx.branch.options.some((b) => b.id === g.branchId) || !ownsGroup(ctx.staff, g))
        return { ok: false, error: uz.common.gone };
      const today = todayTashkent();
      if (v.date > today) return { ok: false, error: uz.grades.future };
      if (v.date < today) {
        const gate = await ctx.requireAny(["grades.edit_past"]);
        if (gate) return gate.pending ? gate : { ok: false, error: uz.grades.pastForbidden };
      }
      const data = await groupAttendance(ctx.db, g, v.date.slice(0, 7));
      if (!data.dates.includes(v.date)) return { ok: false, error: uz.grades.notLessonDay };
      const member = data.members.find((m) => m.studentId === v.studentId);
      if (!member || !markable(member.periods, v.date)) return { ok: false, error: uz.grades.notMember };

      const where = and(
        eq(lessonGrades.groupId, v.groupId),
        eq(lessonGrades.studentId, v.studentId),
        eq(lessonGrades.date, v.date),
      );
      const [before] = await ctx.db
        .select({ score: lessonGrades.score, scale: lessonGrades.scale, homework: lessonGrades.homework })
        .from(lessonGrades)
        .where(where);
      // O'zgarmagan baho o'z shkalasida qoladi; yangi baho — joriy shkalada
      const scale = before && before.score === v.score ? before.scale : (await getGradingSettings(ctx.db)).scale;
      if (v.score !== null && !validScore(v.score, scale)) return { ok: false, error: uz.grades.scoreInvalid(scale) };
      if (v.score !== null && v.score !== (before?.score ?? null)) {
        if (scoreBlocked(data.marks[`${v.studentId}|${v.date}`]?.status))
          return { ok: false, error: uz.grades.absentNoScore };
      }
      if ((before?.score ?? null) === v.score && (before?.homework ?? null) === v.homework) return { ok: true };

      const rt = await coinRuntime(ctx.tenant, ctx.db);
      const coin = await ctx.db.transaction(async (tx) => {
        if (v.score === null && v.homework === null) {
          await tx.delete(lessonGrades).where(where);
        } else {
          const row = { score: v.score, scale, homework: v.homework, markedBy: ctx.staff.id };
          await tx
            .insert(lessonGrades)
            .values({ groupId: v.groupId, studentId: v.studentId, date: v.date, ...row })
            .onConflictDoUpdate({
              target: [lessonGrades.tenantId, lessonGrades.groupId, lessonGrades.studentId, lessonGrades.date],
              set: { ...row, updatedAt: new Date() },
            });
        }
        return syncHomeworkCoin(tx, rt, {
          studentId: v.studentId,
          groupId: v.groupId,
          date: v.date,
          homework: v.homework,
        });
      });
      await ctx.audit(
        "grade.mark",
        { type: "student", id: v.studentId },
        {
          group: g.name,
          groupId: v.groupId,
          date: v.date,
          from: before ?? null,
          to: v.score === null && v.homework === null ? null : { score: v.score, scale, homework: v.homework },
          ...coinMeta([coin]),
        },
      );
      revalidatePath(`/groups/${v.groupId}`);
      revalidatePath(`/students/${v.studentId}`);
      return { ok: true };
    },
    { approval: { action: "grades.mark", input }, teacher: true },
  );
}
