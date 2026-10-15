"use server";

import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formatPhone } from "@ventura/auth/policy";
import {
  courses,
  groups,
  leadEvents,
  leadFirstLessons,
  leadNotes,
  leadStages,
  leadWaitlists,
  leads,
  settings,
  users,
} from "@ventura/db/schema/tenant";
import { APPLY_FORM_KEY, applyFormSchema } from "@/lib/apply-form";
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
  reasonListInput,
  waitlistActivateInput,
  waitlistAssignInput,
  waitlistInput,
} from "@/lib/rules";
import { assignedDraft } from "@/lib/notifications";
import { notify } from "@/lib/server/notify";
import { uz } from "@/lib/uz";
import { convertLeads } from "./convert";
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
        // Mas'ul almashgan bo'lsa — yangi mas'ulga bildirishnoma (E6d)
        if (v.assignedTo && v.assignedTo !== existing.assignedTo)
          await notify(ctx.db, [v.assignedTo], assignedDraft([{ id: existing.id, name: v.name }]), ctx.staff.id);
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
      if (v.assignedTo) await notify(ctx.db, [v.assignedTo], assignedDraft([{ id, name: v.name }]), ctx.staff.id);
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
      // Allaqachon shu xodimda bo'lganlarga bildirishnoma yuborilmaydi
      const already = userId
        ? new Set(
            (
              await ctx.db
                .select({ id: leads.id })
                .from(leads)
                .where(and(inArray(leads.id, ids), eq(leads.assignedTo, userId)))
            ).map((r) => r.id),
          )
        : new Set<string>();
      const rows = await ctx.db
        .update(leads)
        .set({ assignedTo: userId })
        .where(and(inArray(leads.id, ids), isNull(leads.archivedAt), inArray(leads.branchId, branchIds)))
        .returning({ id: leads.id, name: leads.name });
      if (!rows.length) return { ok: false, error: uz.common.gone };
      const [u] = userId ? await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, userId)) : [null];
      for (const r of rows)
        await ctx.audit("lead.assign", { type: "lead", id: r.id }, { name: r.name, to: u?.name ?? null });
      // Yangi mas'ulga bildirishnoma (E6d)
      const fresh = rows.filter((r) => !already.has(r.id));
      if (userId && fresh.length) await notify(ctx.db, [userId], assignedDraft(fresh), ctx.staff.id);
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
      const res = await convertLeads(ctx, [l], parsed.data.groupId);
      if (!res.ok) return res;
      const c = res.converted[0]!;
      refreshAll(l.id, ["/students", ...(res.group ? [`/groups/${res.group.id}`] : [])]);
      return { ok: true, studentId: c.studentId, existing: c.existing };
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
    const parsed = reasonListInput.safeParse(input);
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

/** Ariza sahifasi sozlamasi (ADR 0026): filial xodimning filiallaridan, maydonlar "Lid formasi"dan */
export async function saveApplyFormAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async (ctx) => {
    const parsed = applyFormSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const v = parsed.data;
    if (v.branchId && !ctx.branch.options.some((b) => b.id === v.branchId))
      return { ok: false, error: uz.common.branchForbidden };
    const known = new Set((await getLeadFields(ctx.db)).filter((f) => f.type !== "group").map((f) => f.id));
    const value = { ...v, fieldIds: [...new Set(v.fieldIds)].filter((id) => known.has(id)) };
    await ctx.db
      .insert(settings)
      .values({ key: APPLY_FORM_KEY, value, updatedBy: ctx.staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value, updatedBy: ctx.staff.id, updatedAt: new Date() },
      });
    await ctx.audit(
      "settings.update",
      { type: "setting", id: APPLY_FORM_KEY },
      { enabled: value.enabled, branchId: value.branchId, fields: value.fieldIds },
    );
    refresh();
    revalidatePath("/ariza");
    return { ok: true };
  });
}

/* ---------- Zahira guruhlar (ADR 0024) ---------- */

/** Ochiq zahira guruh, xodimning filiallaridan birida */
async function loadWaitlist(ctx: ActionCtx, id: unknown) {
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return null;
  const [w] = await ctx.db
    .select()
    .from(leadWaitlists)
    .where(and(eq(leadWaitlists.id, parsed.data), isNull(leadWaitlists.closedAt)));
  if (!w || !ctx.branch.options.some((b) => b.id === w.branchId)) return null;
  return w;
}

export async function saveWaitlistAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(FEATURE, "leads.edit", async (ctx) => {
    const parsed = waitlistInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const existing = v.id ? await loadWaitlist(ctx, v.id) : null;
    if (v.id && !existing) return { ok: false, error: uz.common.gone };
    const branchId = existing ? existing.branchId : resolveBranch(ctx.branch, v.branchId);
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    if (!existing && v.branchId && v.branchId !== branchId) return { ok: false, error: uz.common.branchForbidden };
    if (v.courseId) {
      const [c] = await ctx.db.select({ id: courses.id }).from(courses).where(eq(courses.id, v.courseId));
      if (!c) return { ok: false, error: uz.common.gone };
    }
    const values = { name: v.name, courseId: v.courseId, note: v.note || null };
    if (existing) {
      await ctx.db.update(leadWaitlists).set(values).where(eq(leadWaitlists.id, existing.id));
      await ctx.audit("lead.waitlist.update", { type: "lead_waitlist", id: existing.id }, { name: v.name });
      refresh();
      return { ok: true, id: existing.id };
    }
    const [row] = await ctx.db
      .insert(leadWaitlists)
      .values({ ...values, branchId, createdBy: ctx.staff.id })
      .returning({ id: leadWaitlists.id });
    await ctx.audit("lead.waitlist.create", { type: "lead_waitlist", id: row!.id }, { name: v.name, branchId });
    refresh();
    return { ok: true, id: row!.id };
  });
}

/** Zahira guruhni yopish (faollashtirmasdan): lidlar ro'yxatdan chiqadi, o'z bosqichida qoladi */
export async function closeWaitlistAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "leads.edit", async (ctx) => {
    const w = await loadWaitlist(ctx, id);
    if (!w) return { ok: false, error: uz.common.gone };
    const released = await ctx.db.transaction(async (tx) => {
      const rows = await tx
        .update(leads)
        .set({ waitlistId: null })
        .where(eq(leads.waitlistId, w.id))
        .returning({ id: leads.id });
      await tx
        .update(leadWaitlists)
        .set({ closedAt: new Date(), closedBy: ctx.staff.id })
        .where(eq(leadWaitlists.id, w.id));
      return rows.length;
    });
    await ctx.audit("lead.waitlist.close", { type: "lead_waitlist", id: w.id }, { name: w.name, released });
    refresh();
    return { ok: true };
  });
}

/** Lidlarni zahira guruhga yozish yoki chiqarish (`waitlistId: null`) — faqat ish bosqichidagi lidlar */
export async function assignWaitlistAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return crmAction<{ count: number }>(
    FEATURE,
    "leads.edit",
    async (ctx) => {
      const parsed = waitlistAssignInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const { leadIds, waitlistId } = parsed.data;
      const w = waitlistId ? await loadWaitlist(ctx, waitlistId) : null;
      if (waitlistId && !w) return { ok: false, error: uz.common.gone };
      const stages = await listStages(ctx.db);
      const openIds = stages.filter((s) => s.kind === "open").map((s) => s.id);
      const branchIds = w ? [w.branchId] : ctx.branch.options.map((b) => b.id);
      const rows = await ctx.db
        .update(leads)
        .set({ waitlistId: w?.id ?? null })
        .where(
          and(
            inArray(leads.id, leadIds),
            isNull(leads.archivedAt),
            inArray(leads.stageId, openIds),
            inArray(leads.branchId, branchIds),
          ),
        )
        .returning({ id: leads.id, name: leads.name });
      if (!rows.length) return { ok: false, error: w ? uz.leads.waitlistBranch : uz.common.gone };
      for (const r of rows)
        await ctx.audit("lead.waitlist", { type: "lead", id: r.id }, { name: r.name, waitlist: w?.name ?? null });
      refresh();
      return { ok: true, count: rows.length };
    },
    { approval: { action: "leads.waitlist", input } },
  );
}

/**
 * Faollashtirish: zahira guruhdagi hamma lid tanlangan guruhga (yangi ochilgan yoki mavjud) o'quvchi bo'lib sinovda
 * qo'shiladi va ro'yxat yopiladi — bitta tranzaksiyada; biror lid mos kelmasa hech narsa yozilmaydi.
 */
export async function activateWaitlistAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  return crmAction<{ count: number }>(
    FEATURE,
    "leads.convert_to_student",
    async (ctx) => {
      const parsed = waitlistActivateInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const w = await loadWaitlist(ctx, parsed.data.waitlistId);
      if (!w) return { ok: false, error: uz.common.gone };
      const waiting = await ctx.db
        .select()
        .from(leads)
        .where(and(eq(leads.waitlistId, w.id), isNull(leads.archivedAt)));
      if (!waiting.length) return { ok: false, error: uz.leads.waitlistEmpty };
      const res = await convertLeads(ctx, waiting, parsed.data.groupId, async (tx) => {
        await tx
          .update(leadWaitlists)
          .set({ closedAt: new Date(), closedBy: ctx.staff.id, groupId: parsed.data.groupId })
          .where(eq(leadWaitlists.id, w.id));
      });
      if (!res.ok) return res;
      await ctx.audit(
        "lead.waitlist.activate",
        { type: "lead_waitlist", id: w.id },
        { name: w.name, group: res.group?.name ?? null, count: res.converted.length },
      );
      refresh();
      revalidatePath("/students");
      revalidatePath(`/groups/${parsed.data.groupId}`);
      return { ok: true, count: res.converted.length };
    },
    { approval: { action: "leads.waitlistActivate", input } },
  );
}
