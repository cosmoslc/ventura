import { sql } from "drizzle-orm";
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { courses } from "./academic";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";
import { groups } from "./groups";
import { students } from "./students";

/*
 * Lidlar (EDU-CRM-PLAN E4, docs/EDU-CRM-E4.md, ADR 0022). Eski tizimdagi `leads`, `lead_stage_events` va JSON ichidagi
 * izohlar o'rniga: bosqichlar markaz sozlamasida (`lead_stages`), bosqich almashuvi va izohlar alohida jadvallarda —
 * kim va qachon yozgani saqlanadi. Lid o'chirilmaydi — arxivga o'tadi.
 */

/** Bosqich turi: `open` — doskadagi ish bosqichi; `won` — o'quvchi bo'ldi; `lost` — yo'qotildi (tizim bosqichlari) */
export const LEAD_STAGE_KINDS = ["open", "won", "lost"] as const;
export type LeadStageKind = (typeof LEAD_STAGE_KINDS)[number];

export const leadStages = pgTable(
  "lead_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    color: text("color").notNull().default("#3b82f6"),
    position: integer("position").notNull().default(0),
    kind: text("kind", { enum: LEAD_STAGE_KINDS }).notNull().default("open"),
    ...timestamps,
  },
  (t) => [
    unique("lead_stages_tenant_id_uq").on(t.tenantId, t.id),
    check("lead_stages_name_len", sql`length(${t.name}) between 1 and 60`),
    check("lead_stages_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    tenantPolicy("lead_stages"),
  ],
);

/**
 * Zahira guruh — kutish ro'yxati (E4b, ADR 0024): kurs yoki vaqt bo'yicha guruh ochilishini kutayotgan lidlar.
 * Faollashtirilganda (`group_id`) yoki yopilganda (`closed_at`) ro'yxat yopiladi; yozuv o'chirilmaydi.
 */
export const leadWaitlists = pgTable(
  "lead_waitlists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    name: text("name").notNull(),
    courseId: uuid("course_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    /** Faollashtirilgan guruh */
    groupId: uuid("group_id"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by"),
    ...timestamps,
  },
  (t) => [
    unique("lead_waitlists_tenant_id_uq").on(t.tenantId, t.id),
    index("lead_waitlists_branch_idx").on(t.branchId),
    foreignKey({
      name: "lead_waitlists_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_waitlists_course_fk",
      columns: [t.tenantId, t.courseId],
      foreignColumns: [courses.tenantId, courses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_waitlists_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_waitlists_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_waitlists_closed_by_fk",
      columns: [t.tenantId, t.closedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("lead_waitlists_name_len", sql`length(${t.name}) between 1 and 120`),
    check("lead_waitlists_closed", sql`${t.groupId} is null or ${t.closedAt} is not null`),
    tenantPolicy("lead_waitlists"),
  ],
);

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    name: text("name").notNull(),
    /** +998XXXXXXXXX */
    phone: text("phone").notNull(),
    phone2: text("phone2"),
    gender: text("gender", { enum: ["male", "female"] }),
    /** Qayerdan kelgan (Instagram, Telegram, tavsiya, veb-sayt forma...) */
    source: text("source"),
    courseId: uuid("course_id"),
    stageId: uuid("stage_id").notNull(),
    /** Mas'ul xodim */
    assignedTo: uuid("assigned_to"),
    /** Keyingi bog'lanish sanasi ("Bugungi ishlar") */
    targetDate: date("target_date", { mode: "string" }),
    note: text("note"),
    /** Lid formasidagi qo'shimcha maydonlar (maydon id → matn) */
    customData: jsonb("custom_data").$type<Record<string, string>>().notNull().default({}),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true }).notNull().defaultNow(),
    /** O'quvchiga aylanganda (E4b) */
    studentId: uuid("student_id"),
    /** Zahira guruhda kutayapti (E4b) */
    waitlistId: uuid("waitlist_id"),
    /** Yo'qotilganda (E4b): sabab, izoh va qaysi bosqichdan */
    lostReason: text("lost_reason"),
    lostNote: text("lost_note"),
    lostFromStageId: uuid("lost_from_stage_id"),
    createdBy: uuid("created_by"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: uuid("archived_by"),
    archiveReason: text("archive_reason"),
    ...timestamps,
  },
  (t) => [
    unique("leads_tenant_id_uq").on(t.tenantId, t.id),
    index("leads_branch_idx").on(t.branchId),
    index("leads_stage_idx").on(t.stageId),
    index("leads_phone_idx").on(t.phone),
    index("leads_assigned_idx").on(t.assignedTo),
    index("leads_waitlist_idx").on(t.waitlistId),
    foreignKey({
      name: "leads_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_course_fk",
      columns: [t.tenantId, t.courseId],
      foreignColumns: [courses.tenantId, courses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_stage_fk",
      columns: [t.tenantId, t.stageId],
      foreignColumns: [leadStages.tenantId, leadStages.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_lost_from_fk",
      columns: [t.tenantId, t.lostFromStageId],
      foreignColumns: [leadStages.tenantId, leadStages.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_assigned_fk",
      columns: [t.tenantId, t.assignedTo],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_waitlist_fk",
      columns: [t.tenantId, t.waitlistId],
      foreignColumns: [leadWaitlists.tenantId, leadWaitlists.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "leads_archived_by_fk",
      columns: [t.tenantId, t.archivedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("leads_name_len", sql`length(${t.name}) between 1 and 120`),
    tenantPolicy("leads"),
  ],
);

/** Bosqich almashuvi; `from_stage_id` bo'sh — lid yaratildi */
export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    leadId: uuid("lead_id").notNull(),
    fromStageId: uuid("from_stage_id"),
    toStageId: uuid("to_stage_id").notNull(),
    actorId: uuid("actor_id"),
    actorName: text("actor_name"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_events_lead_idx").on(t.leadId, t.at),
    foreignKey({
      name: "lead_events_lead_fk",
      columns: [t.tenantId, t.leadId],
      foreignColumns: [leads.tenantId, leads.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_events_from_fk",
      columns: [t.tenantId, t.fromStageId],
      foreignColumns: [leadStages.tenantId, leadStages.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_events_to_fk",
      columns: [t.tenantId, t.toStageId],
      foreignColumns: [leadStages.tenantId, leadStages.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_events_actor_fk",
      columns: [t.tenantId, t.actorId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    tenantPolicy("lead_events"),
  ],
);

export const LEAD_NOTE_KINDS = ["call", "message", "meeting", "note"] as const;
export type LeadNoteKind = (typeof LEAD_NOTE_KINDS)[number];

/** Izoh va qo'ng'iroq natijasi (eski tizimdagi `comments` JSON o'rniga) */
export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    leadId: uuid("lead_id").notNull(),
    kind: text("kind", { enum: LEAD_NOTE_KINDS }).notNull().default("note"),
    text: text("text").notNull(),
    authorId: uuid("author_id"),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("lead_notes_lead_idx").on(t.leadId),
    foreignKey({
      name: "lead_notes_lead_fk",
      columns: [t.tenantId, t.leadId],
      foreignColumns: [leads.tenantId, leads.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_notes_author_fk",
      columns: [t.tenantId, t.authorId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("lead_notes_text_len", sql`length(${t.text}) between 1 and 2000`),
    tenantPolicy("lead_notes"),
  ],
);

/** Birinchi (sinov) dars holati: rejalashtirilgan, keldi, kelmadi */
export const FIRST_LESSON_STATUSES = ["scheduled", "came", "absent"] as const;
export type FirstLessonStatus = (typeof FIRST_LESSON_STATUSES)[number];

/**
 * Lidning birinchi (sinov) darsi (E4b). Lid o'quvchi emas: bu yozuv o'quvchi, a'zolik, davomat, to'lov va maoshga
 * tegmaydi. Guruh davomatida alohida qatorda ko'rinadi. Bitta lidga bitta yozuv — boshqa kunga ko'chirilsa shu qator.
 */
export const leadFirstLessons = pgTable(
  "lead_first_lessons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    leadId: uuid("lead_id").notNull(),
    groupId: uuid("group_id").notNull(),
    lessonDate: date("lesson_date", { mode: "string" }).notNull(),
    status: text("status", { enum: FIRST_LESSON_STATUSES }).notNull().default("scheduled"),
    createdBy: uuid("created_by"),
    markedBy: uuid("marked_by"),
    markedAt: timestamp("marked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("lead_first_lessons_lead_uq").on(t.tenantId, t.leadId),
    index("lead_first_lessons_group_date_idx").on(t.groupId, t.lessonDate),
    foreignKey({
      name: "lead_first_lessons_lead_fk",
      columns: [t.tenantId, t.leadId],
      foreignColumns: [leads.tenantId, leads.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "lead_first_lessons_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_first_lessons_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lead_first_lessons_marked_by_fk",
      columns: [t.tenantId, t.markedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("lead_first_lessons_marked", sql`${t.status} = 'scheduled' or ${t.markedAt} is not null`),
    tenantPolicy("lead_first_lessons"),
  ],
);
