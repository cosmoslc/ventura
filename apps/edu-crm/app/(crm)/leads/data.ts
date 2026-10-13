import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import {
  type LeadNoteKind,
  type LeadStageKind,
  courses,
  leadEvents,
  leadNotes,
  leadStages,
  leads,
  settings,
  userBranches,
  users,
} from "@ventura/db/schema/tenant";
import { DEFAULT_LEAD_FIELDS, type FormField, LEAD_FIELDS_KEY, parseFormFields } from "@/lib/form-fields";
import { DEFAULT_LEAD_STAGES } from "@/lib/leads";

export interface StageRow {
  id: string;
  name: string;
  color: string;
  kind: LeadStageKind;
  position: number;
}

/**
 * Bosqichlar tartib bo'yicha; mijozda hali yo'q bo'lsa standartlari yaratiladi. Ikki so'rov bir vaqtda kelsa ikki marta
 * yaratilmasligi uchun — tranzaksiya ichida mijoz bo'yicha advisory qulf.
 */
export async function listStages(db: TenantDb): Promise<StageRow[]> {
  const read = () =>
    db
      .select({
        id: leadStages.id,
        name: leadStages.name,
        color: leadStages.color,
        kind: leadStages.kind,
        position: leadStages.position,
      })
      .from(leadStages)
      .orderBy(asc(leadStages.position), asc(leadStages.createdAt));
  const rows = await read();
  if (rows.length) return rows;
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(current_setting('app.tenant_id') || ':lead_stages'))`);
    const [{ n }] = (await tx.select({ n: count() }).from(leadStages)) as [{ n: number }];
    if (n > 0) return;
    await tx.insert(leadStages).values(DEFAULT_LEAD_STAGES.map((s, i) => ({ ...s, position: i })));
  });
  return read();
}

export interface LeadRow {
  id: string;
  branchId: string;
  name: string;
  /** 9 ta mahalliy raqam */
  phone: string;
  phone2: string | null;
  source: string | null;
  courseId: string | null;
  courseName: string | null;
  stageId: string;
  assignedTo: string | null;
  assignedName: string | null;
  targetDate: string | null;
  note: string | null;
  customData: Record<string, string>;
  stageChangedAt: string;
  createdAt: string;
  createdByName: string | null;
  studentId: string | null;
}

const localPhone = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-9);
const assignee = alias(users, "assignee");
const creator = alias(users, "creator");

/** Arxivda bo'lmagan lidlar; `filter` — getBranchContext().filter */
export async function listLeads(db: TenantDb, filter: readonly string[] | null, id?: string): Promise<LeadRow[]> {
  const rows = await db
    .select({ l: leads, courseName: courses.name, assignedName: assignee.name, createdByName: creator.name })
    .from(leads)
    .leftJoin(courses, eq(courses.id, leads.courseId))
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .leftJoin(creator, eq(creator.id, leads.createdBy))
    .where(
      and(
        isNull(leads.archivedAt),
        filter ? inArray(leads.branchId, [...filter]) : undefined,
        id ? eq(leads.id, id) : undefined,
      ),
    )
    .orderBy(desc(leads.createdAt));
  return rows.map(({ l, courseName, assignedName, createdByName }) => ({
    id: l.id,
    branchId: l.branchId,
    name: l.name,
    phone: localPhone(l.phone),
    phone2: l.phone2 ? localPhone(l.phone2) : null,
    source: l.source,
    courseId: l.courseId,
    courseName,
    stageId: l.stageId,
    assignedTo: l.assignedTo,
    assignedName,
    targetDate: l.targetDate,
    note: l.note,
    customData: l.customData,
    stageChangedAt: l.stageChangedAt.toISOString(),
    createdAt: l.createdAt.toISOString(),
    createdByName,
    studentId: l.studentId,
  }));
}

export interface LeadEventRow {
  id: string;
  fromStageId: string | null;
  toStageId: string;
  actorName: string | null;
  at: string;
}

export async function leadHistory(db: TenantDb, leadId: string): Promise<LeadEventRow[]> {
  const rows = await db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(desc(leadEvents.at));
  return rows.map((e) => ({
    id: e.id,
    fromStageId: e.fromStageId,
    toStageId: e.toStageId,
    actorName: e.actorName,
    at: e.at.toISOString(),
  }));
}

export interface LeadNoteRow {
  id: string;
  kind: LeadNoteKind;
  text: string;
  author: string;
  at: string;
}

export async function leadNotesOf(db: TenantDb, leadId: string): Promise<LeadNoteRow[]> {
  const rows = await db.select().from(leadNotes).where(eq(leadNotes.leadId, leadId)).orderBy(desc(leadNotes.createdAt));
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    text: n.text,
    author: n.authorName,
    at: n.createdAt.toISOString(),
  }));
}

export interface StaffOption {
  id: string;
  name: string;
}

/**
 * Mas'ul xodim bo'la oladiganlar: bo'shatilmagan xodimlar. Filial cheklovi bo'lsa — o'sha filiallarga biriktirilganlar
 * va direktorlar (ular hamma filialda).
 */
export async function staffOptions(db: TenantDb, filter: readonly string[] | null): Promise<StaffOption[]> {
  const [staff, links] = await Promise.all([
    db
      .select({ id: users.id, name: users.name, role: users.role })
      .from(users)
      .where(isNull(users.archivedAt))
      .orderBy(asc(users.name)),
    filter
      ? db
          .select({ userId: userBranches.userId })
          .from(userBranches)
          .where(inArray(userBranches.branchId, [...filter]))
      : Promise.resolve(null),
  ]);
  const allowed = links ? new Set(links.map((l) => l.userId)) : null;
  return staff
    .filter((u) => !allowed || u.role === "director" || allowed.has(u.id))
    .map((u) => ({ id: u.id, name: u.name }));
}

/** "Lid formasi" qo'shimcha maydonlari */
export async function getLeadFields(db: TenantDb): Promise<FormField[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LEAD_FIELDS_KEY));
  return parseFormFields(row?.value, DEFAULT_LEAD_FIELDS);
}
