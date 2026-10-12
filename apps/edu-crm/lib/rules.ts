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
