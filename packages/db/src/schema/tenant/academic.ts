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
  uuid,
} from "drizzle-orm/pg-core";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { branches } from "./core";

/*
 * O'quv jarayoni ma'lumotnomalari (EDU-CRM-PLAN E1): kurslar va xonalar. Pul so'mda, butun son.
 * `branch_id` bo'sh — markaz bo'yicha umumiy (hamma filialda ko'rinadi), eski tizimdagidek.
 * Filialga havola (tenant_id, branch_id) juftligi bilan: oddiy FK RLS'ni chetlab o'tardi (ADR 0006),
 * kompozit kalit esa boshqa mijoz filialiga bog'lashni bazaning o'zida taqiqlaydi.
 */

export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id"),
    name: text("name").notNull(),
    /** Baza narxi (oyiga), so'm; guruh o'z narxini qo'ymasa shu olinadi */
    price: bigint("price", { mode: "number" }).notNull().default(0),
    durationMonths: integer("duration_months").notNull().default(0),
    color: text("color").notNull().default("#6366f1"),
    /** Arxivga o'tgan vaqt: ro'yxatda ko'rinmaydi, Arxiv bo'limidan tiklanadi */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("courses_tenant_id_uq").on(t.tenantId, t.id),
    index("courses_branch_idx").on(t.branchId),
    foreignKey({
      name: "courses_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    check("courses_price_nonneg", sql`${t.price} >= 0`),
    check("courses_duration_nonneg", sql`${t.durationMonths} >= 0`),
    check("courses_color_hex", sql`${t.color} ~ '^#[0-9a-f]{6}$'`),
    tenantPolicy("courses"),
  ],
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id"),
    name: text("name").notNull(),
    /** O'quvchi o'rinlari soni (1–200) */
    capacity: integer("capacity").notNull().default(20),
    ...timestamps,
  },
  (t) => [
    index("rooms_branch_idx").on(t.branchId),
    foreignKey({
      name: "rooms_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    check("rooms_capacity_range", sql`${t.capacity} between 1 and 200`),
    tenantPolicy("rooms"),
  ],
);

/* ---------- O'qituvchilar ---------- */

/** `teacher` — asosiy o'qituvchi; `support` — yordamchi (assistent), biror ustozga biriktiriladi */
export const TEACHER_KINDS = ["teacher", "support"] as const;
export type TeacherKind = (typeof TEACHER_KINDS)[number];
/** Eski tizimdagidek: tushumdan foiz, har o'quvchi uchun summa yoki oylik (hisob E3 da) */
export const TEACHER_SALARY_TYPES = ["percent", "per_student", "fixed"] as const;
export type TeacherSalaryType = (typeof TEACHER_SALARY_TYPES)[number];
export const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/**
 * O'qituvchilar — tizimga kiruvchi xodim emas (o'qituvchi portali bu rejaga kirmaydi, 1-qaror), shuning uchun
 * alohida jadval: parol va rasm yo'q. Bo'shatilgani `archived_at` bilan; guruh va maosh tarixi saqlanadi.
 */
export const teachers = pgTable(
  "teachers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    kind: text("kind", { enum: TEACHER_KINDS }).notNull().default("teacher"),
    name: text("name").notNull(),
    /** +998XXXXXXXXX */
    phone: text("phone").notNull(),
    gender: text("gender", { enum: ["male", "female"] }),
    birthDate: date("birth_date", { mode: "string" }),
    /** Support o'qituvchining ustozi */
    assignedTeacherId: uuid("assigned_teacher_id"),
    salaryType: text("salary_type", { enum: TEACHER_SALARY_TYPES }).notNull().default("percent"),
    /** Tushumdagi ulush, % (0–100) */
    revenueSharePercent: integer("revenue_share_percent").notNull().default(0),
    perStudentSalary: bigint("per_student_salary", { mode: "number" }).notNull().default(0),
    fixedSalary: bigint("fixed_salary", { mode: "number" }).notNull().default(0),
    /** Support o'qituvchi ish jadvali */
    workingDays: text("working_days")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    startTime: text("start_time"),
    endTime: text("end_time"),
    note: text("note"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("teachers_tenant_id_uq").on(t.tenantId, t.id),
    index("teachers_branch_idx").on(t.branchId),
    foreignKey({
      name: "teachers_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "teachers_assigned_fk",
      columns: [t.tenantId, t.assignedTeacherId],
      foreignColumns: [t.tenantId, t.id],
    }).onDelete("restrict"),
    check("teachers_percent_range", sql`${t.revenueSharePercent} between 0 and 100`),
    check("teachers_salary_nonneg", sql`${t.perStudentSalary} >= 0 and ${t.fixedSalary} >= 0`),
    check("teachers_assigned_support", sql`${t.assignedTeacherId} is null or ${t.kind} = 'support'`),
    check(
      "teachers_time_format",
      sql`(${t.startTime} is null or ${t.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$') and (${t.endTime} is null or ${t.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')`,
    ),
    tenantPolicy("teachers"),
  ],
);
