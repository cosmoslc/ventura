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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { tenantId, tenantPolicy, timestamps } from "./columns";
import { groupMemberships, groups } from "./groups";
import { students } from "./students";

/*
 * Moliya: o'quvchi hisobi (EDU-CRM-PLAN E3, ADR 0015). Oylik hisoblar saqlanmaydi — har safar bitta toza
 * funksiyadan (apps/edu-crm/lib/billing.ts) hisoblanadi. Tarix barqaror bo'lishi uchun hisobga kiradigan har
 * narsa saqlanadi: narx tarixi, muzlatish oraliqlari, chegirma muddatlari. Pul yozuvlari o'chirilmaydi —
 * bekor qilinadi (voided_at), bekor qilinganini tiklash mumkin.
 */

const MONTH = "^[0-9]{4}-(0[1-9]|1[0-2])$";

/** Guruh narxi tarixi: narx `from_month` dan boshlab amal qiladi (o'tgan oylar o'zgarmaydi) */
export const groupPrices = pgTable(
  "group_prices",
  {
    tenantId: tenantId(),
    groupId: uuid("group_id").notNull(),
    fromMonth: text("from_month").notNull(),
    price: bigint("price", { mode: "number" }).notNull(),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.tenantId, t.groupId, t.fromMonth] }),
    foreignKey({
      name: "group_prices_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "group_prices_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check("group_prices_month", sql`${t.fromMonth} ~ '${sql.raw(MONTH)}'`),
    check("group_prices_nonneg", sql`${t.price} >= 0`),
    tenantPolicy("group_prices"),
  ],
);

/** Muzlatilgan oraliqlar [start, end) — muzlatishdan chiqqanda tarix saqlanadi (eski tizimda o'chib ketar edi) */
export const membershipPauses = pgTable(
  "membership_pauses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    membershipId: uuid("membership_id").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    /** null — hali muzlatilgan */
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("membership_pauses_membership_idx").on(t.membershipId),
    uniqueIndex("membership_pauses_open_uq")
      .on(t.tenantId, t.membershipId)
      .where(sql`${t.endDate} is null`),
    foreignKey({
      name: "membership_pauses_membership_fk",
      columns: [t.tenantId, t.membershipId],
      foreignColumns: [groupMemberships.tenantId, groupMemberships.id],
    }).onDelete("cascade"),
    check("membership_pauses_range", sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`),
    tenantPolicy("membership_pauses"),
  ],
);

export const DISCOUNT_KINDS = ["fixed", "percent"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

/** O'quvchining doimiy chegirmasi (oylar oralig'i bilan) */
export const studentDiscounts = pgTable(
  "student_discounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    studentId: uuid("student_id").notNull(),
    /** null — barcha guruhlariga */
    groupId: uuid("group_id"),
    kind: text("kind", { enum: DISCOUNT_KINDS }).notNull(),
    /** fixed — so'm; percent — 1..100 */
    value: bigint("value", { mode: "number" }).notNull(),
    fromMonth: text("from_month").notNull(),
    toMonth: text("to_month"),
    affectsTeacher: boolean("affects_teacher").notNull().default(true),
    reason: text("reason").notNull(),
    createdBy: uuid("created_by"),
    ...timestamps,
  },
  (t) => [
    index("student_discounts_student_idx").on(t.studentId),
    foreignKey({
      name: "student_discounts_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "student_discounts_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "student_discounts_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check(
      "student_discounts_value",
      sql`(${t.kind} = 'percent' and ${t.value} between 1 and 100) or (${t.kind} = 'fixed' and ${t.value} > 0)`,
    ),
    check(
      "student_discounts_months",
      sql`${t.fromMonth} ~ '${sql.raw(MONTH)}' and (${t.toMonth} is null or (${t.toMonth} ~ '${sql.raw(MONTH)}' and ${t.toMonth} >= ${t.fromMonth}))`,
    ),
    check("student_discounts_reason", sql`length(${t.reason}) between 1 and 500`),
    tenantPolicy("student_discounts"),
  ],
);

/** To'lov turlari (Naqd, Plastik karta, Click...) — o'chirilmaydi, faolsizlantiriladi */
export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("payment_methods_tenant_id_uq").on(t.tenantId, t.id),
    unique("payment_methods_name_uq").on(t.tenantId, t.name),
    check("payment_methods_name_len", sql`length(${t.name}) between 1 and 60`),
    tenantPolicy("payment_methods"),
  ],
);

/**
 * O'quvchi hisobidagi pul yozuvlari:
 *  - payment    — kassaga tushgan to'lov (+), chek raqami bilan;
 *  - refund     — o'quvchiga qaytarilgan pul (−);
 *  - discount   — bir martalik chegirma (+, pul emas);
 *  - correction — balansni qo'lda tuzatish (±, pul emas, sabab bilan);
 *  - writeoff   — kechilgan qarz (+, pul emas): guruhdan qarzdan kechib chiqarishda shu guruh qarzi yopiladi.
 * Eski tizimda `amount` ba'zan naqd, ba'zan balansdan olingan qism edi; bu yerda har yozuv bitta ma'noga ega.
 */
export const LEDGER_KINDS = ["payment", "refund", "discount", "correction", "writeoff"] as const;
export type LedgerKind = (typeof LEDGER_KINDS)[number];

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantId(),
    studentId: uuid("student_id").notNull(),
    /** null — guruhga bog'lanmagan (umumiy balans) */
    groupId: uuid("group_id"),
    kind: text("kind", { enum: LEDGER_KINDS }).notNull(),
    /** payment/refund/discount — musbat; correction — ishorali, 0 emas */
    amount: bigint("amount", { mode: "number" }).notNull(),
    /** Qaysi oy uchun ("YYYY-MM") */
    month: text("month"),
    /** Pul olingan/berilgan kun */
    date: date("date", { mode: "string" }).notNull(),
    methodId: uuid("method_id"),
    /** Chek raqami (faqat to'lovda), mijoz bo'yicha ketma-ket */
    receiptNo: integer("receipt_no"),
    note: text("note"),
    createdBy: uuid("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by"),
    voidReason: text("void_reason"),
    ...timestamps,
  },
  (t) => [
    unique("payments_tenant_id_uq").on(t.tenantId, t.id),
    unique("payments_receipt_uq").on(t.tenantId, t.receiptNo),
    index("payments_student_idx").on(t.studentId),
    index("payments_date_idx").on(t.date),
    index("payments_group_month_idx").on(t.groupId, t.month),
    foreignKey({
      name: "payments_student_fk",
      columns: [t.tenantId, t.studentId],
      foreignColumns: [students.tenantId, students.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payments_group_fk",
      columns: [t.tenantId, t.groupId],
      foreignColumns: [groups.tenantId, groups.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payments_method_fk",
      columns: [t.tenantId, t.methodId],
      foreignColumns: [paymentMethods.tenantId, paymentMethods.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payments_created_by_fk",
      columns: [t.tenantId, t.createdBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "payments_voided_by_fk",
      columns: [t.tenantId, t.voidedBy],
      foreignColumns: [users.tenantId, users.id],
    }).onDelete("restrict"),
    check(
      "payments_amount",
      sql`(${t.kind} = 'correction' and ${t.amount} <> 0) or (${t.kind} <> 'correction' and ${t.amount} > 0)`,
    ),
    check("payments_kind", sql`${t.kind} in ('payment', 'refund', 'discount', 'correction', 'writeoff')`),
    check("payments_method", sql`(${t.kind} in ('payment', 'refund')) = (${t.methodId} is not null)`),
    check("payments_receipt", sql`(${t.kind} = 'payment') = (${t.receiptNo} is not null)`),
    check("payments_month", sql`${t.month} is null or ${t.month} ~ '${sql.raw(MONTH)}'`),
    check("payments_void", sql`(${t.voidedAt} is null) = (${t.voidedBy} is null)`),
    check("payments_note_len", sql`${t.note} is null or length(${t.note}) <= 500`),
    tenantPolicy("payments"),
  ],
);
