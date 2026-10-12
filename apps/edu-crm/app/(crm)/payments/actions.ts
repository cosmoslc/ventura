"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, canAny } from "@ventura/auth/staff/policy";
import {
  DISCOUNT_KINDS,
  groupMemberships,
  paymentMethods,
  payments,
  settings,
  studentDiscounts,
  students,
} from "@ventura/db/schema/tenant";
import { addDays } from "@/lib/billing";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { FINANCE_SETTINGS_KEY, financeSettingsSchema, loadAccount } from "@/lib/server/finance";
import { type Tx, todayTashkent } from "@/lib/server/memberships";
import { firstError } from "@/lib/rules";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";

/*
 * O'quvchi hisobidagi pul amallari (ADR 0015). Har amal bitta tranzaksiyada, o'quvchi bo'yicha qulf bilan
 * (bir vaqtda ikki qaytarish balansdan oshib ketmasin). Yozuvlar o'chirilmaydi — bekor qilinadi.
 * Eski tizimdan farqi: `amount` doim bitta ma'noda, ortiqcha to'lov balansda qoladi, qaytarish balansdan
 * oshmaydi, bekor qilish va tahrirlash balansni to'g'ri o'zgartiradi (hisob har safar yozuvlardan olinadi).
 */

const FEATURE = "payments";
const uuid = z.uuid();
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const month = z.string().regex(MONTH, uz.payments.monthRequired);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sum = z.number().int().positive(uz.payments.amountRequired).max(10_000_000_000);

function refresh(studentId?: string) {
  revalidatePath("/payments");
  revalidatePath("/debtors");
  revalidatePath("/students");
  if (studentId) revalidatePath(`/students/${studentId}`);
}

/** O'quvchi (arxivdagisi ham — qarzini to'lashi mumkin), filial cheklovi bilan */
async function loadStudent(ctx: ActionCtx, id: string) {
  const [s] = await ctx.db.select().from(students).where(eq(students.id, id));
  if (!s || !ctx.branch.options.some((b) => b.id === s.branchId)) return null;
  return s;
}

/** Shu o'quvchining pul amallari ketma-ket bajariladi */
async function lockStudent(tx: Tx, studentId: string) {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`student:${studentId}`} || current_setting('app.tenant_id'), 0))`,
  );
}

async function nextReceiptNo(tx: Tx): Promise<number> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended('receipt:' || current_setting('app.tenant_id'), 0))`,
  );
  const [row] = await tx.select({ max: sql<number | null>`max(${payments.receiptNo})` }).from(payments);
  return (row?.max ?? 0) + 1;
}

function dateError(date: string): string | null {
  const today = todayTashkent();
  if (date > today) return uz.payments.futureDate;
  if (date < addDays(today, -366)) return uz.payments.tooOld;
  return null;
}

async function activeMethod(ctx: ActionCtx, id: string) {
  const [m] = await ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, id));
  return m?.active ? m : null;
}

async function wasMember(ctx: ActionCtx, studentId: string, groupId: string) {
  const [m] = await ctx.db
    .select({ id: groupMemberships.id })
    .from(groupMemberships)
    .where(and(eq(groupMemberships.studentId, studentId), eq(groupMemberships.groupId, groupId)))
    .limit(1);
  return !!m;
}

/* ---------- To'lov ---------- */

const paymentInput = z.object({
  studentId: uuid,
  groupId: uuid.nullable(),
  month: month.nullable(),
  amount: sum,
  methodId: uuid,
  date: day,
  note: z.string().trim().max(500).default(""),
  discount: z
    .object({ amount: sum, reason: z.string().trim().min(1, uz.payments.discountReasonRequired).max(500) })
    .nullable()
    .default(null),
});

export async function recordPaymentAction(input: unknown): Promise<ActionResult<{ id: string; receiptNo: number }>> {
  return crmAction<{ id: string; receiptNo: number }>(FEATURE, "finance.payment_create", async (ctx) => {
    const parsed = paymentInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const s = await loadStudent(ctx, v.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    const bad = dateError(v.date);
    if (bad) return { ok: false, error: bad };
    if (!(await activeMethod(ctx, v.methodId))) return { ok: false, error: uz.payments.methodInactive };
    if (v.groupId && !v.month) return { ok: false, error: uz.payments.monthRequired };
    if (v.groupId && !(await wasMember(ctx, s.id, v.groupId))) return { ok: false, error: uz.payments.groupNotMember };
    const tag = { groupId: v.groupId, month: v.groupId ? v.month : null };

    const result = await ctx.db.transaction(async (tx) => {
      await lockStudent(tx, s.id);
      const receiptNo = await nextReceiptNo(tx);
      const [row] = await tx
        .insert(payments)
        .values({
          studentId: s.id,
          ...tag,
          kind: "payment",
          amount: v.amount,
          date: v.date,
          methodId: v.methodId,
          receiptNo,
          note: v.note || null,
          createdBy: ctx.staff.id,
        })
        .returning({ id: payments.id });
      if (v.discount) {
        await tx.insert(payments).values({
          studentId: s.id,
          ...tag,
          kind: "discount",
          amount: v.discount.amount,
          date: v.date,
          note: v.discount.reason,
          createdBy: ctx.staff.id,
        });
      }
      return { id: row!.id, receiptNo };
    });
    await ctx.audit(
      "payment.create",
      { type: "student", id: s.id },
      {
        paymentId: result.id,
        receiptNo: result.receiptNo,
        amount: v.amount,
        ...tag,
        methodId: v.methodId,
        date: v.date,
        ...(v.discount ? { discount: v.discount.amount, discountReason: v.discount.reason } : {}),
      },
    );
    refresh(s.id);
    return { ok: true, ...result };
  });
}

/* ---------- Qaytarish ---------- */

const refundInput = z.object({
  studentId: uuid,
  groupId: uuid.nullable(),
  amount: sum,
  methodId: uuid,
  date: day,
  reason: z.string().trim().min(1, uz.payments.refundReasonRequired).max(500),
});

export async function refundAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "finance.payment_create", async (ctx) => {
    const parsed = refundInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const s = await loadStudent(ctx, v.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    const bad = dateError(v.date);
    if (bad) return { ok: false, error: bad };
    if (!(await activeMethod(ctx, v.methodId))) return { ok: false, error: uz.payments.methodInactive };
    if (v.groupId && !(await wasMember(ctx, s.id, v.groupId))) return { ok: false, error: uz.payments.groupNotMember };

    const result = await ctx.db.transaction(async (tx): Promise<ActionResult> => {
      await lockStudent(tx, s.id);
      // Faqat o'quvchi foydasiga qolgan pul qaytariladi (eski tizimda tekshiruv yo'q edi)
      const { summary } = await loadAccount(tx, s.id, todayTashkent());
      const available = Math.max(0, summary.balance);
      if (available === 0) return { ok: false, error: uz.payments.refundNone };
      if (v.amount > available)
        return { ok: false, error: uz.payments.refundTooBig(`${money(available)} ${uz.common.som}`) };
      await tx.insert(payments).values({
        studentId: s.id,
        groupId: v.groupId,
        kind: "refund",
        amount: v.amount,
        date: v.date,
        methodId: v.methodId,
        note: v.reason,
        createdBy: ctx.staff.id,
      });
      return { ok: true };
    });
    if (!result.ok) return result;
    await ctx.audit(
      "payment.refund",
      { type: "student", id: s.id },
      {
        amount: v.amount,
        groupId: v.groupId,
        methodId: v.methodId,
        date: v.date,
        reason: v.reason,
      },
    );
    refresh(s.id);
    return { ok: true };
  });
}

/* ---------- Balansni tuzatish ---------- */

export async function correctionAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "students.balance_edit", async (ctx) => {
    const parsed = z
      .object({
        studentId: uuid,
        /** + o'quvchi foydasiga, − qarz */
        amount: z
          .number()
          .int()
          .refine((n) => n !== 0 && Math.abs(n) <= 10_000_000_000, uz.payments.amountRequired),
        reason: z.string().trim().min(1, uz.payments.correctionReasonRequired).max(500),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const s = await loadStudent(ctx, v.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    await ctx.db.transaction(async (tx) => {
      await lockStudent(tx, s.id);
      await tx.insert(payments).values({
        studentId: s.id,
        kind: "correction",
        amount: v.amount,
        date: todayTashkent(),
        note: v.reason,
        createdBy: ctx.staff.id,
      });
    });
    await ctx.audit("payment.correction", { type: "student", id: s.id }, { amount: v.amount, reason: v.reason });
    refresh(s.id);
    return { ok: true };
  });
}

/* ---------- Bekor qilish va tiklash ---------- */

async function loadEntry(ctx: ActionCtx, id: string) {
  const [e] = await ctx.db.select().from(payments).where(eq(payments.id, id));
  if (!e) return null;
  const s = await loadStudent(ctx, e.studentId);
  return s ? { e, s } : null;
}

/** Tuzatishni bekor qilish — balans ruxsati bilan, qolganlari — to'lovni bekor qilish ruxsati bilan */
const voidPermission = (kind: string) => (kind === "correction" ? "students.balance_edit" : "finance.payment_delete");

export async function voidEntryAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, ["finance.payment_delete", "students.balance_edit"], async (ctx) => {
    const parsed = z
      .object({ id: uuid, reason: z.string().trim().min(1, uz.payments.voidReasonRequired).max(500) })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const found = await loadEntry(ctx, parsed.data.id);
    if (!found) return { ok: false, error: uz.common.gone };
    const { e, s } = found;
    if (!can(ctx.staff.access, voidPermission(e.kind))) return { ok: false, error: uz.common.forbidden };
    if (e.voidedAt) return { ok: true };
    await ctx.db.transaction(async (tx) => {
      await lockStudent(tx, s.id);
      await tx
        .update(payments)
        .set({ voidedAt: new Date(), voidedBy: ctx.staff.id, voidReason: parsed.data.reason })
        .where(and(eq(payments.id, e.id), isNull(payments.voidedAt)));
    });
    await ctx.audit(
      "payment.void",
      { type: "student", id: s.id },
      {
        paymentId: e.id,
        kind: e.kind,
        amount: e.amount,
        receiptNo: e.receiptNo,
        reason: parsed.data.reason,
      },
    );
    refresh(s.id);
    return { ok: true };
  });
}

export async function restoreEntryAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, ["finance.payment_delete", "students.balance_edit", "archive.restore"], async (ctx) => {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const found = await loadEntry(ctx, parsed.data);
    if (!found) return { ok: false, error: uz.common.gone };
    const { e, s } = found;
    if (!canAny(ctx.staff.access, [voidPermission(e.kind), "archive.restore"]))
      return { ok: false, error: uz.common.forbidden };
    if (!e.voidedAt) return { ok: true };
    const result = await ctx.db.transaction(async (tx): Promise<ActionResult> => {
      await lockStudent(tx, s.id);
      // Qaytarishni tiklash balansni manfiyga olib kelmasin
      if (e.kind === "refund") {
        const { summary } = await loadAccount(tx, s.id, todayTashkent());
        if (e.amount > Math.max(0, summary.balance)) return { ok: false, error: uz.payments.restoreRefundTooBig };
      }
      await tx.update(payments).set({ voidedAt: null, voidedBy: null, voidReason: null }).where(eq(payments.id, e.id));
      return { ok: true };
    });
    if (!result.ok) return result;
    await ctx.audit(
      "payment.restore",
      { type: "student", id: s.id },
      { paymentId: e.id, kind: e.kind, amount: e.amount },
    );
    refresh(s.id);
    return { ok: true };
  });
}

/* ---------- Tahrirlash ---------- */

const editInput = z.object({
  id: uuid,
  groupId: uuid.nullable(),
  month: month.nullable(),
  amount: sum,
  methodId: uuid.nullable(),
  date: day,
  note: z.string().trim().max(500).default(""),
});

export async function editEntryAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "finance.payment_edit", async (ctx) => {
    const parsed = editInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const found = await loadEntry(ctx, v.id);
    if (!found) return { ok: false, error: uz.common.gone };
    const { e, s } = found;
    if (e.kind === "correction" || e.voidedAt) return { ok: false, error: uz.common.invalid };
    const bad = dateError(v.date);
    if (bad) return { ok: false, error: bad };
    const cashKind = e.kind === "payment" || e.kind === "refund";
    if (cashKind && (!v.methodId || (v.methodId !== e.methodId && !(await activeMethod(ctx, v.methodId)))))
      return { ok: false, error: uz.payments.methodInactive };
    if (v.groupId && v.groupId !== e.groupId && !(await wasMember(ctx, s.id, v.groupId)))
      return { ok: false, error: uz.payments.groupNotMember };
    if (e.kind !== "refund" && v.groupId && !v.month) return { ok: false, error: uz.payments.monthRequired };
    if ((e.kind === "discount" || e.kind === "refund") && !v.note)
      return { ok: false, error: uz.payments.voidReasonRequired };

    const next = {
      groupId: v.groupId,
      month: e.kind === "refund" || !v.groupId ? null : v.month,
      amount: v.amount,
      methodId: cashKind ? v.methodId : null,
      date: v.date,
      note: v.note || null,
    };
    const result = await ctx.db.transaction(async (tx): Promise<ActionResult> => {
      await lockStudent(tx, s.id);
      // Qaytarish oshirilsa — balansda shuncha ortiqcha pul bo'lishi kerak
      if (e.kind === "refund" && v.amount > e.amount) {
        const { summary } = await loadAccount(tx, s.id, todayTashkent());
        const extra = v.amount - e.amount;
        if (extra > Math.max(0, summary.balance))
          return {
            ok: false,
            error: uz.payments.refundTooBig(`${money(e.amount + Math.max(0, summary.balance))} ${uz.common.som}`),
          };
      }
      await tx.update(payments).set(next).where(eq(payments.id, e.id));
      return { ok: true };
    });
    if (!result.ok) return result;
    const before = {
      groupId: e.groupId,
      month: e.month,
      amount: e.amount,
      methodId: e.methodId,
      date: e.date,
      note: e.note,
    };
    const changed = (Object.keys(next) as (keyof typeof next)[]).filter((k) => before[k] !== next[k]);
    await ctx.audit(
      "payment.update",
      { type: "student", id: s.id },
      {
        paymentId: e.id,
        kind: e.kind,
        receiptNo: e.receiptNo,
        changed: Object.fromEntries(changed.map((k) => [k, { from: before[k], to: next[k] }])),
      },
    );
    refresh(s.id);
    return { ok: true };
  });
}

/* ---------- Doimiy chegirmalar ---------- */

const discountInput = z
  .object({
    id: uuid.optional(),
    studentId: uuid,
    groupId: uuid.nullable(),
    kind: z.enum(DISCOUNT_KINDS),
    value: z.number().int().positive(uz.finance.discountValueInvalid).max(1_000_000_000),
    fromMonth: z.string().regex(MONTH),
    toMonth: z.string().regex(MONTH).nullable(),
    affectsTeacher: z.boolean(),
    reason: z.string().trim().min(1, uz.finance.discountReasonRequired).max(500),
  })
  .refine((d) => d.kind !== "percent" || d.value <= 100, { message: uz.finance.discountValueInvalid })
  .refine((d) => !d.toMonth || d.toMonth >= d.fromMonth, { message: uz.finance.discountMonthsInvalid });

export async function saveDiscountAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "finance.payment_edit", async (ctx) => {
    const parsed = discountInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const s = await loadStudent(ctx, v.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    if (v.groupId && !(await wasMember(ctx, s.id, v.groupId))) return { ok: false, error: uz.payments.groupNotMember };
    const values = {
      groupId: v.groupId,
      kind: v.kind,
      value: v.value,
      fromMonth: v.fromMonth,
      toMonth: v.toMonth,
      affectsTeacher: v.affectsTeacher,
      reason: v.reason,
    };
    if (v.id) {
      const [d] = await ctx.db
        .select()
        .from(studentDiscounts)
        .where(and(eq(studentDiscounts.id, v.id), eq(studentDiscounts.studentId, s.id)));
      if (!d) return { ok: false, error: uz.common.gone };
      await ctx.db.update(studentDiscounts).set(values).where(eq(studentDiscounts.id, d.id));
      const before = {
        groupId: d.groupId,
        kind: d.kind,
        value: d.value,
        fromMonth: d.fromMonth,
        toMonth: d.toMonth,
        affectsTeacher: d.affectsTeacher,
        reason: d.reason,
      };
      await ctx.audit("discount.update", { type: "student", id: s.id }, { discountId: d.id, before, after: values });
    } else {
      const [d] = await ctx.db
        .insert(studentDiscounts)
        .values({ studentId: s.id, ...values, createdBy: ctx.staff.id })
        .returning({ id: studentDiscounts.id });
      await ctx.audit("discount.create", { type: "student", id: s.id }, { discountId: d!.id, ...values });
    }
    refresh(s.id);
    return { ok: true };
  });
}

export async function deleteDiscountAction(id: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "finance.payment_edit", async (ctx) => {
    const parsed = uuid.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [d] = await ctx.db.select().from(studentDiscounts).where(eq(studentDiscounts.id, parsed.data));
    if (!d) return { ok: false, error: uz.common.gone };
    const s = await loadStudent(ctx, d.studentId);
    if (!s) return { ok: false, error: uz.common.gone };
    await ctx.db.delete(studentDiscounts).where(eq(studentDiscounts.id, d.id));
    await ctx.audit(
      "discount.delete",
      { type: "student", id: s.id },
      {
        discountId: d.id,
        kind: d.kind,
        value: d.value,
        groupId: d.groupId,
        fromMonth: d.fromMonth,
        toMonth: d.toMonth,
        reason: d.reason,
      },
    );
    refresh(s.id);
    return { ok: true };
  });
}

/* ---------- Sozlamalar ---------- */

export async function savePaymentMethodAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "settings.receipt", async (ctx) => {
    const parsed = z
      .object({
        id: uuid.optional(),
        name: z.string().trim().min(1, uz.financeSettings.methodNameRequired).max(60),
        active: z.boolean().default(true),
      })
      .safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const [dup] = await ctx.db
      .select({ id: paymentMethods.id })
      .from(paymentMethods)
      .where(eq(paymentMethods.name, v.name));
    if (dup && dup.id !== v.id) return { ok: false, error: uz.financeSettings.methodExists };
    if (v.id) {
      const [m] = await ctx.db.select().from(paymentMethods).where(eq(paymentMethods.id, v.id));
      if (!m) return { ok: false, error: uz.common.gone };
      await ctx.db.update(paymentMethods).set({ name: v.name, active: v.active }).where(eq(paymentMethods.id, m.id));
      await ctx.audit(
        "payment_method.update",
        { type: "payment_method", id: m.id },
        {
          before: { name: m.name, active: m.active },
          after: { name: v.name, active: v.active },
        },
      );
    } else {
      const [{ max } = { max: 0 }] = await ctx.db
        .select({ max: sql<number>`coalesce(max(${paymentMethods.sortOrder}), 0)` })
        .from(paymentMethods);
      const [m] = await ctx.db
        .insert(paymentMethods)
        .values({ name: v.name, active: true, sortOrder: max + 1 })
        .returning({ id: paymentMethods.id });
      await ctx.audit("payment_method.create", { type: "payment_method", id: m!.id }, { name: v.name });
    }
    revalidatePath("/payment-settings");
    revalidatePath("/payments");
    return { ok: true };
  });
}

export async function saveFinanceSettingsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "settings.courses", async (ctx) => {
    const parsed = financeSettingsSchema.strict().safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const [before] = await ctx.db.select().from(settings).where(eq(settings.key, FINANCE_SETTINGS_KEY));
    await ctx.db
      .insert(settings)
      .values({ key: FINANCE_SETTINGS_KEY, value: parsed.data, updatedBy: ctx.staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: parsed.data, updatedBy: ctx.staff.id, updatedAt: new Date() },
      });
    await ctx.audit(
      "finance_settings.update",
      { type: "settings", id: FINANCE_SETTINGS_KEY },
      {
        before: before?.value ?? null,
        after: parsed.data,
      },
    );
    revalidatePath("/payment-settings");
    refresh();
    return { ok: true };
  });
}
