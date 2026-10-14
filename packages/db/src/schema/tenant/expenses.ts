import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
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
import { paymentMethods } from "./finance";

/*
 * Xarajatlar va qo'shimcha daromad (EDU-CRM-PLAN E3b, ADR 0016). Eski tizimdan farqi:
 *  - toifa matn emas, ma'lumotnoma (bitta ro'yxat): ishlatilgan toifa o'chirilmaydi, faolsizlantiriladi;
 *  - har yozuv bitta filialga tegishli (filialsiz yozuv yo'q — eski tizimda u bir sahifada hamma filialda,
 *    boshqasida hech qayerda ko'rinar edi);
 *  - pul yozuvlari o'chirilmaydi — bekor qilinadi (voided_at), tiklash mumkin;
 *  - to'lov usuli — o'quvchi to'lovlaridagi bitta ro'yxat (payment_methods).
 */

const MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$";

export const FINANCE_CATEGORY_KINDS = ["expense", "income"] as const;
export type FinanceCategoryKind = (typeof FINANCE_CATEGORY_KINDS)[number];

/** Xarajat va qo'shimcha daromad toifalari */
export const financeCategories = pgTable(
  "finance_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    kind: text("kind", { enum: FINANCE_CATEGORY_KINDS }).notNull(),
    name: text("name").notNull(),
    /** Faolsiz toifa yangi yozuvda tanlanmaydi, eski yozuvlarda qoladi */
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("finance_categories_tenant_id_uq").on(t.tenantId, t.id),
    unique("finance_categories_name_uq").on(t.tenantId, t.kind, t.name),
    check("finance_categories_name_len", sql`length(${t.name}) between 1 and 60`),
    tenantPolicy("finance_categories"),
  ],
);

/** Toifa qaysi filiallarda tanlanadi; qator yo'q — barcha filiallarda */
export const financeCategoryBranches = pgTable(
  "finance_category_branches",
  {
    tenantId: tenantId(),
    categoryId: uuid("category_id").notNull(),
    branchId: uuid("branch_id").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.categoryId, t.branchId] }),
    foreignKey({
      name: "finance_category_branches_category_fk",
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [financeCategories.tenantId, financeCategories.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "finance_category_branches_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("cascade"),
    tenantPolicy("finance_category_branches"),
  ],
);

/** O'zgaruvchi (bir martalik) yoki o'zgarmas (ijara, internet...) xarajat */
export const EXPENSE_KINDS = ["variable", "fixed"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    kind: text("kind", { enum: EXPENSE_KINDS }).notNull(),
    categoryId: uuid("category_id").notNull(),
    /** Sabab (eski tizimda `note`) */
    reason: text("reason").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    methodId: uuid("method_id").notNull(),
    /** Pulni olgan/sarflagan xodim yoki o'qituvchi (ixtiyoriy, ko'pi bilan bittasi) */
    userId: uuid("user_id"),
    teacherId: uuid("teacher_id"),
    createdBy: uuid("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (t) => [
    unique("expenses_tenant_id_uq").on(t.tenantId, t.id),
    index("expenses_date_idx").on(t.date),
    index("expenses_branch_idx").on(t.branchId),
    foreignKey({
      name: "expenses_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_category_fk",
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [financeCategories.tenantId, financeCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_method_fk",
      columns: [t.tenantId, t.methodId],
      foreignColumns: [paymentMethods.tenantId, paymentMethods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_teacher_fk",
      columns: [t.tenantId, t.teacherId],
      foreignColumns: [teachers.tenantId, teachers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expenses_voided_by_fk",
      columns: [t.tenantId, t.voidedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("expenses_amount", sql`${t.amount} > 0`),
    check("expenses_reason_len", sql`length(${t.reason}) between 1 and 300`),
    check("expenses_one_person", sql`${t.userId} is null or ${t.teacherId} is null`),
    check("expenses_void", sql`(${t.voidedAt} is null) = (${t.voidedBy} is null)`),
    tenantPolicy("expenses"),
  ],
);

/** Qo'shimcha daromad (kitob, mock imtihon, zal ijarasi...) — o'quvchi hisobiga kirmaydi */
export const additionalIncomes = pgTable(
  "additional_incomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    title: text("title").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    methodId: uuid("method_id").notNull(),
    payer: text("payer"),
    createdBy: uuid("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (t) => [
    unique("additional_incomes_tenant_id_uq").on(t.tenantId, t.id),
    index("additional_incomes_date_idx").on(t.date),
    index("additional_incomes_branch_idx").on(t.branchId),
    foreignKey({
      name: "additional_incomes_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "additional_incomes_category_fk",
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [financeCategories.tenantId, financeCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "additional_incomes_method_fk",
      columns: [t.tenantId, t.methodId],
      foreignColumns: [paymentMethods.tenantId, paymentMethods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "additional_incomes_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "additional_incomes_voided_by_fk",
      columns: [t.tenantId, t.voidedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("additional_incomes_amount", sql`${t.amount} > 0`),
    check("additional_incomes_title_len", sql`length(${t.title}) between 1 and 120`),
    check("additional_incomes_payer_len", sql`${t.payer} is null or length(${t.payer}) <= 120`),
    check("additional_incomes_void", sql`(${t.voidedAt} is null) = (${t.voidedBy} is null)`),
    tenantPolicy("additional_incomes"),
  ],
);

/**
 * Oylik xarajat rejasi (limit): filial + toifa + oy, ixtiyoriy to'lov usuli va xodim bo'yicha toraytiriladi.
 * Haqiqiy sarf saqlanmaydi — xarajatlardan hisoblanadi (apps/edu-crm/lib/expense-plans.ts).
 */
export const expensePlans = pgTable(
  "expense_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    month: text("month").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** null — barcha to'lov usullari */
    methodId: uuid("method_id"),
    /** ikkalasi null — barcha xodimlar */
    userId: uuid("user_id"),
    teacherId: uuid("teacher_id"),
    note: text("note"),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    index("expense_plans_month_idx").on(t.month),
    foreignKey({
      name: "expense_plans_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "expense_plans_category_fk",
      columns: [t.tenantId, t.categoryId],
      foreignColumns: [financeCategories.tenantId, financeCategories.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expense_plans_method_fk",
      columns: [t.tenantId, t.methodId],
      foreignColumns: [paymentMethods.tenantId, paymentMethods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expense_plans_user_fk",
      columns: [t.tenantId, t.userId],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expense_plans_teacher_fk",
      columns: [t.tenantId, t.teacherId],
      foreignColumns: [teachers.tenantId, teachers.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "expense_plans_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("expense_plans_amount", sql`${t.amount} > 0`),
    check("expense_plans_month", sql`${t.month} ~ '${sql.raw(MONTH)}'`),
    check("expense_plans_one_person", sql`${t.userId} is null or ${t.teacherId} is null`),
    check("expense_plans_note_len", sql`${t.note} is null or length(${t.note}) <= 300`),
    tenantPolicy("expense_plans"),
  ],
);

/**
 * Pul oqimi rejasi (ADR 0030): filial + oy + qator bo'yicha bitta summa. Xarajatlar rejasi bu yerda emas — u
 * toifalar bo'yicha `expense_plans` dan yig'iladi. Reja pul yozuvi emas: summa bo'shatilsa qator o'chiriladi.
 */
export const FINANCE_PLAN_LINES = ["payments", "income", "salary"] as const;
export type FinancePlanLine = (typeof FINANCE_PLAN_LINES)[number];

export const financePlans = pgTable(
  "finance_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    branchId: uuid("branch_id").notNull(),
    month: text("month").notNull(),
    /** payments — o'quvchi to'lovlari, income — qo'shimcha daromad, salary — ish haqi va avans */
    line: text("line").$type<FinancePlanLine>().notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    unique("finance_plans_cell_uq").on(t.tenantId, t.branchId, t.month, t.line),
    index("finance_plans_month_idx").on(t.month),
    foreignKey({
      name: "finance_plans_branch_fk",
      columns: [t.tenantId, t.branchId],
      foreignColumns: [branches.tenantId, branches.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "finance_plans_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("finance_plans_amount", sql`${t.amount} > 0`),
    check("finance_plans_month", sql`${t.month} ~ '${sql.raw(MONTH)}'`),
    check("finance_plans_line", sql`${t.line} in ('payments', 'income', 'salary')`),
    tenantPolicy("finance_plans"),
  ],
);
