"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { notifyDirectors } from "@ventura/auth/staff";
import { can } from "@ventura/auth/staff/policy";
import { courses, groups, leadStages, leads, students, teachers, users } from "@ventura/db/schema/tenant";
import { escapeHtml } from "@ventura/integrations";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { tenantDeps } from "@/lib/server/deps";
import { uz } from "@/lib/uz";
import { archivedStaff } from "../staff/data";

/*
 * Arxiv (eski tizimdagi "Arxiv & Chiqindilar qutisi"): tiklash — archive.restore, butunlay o'chirish —
 * archive.permanent_delete (faqat o'quvchi; bog'liq yozuvi bo'lsa baza rad etadi). Filial cheklovi amal qiladi.
 * Xodimni tiklash (E6e) qo'shimcha "Xodimni bo'shatish" (staff.delete) ruxsatini talab qiladi — bo'shatish bilan bir xil;
 * lavozim va filiallar saqlangan, shuning uchun faqat arxiv belgisi olinadi (telefon baza bo'yicha yagona, band bo'lmaydi).
 */

const FEATURE = "students";
const input = z.object({ kind: z.enum(["student", "course", "teacher", "group", "lead", "staff"]), id: z.uuid() });

/** Umumiy (filialsiz) kurs hammaga ochiq, qolganlari — xodimning filiallarida */
const inScope = (ctx: ActionCtx, branchId: string | null) =>
  !branchId || ctx.branch.options.some((b) => b.id === branchId);

function done() {
  revalidatePath("/archive");
  revalidatePath("/students");
  revalidatePath("/courses");
  revalidatePath("/teachers");
  revalidatePath("/groups");
  revalidatePath("/leads");
}

export async function restoreArchivedAction(raw: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "archive.restore", async (ctx) => {
    const parsed = input.safeParse(raw);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const { kind, id } = parsed.data;
    const { db, audit } = ctx;

    if (kind === "student") {
      const [s] = await db
        .select()
        .from(students)
        .where(and(eq(students.id, id), isNotNull(students.archivedAt)));
      if (!s || !inScope(ctx, s.branchId)) return { ok: false, error: uz.common.gone };
      const [busy] = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.phone, s.phone), isNull(students.archivedAt)));
      if (busy) return { ok: false, error: uz.archive.phoneBusy };
      await db
        .update(students)
        .set({ archivedAt: null, archiveReason: null, archivedBy: null })
        .where(eq(students.id, id));
      await audit("student.restore", { type: "student", id }, { name: s.name });
    } else if (kind === "course") {
      const [c] = await db
        .select()
        .from(courses)
        .where(and(eq(courses.id, id), isNotNull(courses.archivedAt)));
      if (!c || !inScope(ctx, c.branchId)) return { ok: false, error: uz.common.gone };
      await db.update(courses).set({ archivedAt: null }).where(eq(courses.id, id));
      await audit("course.restore", { type: "course", id }, { name: c.name });
    } else if (kind === "lead") {
      const [l] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, id), isNotNull(leads.archivedAt)));
      if (!l || !inScope(ctx, l.branchId)) return { ok: false, error: uz.common.gone };
      // Shu telefonli ochiq lid bo'lsa — ikkinchisi tiklanmaydi (takror)
      const [busy] = await db
        .select({ id: leads.id })
        .from(leads)
        .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
        .where(and(eq(leads.phone, l.phone), isNull(leads.archivedAt), eq(leadStages.kind, "open")));
      if (busy) return { ok: false, error: uz.archive.leadPhoneBusy };
      await db.update(leads).set({ archivedAt: null, archiveReason: null, archivedBy: null }).where(eq(leads.id, id));
      await audit("lead.unarchive", { type: "lead", id }, { name: l.name });
    } else if (kind === "group") {
      const [g] = await db
        .select()
        .from(groups)
        .where(and(eq(groups.id, id), isNotNull(groups.archivedAt)));
      if (!g || !inScope(ctx, g.branchId)) return { ok: false, error: uz.common.gone };
      // Kurs va o'qituvchi faol bo'lishi kerak; a'zolar qayta qo'shiladi (yopilgan davrlar tarixda qoladi)
      const [c] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, g.courseId), isNull(courses.archivedAt)));
      const [t] = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(and(eq(teachers.id, g.teacherId), isNull(teachers.archivedAt)));
      if (!c || !t) return { ok: false, error: uz.archive.groupDepsArchived };
      await db.update(groups).set({ archivedAt: null }).where(eq(groups.id, id));
      await audit("group.restore", { type: "group", id }, { name: g.name });
    } else if (kind === "staff") {
      if (!can(ctx.staff.access, "staff.delete")) return { ok: false, error: uz.common.forbidden };
      const scope = ctx.staff.scope === "all" ? null : ctx.staff.scope;
      const row = (await archivedStaff(db, ctx.staff, scope)).find((r) => r.id === id);
      if (!row) return { ok: false, error: uz.common.gone };
      if (!row.manageable) return { ok: false, error: uz.common.forbidden };
      await db.update(users).set({ archivedAt: null }).where(eq(users.id, id));
      await audit("staff.restore", { type: "user", id }, { name: row.name });
      const deps = tenantDeps(ctx.tenant);
      if (deps) {
        await notifyDirectors(
          deps,
          `♻️ <b>Xodim tiklandi</b>: ${escapeHtml(row.name)}\nKim: ${escapeHtml(ctx.staff.name)}`,
        );
      }
      revalidatePath("/staff");
    } else {
      const [t] = await db
        .select()
        .from(teachers)
        .where(and(eq(teachers.id, id), isNotNull(teachers.archivedAt)));
      if (!t || !inScope(ctx, t.branchId)) return { ok: false, error: uz.common.gone };
      const [busy] = await db
        .select({ id: teachers.id })
        .from(teachers)
        .where(and(eq(teachers.phone, t.phone), isNull(teachers.archivedAt)));
      if (busy) return { ok: false, error: uz.teachers.phoneTaken };
      await db.update(teachers).set({ archivedAt: null }).where(eq(teachers.id, id));
      await audit("teacher.restore", { type: "teacher", id }, { name: t.name });
    }
    done();
    return { ok: true };
  });
}

export async function purgeStudentAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "archive.permanent_delete", async (ctx) => {
    const parsed = z.uuid().safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [s] = await ctx.db
      .select()
      .from(students)
      .where(and(eq(students.id, parsed.data), isNotNull(students.archivedAt)));
    if (!s || !inScope(ctx, s.branchId)) return { ok: false, error: uz.common.gone };
    try {
      await ctx.db.delete(students).where(eq(students.id, s.id));
    } catch {
      // Keyingi bo'limlar (a'zolik, to'lov) bog'langan bo'lsa FK rad etadi — tarix yo'qolmaydi
      return { ok: false, error: uz.archive.purgeBlocked };
    }
    await ctx.audit("student.purge", { type: "student", id: s.id }, { name: s.name, reason: s.archiveReason });
    done();
    return { ok: true };
  });
}
