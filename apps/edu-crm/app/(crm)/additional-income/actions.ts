"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { additionalIncomes } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { checkCategory, checkMethod, moneyDateError, ownBranch } from "@/lib/server/expenses";
import { firstError, incomeInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Qo'shimcha daromad (EDU-CRM-PLAN E3b, ADR 0016). Eski tizimdagidek hamma amal `additional_income.create`
 * ruxsati bilan. Eski tizimdan farqi: yozuv o'chirilmaydi — bekor qilinadi (sabab bilan), tiklash mumkin;
 * toifa ma'lumotnomadan; har yozuv filialga tegishli.
 */

const FEATURE = "expenses";
const PERMISSION = "additional_income.create";
const voidInput = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1, uz.expenses.voidReasonRequired).max(500),
});

function refresh() {
  revalidatePath("/additional-income");
}

export async function saveIncomeAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(
    FEATURE,
    PERMISSION,
    async (ctx) => {
      const parsed = incomeInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const branchId = resolveBranch(ctx.branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };

      let before: typeof additionalIncomes.$inferSelect | undefined;
      if (v.id) {
        [before] = await ctx.db.select().from(additionalIncomes).where(eq(additionalIncomes.id, v.id));
        if (!before || !ownBranch(ctx, before.branchId)) return { ok: false, error: uz.common.gone };
        if (before.voidedAt) return { ok: false, error: uz.expenses.alreadyVoided };
      }
      // Sana faqat yangi yozuvda yoki o'zgarganda tekshiriladi (eski yozuvni tahrirlash to'xtab qolmasin)
      const bad = before?.date === v.date ? null : moneyDateError(v.date);
      if (bad) return { ok: false, error: bad };
      const catErr = await checkCategory(
        ctx,
        v.categoryId,
        "income",
        branchId,
        before?.categoryId !== v.categoryId || before?.branchId !== branchId,
      );
      if (catErr) return { ok: false, error: catErr };
      const methodErr = await checkMethod(ctx, v.methodId, before?.methodId !== v.methodId);
      if (methodErr) return { ok: false, error: methodErr };

      const values = {
        branchId,
        categoryId: v.categoryId,
        title: v.title,
        amount: v.amount,
        date: v.date,
        methodId: v.methodId,
        payer: v.payer || null,
      };
      let id: string;
      if (before) {
        await ctx.db.update(additionalIncomes).set(values).where(eq(additionalIncomes.id, before.id));
        id = before.id;
        await ctx.audit(
          "additional_income.update",
          { type: "additional_income", id },
          {
            before: { amount: before.amount, date: before.date, title: before.title, categoryId: before.categoryId },
            after: { amount: v.amount, date: v.date, title: v.title, categoryId: v.categoryId },
          },
        );
      } else {
        const [row] = await ctx.db
          .insert(additionalIncomes)
          .values({ ...values, createdBy: ctx.staff.id })
          .returning({ id: additionalIncomes.id });
        id = row!.id;
        await ctx.audit(
          "additional_income.create",
          { type: "additional_income", id },
          { amount: v.amount, date: v.date, title: v.title, categoryId: v.categoryId, branchId },
        );
      }
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "incomes.save", input: input } },
  );
}

export async function voidIncomeAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    PERMISSION,
    async (ctx) => {
      const parsed = voidInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const [row] = await ctx.db.select().from(additionalIncomes).where(eq(additionalIncomes.id, parsed.data.id));
      if (!row || !ownBranch(ctx, row.branchId)) return { ok: false, error: uz.common.gone };
      const updated = await ctx.db
        .update(additionalIncomes)
        .set({ voidedAt: new Date(), voidedBy: ctx.staff.id, voidReason: parsed.data.reason })
        .where(and(eq(additionalIncomes.id, row.id), isNull(additionalIncomes.voidedAt)))
        .returning({ id: additionalIncomes.id });
      if (!updated.length) return { ok: false, error: uz.expenses.alreadyVoided };
      await ctx.audit(
        "additional_income.void",
        { type: "additional_income", id: row.id },
        { amount: row.amount, date: row.date, title: row.title, reason: parsed.data.reason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "incomes.void", input: input } },
  );
}

export async function restoreIncomeAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    PERMISSION,
    async (ctx) => {
      const parsed = z.uuid().safeParse(id);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const [row] = await ctx.db.select().from(additionalIncomes).where(eq(additionalIncomes.id, parsed.data));
      if (!row || !ownBranch(ctx, row.branchId)) return { ok: false, error: uz.common.gone };
      const updated = await ctx.db
        .update(additionalIncomes)
        .set({ voidedAt: null, voidedBy: null, voidReason: null })
        .where(and(eq(additionalIncomes.id, row.id), isNotNull(additionalIncomes.voidedAt)))
        .returning({ id: additionalIncomes.id });
      if (!updated.length) return { ok: true };
      await ctx.audit(
        "additional_income.restore",
        { type: "additional_income", id: row.id },
        { amount: row.amount, date: row.date, title: row.title, voidReason: row.voidReason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "incomes.restore", input: id } },
  );
}
