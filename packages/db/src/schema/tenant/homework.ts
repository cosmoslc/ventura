import { date, foreignKey, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { groups } from "./groups";
import { students } from "./students";

/*
 * Guruh uy vazifalari va topshiriqlar (ADR 0063).
 * O'qituvchi tomonidan dars uchun topshiriladigan vazifalar: mavzu, tavsif, fayllar va muddat.
 * O'quvchilar javob (reply) sifatida fayllar va izoh yubora oladi, o'qituvchi tekshirib baholaydi.
 * Muallif / Agent: Google Gemini
 */

export interface HomeworkAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType?: string;
}

export const groupHomeworks = pgTable(
  "group_homeworks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    lessonDate: date("lesson_date", { mode: "string" }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    attachments: jsonb("attachments").$type<HomeworkAttachment[]>().notNull().default([]),
    dueDate: date("due_date", { mode: "string" }),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("group_homeworks_tenant_id_uq").on(t.tenantId, t.id),
    index("group_homeworks_group_idx").on(t.groupId, t.lessonDate),
    foreignKey({
      name: "group_homeworks_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "group_homeworks_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("set null"),
    tenantPolicy("group_homeworks"),
  ],
);

export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    homeworkId: uuid("homework_id").notNull(),
    studentId: uuid("student_id").notNull(),
    text: text("text"),
    attachments: jsonb("attachments").$type<HomeworkAttachment[]>().notNull().default([]),
    status: text("status", { enum: ["submitted", "checked", "rejected"] })
      .notNull()
      .default("submitted"),
    grade: integer("grade"),
    feedback: text("feedback"),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    checkedBy: uuid("checked_by"),
    ...timestamps,
  },
  (t) => [
    unique("homework_submissions_tenant_id_uq").on(t.tenantId, t.id),
    unique("homework_submissions_hw_student_uq").on(t.tenantId, t.homeworkId, t.studentId),
    index("homework_submissions_hw_idx").on(t.homeworkId),
    index("homework_submissions_student_idx").on(t.studentId),
    foreignKey({
      name: "homework_submissions_homework_fk",
      columns: [t.tenantId, t.homeworkId],
      foreignColumns: [groupHomeworks.tenantId, groupHomeworks.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "homework_submissions_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "homework_submissions_checked_by_fk",
      columns: [t.tenantId, t.checkedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("set null"),
    tenantPolicy("homework_submissions"),
  ],
);
