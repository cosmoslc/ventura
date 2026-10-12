"use server";

import { and, count, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone } from "@ventura/auth/policy";
import { teachers } from "@ventura/db/schema/tenant";
import { resolveBranch } from "@/lib/server/branch";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { firstError, teacherInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * O'qituvchilar (ustozlar) va support o'qituvchilar. Ruxsatlar eski tizimdagidek "Xodimlar va O'qituvchilar (HR)"
 * toifasidan: qo'shish — staff.create, tahrirlash — staff.edit, o'chirish (arxiv) — staff.delete.
 * Filial cheklovi: xodim faqat o'z filiallaridagi ustozlarni ko'radi va o'zgartiradi.
 */

const FEATURE = "teachers";
const PATH = "/teachers";

export async function saveTeacherAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const raw = z.object({ id: z.uuid().optional() }).safeParse(input);
  const editing = raw.success && !!raw.data.id;
  return crmAction<{ id: string }>(FEATURE, editing ? "staff.edit" : "staff.create", async ({ db, branch, audit }) => {
    const parsed = teacherInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const support = v.kind === "support";
    if (support && v.startTime && v.endTime && v.endTime <= v.startTime)
      return { ok: false, error: uz.teachers.timeOrder };

    let existing: typeof teachers.$inferSelect | undefined;
    if (v.id) {
      [existing] = await db
        .select()
        .from(teachers)
        .where(and(eq(teachers.id, v.id), isNull(teachers.archivedAt)));
      if (!existing || existing.kind !== v.kind) return { ok: false, error: uz.common.gone };
      if (!branch.options.some((b) => b.id === existing!.branchId))
        return { ok: false, error: uz.common.branchForbidden };
    }
    const branchId = resolveBranch(branch, v.branchId) ?? existing?.branchId ?? null;
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    if (v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };

    const phone = `+998${v.phone}`;
    const [dup] = await db
      .select({ id: teachers.id })
      .from(teachers)
      .where(and(eq(teachers.phone, phone), isNull(teachers.archivedAt), v.id ? ne(teachers.id, v.id) : undefined));
    if (dup) return { ok: false, error: uz.teachers.phoneTaken };

    if (support && v.assignedTeacherId) {
      const [mentor] = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(and(eq(teachers.id, v.assignedTeacherId), eq(teachers.kind, "teacher"), isNull(teachers.archivedAt)));
      if (!mentor) return { ok: false, error: uz.teachers.assignedInvalid };
    }

    // Faqat tanlangan maosh turining summasi saqlanadi (eski tizimdagidek)
    const values = {
      kind: v.kind,
      branchId,
      name: v.name,
      phone,
      gender: support ? null : v.gender,
      birthDate: support ? null : v.birthDate || null,
      assignedTeacherId: support ? v.assignedTeacherId : null,
      salaryType: support ? ("fixed" as const) : v.salaryType,
      revenueSharePercent: !support && v.salaryType === "percent" ? v.revenueSharePercent : 0,
      perStudentSalary: !support && v.salaryType === "per_student" ? v.perStudentSalary : 0,
      fixedSalary: support || v.salaryType === "fixed" ? v.fixedSalary : 0,
      workingDays: support ? v.workingDays : [],
      startTime: support ? v.startTime || null : null,
      endTime: support ? v.endTime || null : null,
      note: v.note || null,
    };

    if (existing) {
      await db.update(teachers).set(values).where(eq(teachers.id, existing.id));
      await audit(
        "teacher.update",
        { type: "teacher", id: existing.id },
        {
          name: v.name,
          kind: v.kind,
          ...(existing.branchId !== branchId ? { branchId } : {}),
          ...(existing.salaryType !== values.salaryType ? { salaryType: values.salaryType } : {}),
        },
      );
      revalidatePath(PATH);
      return { ok: true, id: existing.id };
    }

    const [row] = await db.insert(teachers).values(values).returning({ id: teachers.id });
    await audit(
      "teacher.create",
      { type: "teacher", id: row!.id },
      {
        name: v.name,
        kind: v.kind,
        phone: formatPhone(phone),
        branchId,
        salaryType: values.salaryType,
      },
    );
    revalidatePath(PATH);
    return { ok: true, id: row!.id };
  });
}

export async function archiveTeacherAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "staff.delete", async ({ db, branch, audit }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [t] = await db
      .select()
      .from(teachers)
      .where(and(eq(teachers.id, parsed.data), isNull(teachers.archivedAt)));
    if (!t) return { ok: false, error: uz.common.gone };
    if (!branch.options.some((b) => b.id === t.branchId)) return { ok: false, error: uz.common.branchForbidden };
    const [supports] = await db
      .select({ n: count() })
      .from(teachers)
      .where(and(eq(teachers.assignedTeacherId, t.id), isNull(teachers.archivedAt)));
    if ((supports?.n ?? 0) > 0) return { ok: false, error: uz.teachers.hasSupports(supports!.n) };
    await db.update(teachers).set({ archivedAt: new Date() }).where(eq(teachers.id, t.id));
    await audit("teacher.archive", { type: "teacher", id: t.id }, { name: t.name, kind: t.kind });
    revalidatePath(PATH);
    return { ok: true };
  });
}
