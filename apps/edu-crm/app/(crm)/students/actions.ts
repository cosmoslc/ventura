"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone } from "@ventura/auth/policy";
import { can } from "@ventura/auth/staff/policy";
import { STUDENT_NOTE_KINDS, courses, groupMemberships, studentNotes, students } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { syncMembershipsWithStatus, todayTashkent } from "@/lib/server/memberships";
import { firstError, studentInput, studentStatusInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * O'quvchilar (EDU-CRM-PLAN E1c). Ruxsatlar eski tizimdagi "Talabalar Boshqaruvi" toifasidan: qo'shish
 * students.create, tahrirlash students.edit, muzlatish students.freeze, o'chirish (arxiv) students.delete.
 * Filial cheklovi: xodim faqat o'z filiallaridagi o'quvchilarni ko'radi va o'zgartiradi.
 */

const FEATURE = "students";
const PATH = "/students";
const uuid = z.uuid();

/** Faol o'quvchi, xodimning filiallaridan birida */
async function loadStudent(ctx: ActionCtx, id: unknown) {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return null;
  const [s] = await ctx.db
    .select()
    .from(students)
    .where(and(eq(students.id, parsed.data), isNull(students.archivedAt)));
  if (!s || !ctx.branch.options.some((b) => b.id === s.branchId)) return null;
  return s;
}

export async function saveStudentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const raw = z.object({ id: uuid.optional() }).safeParse(input);
  const editing = raw.success && !!raw.data.id;
  return crmAction<{ id: string }>(FEATURE, editing ? "students.edit" : "students.create", async (ctx) => {
    const { db, branch, audit } = ctx;
    const parsed = studentInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;

    const existing = v.id ? await loadStudent(ctx, v.id) : null;
    if (v.id && !existing) return { ok: false, error: uz.common.gone };
    const branchId = resolveBranch(branch, v.branchId) ?? existing?.branchId ?? null;
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    if (v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };

    const phone = `+998${v.phone}`;
    const [dup] = await db
      .select({ id: students.id })
      .from(students)
      .where(and(eq(students.phone, phone), isNull(students.archivedAt), v.id ? ne(students.id, v.id) : undefined));
    if (dup) return { ok: false, error: uz.students.phoneTaken };

    if (v.interestedCourseId) {
      const [c] = await db.select({ id: courses.id }).from(courses).where(eq(courses.id, v.interestedCourseId));
      if (!c) return { ok: false, error: uz.common.gone };
    }

    const values = {
      branchId,
      name: v.name,
      phone,
      parentName: v.parentName || null,
      parentPhone: v.parentPhone ? `+998${v.parentPhone}` : null,
      birthDate: v.birthDate || null,
      gender: v.gender,
      school: v.school || null,
      grade: v.grade || null,
      address: v.address || null,
      source: v.source || null,
      interestedCourseId: v.interestedCourseId,
      joinedAt: v.joinedAt,
      note: v.note || null,
    };

    if (existing) {
      await db.update(students).set(values).where(eq(students.id, existing.id));
      const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => existing[k] !== values[k]);
      await audit("student.update", { type: "student", id: existing.id }, { name: v.name, fields: changed });
      revalidatePath(PATH);
      return { ok: true, id: existing.id };
    }

    const [row] = await db
      .insert(students)
      .values({ ...values, createdBy: ctx.staff.id })
      .returning({ id: students.id });
    await audit(
      "student.create",
      { type: "student", id: row!.id },
      {
        name: v.name,
        phone: formatPhone(phone),
        branchId,
      },
    );
    revalidatePath(PATH);
    return { ok: true, id: row!.id };
  });
}

export async function setStudentStatusAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, ["students.edit", "students.freeze"], async (ctx) => {
    const parsed = studentStatusInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { status, reason } = parsed.data;
    const s = await loadStudent(ctx, parsed.data.id);
    if (!s) return { ok: false, error: uz.common.gone };
    // Muzlatish va muzlatishdan chiqarish — students.freeze, qolgan holatlar — students.edit
    const freezing = status === "paused" || s.status === "paused";
    if (!can(ctx.staff.access, freezing ? "students.freeze" : "students.edit")) {
      return { ok: false, error: uz.common.forbidden };
    }
    if (s.status === status && (s.statusNote ?? "") === reason) return { ok: true };
    // Holat va guruhdagi a'zoliklar birga o'zgaradi (muzlatish to'lov hisobini ham to'xtatadi — ADR 0012)
    const memberships = await ctx.db.transaction(async (tx) => {
      await tx
        .update(students)
        .set({ status, statusNote: reason || null, statusChangedAt: new Date() })
        .where(eq(students.id, s.id));
      return s.status === status ? 0 : syncMembershipsWithStatus(tx, s.id, s.status, status, reason || null);
    });
    await ctx.audit(
      "student.status",
      { type: "student", id: s.id },
      {
        name: s.name,
        from: s.status,
        to: status,
        ...(reason ? { reason } : {}),
        ...(memberships ? { memberships } : {}),
      },
    );
    revalidatePath(PATH);
    return { ok: true };
  });
}

export async function archiveStudentAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.delete", async (ctx) => {
    const parsed = z.object({ id: uuid, reason: z.string().trim().max(500).default("") }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const s = await loadStudent(ctx, parsed.data.id);
    if (!s) return { ok: false, error: uz.common.gone };
    // Arxivga o'tgan o'quvchining ochiq a'zoliklari shu kun bilan yopiladi
    await ctx.db.transaction(async (tx) => {
      await tx
        .update(students)
        .set({ archivedAt: new Date(), archiveReason: parsed.data.reason || null, archivedBy: ctx.staff.id })
        .where(eq(students.id, s.id));
      await tx
        .update(groupMemberships)
        .set({
          status: "left",
          leftAt: todayTashkent(),
          leftReason: parsed.data.reason || uz.groups.archivedStudentReason,
        })
        .where(and(eq(groupMemberships.studentId, s.id), isNull(groupMemberships.leftAt)));
    });
    await ctx.audit(
      "student.archive",
      { type: "student", id: s.id },
      {
        name: s.name,
        ...(parsed.data.reason ? { reason: parsed.data.reason } : {}),
      },
    );
    revalidatePath(PATH);
    revalidatePath("/archive");
    return { ok: true };
  });
}

export async function addStudentNoteAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.edit", async (ctx) => {
    const parsed = z
      .object({
        studentId: uuid,
        kind: z.enum(STUDENT_NOTE_KINDS),
        text: z.string().trim().min(1, uz.students.noteRequired).max(2000),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const s = await loadStudent(ctx, parsed.data.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
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
    await ctx.audit("student.note.create", { type: "student", id: s.id }, { noteId: note!.id, kind: parsed.data.kind });
    revalidatePath(`${PATH}/${s.id}`);
    return { ok: true };
  });
}

export async function deleteStudentNoteAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.edit", async (ctx) => {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [note] = await ctx.db.select().from(studentNotes).where(eq(studentNotes.id, parsed.data));
    if (!note) return { ok: false, error: uz.common.gone };
    const s = await loadStudent(ctx, note.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    await ctx.db.delete(studentNotes).where(eq(studentNotes.id, note.id));
    await ctx.audit(
      "student.note.delete",
      { type: "student", id: s.id },
      {
        noteId: note.id,
        kind: note.kind,
        text: note.text.slice(0, 200),
      },
    );
    revalidatePath(`${PATH}/${s.id}`);
    return { ok: true };
  });
}
