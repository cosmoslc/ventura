"use server";

import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone } from "@ventura/auth/policy";
import { STUDENT_NOTE_KINDS, groupMemberships, settings, studentNotes, students } from "@ventura/db/schema/tenant";
import { STUDENT_FIELDS_KEY, cleanCustomData, formFieldsSchema, missingRequired } from "@/lib/form-fields";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { closePauses, syncMembershipsWithStatus, todayTashkent } from "@/lib/server/memberships";
import { firstError, studentInput, studentStatusInput, studentTransferInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { getStudentFields } from "./data";

/*
 * O'quvchilar (EDU-CRM-PLAN E1c). Ruxsatlar eski tizimdagi "Talabalar Boshqaruvi" toifasidan: qo'shish
 * students.create, tahrirlash students.edit, muzlatish students.freeze, o'chirish (arxiv) students.delete.
 * Filial cheklovi: xodim faqat o'z filiallaridagi o'quvchilarni ko'radi va o'zgartiradi. Filial tahrirlashda
 * o'zgarmaydi — faqat "Boshqa filialga o'tkazish" amali bilan (ochiq a'zoliklar yopiladi, ADR 0020).
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
  return crmAction<{ id: string }>(
    FEATURE,
    editing ? "students.edit" : "students.create",
    async (ctx) => {
      const { db, branch, audit } = ctx;
      const parsed = studentInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;

      const existing = v.id ? await loadStudent(ctx, v.id) : null;
      if (v.id && !existing) return { ok: false, error: uz.common.gone };
      const branchId = existing ? existing.branchId : resolveBranch(branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };
      if (!existing && v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };

      const fields = await getStudentFields(db);
      const customData = cleanCustomData(v.customData, fields);
      const missing = missingRequired(customData, fields);
      if (missing) return { ok: false, error: uz.staff.fieldMissing(missing.label) };

      const phone = `+998${v.phone}`;
      const [dup] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.phone, phone), isNull(students.archivedAt), v.id ? ne(students.id, v.id) : undefined));
      if (dup) return { ok: false, error: uz.students.phoneTaken };

      // Tahrirlashda faqat formadagi maydonlar yangilanadi — eski ustunlar (Excel importidan) saqlanib qoladi
      const values = {
        name: v.name,
        phone,
        gender: v.gender,
        note: v.note || null,
        customData,
      };

      if (existing) {
        await db.update(students).set(values).where(eq(students.id, existing.id));
        const same = (k: keyof typeof values) =>
          k === "customData"
            ? JSON.stringify(existing.customData) === JSON.stringify(customData)
            : existing[k] === values[k];
        const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => !same(k));
        await audit("student.update", { type: "student", id: existing.id }, { name: v.name, fields: changed });
        revalidatePath(PATH);
        return { ok: true, id: existing.id };
      }

      const [row] = await db
        .insert(students)
        .values({ ...values, branchId, createdBy: ctx.staff.id })
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
    },
    { approval: { action: "students.save", input: input } },
  );
}

export async function setStudentStatusAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    ["students.edit", "students.freeze"],
    async (ctx) => {
      const parsed = studentStatusInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const { status, reason } = parsed.data;
      const s = await loadStudent(ctx, parsed.data.id);
      if (!s) return { ok: false, error: uz.common.gone };
      // Muzlatish va muzlatishdan chiqarish — students.freeze, qolgan holatlar — students.edit
      const freezing = status === "paused" || s.status === "paused";
      const gate = await ctx.requireAny([freezing ? "students.freeze" : "students.edit"]);
      if (gate) return gate;
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
    },
    { approval: { action: "students.status", input: input } },
  );
}

/**
 * Boshqa filialga o'tkazish. Guruh va o'quvchi filiali bir xil bo'lishi shart (a'zolik qoidasi), shuning uchun eski
 * filialdagi ochiq a'zoliklar shu kun bilan yopiladi; yangi guruhga keyin "Guruhga qo'shish" bilan qo'shiladi.
 * To'lovlar va chegirmalar o'quvchiniki bo'lib qoladi (balans o'zgarmaydi).
 */
export async function transferStudentAction(input: unknown): Promise<ActionResult<{ closed: number }>> {
  return crmAction<{ closed: number }>(
    FEATURE,
    "students.edit",
    async (ctx) => {
      const parsed = studentTransferInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const { branchId, reason } = parsed.data;
      const s = await loadStudent(ctx, parsed.data.studentId);
      if (!s) return { ok: false, error: uz.common.gone };
      if (s.branchId === branchId) return { ok: false, error: uz.students.transferSame };
      if (!ctx.branch.options.some((b) => b.id === branchId)) return { ok: false, error: uz.common.branchForbidden };
      const today = todayTashkent();
      const closed = await ctx.db.transaction(async (tx) => {
        await tx.update(students).set({ branchId }).where(eq(students.id, s.id));
        const open = await tx
          .select({ id: groupMemberships.id, status: groupMemberships.status, pausedAt: groupMemberships.pausedAt })
          .from(groupMemberships)
          .where(and(eq(groupMemberships.studentId, s.id), isNull(groupMemberships.leftAt)));
        await closePauses(
          tx,
          open.filter((m) => m.status === "paused"),
          today,
        );
        // Kelajakdagi sanaga yozilgan a'zolik o'sha sana bilan yopiladi (chiqish qo'shilishdan oldin bo'lmaydi)
        await tx
          .update(groupMemberships)
          .set({
            status: "left",
            leavePendingAt: null,
            leftAt: sql`greatest(${groupMemberships.enrolledAt}, ${today}::date)`,
            leftReason: reason || uz.students.transferReason,
          })
          .where(and(eq(groupMemberships.studentId, s.id), isNull(groupMemberships.leftAt)));
        return open.length;
      });
      await ctx.audit(
        "student.transfer",
        { type: "student", id: s.id },
        {
          name: s.name,
          from: s.branchId,
          to: branchId,
          ...(reason ? { reason } : {}),
          ...(closed ? { memberships: closed } : {}),
        },
      );
      revalidatePath(PATH);
      revalidatePath(`${PATH}/${s.id}`);
      return { ok: true, closed };
    },
    { approval: { action: "students.transfer", input } },
  );
}

/** "O'quvchi formasi" qo'shimcha maydonlari (xodim formasidagidek) */
export async function saveStudentFieldsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.edit", async ({ db, staff, audit }) => {
    const parsed = formFieldsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const ids = parsed.data.map((f) => f.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: uz.common.invalid };
    await db
      .insert(settings)
      .values({ key: STUDENT_FIELDS_KEY, value: parsed.data, updatedBy: staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: parsed.data, updatedBy: staff.id, updatedAt: new Date() },
      });
    await audit("settings.update", { type: "setting", id: STUDENT_FIELDS_KEY }, { fields: ids });
    revalidatePath(PATH, "layout");
    return { ok: true };
  });
}

export async function archiveStudentAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "students.delete",
    async (ctx) => {
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
            leavePendingAt: null,
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
    },
    { approval: { action: "students.archive", input: input } },
  );
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
