import { z } from "zod";
import { uz } from "./uz";

/*
 * Formalar qoidalari: client formada ham (darhol xato ko'rsatish), server amalida ham (yagona haqiqat) shu sxema.
 * Xato matnlari eski tizimdagidek.
 */

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((v) => v.toLowerCase());
const id = z.uuid();

export const branchInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, uz.branches.nameRequired).max(120),
  /** 9 ta mahalliy raqam yoki bo'sh */
  phone: z
    .string()
    .regex(/^(\d{9})?$/, uz.branches.phoneInvalid)
    .default(""),
  address: z.string().trim().max(300).default(""),
  color: hex,
  managerIds: z.array(id).max(100).default([]),
});
export type BranchInput = z.input<typeof branchInput>;

export const courseInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.courses.nameRequired).max(120),
  price: z.number().int().min(0).max(1_000_000_000).default(0),
  durationMonths: z.number().int().min(0).max(120).default(0),
  color: hex,
});
export type CourseInput = z.input<typeof courseInput>;

export const roomInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.rooms.nameRequired).max(120),
  capacity: z
    .number({ error: uz.rooms.capacityInvalid })
    .int(uz.rooms.capacityInvalid)
    .min(1, uz.rooms.capacityInvalid)
    .max(200, uz.rooms.capacityInvalid),
});
export type RoomInput = z.input<typeof roomInput>;

/** Birinchi xato matni (forma tepasida ko'rsatiladi) */
export const firstError = (e: z.ZodError) => e.issues[0]?.message ?? uz.common.invalid;

const money = z.number().int().min(0).max(1_000_000_000).default(0);

export const staffInput = z.object({
  id: id.optional(),
  name: z.string().trim().min(1, uz.staff.nameRequired).max(120),
  /** 9 ta mahalliy raqam (login) */
  phone: z.string().regex(/^\d{9}$/, uz.staff.phoneInvalid),
  gender: z.enum(["male", "female"]).nullable().default(null),
  /** YYYY-MM-DD yoki bo'sh */
  birthDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  address: z.string().trim().max(300).default(""),
  note: z.string().trim().max(1000).default(""),
  /** Kamida bittasi — yaratishda va o'zgartirilganda (eski hisoblarda bo'sh bo'lishi mumkin) */
  positionIds: z.array(id).max(20),
  branchIds: z.array(id).max(100),
  salaryType: z.enum(["fixed", "kpi"]).default("fixed"),
  monthlySalary: money,
  kpiStudentAmount: money,
  kpiContractBonus: money,
  customData: z.record(z.string(), z.string().max(300)).default({}),
});
export type StaffInput = z.input<typeof staffInput>;

const hhmm = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d)?$/, uz.teachers.timeInvalid)
  .default("");

export const teacherInput = z.object({
  id: id.optional(),
  kind: z.enum(["teacher", "support"]),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.teachers.nameRequired).max(120),
  phone: z.string().regex(/^\d{9}$/, uz.teachers.phoneInvalid),
  gender: z.enum(["male", "female"]).nullable().default(null),
  birthDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  assignedTeacherId: id.nullable().default(null),
  salaryType: z.enum(["percent", "per_student", "fixed"]),
  revenueSharePercent: z
    .number()
    .int()
    .min(0, uz.teachers.percentInvalid)
    .max(100, uz.teachers.percentInvalid)
    .default(0),
  perStudentSalary: money,
  fixedSalary: money,
  workingDays: z
    .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
    .max(7)
    .default([]),
  startTime: hhmm,
  endTime: hhmm,
  note: z.string().trim().max(1000).default(""),
});
export type TeacherInput = z.input<typeof teacherInput>;

export const studentInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.students.nameRequired).max(120),
  phone: z.string().regex(/^\d{9}$/, uz.students.phoneInvalid),
  parentName: z.string().trim().max(120).default(""),
  parentPhone: z
    .string()
    .regex(/^(\d{9})?$/, uz.students.parentPhoneInvalid)
    .default(""),
  birthDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  gender: z.enum(["male", "female"]).nullable().default(null),
  school: z.string().trim().max(120).default(""),
  grade: z.string().trim().max(40).default(""),
  address: z.string().trim().max(300).default(""),
  source: z.string().trim().max(80).default(""),
  interestedCourseId: id.nullable().default(null),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  note: z.string().trim().max(1000).default(""),
});
export type StudentInput = z.input<typeof studentInput>;

export const studentStatusInput = z.object({
  id,
  status: z.enum(["trial", "active", "paused", "left", "returned", "graduated"]),
  reason: z.string().trim().max(500).default(""),
});
