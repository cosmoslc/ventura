"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { groups, studentNotes, students } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { uz } from "@/lib/uz";

/*
 * Davomat hisobotidan bog'lanish natijasi (ADR 0014): o'quvchi eslatmalari tarixiga yoziladi. "Gaplashildi" —
 * "Qo'ng'iroq" turidagi eslatma (hisobotda "bog'lanildi" deb hisoblanadi), "javob bermadi" — oddiy eslatma.
 */

export async function logContactAction(input: unknown): Promise<ActionResult> {
  return crmAction("attendance", ["attendance.student_mark", "attendance.student_edit_past"], async (ctx) => {
    const parsed = z
      .object({
        studentId: z.uuid(),
        groupId: z.uuid(),
        answered: z.boolean(),
        text: z.string().trim().max(1000).default(""),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const v = parsed.data;
    const [[s], [g]] = await Promise.all([
      ctx.db
        .select({ id: students.id, branchId: students.branchId })
        .from(students)
        .where(and(eq(students.id, v.studentId), isNull(students.archivedAt))),
      ctx.db
        .select({ id: groups.id, name: groups.name, branchId: groups.branchId })
        .from(groups)
        .where(eq(groups.id, v.groupId)),
    ]);
    const inScope = (branchId: string) => ctx.branch.options.some((b) => b.id === branchId);
    if (!s || !g || !inScope(s.branchId) || !inScope(g.branchId)) return { ok: false, error: uz.common.gone };
    const kind = v.answered ? "call" : "note";
    const [note] = await ctx.db
      .insert(studentNotes)
      .values({
        studentId: s.id,
        kind,
        text: uz.attendance.report.callNoteText(v.answered, g.name, v.text),
        authorId: ctx.staff.id,
        authorName: ctx.staff.name,
      })
      .returning({ id: studentNotes.id });
    await ctx.audit(
      "student.note.create",
      { type: "student", id: s.id },
      {
        noteId: note!.id,
        kind,
        source: "attendance",
        groupId: g.id,
        answered: v.answered,
      },
    );
    revalidatePath("/attendance");
    revalidatePath(`/students/${s.id}`);
    return { ok: true };
  });
}
