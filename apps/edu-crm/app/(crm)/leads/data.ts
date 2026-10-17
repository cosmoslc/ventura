import "server-only";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { TenantDb } from "@ventura/db";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import {
  type FirstLessonStatus,
  type LeadNoteKind,
  type LeadStageKind,
  courses,
  groups,
  leadEvents,
  leadFirstLessons,
  leadNotes,
  leadStages,
  leadWaitlists,
  leads,
  settings,
  students,
  userBranches,
  users,
} from "@ventura/db/schema/tenant";
import { DEFAULT_LEAD_FIELDS, type FormField, LEAD_FIELDS_KEY, parseFormFields } from "@/lib/form-fields";
import {
  DEFAULT_LEAD_STAGES,
  DEFAULT_LOST_REASONS,
  FIRST_LESSON_WINDOW_DAYS,
  LOST_REASONS_KEY,
  addDays,
  firstLessonDays,
  parseLostReasons,
} from "@/lib/leads";
import { todayTashkent } from "@/lib/server/memberships";
import { holidayRanges } from "../holidays/data";
import { listGroups } from "../groups/data";

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
  gender: "male" | "female" | null;
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
  studentName: string | null;
  waitlistId: string | null;
  lostReason: string | null;
  lostNote: string | null;
  lostFromStageId: string | null;
  firstLesson: {
    groupId: string;
    groupName: string;
    date: string;
    status: FirstLessonStatus;
  } | null;
}

const localPhone = (p: string | null) => (p ?? "").replace(/\D/g, "").slice(-9);
const assignee = alias(users, "assignee");
const creator = alias(users, "creator");
const lessonGroup = alias(groups, "lesson_group");

/** Arxivda bo'lmagan lidlar; `filter` — getBranchContext().filter */
export async function listLeads(db: TenantDb, filter: readonly string[] | null, id?: string): Promise<LeadRow[]> {
  const rows = await db
    .select({
      l: leads,
      courseName: courses.name,
      assignedName: assignee.name,
      createdByName: creator.name,
      studentName: students.name,
      fl: leadFirstLessons,
      flGroup: lessonGroup.name,
    })
    .from(leads)
    .leftJoin(courses, eq(courses.id, leads.courseId))
    .leftJoin(assignee, eq(assignee.id, leads.assignedTo))
    .leftJoin(creator, eq(creator.id, leads.createdBy))
    .leftJoin(students, eq(students.id, leads.studentId))
    .leftJoin(leadFirstLessons, eq(leadFirstLessons.leadId, leads.id))
    .leftJoin(lessonGroup, eq(lessonGroup.id, leadFirstLessons.groupId))
    .where(
      and(
        isNull(leads.archivedAt),
        filter ? inArray(leads.branchId, [...filter]) : undefined,
        id ? eq(leads.id, id) : undefined,
      ),
    )
    .orderBy(desc(leads.createdAt));
  return rows.map(({ l, courseName, assignedName, createdByName, studentName, fl, flGroup }) => ({
    id: l.id,
    branchId: l.branchId,
    name: l.name,
    phone: localPhone(l.phone),
    phone2: l.phone2 ? localPhone(l.phone2) : null,
    gender: l.gender,
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
    studentName,
    waitlistId: l.waitlistId,
    lostReason: l.lostReason,
    lostNote: l.lostNote,
    lostFromStageId: l.lostFromStageId,
    firstLesson: fl ? { groupId: fl.groupId, groupName: flGroup ?? "—", date: fl.lessonDate, status: fl.status } : null,
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

export interface LeadGroupOption extends SearchSelectOption {
  branchId: string;
  /** Birinchi dars uchun yaqin dars kunlari ("YYYY-MM-DD"): guruh jadvali va dam olish kunlaridan */
  lessonDays: string[];
  /** Dars vaqti, "HH:MM–HH:MM" */
  time: string;
}

/**
 * Birinchi dars va o'quvchiga aylantirish uchun guruhlar (arxivda bo'lmagan, xodimning filiallarida). Har guruhga
 * bugundan boshlab 3 haftalik dars kunlari ham beriladi — birinchi dars sanasi shulardan tanlanadi.
 */
export async function leadGroupOptions(
  db: TenantDb,
  filter: readonly string[] | null,
  today: string = todayTashkent(),
): Promise<LeadGroupOption[]> {
  const [rows, holidays] = await Promise.all([
    listGroups(db, filter),
    holidayRanges(db, today, addDays(today, FIRST_LESSON_WINDOW_DAYS)),
  ]);
  return rows.map((g) => ({
    value: g.id,
    label: g.name,
    hint: `${g.courseName} · ${g.teacherName} · ${g.startTime}`,
    branchId: g.branchId,
    lessonDays: firstLessonDays(g, today, holidays),
    time: `${g.startTime}–${g.endTime}`,
  }));
}

/** Yo'qotish sabablari (sozlamada; bo'lmasa standart ro'yxat) */
export async function getLostReasons(db: TenantDb): Promise<string[]> {
  const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, LOST_REASONS_KEY));
  return row ? parseLostReasons(row.value) : DEFAULT_LOST_REASONS;
}

export interface WaitlistRow {
  id: string;
  branchId: string;
  name: string;
  courseId: string | null;
  courseName: string | null;
  note: string | null;
  createdAt: string;
}

/** Ochiq zahira guruhlar (ADR 0024); `filter` — getBranchContext().filter */
export async function listWaitlists(db: TenantDb, filter: readonly string[] | null): Promise<WaitlistRow[]> {
  const rows = await db
    .select({ w: leadWaitlists, courseName: courses.name })
    .from(leadWaitlists)
    .leftJoin(courses, eq(courses.id, leadWaitlists.courseId))
    .where(and(isNull(leadWaitlists.closedAt), filter ? inArray(leadWaitlists.branchId, [...filter]) : undefined))
    .orderBy(asc(leadWaitlists.createdAt));
  return rows.map(({ w, courseName }) => ({
    id: w.id,
    branchId: w.branchId,
    name: w.name,
    courseId: w.courseId,
    courseName,
    note: w.note,
    createdAt: w.createdAt.toISOString(),
  }));
}
