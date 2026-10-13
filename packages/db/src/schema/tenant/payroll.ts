import { sql } from "drizzle-orm";
import { bigint, check, date, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { teachers } from "./academic";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { paymentMethods } from "./finance";

/*
 * Ish haqi yozuvlari (EDU-CRM-PLAN E3c, ADR 0018). Hisoblangan maosh saqlanmaydi — har safar bitta toza funksiyadan
 * (apps/edu-crm/lib/payroll.ts) olinadi. Bu yerda faqat xodim yoki o'qituvchiga tegishli harakatlar:
 *  - salary  — maosh to'lovi (kassadan chiqadi, to'lov usuli bilan);
 *  - advance — avans (kassadan chiqadi, to'lov usuli bilan);
 *  - bonus   — hisoblanganga qo'shimcha (pul emas — keyin maosh bilan beriladi);
 *  - penalty — jarima (hisoblangandan ayiriladi, pul emas).
 * Qoldiq = hisoblangan + bonus − jarima − (maosh + avans). Eski tizimda to'lov usuli va menejer to'lovi turi
 * saqlanmas, "mukofot" maosh bo'lib yozilar, qoldiq to'rt xil formula bilan hisoblanar edi.
 * Yozuv o'chirilmaydi — bekor qilinadi (voided_at), tiklash mumkin.
 */

const MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$";

export const SALARY_ENTRY_KINDS = ["salary", "advance", "bonus", "penalty"] as const;
export type SalaryEntryKind = (typeof SALARY_ENTRY_KINDS)[number];

export const salaryEntries = pgTable(
  "salary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    /** Xodim (menejer, kassir...) yoki o'qituvchi — aniq bittasi */
    userId: uuid("user_id"),
    teacherId: uuid("teacher_id"),
    kind: text("kind", { enum: SALARY_ENTRY_KINDS }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** Qaysi oy hisobi uchun ("YYYY-MM") */
    month: text("month").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    /** Faqat maosh va avansda */
    methodId: uuid("method_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (t) => [
    unique("salary_entries_tenant_id_uq").on(t.tenantId, t.id),
    index("salary_entries_month_idx").on(t.month),
    index("salary_entries_user_idx").on(t.userId),
    index("salary_entries_teacher_idx").on(t.teacherId),
    foreignKey({
      name: "salary_entries_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "salary_entries_teacher_fk",
      columns: [t.tenantId, t.teacherId],
      foreignColumns: [teachers.tenantId, teachers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "salary_entries_method_fk",
      columns: [t.tenantId, t.methodId],
      foreignColumns: [paymentMethods.tenantId, paymentMethods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "salary_entries_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "salary_entries_voided_by_fk",
      columns: [t.tenantId, t.voidedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("salary_entries_one_person", sql`(${t.userId} is null) <> (${t.teacherId} is null)`),
    check("salary_entries_amount", sql`${t.amount} > 0`),
    check("salary_entries_month", sql`${t.month} ~ '${sql.raw(MONTH)}'`),
    check("salary_entries_method", sql`(${t.kind} in ('salary', 'advance')) = (${t.methodId} is not null)`),
    check("salary_entries_note_len", sql`${t.note} is null or length(${t.note}) <= 500`),
    check("salary_entries_void", sql`(${t.voidedAt} is null) = (${t.voidedBy} is null)`),
    tenantPolicy("salary_entries"),
  ],
);
