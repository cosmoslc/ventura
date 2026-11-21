"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { expenseCategories, generalExpenses } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";

export interface ExpenseActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Toifa nomi bo'sh bo'lishi mumkin emas").max(100),
});

export async function createExpenseCategoryAction(formData: FormData): Promise<ExpenseActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "expenses.manage")) {
    return { ok: false, error: "Ruxsat etilmagan" };
  }

  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Sessiya xatosi" };

  const parsed = createCategorySchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" };
  }

  const { name } = parsed.data;

  try {
    const [cat] = await deps.db.insert(expenseCategories).values({ name }).returning();

    if (!cat) return { ok: false, error: "Toifa saqlanmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "expense_category.created",
      target: { type: "expense_categories", id: cat.id },
      metadata: { name },
    });

    revalidatePath("/expenses");
    return { ok: true, id: cat.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function archiveExpenseCategoryAction(categoryId: string): Promise<ExpenseActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "expenses.manage")) {
    return { ok: false, error: "Ruxsat etilmagan" };
  }

  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Sessiya xatosi" };

  try {
    await deps.db.update(expenseCategories).set({ archivedAt: new Date() }).where(eq(expenseCategories.id, categoryId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "expense_category.archived",
      target: { type: "expense_categories", id: categoryId },
    });

    revalidatePath("/expenses");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const createExpenseSchema = z.object({
  categoryId: z.string().uuid("Toifa tanlanishi shart"),
  amount: z.coerce.number().positive("Summa 0 dan katta bo'lishi shart"),
  date: z.string().min(10, "Sana kiritilishi shart"),
  note: z.string().trim().optional().nullable(),
});

export async function createGeneralExpenseAction(formData: FormData): Promise<ExpenseActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "expenses.manage")) {
    return { ok: false, error: "Ruxsat etilmagan" };
  }

  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Sessiya xatosi" };

  const parsed = createExpenseSchema.safeParse({
    categoryId: formData.get("categoryId"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    note: formData.get("note") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xato ma'lumot" };
  }

  const { categoryId, amount, date, note } = parsed.data;

  try {
    const [exp] = await deps.db
      .insert(generalExpenses)
      .values({
        categoryId,
        amount: Math.round(amount),
        date,
        note: note || null,
      })
      .returning();

    if (!exp) return { ok: false, error: "Xarajat saqlanmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "general_expense.created",
      target: { type: "general_expenses", id: exp.id },
      metadata: { categoryId, amount, date, note },
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    return { ok: true, id: exp.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteGeneralExpenseAction(expenseId: string): Promise<ExpenseActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "expenses.manage")) {
    return { ok: false, error: "Ruxsat etilmagan" };
  }

  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Sessiya xatosi" };

  try {
    await deps.db.delete(generalExpenses).where(eq(generalExpenses.id, expenseId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "general_expense.deleted",
      target: { type: "general_expenses", id: expenseId },
    });

    revalidatePath("/expenses");
    revalidatePath("/");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getGeneralExpensesData(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    categoryId?: string;
  },
) {
  const categories = await db
    .select({
      id: expenseCategories.id,
      name: expenseCategories.name,
      archivedAt: expenseCategories.archivedAt,
    })
    .from(expenseCategories)
    .where(isNull(expenseCategories.archivedAt))
    .orderBy(expenseCategories.name);

  const conditions = [];
  if (filters?.categoryId) {
    conditions.push(eq(generalExpenses.categoryId, filters.categoryId));
  }

  const rows = await db
    .select({
      id: generalExpenses.id,
      categoryId: generalExpenses.categoryId,
      categoryName: expenseCategories.name,
      amount: generalExpenses.amount,
      date: generalExpenses.date,
      note: generalExpenses.note,
      createdAt: generalExpenses.createdAt,
    })
    .from(generalExpenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, generalExpenses.categoryId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(generalExpenses.date), desc(generalExpenses.createdAt));

  const totalAmount = rows.reduce((acc, r) => acc + Number(r.amount), 0);

  return {
    categories,
    expenses: rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    })),
    totalAmount,
  };
}
