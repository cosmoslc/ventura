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
  /** Kabinetga kirish paroli (ADR 0062): faqat yangi o'qituvchida, bo'sh — kirish berilmaydi */
  password: z.string().max(128).default(""),
  revenueSharePercent: z
    .number()
    .int()
    .min(0, uz.teachers.percentInvalid)
    .max(100, uz.teachers.percentInvalid)
    .default(0),
  perStudentSalary: money,
  fixedSalary: money,
  /** Belgilangan oylik shu sanadan (bo'sh — avtomatik, ADR 0043) */
  salaryStartDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/, uz.groups.dateInvalid)
    .default(""),
  workingDays: z
    .array(z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]))
    .max(7)
    .default([]),
  startTime: hhmm,
  endTime: hhmm,
  note: z.string().trim().max(1000).default(""),
});
export type TeacherInput = z.input<typeof teacherInput>;

/**
 * O'quvchi formasi (ADR 0020): asosiy maydonlar — ism, telefon, jins va izoh. Qolgani markazning o'zi qo'shadigan
 * qo'shimcha maydonlar (`customData`, serverda sozlamadagi ro'yxat bo'yicha tozalanadi). Eski ustunlar (tug'ilgan sana,
 * maktab, ota-ona...) bazada qoladi — Excel importi ularni to'ldiradi, profil to'ldirilganini ko'rsatadi.
 */
export const studentInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.students.nameRequired).max(120),
  phone: z.string().regex(/^\d{9}$/, uz.students.phoneInvalid),
  gender: z.enum(["male", "female"]).nullable().default(null),
  note: z.string().trim().max(1000).default(""),
  customData: z.record(z.string().max(40), z.string().max(300)).default({}),
});
export type StudentInput = z.input<typeof studentInput>;

/** Lid formasi (E4a): asosiy maydonlar; qolgani — "Lid formasi" sozlamasidagi qo'shimcha maydonlar */
export const leadInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.leads.nameRequired).max(120),
  phone: z.string().regex(/^\d{9}$/, uz.leads.phoneInvalid),
  phone2: z
    .string()
    .regex(/^(\d{9})?$/, uz.leads.phoneInvalid)
    .default(""),
  gender: z.enum(["male", "female"]).nullable().default(null),
  source: z.string().trim().max(80).default(""),
  courseId: id.nullable().default(null),
  assignedTo: id.nullable().default(null),
  targetDate: z
    .string()
    .regex(/^(\d{4}-\d{2}-\d{2})?$/)
    .default(""),
  note: z.string().trim().max(1000).default(""),
  customData: z.record(z.string().max(40), z.string().max(300)).default({}),
});

export const leadMoveInput = z.object({ id, stageId: id });
export const leadAssignInput = z.object({ ids: z.array(id).min(1).max(500), userId: id.nullable() });
export const leadNoteInput = z.object({
  leadId: id,
  kind: z.enum(["call", "message", "meeting", "note"]),
  text: z.string().trim().min(1, uz.leads.noteRequired).max(2000),
});
export const leadConvertInput = z.object({ leadId: id, groupId: id.nullable().default(null) });
export const leadFirstLessonInput = z.object({
  leadId: id,
  groupId: id,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, uz.leads.firstLessonDateRequired),
});
export const leadFirstLessonMarkInput = z.object({ leadId: id, status: z.enum(["scheduled", "came", "absent"]) });
export const leadLoseInput = z.object({
  id,
  reason: z.string().trim().min(1, uz.leads.loseReasonRequired).max(80),
  note: z.string().trim().max(500).default(""),
});
export const waitlistInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  name: z.string().trim().min(1, uz.leads.waitlistNameRequired).max(120),
  courseId: id.nullable().default(null),
  note: z.string().trim().max(500).default(""),
});
export const waitlistAssignInput = z.object({ leadIds: z.array(id).min(1).max(500), waitlistId: id.nullable() });
export const waitlistActivateInput = z.object({ waitlistId: id, groupId: id });
/** Sabablar ro'yxati (lid yo'qotish, guruhdan chiqish) */
export const reasonListInput = z.array(z.string().trim().min(1).max(80)).min(1).max(30);

export const leadStagesInput = z
  .array(
    z.object({
      id: id.optional(),
      name: z.string().trim().min(1).max(60),
      color: z.string().regex(/^#[0-9a-f]{6}$/),
      kind: z.enum(["open", "won", "lost"]),
    }),
  )
  .min(3)
  .max(20);

export const studentTransferInput = z.object({
  studentId: id,
  branchId: id,
  reason: z.string().trim().max(500).default(""),
});

export const studentStatusInput = z.object({
  id,
  status: z.enum(["trial", "active", "paused", "left", "returned", "graduated"]),
  reason: z.string().trim().max(500).default(""),
});

const weekday = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, uz.groups.dateInvalid);

export const groupInput = z
  .object({
    id: id.optional(),
    branchId: id.nullable(),
    name: z.string().trim().min(1, uz.groups.nameRequired).max(120),
    courseId: z.uuid({ error: uz.groups.courseRequired }),
    teacherId: z.uuid({ error: uz.groups.teacherRequired }),
    roomId: id.nullable(),
    price: z.number().int().min(0).max(1_000_000_000).default(0),
    /** Narx o'zgarsa — yangi narx qaysi oydan amal qiladi (ADR 0015); null — joriy oydan */
    priceFrom: z
      .string()
      .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
      .nullable()
      .default(null),
    durationMonths: z.number().int().min(0).max(120).default(0),
    days: z.array(weekday).min(1, uz.groups.daysRequired).max(7),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, uz.groups.timeInvalid),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, uz.groups.timeInvalid),
    startDate: day,
    color: hex,
    teacherSalaryType: z.enum(["percent", "per_student", "fixed"]).nullable().default(null),
    teacherSalaryPercent: z
      .number()
      .int()
      .min(0, uz.teachers.percentInvalid)
      .max(100, uz.teachers.percentInvalid)
      .nullable()
      .default(null),
    teacherSalaryAmount: z.number().int().min(0).max(1_000_000_000).nullable().default(null),
    /** Guruhdagi belgilangan summa shu sanadan (null — guruh boshlangan sana, ADR 0043) */
    teacherSalaryFrom: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, uz.groups.dateInvalid)
      .nullable()
      .default(null),
    note: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.endTime > v.startTime, { message: uz.groups.timeOrder, path: ["endTime"] });
export type GroupInput = z.input<typeof groupInput>;

export const membershipDateInput = z.object({ id, date: day });
/** Sabab — ro'yxatdan (eski yozuvlar va tizim sabablari erkin matn bo'lgani uchun server faqat uzunlikni tekshiradi) */
const leaveFields = {
  date: day,
  reason: z.string().trim().max(500).default(""),
  note: z.string().trim().max(500).default(""),
  /**
   * Qarzi bo'lsa (ADR 0050): `auto` — qarz bo'lsa chiqarilmaydi (oyna variant so'raydi), `pending` — qarz bilan
   * (to'languncha muzlatiladi), `forgive` — qarzdan kechib (balansni tahrirlash ruxsati bilan)
   */
  mode: z.enum(["auto", "pending", "forgive"]).default("auto"),
};
export const membershipLeaveInput = z.object({ id, ...leaveFields });

/** O'quvchilar ro'yxatidan bir nechtasini birga (ADR 0028); 400 tagacha — tasdiq so'rovi hajmiga sig'adi */
export const BULK_MAX = 400;
const bulkIds = z.array(id).min(1).max(BULK_MAX);
export const bulkEnrollInput = z.object({
  groupId: id,
  studentIds: bulkIds,
  /** Tasdiq so'rovi sarlavhasi uchun ("5 ta o'quvchi") */
  title: z.string().max(80).optional(),
});
export const bulkLeaveInput = bulkEnrollInput.extend(leaveFields);

/* ---------- Xarajatlar va qo'shimcha daromad (ADR 0016) ---------- */

const amount = (msg: string) => z.number({ error: msg }).int(msg).positive(msg).max(10_000_000_000, msg);
/** Xodim yoki o'qituvchi: "user:<id>" / "teacher:<id>" */
export const personRef = z.string().regex(/^(user|teacher):[0-9a-f-]{36}$/);

export const expenseInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  kind: z.enum(["variable", "fixed"]),
  categoryId: z.uuid({ error: uz.expenses.categoryRequired }),
  reason: z.string().trim().min(1, uz.expenses.reasonRequired).max(300),
  amount: amount(uz.expenses.amountRequired),
  date: day,
  methodId: z.uuid({ error: uz.expenses.methodRequired }),
  person: personRef.nullable().default(null),
});
export type ExpenseInput = z.input<typeof expenseInput>;

export const incomeInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  categoryId: z.uuid({ error: uz.expenses.categoryRequired }),
  title: z.string().trim().min(1, uz.incomes.titleRequired).max(120),
  amount: amount(uz.expenses.amountRequired),
  date: day,
  methodId: z.uuid({ error: uz.expenses.methodRequired }),
  payer: z.string().trim().max(120).default(""),
});
export type IncomeInput = z.input<typeof incomeInput>;

export const planInput = z.object({
  id: id.optional(),
  branchId: id.nullable(),
  categoryId: z.uuid({ error: uz.expenses.categoryRequired }),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, uz.expenses.planMonthRequired),
  amount: amount(uz.expenses.planAmountRequired),
  methodId: id.nullable().default(null),
  person: personRef.nullable().default(null),
  note: z.string().trim().max(300).default(""),
});
export type PlanInput = z.input<typeof planInput>;

export const financeCategoryInput = z.object({
  id: id.optional(),
  kind: z.enum(["expense", "income"]),
  name: z.string().trim().min(1, uz.expenses.categoryNameRequired).max(60),
  /** bo'sh — barcha filiallar */
  branchIds: z.array(id).max(100).default([]),
  active: z.boolean().default(true),
});
export type FinanceCategoryInput = z.input<typeof financeCategoryInput>;

/* ---------- Ish haqi (ADR 0018) ---------- */

export const salaryEntryInput = z.object({
  id: id.optional(),
  person: z.string().regex(/^(user|teacher):[0-9a-f-]{36}$/, uz.salaries.personRequired),
  kind: z.enum(["salary", "advance", "bonus", "penalty"]),
  amount: z
    .number({ error: uz.salaries.amountRequired })
    .int(uz.salaries.amountRequired)
    .positive(uz.salaries.amountRequired)
    .max(10_000_000_000, uz.salaries.amountRequired),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, uz.salaries.monthRequired),
  date: day,
  /** Faqat maosh va avansda (server tekshiradi) */
  methodId: id.nullable().default(null),
  note: z.string().trim().max(500).default(""),
});
export type SalaryEntryInput = z.input<typeof salaryEntryInput>;

/* ---------- Pul oqimi rejasi (ADR 0030) ---------- */

/** `finance_plans.line` bilan bir xil (bazadagi CHECK) */
export const FINANCE_PLAN_LINES = ["payments", "income", "salary"] as const;

/** Bir filialning bir yillik rejasi: har oy va qator uchun summa; null — reja yo'q (qator o'chiriladi) */
export const financePlanInput = z.object({
  branchId: id.nullable(),
  year: z.number().int().min(2000).max(2100),
  cells: z
    .array(
      z.object({
        month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
        line: z.enum(FINANCE_PLAN_LINES),
        amount: z
          .number({ error: uz.reports.plan.amountInvalid })
          .int(uz.reports.plan.amountInvalid)
          .positive(uz.reports.plan.amountInvalid)
          .max(10_000_000_000, uz.reports.plan.amountInvalid)
          .nullable(),
      }),
    )
    .max(36),
});
export type FinancePlanInput = z.input<typeof financePlanInput>;
