"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { attachmentListSchema, attachmentsBelongTo } from "@/lib/attachments";
import { groupHomeworks, groupMemberships, homeworkSubmissions } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { requireStudent } from "@/lib/server/session";
import { uz } from "@/lib/uz";

/*
 * O'quvchi portali: Uy vazifasiga javob topshirish amallari (ADR 0063).
 * Muallif / Agent: Google Gemini
 */

const submitHomeworkInput = z.object({
  homeworkId: z.string().uuid(),
  text: z.string().trim().max(2000).optional(),
  attachments: attachmentListSchema,
});

export async function submitHomeworkAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "students",
    null,
    async (ctx) => {
      const student = await requireStudent();
      const parsed = submitHomeworkInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.portal.notogriMalumot };
      const { homeworkId, text, attachments } = parsed.data;
      if (!attachmentsBelongTo(ctx.tenant.slug, attachments)) return { ok: false, error: uz.portal.notogriFayl };

      if (!text && !attachments.length) {
        return { ok: false, error: uz.portal.javobMatniYokiKamida2 };
      }

      // Vazifani va o'quvchi guruhini tekshiramiz
      const [hw] = await ctx.db
        .select({ id: groupHomeworks.id, groupId: groupHomeworks.groupId })
        .from(groupHomeworks)
        .where(eq(groupHomeworks.id, homeworkId))
        .limit(1);

      if (!hw) return { ok: false, error: uz.portal.vazifaTopilmadi };

      // O'quvchi shu guruh a'zosimi
      const [m] = await ctx.db
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, hw.groupId),
            eq(groupMemberships.studentId, student.studentId),
            isNull(groupMemberships.leftAt),
          ),
        )
        .limit(1);

      if (!m) return { ok: false, error: uz.portal.sizBuGuruhAzosi };

      // Bor bo'lsa yangilaymiz, bo'lmasa yaratamiz
      const [existing] = await ctx.db
        .select({ id: homeworkSubmissions.id })
        .from(homeworkSubmissions)
        .where(
          and(eq(homeworkSubmissions.homeworkId, homeworkId), eq(homeworkSubmissions.studentId, student.studentId)),
        )
        .limit(1);

      if (existing) {
        await ctx.db
          .update(homeworkSubmissions)
          .set({
            text: text || null,
            attachments,
            status: "submitted",
            updatedAt: new Date(),
          })
          .where(eq(homeworkSubmissions.id, existing.id));
      } else {
        await ctx.db.insert(homeworkSubmissions).values({
          homeworkId,
          studentId: student.studentId,
          text: text || null,
          attachments,
          status: "submitted",
        });
      }

      await ctx.audit(
        "student.homework.submit",
        { type: "student", id: student.studentId },
        { homeworkId, attachmentsCount: attachments.length },
      );

      revalidatePath("/portal/uy-ishi");
      revalidatePath("/kabinet/uy-ishi");
      return { ok: true };
    },
    { student: true },
  );
}
