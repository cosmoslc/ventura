import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { teachers } from "./academic";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";
import { groups } from "./groups";
import { students } from "./students";

/*
 * Davomat va dam olish kunlari (EDU-CRM-PLAN E2, ADR 0014). Eski tizimda bayram sahifasi bazaga saqlamas edi
 * (oxiri, filial, turi, "balansga ta'sir" ustunlari yo'q edi) va xodim davomatini belgilab bo'lmas edi.
 */

export const HOLIDAY_TYPES = ["official", "center", "custom"] as const;
export type HolidayType = (typeof HOLIDAY_TYPES)[number];

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    type: text("type", { enum: HOLIDAY_TYPES }).notNull().default("official"),
    /** "Ha" — shu kunlardagi darslar o'tmaydi: davomat olinmaydi, oylik hisobdagi darslar sonidan chiqadi (E3) */
    affectsLessons: boolean("affects_lessons").notNull().default(true),
    note: text("note"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("holidays_tenant_id_uq").on(t.tenantId, t.id),
    index("holidays_dates_idx").on(t.startDate, t.endDate),
    foreignKey({
      name: "holidays_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("holidays_range", sql`${t.endDate} >= ${t.startDate} and ${t.endDate} - ${t.startDate} < 60`),
    tenantPolicy("holidays"),
  ],
);

/** Bayram qaysi filiallarga tegishli; qator yo'q — barcha filiallar */
export const holidayBranches = pgTable(
  "holiday_branches",
  {
    tenantId: tenantId(),
    holidayId: uuid("holiday_id").notNull(),
    branchId: uuid("branch_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.holidayId, t.branchId] }),
    foreignKey({
      name: "holiday_branches_holiday_fk",
      columns: [t.tenantId, t.holidayId],
      foreignColumns: [holidays.tenantId, holidays.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "holiday_branches_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("cascade"),
    tenantPolicy("holiday_branches"),
  ],
);

/* ---------- Xodimlar davomati ---------- */

export const EMPLOYEE_ATTENDANCE_STATUSES = ["present", "late", "absent"] as const;
export type EmployeeAttendanceStatus = (typeof EMPLOYEE_ATTENDANCE_STATUSES)[number];

/** Xodim (users) yoki o'qituvchi (teachers) — aniq bittasi */
export const employeeAttendance = pgTable(
  "employee_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    userId: uuid("user_id"),
    teacherId: uuid("teacher_id"),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status", { enum: EMPLOYEE_ATTENDANCE_STATUSES }).notNull(),
    /** Kelgan vaqti "HH:MM" (ixtiyoriy) */
    checkIn: text("check_in"),
    note: text("note"),
    markedBy: uuid("marked_by"),
    markedAt: timestamp("marked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("employee_attendance_user_day_uq").on(t.tenantId, t.userId, t.date),
    unique("employee_attendance_teacher_day_uq").on(t.tenantId, t.teacherId, t.date),
    index("employee_attendance_date_idx").on(t.date),
    foreignKey({
      name: "employee_attendance_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "employee_attendance_teacher_fk",
      columns: [t.tenantId, t.teacherId],
      foreignColumns: [teachers.tenantId, teachers.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "employee_attendance_marked_by_fk",
      columns: [t.tenantId, t.markedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("employee_attendance_one_person", sql`(${t.userId} is null) <> (${t.teacherId} is null)`),
    check(
      "employee_attendance_check_in",
      sql`${t.checkIn} is null or ${t.checkIn} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`,
    ),
    tenantPolicy("employee_attendance"),
  ],
);

/* ---------- O'quvchilar davomati ---------- */

/** Bor, kech, sababli, yo'q — eski tizimdagi to'rt holat */
export const ATTENDANCE_STATUSES = ["present", "late", "excused", "absent"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

/**
 * Bitta o'quvchining bitta darsdagi belgisi. Eski tizimda guruh+sana uchun JSON qator edi (noyob kalitsiz —
 * takror qatorlar paydo bo'lar edi); bu yerda (guruh, o'quvchi, sana) noyob. Belgi yo'q — "belgilanmagan",
 * hech qachon "keldi" yoki "kelmadi" deb taxmin qilinmaydi.
 */
export const attendance = pgTable(
  "attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    studentId: uuid("student_id").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    status: text("status", { enum: ATTENDANCE_STATUSES }).notNull(),
    reason: text("reason"),
    markedBy: uuid("marked_by"),
    ...timestamps,
  },
  (t) => [
    unique("attendance_group_student_day_uq").on(t.tenantId, t.groupId, t.studentId, t.date),
    index("attendance_group_date_idx").on(t.groupId, t.date),
    index("attendance_student_idx").on(t.studentId, t.date),
    foreignKey({
      name: "attendance_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "attendance_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "attendance_marked_by_fk",
      columns: [t.tenantId, t.markedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("attendance_reason_len", sql`${t.reason} is null or length(${t.reason}) <= 500`),
    tenantPolicy("attendance"),
  ],
);
