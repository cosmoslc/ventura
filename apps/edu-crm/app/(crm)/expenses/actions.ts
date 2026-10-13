"use server";

import { and, eq, isNotNull, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expensePlans, expenses, financeCategories, financeCategoryBranches } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import {
  checkCategory,
  checkMethod,
  listCategories,
  moneyDateError,
  ownBranch,
  parsePerson,
  personExists,
} from "@/lib/server/expenses";
import { expenseInput, financeCategoryInput, firstError, planInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Xarajatlar, toifalar va oylik rejalar (EDU-CRM-PLAN E3b, ADR 0016). Ruxsatlar eski tizimdagidek: kiritish —
 * `expenses.create`, tahrirlash va bekor qilish — `expenses.edit_delete`, toifalar — `expenses.categories`,
 * rejalar — `expenses.create`. Xarajat o'chirilmaydi — bekor qilinadi (sabab bilan), tiklash mumkin.
 */

const FEATURE = "expenses";
const t = uz.expenses;
const voidInput = z.object({ id: z.uuid(), reason: z.string().trim().min(1, t.voidReasonRequired).max(500) });

function refresh() {
  revalidatePath("/expenses");
  revalidatePath("/additional-income");
}

/* ---------- Xarajat ---------- */

export async function saveExpenseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = expenseInput.safeParse(input);
  const editing = parsed.success && !!parsed.data.id;
  return crmAction<{ id: string }>(
    FEATURE,
    editing ? "expenses.edit_delete" : "expenses.create",
    async (ctx) => {
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const branchId = resolveBranch(ctx.branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };

      let before: typeof expenses.$inferSelect | undefined;
      if (v.id) {
        [before] = await ctx.db.select().from(expenses).where(eq(expenses.id, v.id));
        if (!before || !ownBranch(ctx, before.branchId)) return { ok: false, error: uz.common.gone };
        if (before.voidedAt) return { ok: false, error: t.alreadyVoided };
      }
      const person = parsePerson(v.person);
      // Sana faqat yangi yozuvda yoki o'zgarganda tekshiriladi (eski yozuvni tahrirlash to'xtab qolmasin)
      const bad = before?.date === v.date ? null : moneyDateError(v.date);
      if (bad) return { ok: false, error: bad };
      const catErr = await checkCategory(
        ctx,
        v.categoryId,
        "expense",
        branchId,
        before?.categoryId !== v.categoryId || before?.branchId !== branchId,
      );
      if (catErr) return { ok: false, error: catErr };
      const methodErr = await checkMethod(ctx, v.methodId, before?.methodId !== v.methodId);
      if (methodErr) return { ok: false, error: methodErr };
      const personChanged = before?.userId !== person.userId || before?.teacherId !== person.teacherId;
      if (personChanged && !(await personExists(ctx.db, person))) return { ok: false, error: t.personGone };

      const values = {
        branchId,
        kind: v.kind,
        categoryId: v.categoryId,
        reason: v.reason,
        amount: v.amount,
        date: v.date,
        methodId: v.methodId,
        ...person,
      };
      let id: string;
      if (before) {
        await ctx.db.update(expenses).set(values).where(eq(expenses.id, before.id));
        id = before.id;
        await ctx.audit(
          "expense.update",
          { type: "expense", id },
          {
            before: { amount: before.amount, date: before.date, categoryId: before.categoryId, reason: before.reason },
            after: { amount: v.amount, date: v.date, categoryId: v.categoryId, reason: v.reason },
          },
        );
      } else {
        const [row] = await ctx.db
          .insert(expenses)
          .values({ ...values, createdBy: ctx.staff.id })
          .returning({ id: expenses.id });
        id = row!.id;
        await ctx.audit(
          "expense.create",
          { type: "expense", id },
          { amount: v.amount, date: v.date, kind: v.kind, categoryId: v.categoryId, branchId },
        );
      }
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "expenses.save", input: input } },
  );
}

export async function voidExpenseAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "expenses.edit_delete",
    async (ctx) => {
      const parsed = voidInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const [row] = await ctx.db.select().from(expenses).where(eq(expenses.id, parsed.data.id));
      if (!row || !ownBranch(ctx, row.branchId)) return { ok: false, error: uz.common.gone };
      const updated = await ctx.db
        .update(expenses)
        .set({ voidedAt: new Date(), voidedBy: ctx.staff.id, voidReason: parsed.data.reason })
        .where(and(eq(expenses.id, row.id), isNull(expenses.voidedAt)))
        .returning({ id: expenses.id });
      if (!updated.length) return { ok: false, error: t.alreadyVoided };
      await ctx.audit(
        "expense.void",
        { type: "expense", id: row.id },
        { amount: row.amount, date: row.date, reason: parsed.data.reason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "expenses.void", input: input } },
  );
}

export async function restoreExpenseAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "expenses.edit_delete",
    async (ctx) => {
      const parsed = z.uuid().safeParse(id);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const [row] = await ctx.db.select().from(expenses).where(eq(expenses.id, parsed.data));
      if (!row || !ownBranch(ctx, row.branchId)) return { ok: false, error: uz.common.gone };
      const updated = await ctx.db
        .update(expenses)
        .set({ voidedAt: null, voidedBy: null, voidReason: null })
        .where(and(eq(expenses.id, row.id), isNotNull(expenses.voidedAt)))
        .returning({ id: expenses.id });
      if (!updated.length) return { ok: true };
      await ctx.audit(
        "expense.restore",
        { type: "expense", id: row.id },
        { amount: row.amount, date: row.date, voidReason: row.voidReason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "expenses.restore", input: id } },
  );
}

/* ---------- Toifalar ---------- */

/** Filial cheklovi bor xodim faqat o'z filiallaridagi toifani boshqaradi; "barcha filiallar" — cheklovsiz xodim */
function canManageScope(ctx: ActionCtx, branchIds: readonly string[] | null) {
  if (ctx.staff.scope === "all") return true;
  if (!branchIds?.length) return false;
  return branchIds.every((b) => ownBranch(ctx, b));
}

export async function saveCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(
    FEATURE,
    "expenses.categories",
    async (ctx) => {
      const parsed = financeCategoryInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const branchIds = v.branchIds.length ? [...new Set(v.branchIds)] : null;
      if (!canManageScope(ctx, branchIds)) return { ok: false, error: uz.common.branchForbidden };

      const all = await listCategories(ctx.db);
      const before = v.id ? all.find((c) => c.id === v.id) : undefined;
      if (v.id && (!before || before.kind !== v.kind)) return { ok: false, error: uz.common.gone };
      if (before && !canManageScope(ctx, before.branchIds)) return { ok: false, error: uz.common.branchForbidden };
      const [taken] = await ctx.db
        .select({ id: financeCategories.id })
        .from(financeCategories)
        .where(
          and(
            eq(financeCategories.kind, v.kind),
            eq(financeCategories.name, v.name),
            before ? ne(financeCategories.id, before.id) : undefined,
          ),
        );
      if (taken) return { ok: false, error: t.categoryNameTaken };

      const id = await ctx.db.transaction(async (tx) => {
        let cid = before?.id;
        if (cid) {
          await tx
            .update(financeCategories)
            .set({ name: v.name, active: v.active })
            .where(eq(financeCategories.id, cid));
          await tx.delete(financeCategoryBranches).where(eq(financeCategoryBranches.categoryId, cid));
        } else {
          const last = all.filter((c) => c.kind === v.kind).length;
          const [row] = await tx
            .insert(financeCategories)
            .values({ kind: v.kind, name: v.name, active: v.active, sortOrder: last })
            .returning({ id: financeCategories.id });
          cid = row!.id;
        }
        if (branchIds)
          await tx
            .insert(financeCategoryBranches)
            .values(branchIds.map((branchId) => ({ categoryId: cid!, branchId })));
        return cid;
      });
      await ctx.audit(
        before ? "finance_category.update" : "finance_category.create",
        { type: "finance_category", id },
        {
          kind: v.kind,
          name: v.name,
          active: v.active,
          branches: branchIds ?? "all",
          ...(before
            ? { before: { name: before.name, active: before.active, branches: before.branchIds ?? "all" } }
            : {}),
        },
      );
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "expenses.category", input: input } },
  );
}

/** Faqat ishlatilmagan toifa o'chiriladi; ishlatilgani faolsizlantiriladi (eski tizimda tekshiruvsiz o'char edi) */
export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "expenses.categories",
    async (ctx) => {
      const parsed = z.uuid().safeParse(id);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const c = (await listCategories(ctx.db)).find((x) => x.id === parsed.data);
      if (!c) return { ok: false, error: uz.common.gone };
      if (!canManageScope(ctx, c.branchIds)) return { ok: false, error: uz.common.branchForbidden };
      if (c.usage > 0) return { ok: false, error: t.categoryInUse(c.usage) };
      try {
        await ctx.db.delete(financeCategories).where(eq(financeCategories.id, c.id));
      } catch {
        // Tekshiruvdan keyin parallel yozuv qo'shilgan bo'lsa — FK (restrict) to'xtatadi
        return { ok: false, error: t.categoryInUse(1) };
      }
      await ctx.audit(
        "finance_category.delete",
        { type: "finance_category", id: c.id },
        { kind: c.kind, name: c.name },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "expenses.categoryDelete", input: id } },
  );
}

/* ---------- Oylik rejalar ---------- */

export async function savePlanAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(
    FEATURE,
    "expenses.create",
    async (ctx) => {
      const parsed = planInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      const branchId = resolveBranch(ctx.branch, v.branchId);
      if (!branchId) return { ok: false, error: uz.common.branchRequired };

      let before: typeof expensePlans.$inferSelect | undefined;
      if (v.id) {
        [before] = await ctx.db.select().from(expensePlans).where(eq(expensePlans.id, v.id));
        if (!before || !ownBranch(ctx, before.branchId)) return { ok: false, error: uz.common.gone };
      }
      const person = parsePerson(v.person);
      const catErr = await checkCategory(
        ctx,
        v.categoryId,
        "expense",
        branchId,
        before?.categoryId !== v.categoryId || before?.branchId !== branchId,
      );
      if (catErr) return { ok: false, error: catErr };
      if (v.methodId) {
        const methodErr = await checkMethod(ctx, v.methodId, before?.methodId !== v.methodId);
        if (methodErr) return { ok: false, error: methodErr };
      }
      const personChanged = before?.userId !== person.userId || before?.teacherId !== person.teacherId;
      if (personChanged && !(await personExists(ctx.db, person))) return { ok: false, error: t.personGone };

      const values = {
        branchId,
        categoryId: v.categoryId,
        month: v.month,
        amount: v.amount,
        methodId: v.methodId,
        ...person,
        note: v.note || null,
      };
      let id: string;
      if (before) {
        await ctx.db.update(expensePlans).set(values).where(eq(expensePlans.id, before.id));
        id = before.id;
      } else {
        const [row] = await ctx.db
          .insert(expensePlans)
          .values({ ...values, createdBy: ctx.staff.id })
          .returning({ id: expensePlans.id });
        id = row!.id;
      }
      await ctx.audit(
        before ? "expense_plan.update" : "expense_plan.create",
        { type: "expense_plan", id },
        {
          ...values,
          ...(before ? { before: { month: before.month, amount: before.amount, categoryId: before.categoryId } } : {}),
        },
      );
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "expenses.plan", input: input } },
  );
}

/** Reja pul yozuvi emas — o'chiriladi, lekin to'liq nusxasi jurnalda qoladi (eski tizimda tarixsiz o'char edi) */
export async function deletePlanAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "expenses.create",
    async (ctx) => {
      const parsed = z.uuid().safeParse(id);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const [row] = await ctx.db.select().from(expensePlans).where(eq(expensePlans.id, parsed.data));
      if (!row || !ownBranch(ctx, row.branchId)) return { ok: false, error: uz.common.gone };
      await ctx.db.delete(expensePlans).where(eq(expensePlans.id, row.id));
      await ctx.audit(
        "expense_plan.delete",
        { type: "expense_plan", id: row.id },
        {
          branchId: row.branchId,
          categoryId: row.categoryId,
          month: row.month,
          amount: row.amount,
          methodId: row.methodId,
          userId: row.userId,
          teacherId: row.teacherId,
          note: row.note,
        },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "expenses.planDelete", input: id } },
  );
}
