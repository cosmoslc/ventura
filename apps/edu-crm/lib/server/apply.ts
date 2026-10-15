import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { TenantDb } from "@ventura/db";
import { branches, courses, leadEvents, leadNotes, leadStages, leads, settings } from "@ventura/db/schema/tenant";
import { formatPhone } from "@ventura/auth/policy";
import { tenantAudit } from "@ventura/security";
import { listStages } from "@/app/(crm)/leads/data";
import { APPLY_FORM_KEY, APPLY_SOURCE, type ApplyForm, DEFAULT_APPLY_FORM, parseApplyForm } from "@/lib/apply-form";
import {
  DEFAULT_LEAD_FIELDS,
  type FormField,
  LEAD_FIELDS_KEY,
  cleanCustomData,
  missingRequired,
  parseFormFields,
} from "@/lib/form-fields";
import { applyDraft } from "@/lib/notifications";
import { notify, staffWithPermission } from "./notify";

/*
 * Tashqi ariza (E4c, ADR 0026): sahifa uchun ma'lumot va arizani yozish. Xodim yo'q — bazaga mijoz ulanishi bilan
 * yoziladi (RLS mijoz bo'yicha), jurnalda muallif "Veb-sayt forma" (tizim). Shu telefonli ochiq lid bo'lsa yangisi
 * yaratilmaydi: o'sha lidga izoh qo'shiladi (E4 qarori 2).
 */

export async function getApplyForm(db: TenantDb): Promise<ApplyForm> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, APPLY_FORM_KEY));
  return row ? parseApplyForm(row.value) : DEFAULT_APPLY_FORM;
}

async function leadFields(db: TenantDb): Promise<FormField[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LEAD_FIELDS_KEY));
  return parseFormFields(row?.value, DEFAULT_LEAD_FIELDS);
}

export interface ApplyOption {
  id: string;
  name: string;
}

export interface ApplyCourse extends ApplyOption {
  /** null — hamma filialda */
  branchId: string | null;
}

export interface ApplyPageData {
  branches: ApplyOption[];
  courses: ApplyCourse[];
  fields: FormField[];
}

/** Sahifada ko'rinadigan narsalar: faol filiallar, kurslar va tanlangan qo'shimcha maydonlar (sozlamadagi tartibda) */
export async function applyPageData(db: TenantDb, form: ApplyForm): Promise<ApplyPageData> {
  const [branchRows, courseRows, fields] = await Promise.all([
    db
      .select({ id: branches.id, name: branches.name })
      .from(branches)
      .where(eq(branches.isActive, true))
      .orderBy(asc(branches.createdAt)),
    form.askCourse
      ? db
          .select({ id: courses.id, name: courses.name, branchId: courses.branchId })
          .from(courses)
          .where(isNull(courses.archivedAt))
          .orderBy(asc(courses.name))
      : Promise.resolve([]),
    leadFields(db),
  ]);
  const shown = new Set(form.fieldIds);
  return {
    branches: branchRows,
    courses: courseRows,
    // Guruh tanlash ochiq sahifada ko'rsatilmaydi (guruhlar ro'yxati ichki ma'lumot)
    fields: fields.filter((f) => shown.has(f.id) && f.type !== "group"),
  };
}

/** Ariza qaysi filialga tushadi: tanlangani (ruxsat bo'lsa), sozlamadagisi yoki birinchi faol filial */
export function applyBranch(form: ApplyForm, active: readonly ApplyOption[], chosen: string | null): string | null {
  if (form.askBranch && chosen && active.some((b) => b.id === chosen)) return chosen;
  if (form.branchId && active.some((b) => b.id === form.branchId)) return form.branchId;
  return active[0]?.id ?? null;
}

export interface Application {
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  branchId: string | null;
  courseId: string | null;
  customData: Record<string, string>;
}

export type ApplyResult =
  { ok: true; leadId: string; repeat: boolean } | { ok: false; reason: "branch" | "missing"; field?: string };

const ACTOR = { type: "system" as const, name: APPLY_SOURCE };

export async function submitApplication(
  db: TenantDb,
  form: ApplyForm,
  app: Application,
  meta: { ip?: string | null; userAgent?: string | null },
): Promise<ApplyResult> {
  const page = await applyPageData(db, form);
  const branchId = applyBranch(form, page.branches, app.branchId);
  if (!branchId) return { ok: false, reason: "branch" };
  const course = app.courseId
    ? page.courses.find((c) => c.id === app.courseId && (!c.branchId || c.branchId === branchId))
    : undefined;
  const customData = cleanCustomData(app.customData, page.fields);
  const missing = missingRequired(customData, page.fields);
  if (missing) return { ok: false, reason: "missing", field: missing.label };
  const phone = `+998${app.phone}`;

  // Shu telefonli ochiq lid — yangi lid emas, izoh
  const [open] = await db
    .select({ id: leads.id, branchId: leads.branchId, assignedTo: leads.assignedTo })
    .from(leads)
    .innerJoin(leadStages, eq(leadStages.id, leads.stageId))
    .where(and(eq(leads.phone, phone), isNull(leads.archivedAt), eq(leadStages.kind, "open")))
    .limit(1);
  if (open) {
    const parts = [
      app.name,
      course?.name,
      ...page.fields.flatMap((f) => (customData[f.id] ? [`${f.label}: ${customData[f.id]}`] : [])),
    ];
    await db.insert(leadNotes).values({
      leadId: open.id,
      kind: "note",
      text: `Saytdan qayta ariza: ${parts.filter(Boolean).join(" · ")}`,
      authorId: null,
      authorName: APPLY_SOURCE,
    });
    await tenantAudit.record(db, {
      actor: ACTOR,
      action: "lead.apply",
      target: { type: "lead", id: open.id },
      ...meta,
      metadata: { repeat: true },
    });
    // Mas'ul bor bo'lsa — o'sha, aks holda filial xodimlari (E6d)
    const who = open.assignedTo ? [open.assignedTo] : await staffWithPermission(db, ["leads.view"], open.branchId);
    await notify(db, who, applyDraft({ id: open.id, name: app.name, phone: formatPhone(phone) }, true));
    return { ok: true, leadId: open.id, repeat: true };
  }

  const stages = await listStages(db);
  const first = stages.find((s) => s.kind === "open")!;
  const leadId = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(leads)
      .values({
        branchId,
        name: app.name,
        phone,
        source: APPLY_SOURCE,
        courseId: course?.id ?? null,
        customData,
        stageId: first.id,
        createdBy: null,
      })
      .returning({ id: leads.id });
    await tx.insert(leadEvents).values({
      leadId: row!.id,
      fromStageId: null,
      toStageId: first.id,
      actorId: null,
      actorName: APPLY_SOURCE,
    });
    return row!.id;
  });
  await tenantAudit.record(db, {
    actor: ACTOR,
    action: "lead.apply",
    target: { type: "lead", id: leadId },
    ...meta,
    metadata: { name: app.name, branchId },
  });
  // Filial xodimlariga (leads.view) va direktorlarga bildirishnoma (E6d)
  const who = await staffWithPermission(db, ["leads.view"], branchId);
  await notify(db, who, applyDraft({ id: leadId, name: app.name, phone: formatPhone(phone) }, false));
  return { ok: true, leadId, repeat: false };
}
