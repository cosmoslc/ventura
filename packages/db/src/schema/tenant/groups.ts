import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { TEACHER_SALARY_TYPES, courses, rooms, teachers } from "./academic";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";
import { students } from "./students";

/*
 * Guruhlar va a'zolik (EDU-CRM-PLAN E1d). Eski tizimda a'zolik o'quvchi kartochkasidagi JSON xaritada edi, davrlar
 * esa alohida jadvalda — ikkalasi bir-biridan ajralib qolar edi. Bu yerda bitta manba: `group_memberships` —
 * har qatori bitta a'zolik davri (qo'shilgan → chiqqan). Qayta qo'shilsa yangi davr ochiladi, tarix saqlanadi.
 * Guruh o'chirilmaydi, arxivlanadi: to'lov va davomat tarixi yo'qolmaydi (eski tizimda kaskad bilan o'char edi).
 */

const HHMM = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

export const groups = pgTable(
  "groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    courseId: uuid("course_id").notNull(),
    teacherId: uuid("teacher_id").notNull(),
    roomId: uuid("room_id"),
    name: text("name").notNull(),
    /** Oylik narx, so'm (kursdan olinadi, guruhda o'zgartirsa bo'ladi) */
    price: bigint("price", { mode: "number" }).notNull().default(0),
    durationMonths: integer("duration_months").notNull().default(0),
    /** mon..sun */
    days: text("days").array().notNull(),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    color: text("color").notNull().default("#6366f1"),
    /** O'qituvchi maoshi shu guruh uchun boshqacha bo'lsa; null — o'qituvchining o'z sozlamasi */
    teacherSalaryType: text("teacher_salary_type", { enum: TEACHER_SALARY_TYPES }),
    teacherSalaryPercent: integer("teacher_salary_percent"),
    teacherSalaryAmount: bigint("teacher_salary_amount", { mode: "number" }),
    note: text("note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("groups_tenant_id_uq").on(t.tenantId, t.id),
    index("groups_branch_idx").on(t.branchId),
    index("groups_teacher_idx").on(t.teacherId),
    foreignKey({
      name: "groups_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "groups_course_fk",
      columns: [t.tenantId, t.courseId],
      foreignColumns: [courses.tenantId, courses.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "groups_teacher_fk",
      columns: [t.tenantId, t.teacherId],
      foreignColumns: [teachers.tenantId, teachers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "groups_room_fk",
      columns: [t.tenantId, t.roomId],
      foreignColumns: [rooms.tenantId, rooms.id],
    }).onDelete("restrict"),
    check("groups_price_nonneg", sql`${t.price} >= 0 and ${t.durationMonths} >= 0`),
    check("groups_days_nonempty", sql`cardinality(${t.days}) between 1 and 7`),
    check("groups_time_format", sql`${t.startTime} ~ '${sql.raw(HHMM)}' and ${t.endTime} ~ '${sql.raw(HHMM)}'`),
    check("groups_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    check(
      "groups_salary_override",
      sql`(${t.teacherSalaryPercent} is null or ${t.teacherSalaryPercent} between 0 and 100) and (${t.teacherSalaryAmount} is null or ${t.teacherSalaryAmount} >= 0)`,
    ),
    tenantPolicy("groups"),
  ],
);

/** A'zolik holati: sinovda (to'lov hisoblanmaydi), faol, muzlatilgan; chiqqan — davr yopilgan */
export const MEMBERSHIP_STATUSES = ["trial", "active", "paused", "left"] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

export const groupMemberships = pgTable(
  "group_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    studentId: uuid("student_id").notNull(),
    status: text("status", { enum: MEMBERSHIP_STATUSES }).notNull().default("trial"),
    /** Guruhga qo'shilgan sana */
    enrolledAt: date("enrolled_at", { mode: "string" })
      .notNull()
      .default(sql`current_date`),
    /** Faollashtirilgan sana — to'lov shu kundan hisoblanadi (E3) */
    activatedAt: date("activated_at", { mode: "string" }),
    pausedAt: date("paused_at", { mode: "string" }),
    /** Davr yopilgan sana (guruhdan chiqqan) */
    leftAt: date("left_at", { mode: "string" }),
    leftReason: text("left_reason"),
    /** Chiqarishdagi izoh (sabab ro'yxatdan tanlanadi, izoh — erkin matn; ADR 0031) */
    leftNote: text("left_note"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("group_memberships_tenant_id_uq").on(t.tenantId, t.id),
    index("group_memberships_group_idx").on(t.groupId),
    index("group_memberships_student_idx").on(t.studentId),
    // Bir o'quvchi bir guruhda bir vaqtda faqat bitta ochiq davrga ega
    uniqueIndex("group_memberships_open_uq")
      .on(t.tenantId, t.groupId, t.studentId)
      .where(sql`${t.leftAt} is null`),
    foreignKey({
      name: "group_memberships_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "group_memberships_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "group_memberships_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("group_memberships_left_note_len", sql`${t.leftNote} is null or length(${t.leftNote}) <= 500`),
    check("group_memberships_left_consistent", sql`(${t.status} = 'left') = (${t.leftAt} is not null)`),
    check("group_memberships_activated", sql`${t.status} <> 'active' or ${t.activatedAt} is not null`),
    tenantPolicy("group_memberships"),
  ],
);
