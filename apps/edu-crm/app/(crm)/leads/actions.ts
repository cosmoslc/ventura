"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone } from "@ventura/auth/policy";
import {
  courses,
  groupMemberships,
  groups,
  leadEvents,
  leadFirstLessons,
  leadNotes,
  leadStages,
  leads,
  settings,
  students,
  users,
} from "@ventura/db/schema/tenant";
import { LEAD_FIELDS_KEY, cleanCustomData, formFieldsSchema, missingRequired } from "@/lib/form-fields";
import { LOST_REASONS_KEY, stagesError } from "@/lib/leads";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { todayTashkent } from "@/lib/server/memberships";
import {
  firstError,
  leadAssignInput,
  leadConvertInput,
  leadFirstLessonInput,
  leadFirstLessonMarkInput,
  leadInput,
  leadLoseInput,
  leadMoveInput,
  leadNoteInput,
  leadStagesInput,
  lostReasonsInput,
} from "@/lib/rules";
import { uz } from "@/lib/uz";
import { getStudentFields } from "../students/data";
import { getLeadFields, listStages, staffOptions } from "./data";

/*
 * Lidlar (E4a, ADR 0022). Ruxsatlar eski tizimdagi "Lidlar" toifasidan: qo'shish leads.create, tahrirlash leads.edit,
 * bosqich leads.status_change, mas'ul leads.reassign, izoh leads.call_log, o'chirish (arxiv) leads.delete.
 * Filial cheklovi: xodim faqat o'z filiallaridagi lidlarni ko'radi va o'zgartiradi. Bosqich almashuvi `lead_events`
 * ga amal ichida yoziladi. "O'quvchi bo'ldi" va "Yo'qotildi" bosqichlariga faqat o'z amallari bilan o'tiladi (E4b):
 * o'quvchiga aylantirish (leads.convert_to_student) va sabab bilan yo'qotish / tiklash (leads.status_change).
 */

const FEATURE = "leads";
const PATH = "/leads";
const uuid = z.uuid();

function refresh(id?: string) {
  revalidatePath(PATH);
  if (id) revalidatePath(`${PATH}/${id}`);
}

/** Arxivda bo'lmagan lid, xodimning filiallaridan birida */
async function loadLead(ctx: ActionCtx, id: unknown) {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return null;
  const [l] = await ctx.db
    .select()
    .from(leads)
    .where(and(eq(leads.id, parsed.data), isNull(leads.archivedAt)));
  if (!l || !ctx.branch.options.some((b) => b.id === l.branchId)) return null;
  return l;
}

/** Shu telefonli ochiq lid (arxivda emas, ish bosqichida) */
async function openLeadByPhone(ctx: ActionCtx, phone: string, except?: string) {
  const [row] = await ctx.db
    .select({ id: leads.id, name: leads.name, stage: leadStages.name })
    .from(leads)
    .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
    .where(
      and(
        eq(leads.phone, phone),
        isNull(leads.archivedAt),
        eq(leadStages.kind, "open"),
        except ? ne(leads.id, except) : undefined,
      ),
    )
    .limit(1);
  return row ?? null;
}

async function checkAssignee(ctx: ActionCtx, userId: string | null) {
  if (!userId) return true;
  const allowed = await staffOptions(
    ctx.db,
    ctx.branch.options.map((b) => b.id),
  );
  return allowed.some((u) => u.id === userId);
}

export async function saveLeadAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const raw = z.object({ id: uuid.optional() }).safeParse(input);
  const editing = raw.success && !!raw.data.id;
  return crmAction<{ id: string }>(
    FEATURE,
    editing ? "leads.edit" : "leads.create",
    async (ctx) => {
      const parsed = leadInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const existing = v.id ? await loadLead(ctx, v.id) : null;
      if (v.id && !existing) return { ok: false, error: uz.common.gone };
      // Filial tahrirlashda o'zgarmaydi
      const branchId = existing ? existing.branchId : resolveBranch(ctx.branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };
      if (!existing && v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };

      const phone = `+998${v.phone}`;
      const dup = await openLeadByPhone(ctx, phone, existing?.id);
      if (dup) return { ok: false, error: uz.leads.duplicate(dup.name, dup.stage) };
      if (v.courseId) {
        const [c] = await ctx.db.select({ id: courses.id }).from(courses).where(eq(courses.id, v.courseId));
        if (!c) return { ok: false, error: uz.common.gone };
      }
      // Mas'ulni almashtirish — leads.reassign (yangi lidda o'zini yoki bo'sh qoldirish mumkin)
      if ((existing ? existing.assignedTo : null) !== v.assignedTo && !(!existing && v.assignedTo === ctx.staff.id)) {
        const gate = await ctx.requireAny(["leads.reassign"]);
        if (gate) return gate;
      }
      if (!(await checkAssignee(ctx, v.assignedTo))) return { ok: false, error: uz.common.gone };

      const fields = await getLeadFields(ctx.db);
      const customData = cleanCustomData(v.customData, fields);
      const missing = missingRequired(customData, fields);
      if (missing) return { ok: false, error: uz.staff.fieldMissing(missing.label) };

      const values = {
        name: v.name,
        phone,
        phone2: v.phone2 ? `+998${v.phone2}` : null,
        gender: v.gender,
        source: v.source || null,
        courseId: v.courseId,
        assignedTo: v.assignedTo,
        targetDate: v.targetDate || null,
        note: v.note || null,
        customData,
      };

      if (existing) {
        await ctx.db.update(leads).set(values).where(eq(leads.id, existing.id));
        const same = (k: keyof typeof values) =>
          k === "customData"
            ? JSON.stringify(existing.customData) === JSON.stringify(customData)
            : existing[k] === values[k];
        const changed = (Object.keys(values) as (keyof typeof values)[]).filter((k) => !same(k));
        await ctx.audit("lead.update", { type: "lead", id: existing.id }, { name: v.name, fields: changed });
        refresh(existing.id);
        return { ok: true, id: existing.id };
      }

      const stages = await listStages(ctx.db);
      const first = stages.find((s) => s.kind === "open")!;
      const id = await ctx.db.transaction(async (tx) => {
        const [row] = await tx
          .insert(leads)
          .values({ ...values, branchId, stageId: first.id, createdBy: ctx.staff.id })
          .returning({ id: leads.id });
        await tx.insert(leadEvents).values({
          leadId: row!.id,
          fromStageId: null,
          toStageId: first.id,
          actorId: ctx.staff.id,
          actorName: ctx.staff.name,
        });
        return row!.id;
      });
      await ctx.audit("lead.create", { type: "lead", id }, { name: v.name, phone: formatPhone(phone), branchId });
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "leads.save", input } },
  );
}

/** Ochiq lid bormi — forma telefon to'liq kiritilganda ogohlantiradi */
export async function checkLeadPhoneAction(
  input: unknown,
): Promise<ActionResult<{ lead: { id: string; name: string; stage: string } | null }>> {
  return crmAction(FEATURE, ["leads.create", "leads.edit"], async (ctx) => {
    const parsed = z.object({ phone: z.string().regex(/^\d{9}$/), except: uuid.optional() }).safeParse(input);
    if (!parsed.success) return { ok: true, lead: null };
    return { ok: true, lead: await openLeadByPhone(ctx, `+998${parsed.data.phone}`, parsed.data.except) };
  });
}

export async function moveLeadAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "leads.status_change",
    async (ctx) => {
      const parsed = leadMoveInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const l = await loadLead(ctx, parsed.data.id);
      if (!l) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      const from = stages.find((s) => s.id === l.stageId);
      const to = stages.find((s) => s.id === parsed.data.stageId);
      if (!to) return { ok: false, error: uz.common.gone };
      if (to.kind !== "open" || from?.kind !== "open") return { ok: false, error: uz.leads.systemStageMove };
      if (to.id === l.stageId) return { ok: true };
      await ctx.db.transaction(async (tx) => {
        await tx.update(leads).set({ stageId: to.id, stageChangedAt: new Date() }).where(eq(leads.id, l.id));
        await tx.insert(leadEvents).values({
          leadId: l.id,
          fromStageId: l.stageId,
          toStageId: to.id,
          actorId: ctx.staff.id,
          actorName: ctx.staff.name,
        });
      });
      await ctx.audit("lead.stage", { type: "lead", id: l.id }, { name: l.name, from: from.name, to: to.name });
      refresh(l.id);
      return { ok: true };
    },
    { approval: { action: "leads.move", input } },
  );
}

export async function assignLeadsAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return crmAction<{ count: number }>(
    FEATURE,
    "leads.reassign",
    async (ctx) => {
      const parsed = leadAssignInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const { ids, userId } = parsed.data;
      if (!(await checkAssignee(ctx, userId))) return { ok: false, error: uz.common.gone };
      const branchIds = ctx.branch.options.map((b) => b.id);
      const rows = await ctx.db
        .update(leads)
        .set({ assignedTo: userId })
        .where(and(inArray(leads.id, ids), isNull(leads.archivedAt), inArray(leads.branchId, branchIds)))
        .returning({ id: leads.id, name: leads.name });
      if (!rows.length) return { ok: false, error: uz.common.gone };
      const [u] = userId ? await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, userId)) : [null];
      for (const r of rows)
        await ctx.audit("lead.assign", { type: "lead", id: r.id }, { name: r.name, to: u?.name ?? null });
      refresh();
      return { ok: true, count: rows.length };
    },
    { approval: { action: "leads.assign", input } },
  );
}

export async function archiveLeadAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "leads.delete",
    async (ctx) => {
      const parsed = z.object({ id: uuid, reason: z.string().trim().max(500).default("") }).safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const l = await loadLead(ctx, parsed.data.id);
      if (!l) return { ok: false, error: uz.common.gone };
      await ctx.db
        .update(leads)
        .set({ archivedAt: new Date(), archivedBy: ctx.staff.id, archiveReason: parsed.data.reason || null })
        .where(eq(leads.id, l.id));
      await ctx.audit(
        "lead.archive",
        { type: "lead", id: l.id },
        { name: l.name, ...(parsed.data.reason ? { reason: parsed.data.reason } : {}) },
      );
      refresh(l.id);
      return { ok: true };
    },
    { approval: { action: "leads.archive", input } },
  );
}

export async function addLeadNoteAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.call_log", async (ctx) => {
    const parsed = leadNoteInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const l = await loadLead(ctx, parsed.data.leadId);
    if (!l) return { ok: false, error: uz.common.gone };
    const [note] = await ctx.db
      .insert(leadNotes)
      .values({
        leadId: l.id,
        kind: parsed.data.kind,
        text: parsed.data.text,
        authorId: ctx.staff.id,
        authorName: ctx.staff.name,
      })
      .returning({ id: leadNotes.id });
    await ctx.audit("lead.note", { type: "lead", id: l.id }, { noteId: note!.id, kind: parsed.data.kind });
    refresh(l.id);
    return { ok: true };
  });
}

export async function deleteLeadNoteAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.call_log", async (ctx) => {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [note] = await ctx.db.select().from(leadNotes).where(eq(leadNotes.id, parsed.data));
    if (!note) return { ok: false, error: uz.common.gone };
    const l = await loadLead(ctx, note.leadId);
    if (!l) return { ok: false, error: uz.common.gone };
    await ctx.db.delete(leadNotes).where(eq(leadNotes.id, note.id));
    await ctx.audit(
      "lead.note.delete",
      { type: "lead", id: l.id },
      { noteId: note.id, kind: note.kind, text: note.text.slice(0, 200) },
    );
    refresh(l.id);
    return { ok: true };
  });
}

/**
 * Ustunlar: nom, rang va tartib. Yangi ustun — ochiq bosqich; tizim bosqichlarining turi o'zgarmaydi. Ro'yxatda
 * bo'lmagan ustun bu yerda o'chirilmaydi — `deleteLeadStageAction` bilan (lidlari boshqa ustunga o'tadi).
 */
export async function saveLeadStagesAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async (ctx) => {
    const parsed = leadStagesInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const current = await listStages(ctx.db);
    const list = parsed.data.map((s) => {
      const prev = s.id ? current.find((c) => c.id === s.id) : undefined;
      return { ...s, kind: prev ? prev.kind : ("open" as const), known: !!prev };
    });
    if (list.some((s) => s.id && !s.known)) return { ok: false, error: uz.common.gone };
    if (current.some((c) => !list.some((s) => s.id === c.id))) return { ok: false, error: uz.common.invalid };
    const err = stagesError(list);
    if (err) return { ok: false, error: uz.leads.stagesErrors[err] ?? uz.common.invalid };
    await ctx.db.transaction(async (tx) => {
      for (const [i, s] of list.entries()) {
        if (s.id)
          await tx.update(leadStages).set({ name: s.name, color: s.color, position: i }).where(eq(leadStages.id, s.id));
        else await tx.insert(leadStages).values({ name: s.name, color: s.color, position: i, kind: "open" });
      }
    });
    await ctx.audit(
      "settings.update",
      { type: "setting", id: "leads.stages" },
      {
        stages: list.map((s) => s.name),
      },
    );
    refresh();
    return { ok: true };
  });
}

export async function deleteLeadStageAction(input: unknown): Promise<ActionResult<{ moved: number }>> {
  return crmAction<{ moved: number }>(FEATURE, "leads.edit", async (ctx) => {
    const parsed = z.object({ id: uuid, moveTo: uuid }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const stages = await listStages(ctx.db);
    const stage = stages.find((s) => s.id === parsed.data.id);
    if (!stage) return { ok: false, error: uz.common.gone };
    if (stage.kind !== "open") return { ok: false, error: uz.leads.stagesErrors.system! };
    // Lidlar (arxivdagilari ham) va tarixdagi havolalar tanlangan ustunga ko'chadi — FK o'chirishga yo'l qo'yadi
    const target = stages.find((s) => s.id === parsed.data.moveTo && s.kind === "open" && s.id !== stage.id);
    if (!target) return { ok: false, error: uz.leads.stagesErrors.open! };
    const moved = await ctx.db.transaction(async (tx) => {
      const inStage = await tx.select({ id: leads.id }).from(leads).where(eq(leads.stageId, stage.id));
      if (inStage.length) {
        await tx
          .update(leads)
          .set({ stageId: target.id, stageChangedAt: new Date() })
          .where(eq(leads.stageId, stage.id));
        await tx.insert(leadEvents).values(
          inStage.map((l) => ({
            leadId: l.id,
            fromStageId: stage.id,
            toStageId: target.id,
            actorId: ctx.staff.id,
            actorName: ctx.staff.name,
          })),
        );
      }
      await tx.update(leadEvents).set({ fromStageId: target.id }).where(eq(leadEvents.fromStageId, stage.id));
      await tx.update(leadEvents).set({ toStageId: target.id }).where(eq(leadEvents.toStageId, stage.id));
      await tx.update(leads).set({ lostFromStageId: target.id }).where(eq(leads.lostFromStageId, stage.id));
      await tx.delete(leadStages).where(eq(leadStages.id, stage.id));
      return inStage.length;
    });
    await ctx.audit(
      "settings.update",
      { type: "setting", id: "leads.stages" },
      {
        deleted: stage.name,
        movedTo: target.name,
        moved,
      },
    );
    refresh();
    return { ok: true, moved };
  });
}

/** "Lid formasi" qo'shimcha maydonlari (o'quvchi formasidagidek) */
export async function saveLeadFieldsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async ({ db, staff, audit }) => {
    const parsed = formFieldsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const ids = parsed.data.map((f) => f.id);
    if (new Set(ids).size !== ids.length) return { ok: false, error: uz.common.invalid };
    await db
      .insert(settings)
      .values({ key: LEAD_FIELDS_KEY, value: parsed.data, updatedBy: staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: parsed.data, updatedBy: staff.id, updatedAt: new Date() },
      });
    await audit("settings.update", { type: "setting", id: LEAD_FIELDS_KEY }, { fields: ids });
    revalidatePath(PATH, "layout");
    return { ok: true };
  });
}

/* ---------- E4b: o'quvchiga aylantirish, birinchi dars, yo'qotish ---------- */

function refreshAll(leadId: string, extra: string[] = []) {
  refresh(leadId);
  for (const p of extra) revalidatePath(p);
}

/**
 * O'quvchiga aylantirish (ADR 0023): shu telefonli o'quvchi bo'lsa — o'shanga bog'lanadi, bo'lmasa yangisi
 * yaratiladi (ism, telefon, jins — lid formasidan, manba, qiziqqan kurs, o'quvchi formasida bir xil id li qo'shimcha
 * maydonlar).
 * Guruh tanlansa — sinovda qo'shiladi. Lid "O'quvchi bo'ldi" bosqichiga o'tadi. Hammasi bitta tranzaksiyada.
 */
export async function convertLeadAction(
  input: unknown,
): Promise<ActionResult<{ studentId: string; existing: boolean }>> {
  return crmAction<{ studentId: string; existing: boolean }>(
    FEATURE,
    "leads.convert_to_student",
    async (ctx) => {
      const parsed = leadConvertInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const l = await loadLead(ctx, parsed.data.leadId);
      if (!l) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      const from = stages.find((s) => s.id === l.stageId);
      const won = stages.find((s) => s.kind === "won")!;
      if (from?.kind !== "open") return { ok: false, error: uz.leads.notOpen };

      const [existing] = await ctx.db
        .select()
        .from(students)
        .where(and(eq(students.phone, l.phone), isNull(students.archivedAt)));
      if (existing && !ctx.branch.options.some((b) => b.id === existing.branchId))
        return { ok: false, error: uz.leads.studentOtherBranch };
      const studentBranch = existing?.branchId ?? l.branchId;

      const groupId = parsed.data.groupId;
      const [g] = groupId
        ? await ctx.db
            .select({ id: groups.id, name: groups.name, branchId: groups.branchId })
            .from(groups)
            .where(and(eq(groups.id, groupId), isNull(groups.archivedAt)))
        : [];
      if (groupId && !g) return { ok: false, error: uz.groups.groupArchived };
      if (g && g.branchId !== studentBranch) return { ok: false, error: uz.groups.branchMismatch };

      const studentFields = await getStudentFields(ctx.db);
      const customData = cleanCustomData(l.customData, studentFields);
      const today = todayTashkent();

      const result = await ctx.db.transaction(async (tx) => {
        let studentId = existing?.id;
        if (!studentId) {
          const [row] = await tx
            .insert(students)
            .values({
              branchId: l.branchId,
              name: l.name,
              phone: l.phone,
              parentPhone: l.phone2,
              gender: l.gender,
              source: l.source,
              interestedCourseId: l.courseId,
              customData,
              createdBy: ctx.staff.id,
            })
            .returning({ id: students.id });
          studentId = row!.id;
        }
        let membershipId: string | null = null;
        if (g) {
          const [open] = await tx
            .select({ id: groupMemberships.id })
            .from(groupMemberships)
            .where(
              and(
                eq(groupMemberships.groupId, g.id),
                eq(groupMemberships.studentId, studentId),
                isNull(groupMemberships.leftAt),
              ),
            );
          if (!open) {
            const [m] = await tx
              .insert(groupMemberships)
              .values({ groupId: g.id, studentId, status: "trial", enrolledAt: today, createdBy: ctx.staff.id })
              .returning({ id: groupMemberships.id });
            membershipId = m!.id;
          }
        }
        await tx
          .update(leads)
          .set({ stageId: won.id, stageChangedAt: new Date(), studentId })
          .where(eq(leads.id, l.id));
        await tx.insert(leadEvents).values({
          leadId: l.id,
          fromStageId: l.stageId,
          toStageId: won.id,
          actorId: ctx.staff.id,
          actorName: ctx.staff.name,
        });
        return { studentId, membershipId };
      });

      await ctx.audit(
        "lead.convert",
        { type: "lead", id: l.id },
        { name: l.name, studentId: result.studentId, existing: !!existing, ...(g ? { group: g.name } : {}) },
      );
      if (!existing)
        await ctx.audit(
          "student.create",
          { type: "student", id: result.studentId },
          { name: l.name, phone: formatPhone(l.phone), branchId: l.branchId, fromLead: l.id },
        );
      if (g && result.membershipId) {
        await ctx.audit(
          "group.enroll",
          { type: "group", id: g.id },
          { student: l.name, studentId: result.studentId, membershipId: result.membershipId },
        );
        await ctx.audit("student.enroll", { type: "student", id: result.studentId }, { group: g.name, groupId: g.id });
      }
      refreshAll(l.id, ["/students", ...(g ? [`/groups/${g.id}`] : [])]);
      return { ok: true, studentId: result.studentId, existing: !!existing };
    },
    { approval: { action: "leads.convert", input } },
  );
}

/** Birinchi (sinov) darsga yozish yoki boshqa kunga ko'chirish — lid o'quvchi bo'lmaydi, hisobga tegmaydi */
export async function scheduleFirstLessonAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "leads.edit",
    async (ctx) => {
      const parsed = leadFirstLessonInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const l = await loadLead(ctx, parsed.data.leadId);
      if (!l) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      if (stages.find((s) => s.id === l.stageId)?.kind !== "open") return { ok: false, error: uz.leads.notOpen };
      const [g] = await ctx.db
        .select({ id: groups.id, name: groups.name, branchId: groups.branchId })
        .from(groups)
        .where(and(eq(groups.id, parsed.data.groupId), isNull(groups.archivedAt)));
      if (!g || !ctx.branch.options.some((b) => b.id === g.branchId))
        return { ok: false, error: uz.groups.groupArchived };
      if (g.branchId !== l.branchId) return { ok: false, error: uz.groups.branchMismatch };
      const values = {
        groupId: g.id,
        lessonDate: parsed.data.date,
        status: "scheduled" as const,
        markedBy: null,
        markedAt: null,
      };
      await ctx.db
        .insert(leadFirstLessons)
        .values({ leadId: l.id, createdBy: ctx.staff.id, ...values })
        .onConflictDoUpdate({ target: [leadFirstLessons.tenantId, leadFirstLessons.leadId], set: values });
      await ctx.audit(
        "lead.first_lesson",
        { type: "lead", id: l.id },
        { name: l.name, group: g.name, date: parsed.data.date },
      );
      refreshAll(l.id, [`/groups/${g.id}`]);
      return { ok: true };
    },
    { approval: { action: "leads.firstLesson", input } },
  );
}

export async function cancelFirstLessonAction(leadId: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async (ctx) => {
    const l = await loadLead(ctx, leadId);
    if (!l) return { ok: false, error: uz.common.gone };
    const [row] = await ctx.db
      .delete(leadFirstLessons)
      .where(eq(leadFirstLessons.leadId, l.id))
      .returning({ groupId: leadFirstLessons.groupId, date: leadFirstLessons.lessonDate });
    if (!row) return { ok: true };
    await ctx.audit("lead.first_lesson.cancel", { type: "lead", id: l.id }, { name: l.name, date: row.date });
    refreshAll(l.id, [`/groups/${row.groupId}`]);
    return { ok: true };
  });
}

/**
 * Birinchi darsga keldi / kelmadi — guruh davomatidan (o'qituvchi) yoki lid profilidan. Davomat qoidasi: kelajakdagi kun
 * belgilanmaydi, o'tgan kun — `attendance.student_edit_past` (yoki `leads.edit`) bilan.
 */
export async function markFirstLessonAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, ["attendance.student_mark", "attendance.student_edit_past", "leads.edit"], async (ctx) => {
    const parsed = leadFirstLessonMarkInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const l = await loadLead(ctx, parsed.data.leadId);
    if (!l) return { ok: false, error: uz.common.gone };
    const [fl] = await ctx.db.select().from(leadFirstLessons).where(eq(leadFirstLessons.leadId, l.id));
    if (!fl) return { ok: false, error: uz.common.gone };
    const today = todayTashkent();
    if (fl.lessonDate > today) return { ok: false, error: uz.leads.firstLessonFuture };
    const gate = await ctx.requireAny(
      fl.lessonDate < today
        ? ["attendance.student_edit_past", "leads.edit"]
        : ["attendance.student_mark", "attendance.student_edit_past", "leads.edit"],
    );
    if (gate) return gate;
    const status = parsed.data.status;
    await ctx.db
      .update(leadFirstLessons)
      .set(
        status === "scheduled"
          ? { status, markedBy: null, markedAt: null }
          : { status, markedBy: ctx.staff.id, markedAt: new Date() },
      )
      .where(eq(leadFirstLessons.id, fl.id));
    await ctx.audit(
      "lead.first_lesson.mark",
      { type: "lead", id: l.id },
      { name: l.name, date: fl.lessonDate, status },
    );
    refreshAll(l.id, [`/groups/${fl.groupId}`]);
    return { ok: true };
  });
}

/** Yo'qotildi — sabab bilan; qaysi bosqichdan yo'qotilgani saqlanadi (tiklashda shu bosqichga qaytadi) */
export async function loseLeadAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "leads.status_change",
    async (ctx) => {
      const parsed = leadLoseInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const l = await loadLead(ctx, parsed.data.id);
      if (!l) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      const from = stages.find((s) => s.id === l.stageId);
      const lost = stages.find((s) => s.kind === "lost")!;
      if (from?.kind !== "open") return { ok: false, error: uz.leads.notOpen };
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(leads)
          .set({
            stageId: lost.id,
            stageChangedAt: new Date(),
            lostFromStageId: from.id,
            lostReason: parsed.data.reason,
            lostNote: parsed.data.note || null,
          })
          .where(eq(leads.id, l.id));
        await tx.insert(leadEvents).values({
          leadId: l.id,
          fromStageId: from.id,
          toStageId: lost.id,
          actorId: ctx.staff.id,
          actorName: ctx.staff.name,
        });
      });
      await ctx.audit(
        "lead.lose",
        { type: "lead", id: l.id },
        {
          name: l.name,
          from: from.name,
          reason: parsed.data.reason,
          ...(parsed.data.note ? { note: parsed.data.note } : {}),
        },
      );
      refresh(l.id);
      return { ok: true };
    },
    { approval: { action: "leads.lose", input } },
  );
}

/** Yo'qotilgan lidni tiklash — oldingi bosqichiga (u o'chirilgan bo'lsa — birinchi ish bosqichiga) */
export async function restoreLeadAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "leads.status_change",
    async (ctx) => {
      const l = await loadLead(ctx, id);
      if (!l) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      if (stages.find((s) => s.id === l.stageId)?.kind !== "lost") return { ok: false, error: uz.common.invalid };
      const dup = await openLeadByPhone(ctx, l.phone, l.id);
      if (dup) return { ok: false, error: uz.leads.duplicate(dup.name, dup.stage) };
      const target =
        stages.find((s) => s.id === l.lostFromStageId && s.kind === "open") ?? stages.find((s) => s.kind === "open")!;
      await ctx.db.transaction(async (tx) => {
        await tx
          .update(leads)
          .set({
            stageId: target.id,
            stageChangedAt: new Date(),
            lostFromStageId: null,
            lostReason: null,
            lostNote: null,
          })
          .where(eq(leads.id, l.id));
        await tx.insert(leadEvents).values({
          leadId: l.id,
          fromStageId: l.stageId,
          toStageId: target.id,
          actorId: ctx.staff.id,
          actorName: ctx.staff.name,
        });
      });
      await ctx.audit("lead.restore", { type: "lead", id: l.id }, { name: l.name, to: target.name });
      refresh(l.id);
      return { ok: true };
    },
    { approval: { action: "leads.restore", input: id } },
  );
}

/** Yo'qotish sabablari ro'yxati */
export async function saveLostReasonsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async ({ db, staff, audit }) => {
    const parsed = lostReasonsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const list = [...new Set(parsed.data)];
    await db
      .insert(settings)
      .values({ key: LOST_REASONS_KEY, value: list, updatedBy: staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: list, updatedBy: staff.id, updatedAt: new Date() },
      });
    await audit("settings.update", { type: "setting", id: LOST_REASONS_KEY }, { reasons: list });
    refresh();
    return { ok: true };
  });
}
