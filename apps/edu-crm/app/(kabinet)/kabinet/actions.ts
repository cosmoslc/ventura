"use server";

import { and, eq, inArray, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { passwordProblem } from "@ventura/auth/policy";
import { groupHomeworks, groupMemberships, students, teachers, users } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { kabinetGroups } from "@/lib/server/kabinet";
import { grantStudentLogin, resetStudentPassword, studentPhoneFree } from "@/lib/server/student-account";
import { uz } from "@/lib/uz";

/*
 * O'qituvchi kabineti amallari (ADR 0062, ADR 0063). Faqat o'z kartasi: ism, jins, tug'ilgan sana.
 * Shuningdek o'z guruhidagi o'quvchilarga portal kirish parolini berish / yangilash (ADR 0063).
 */

const profileInput = z.object({
  name: z.string().trim().min(1, uz.kabinet.nameRequired).max(120),
  gender: z.enum(["male", "female"]).nullable(),
  birthDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/),
});

const studentPasswordInput = z.object({
  studentId: z.string().uuid(),
  password: z.string().min(6).max(128),
});

export async function saveKabinetProfileAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "teachers",
    null,
    async (ctx) => {
      if (ctx.staff.kind !== "teacher" || !ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };
      const parsed = profileInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const v = parsed.data;
      const teacherId = ctx.staff.teacherId;
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(teachers)
          .set({ name: v.name, gender: v.gender, birthDate: v.birthDate || null })
          .where(eq(teachers.id, teacherId));
        await tx.update(users).set({ name: v.name }).where(eq(users.id, ctx.staff.id));
      });
      await ctx.audit("teacher.self_update", { type: "teacher", id: teacherId }, { name: v.name });
      revalidatePath("/kabinet", "layout");
      return { ok: true };
    },
    { teacher: true },
  );
}

/** O'qituvchi o'z guruhidagi o'quvchiga kabinet paroli berishi yoki yangilashi (ADR 0063) */
export async function setStudentPasswordByTeacherAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "students",
    null,
    async (ctx) => {
      if (ctx.staff.kind !== "teacher" || !ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };
      const parsed = studentPasswordInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const { studentId, password } = parsed.data;

      const problem = passwordProblem(password);
      if (problem) return { ok: false, error: problem };

      // O'quvchi aynan shu o'qituvchining faol guruhlaridan birida bo'lishi shart
      const ownGroups = await kabinetGroups(ctx.db, ctx.staff.teacherId);
      const groupIds = ownGroups.map((g) => g.id);
      if (!groupIds.length) return { ok: false, error: uz.common.forbidden };

      const [membership] = await ctx.db
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.studentId, studentId),
            inArray(groupMemberships.groupId, groupIds),
            isNull(groupMemberships.leftAt),
          ),
        )
        .limit(1);
      if (!membership) return { ok: false, error: uz.common.forbidden };

      const [s] = await ctx.db.select().from(students).where(eq(students.id, studentId)).limit(1);
      if (!s || s.archivedAt) return { ok: false, error: uz.common.gone };

      if (s.userId) {
        const ok = await resetStudentPassword(ctx, s.userId, password);
        if (!ok) return { ok: false, error: uz.common.gone };
        await ctx.audit("student.password.teacher_reset", { type: "student", id: s.id }, { userId: s.userId });
      } else {
        if (!(await studentPhoneFree(ctx, s.phone, s.id)))
          return { ok: false, error: uz.students.phoneTaken };
        const login = await grantStudentLogin(ctx, s, password);
        if (!login.ok) return { ok: false, error: login.error === "phone_taken" ? "Telefon band" : "Xatolik" };
        await ctx.audit("student.password.teacher_grant", { type: "student", id: s.id }, { userId: login.userId });
      }

      revalidatePath("/kabinet/oquvchilar");
      revalidatePath("/kabinet/guruhlar");
      return { ok: true };
    },
    { teacher: true },
  );
}

/* ---------- Uy vazifasi berish (ADR 0063) ---------- */

const homeworkInput = z.object({
  groupId: z.string().uuid(),
  lessonDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1, "Vazifa sarlavhasi kiritilishi shart").max(200),
  description: z.string().trim().max(2000).optional(),
  dueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional(),
});

export async function createGroupHomeworkAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "groups",
    null,
    async (ctx) => {
      if (ctx.staff.kind !== "teacher" || !ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };
      const parsed = homeworkInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const v = parsed.data;

      // O'qituvchining o'z guruhi ekanini tekshirish
      const { groups: grpTable } = await import("@ventura/db/schema/tenant");
      const [g] = await ctx.db
        .select({ id: grpTable.id, teacherId: grpTable.teacherId })
        .from(grpTable)
        .where(and(eq(grpTable.id, v.groupId), isNull(grpTable.archivedAt)))
        .limit(1);
      if (!g || g.teacherId !== ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };

      await ctx.db.insert(groupHomeworks).values({
        groupId: v.groupId,
        lessonDate: v.lessonDate,
        title: v.title,
        description: v.description || null,
        dueDate: v.dueDate || null,
        createdBy: ctx.staff.id,
      });

      await ctx.audit("group.homework.create", { type: "group", id: v.groupId }, { title: v.title, lessonDate: v.lessonDate });
      revalidatePath(`/kabinet/guruhlar/${v.groupId}`);
      revalidatePath("/kabinet/uy-ishi");
      revalidatePath("/portal/uy-ishi");
      return { ok: true };
    },
    { teacher: true },
  );
}

const deleteHomeworkInput = z.object({
  homeworkId: z.string().uuid(),
  groupId: z.string().uuid(),
});

export async function deleteGroupHomeworkAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    "groups",
    null,
    async (ctx) => {
      if (ctx.staff.kind !== "teacher" || !ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };
      const parsed = deleteHomeworkInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const { homeworkId, groupId } = parsed.data;

      const { groups: grpTable } = await import("@ventura/db/schema/tenant");
      const [g] = await ctx.db
        .select({ id: grpTable.id, teacherId: grpTable.teacherId })
        .from(grpTable)
        .where(and(eq(grpTable.id, groupId), isNull(grpTable.archivedAt)))
        .limit(1);
      if (!g || g.teacherId !== ctx.staff.teacherId) return { ok: false, error: uz.common.forbidden };

      await ctx.db
        .delete(groupHomeworks)
        .where(and(eq(groupHomeworks.id, homeworkId), eq(groupHomeworks.groupId, groupId)));

      await ctx.audit("group.homework.delete", { type: "group", id: groupId }, { homeworkId });
      revalidatePath(`/kabinet/guruhlar/${groupId}`);
      revalidatePath("/kabinet/uy-ishi");
      revalidatePath("/portal/uy-ishi");
      return { ok: true };
    },
    { teacher: true },
  );
}
