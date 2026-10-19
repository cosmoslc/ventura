import { sql } from "drizzle-orm";
import { boolean, check, date, foreignKey, index, pgTable, smallint, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { groups } from "./groups";
import { students } from "./students";

/*
 * Dars baholari (ADR 0061): bitta o'quvchining bitta darsdagi bahosi va uy vazifasi belgisi, davomat kabi
 * (guruh, o'quvchi, sana) noyob. Baho qo'yilgan paytdagi shkala saqlanadi — sozlama keyin o'zgarsa, eski baho o'z
 * shkalasida qoladi ("4/5"). Baho ham, uy vazifasi ham yo'q bo'lsa qator saqlanmaydi.
 */

export const lessonGrades = pgTable(
  "lesson_grades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    studentId: uuid("student_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    score: smallint("score"),
    scale: smallint("scale").notNull(),
    /** null — belgilanmagan, true — bajardi, false — bajarmadi */
    homework: boolean("homework"),
    markedBy: uuid("marked_by"),
    ...timestamps,
  },
  (t) => [
    unique("lesson_grades_group_student_day_uq").on(t.tenantId, t.groupId, t.studentId, t.date),
    index("lesson_grades_group_date_idx").on(t.groupId, t.date),
    index("lesson_grades_student_idx").on(t.studentId, t.date),
    foreignKey({
      name: "lesson_grades_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lesson_grades_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "lesson_grades_marked_by_fk",
      columns: [t.tenantId, t.markedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("lesson_grades_scale", sql`${t.scale} in (5, 10, 100)`),
    check("lesson_grades_score", sql`${t.score} is null or (${t.score} > 0 and ${t.score} <= ${t.scale})`),
    check("lesson_grades_not_empty", sql`${t.score} is not null or ${t.homework} is not null`),
    tenantPolicy("lesson_grades"),
  ],
);
