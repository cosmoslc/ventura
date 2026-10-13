"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ATTENDANCE_STATUSES, attendance, groups } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { markable } from "@/lib/lessons";
import { groupAttendance } from "@/lib/server/attendance";
import { todayTashkent } from "@/lib/server/memberships";
import { uz } from "@/lib/uz";

/*
 * Davomat belgilash (EDU-CRM-PLAN E2, ADR 0014). Ruxsat: bugungi dars — attendance.student_mark, o'tgan kunlar —
 * attendance.student_edit_past (eski tizimda sana tekshirilmas edi). Kelajakdagi, dars bo'lmagan yoki bayram kuni,
 * guruhda bo'lmagan yoki muzlatilgan o'quvchi belgilanmaydi.
 */

const FEATURE = "attendance";
const PERMS = ["attendance.student_mark", "attendance.student_edit_past"] as const;
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Guruh (filial cheklovi bilan), sana qoidalari va shu kun belgilanadigan o'quvchilar */
async function lessonContext(ctx: ActionCtx, groupId: string, date: string) {
  const [g] = await ctx.db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)));
  if (!g || !ctx.branch.options.some((b) => b.id === g.branchId)) return { ok: false as const, error: uz.common.gone };
  const today = todayTashkent();
  if (date > today) return { ok: false as const, error: uz.attendance.future };
  if (date < today) {
    const gate = await ctx.requireAny(["attendance.student_edit_past"]);
    if (gate) return gate.pending ? gate : { ok: false as const, error: uz.attendance.pastForbidden };
  } else {
    const gate = await ctx.requireAny(["attendance.student_mark", "attendance.student_edit_past"]);
    if (gate) return gate;
  }
  const data = await groupAttendance(ctx.db, g, date.slice(0, 7));
  if (!data.dates.includes(date)) return { ok: false as const, error: uz.attendance.notLessonDay };
  return { ok: true as const, group: g, data };
}

function refresh(groupId: string) {
  revalidatePath(`/groups/${groupId}`);
  revalidatePath("/attendance");
}

export async function markAttendanceAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    PERMS,
    async (ctx) => {
      const parsed = z
        .object({
          groupId: z.uuid(),
          studentId: z.uuid(),
          date: day,
          /** null — belgini olib tashlash */
          status: z.enum(ATTENDANCE_STATUSES).nullable(),
          reason: z.string().trim().max(500).default(""),
        })
        .safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const v = parsed.data;
      const lc = await lessonContext(ctx, v.groupId, v.date);
      if (!lc.ok) return lc;
      const member = lc.data.members.find((m) => m.studentId === v.studentId);
      if (!member || !markable(member.periods, v.date)) return { ok: false, error: uz.attendance.notMember };

      const before = lc.data.marks[`${v.studentId}|${v.date}`] ?? null;
      if (v.status === null) {
        if (!before) return { ok: true };
        await ctx.db
          .delete(attendance)
          .where(
            and(eq(attendance.groupId, v.groupId), eq(attendance.studentId, v.studentId), eq(attendance.date, v.date)),
          );
      } else {
        // Sabab faqat kelmagan/kechikkan/sababli uchun
        const reason = v.status === "present" ? null : v.reason || null;
        if (before && before.status === v.status && before.reason === reason) return { ok: true };
        await ctx.db
          .insert(attendance)
          .values({
            groupId: v.groupId,
            studentId: v.studentId,
            date: v.date,
            status: v.status,
            reason,
            markedBy: ctx.staff.id,
          })
          .onConflictDoUpdate({
            target: [attendance.tenantId, attendance.groupId, attendance.studentId, attendance.date],
            set: { status: v.status, reason, markedBy: ctx.staff.id, updatedAt: new Date() },
          });
      }
      await ctx.audit(
        "attendance.mark",
        { type: "student", id: v.studentId },
        {
          group: lc.group.name,
          groupId: v.groupId,
          date: v.date,
          from: before?.status ?? null,
          to: v.status,
          ...(v.status && v.status !== "present" && v.reason ? { reason: v.reason } : {}),
        },
      );
      refresh(v.groupId);
      return { ok: true };
    },
    { approval: { action: "attendance.mark", input: input } },
  );
}

/** Belgilanmagan o'quvchilarni "Bor" qilish — mavjud belgilar va sabablar o'zgarmaydi (eski tizim ustidan yozar edi) */
export async function markRestPresentAction(input: unknown): Promise<ActionResult<{ marked: number }>> {
  return crmAction<{ marked: number }>(
    FEATURE,
    PERMS,
    async (ctx) => {
      const parsed = z.object({ groupId: z.uuid(), date: day }).safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const { groupId, date } = parsed.data;
      const lc = await lessonContext(ctx, groupId, date);
      if (!lc.ok) return lc;
      const targets = lc.data.members.filter(
        (m) => markable(m.periods, date) && !lc.data.marks[`${m.studentId}|${date}`],
      );
      if (!targets.length) return { ok: true, marked: 0 };
      await ctx.db
        .insert(attendance)
        .values(
          targets.map((m) => ({
            groupId,
            studentId: m.studentId,
            date,
            status: "present" as const,
            markedBy: ctx.staff.id,
          })),
        )
        .onConflictDoNothing();
      await ctx.audit(
        "attendance.mark_all",
        { type: "group", id: groupId },
        { group: lc.group.name, date, marked: targets.length },
      );
      refresh(groupId);
      return { ok: true, marked: targets.length };
    },
    { approval: { action: "attendance.markRest", input: input } },
  );
}
