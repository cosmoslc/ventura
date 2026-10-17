"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { studentNotes, students } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { DEBTOR_NOTE_KINDS } from "./data";

/*
 * Qarzdor bilan bog'lanish izohi (EDU-CRM-FIXES 5.2): o'quvchi eslatmalariga ("student_notes") yoziladi, shuning
 * uchun profildagi "Eslatma" tabida ham ko'rinadi; qarzdorlar jadvalida faqat eng oxirgisi chiqadi. Ruxsat —
 * "Qarzdorlarga eslatma yuborish" yoki o'quvchini tahrirlash. Arxivdagi o'quvchiga ham yozish mumkin (qarzi qolgan).
 */

export async function addDebtorNoteAction(input: unknown): Promise<ActionResult> {
  return crmAction("debtors", ["finance.debtors_remind", "students.edit"], async (ctx) => {
    const parsed = z
      .object({
        studentId: z.uuid(),
        kind: z.enum(DEBTOR_NOTE_KINDS),
        text: z.string().trim().min(1, uz.students.noteRequired).max(2000),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const [s] = await ctx.db.select().from(students).where(eq(students.id, parsed.data.studentId));
    if (!s || !ctx.branch.options.some((b) => b.id === s.branchId)) return { ok: false, error: uz.common.gone };
    const [note] = await ctx.db
      .insert(studentNotes)
      .values({
        studentId: s.id,
        kind: parsed.data.kind,
        text: parsed.data.text,
        authorId: ctx.staff.id,
        authorName: ctx.staff.name,
      })
      .returning({ id: studentNotes.id });
    await ctx.audit(
      "student.note.create",
      { type: "student", id: s.id },
      { noteId: note!.id, kind: parsed.data.kind, source: "debtors" },
    );
    revalidatePath("/debtors");
    revalidatePath(`/students/${s.id}`);
    return { ok: true };
  });
}
