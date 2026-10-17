"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { inScope } from "@ventura/auth/staff/policy";
import { courses, groups } from "@ventura/db/schema/tenant";
import { courseInput, firstError } from "@/lib/rules";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { uz } from "@/lib/uz";

/*
 * Kurslar: menejer ham o'zgartiradi (`courses.write`), lekin faqat o'z filiallari va umumiy (filialsiz) kurslarni.
 * O'chirish — arxivga o'tkazish (eski tizimdagidek), guruhlar o'chmaydi; Arxiv bo'limidan tiklanadi.
 */

export async function saveCourseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>("courses", "settings.courses", async ({ db, staff, branch, audit }) => {
    const parsed = courseInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { id, name, price, durationMonths, color } = parsed.data;

    if (id) {
      const [existing] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, id), isNull(courses.archivedAt)));
      if (!existing) return { ok: false, error: uz.common.gone };
      if (existing.branchId && !inScope(staff.scope, existing.branchId))
        return { ok: false, error: uz.common.branchForbidden };
      // Filial formada o'zgartirilgan bo'lsa — yangisi ham xodimga ochiq bo'lishi kerak
      let branchId = existing.branchId;
      if (parsed.data.branchId && parsed.data.branchId !== existing.branchId) {
        if (!branch.options.some((b) => b.id === parsed.data.branchId))
          return { ok: false, error: uz.common.branchForbidden };
        branchId = parsed.data.branchId;
      }
      await db.update(courses).set({ branchId, name, price, durationMonths, color }).where(eq(courses.id, id));
      await audit(
        "course.update",
        { type: "course", id },
        {
          before: { name: existing.name, price: existing.price, durationMonths: existing.durationMonths },
          after: { name, price, durationMonths },
        },
      );
      revalidatePath("/courses");
      return { ok: true, id };
    }

    const branchId = resolveBranch(branch, parsed.data.branchId);
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    const [row] = await db
      .insert(courses)
      .values({ branchId, name, price, durationMonths, color })
      .returning({ id: courses.id });
    await audit("course.create", { type: "course", id: row!.id }, { name, price, durationMonths });
    revalidatePath("/courses");
    return { ok: true, id: row!.id };
  });
}

export async function archiveCourseAction(id: unknown): Promise<ActionResult> {
  return crmAction("courses", "settings.courses", async ({ db, staff, audit }) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [course] = await db
      .select()
      .from(courses)
      .where(and(eq(courses.id, parsed.data), isNull(courses.archivedAt)));
    if (!course) return { ok: false, error: uz.common.gone };
    if (course.branchId && !inScope(staff.scope, course.branchId))
      return { ok: false, error: uz.common.branchForbidden };
    const [open] = await db
      .select({ n: count() })
      .from(groups)
      .where(and(eq(groups.courseId, course.id), isNull(groups.archivedAt)));
    if ((open?.n ?? 0) > 0) return { ok: false, error: uz.courses.hasGroups(open!.n) };
    await db.update(courses).set({ archivedAt: new Date() }).where(eq(courses.id, course.id));
    await audit("course.archive", { type: "course", id: course.id }, { name: course.name });
    revalidatePath("/courses");
    return { ok: true };
  });
}
