import { sql } from "drizzle-orm";
import { check, date, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { courses } from "./academic";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";

/*
 * O'quvchilar (EDU-CRM-PLAN E1c). O'quvchi tizimga kirmaydi (o'quvchi portali rejaga kirmaydi, 1-qaror) — parol yo'q.
 * Balans, coin va guruh a'zoligi bu jadvalda emas: a'zolik davrlari (E1d) va to'lovlar (E3) o'z jadvallarida,
 * balans ulardan hisoblanadi (eski tizimdagi "saqlangan balans + qayta hisob" ikki marta sanash xatosi takrorlanmaydi).
 */

/**
 * Eski tizimdagi holatlar: `trial` — sinovda, `active` — faol, `paused` — muzlatilgan, `left` — ketgan,
 * `returned` — qaytib kelgan, `graduated` — bitirgan. Arxiv — alohida (`archived_at`), holat saqlanib qoladi.
 */
export const STUDENT_STATUSES = ["trial", "active", "paused", "left", "returned", "graduated"] as const;
export type StudentStatus = (typeof STUDENT_STATUSES)[number];

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    name: text("name").notNull(),
    /** +998XXXXXXXXX */
    phone: text("phone").notNull(),
    parentName: text("parent_name"),
    parentPhone: text("parent_phone"),
    birthDate: date("birth_date", { mode: "string" }),
    gender: text("gender", { enum: ["male", "female"] }),
    /** Maktab raqami yoki nomi ("45" → "45-maktab") */
    school: text("school"),
    grade: text("grade"),
    address: text("address"),
    /** Biz haqimizda qayerdan eshitgan (manba) */
    source: text("source"),
    interestedCourseId: uuid("interested_course_id"),
    note: text("note"),
    status: text("status", { enum: STUDENT_STATUSES }).notNull().default("trial"),
    /** Oxirgi holat o'zgarishi sababi */
    statusNote: text("status_note"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    /** O'qishni boshlagan sana */
    joinedAt: date("joined_at", { mode: "string" })
      .notNull()
      .default(sql`current_date`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archiveReason: text("archive_reason"),
    archivedBy: uuid("archived_by"),
    /** O'quvchini qo'shgan xodim — menejer KPI shunga yoziladi (EDU-CRM-E3-DAVOMI, 4-qaror); eski yozuvlarda bo'sh */
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("students_tenant_id_uq").on(t.tenantId, t.id),
    index("students_branch_idx").on(t.branchId),
    index("students_phone_idx").on(t.phone),
    index("students_created_by_idx").on(t.createdBy),
    foreignKey({
      name: "students_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "students_course_fk",
      columns: [t.tenantId, t.interestedCourseId],
      foreignColumns: [courses.tenantId, courses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "students_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "students_archived_by_fk",
      columns: [t.tenantId, t.archivedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    tenantPolicy("students"),
  ],
);

/** Eski tizimdagi "Izoh turi" */
export const STUDENT_NOTE_KINDS = ["call", "message", "parent", "result", "note", "warning"] as const;
export type StudentNoteKind = (typeof STUDENT_NOTE_KINDS)[number];

/** Muloqot va eslatmalar tarixi (profildagi "Eslatma" tabi) */
export const studentNotes = pgTable(
  "student_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    studentId: uuid("student_id").notNull(),
    kind: text("kind", { enum: STUDENT_NOTE_KINDS }).notNull().default("note"),
    text: text("text").notNull(),
    authorId: uuid("author_id"),
    authorName: text("author_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("student_notes_student_idx").on(t.studentId),
    foreignKey({
      name: "student_notes_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "student_notes_author_fk",
      columns: [t.tenantId, t.authorId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("student_notes_text_len", sql`length(${t.text}) between 1 and 2000`),
    tenantPolicy("student_notes"),
  ],
);
