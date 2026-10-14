"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { financePlans } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { yearMonths } from "@/lib/reports";
import { financePlanInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Pul oqimi rejasi (ADR 0030): bir filialning bir yillik rejasini bir martada saqlash. Ruxsat — hisobotni ko'radigan
 * `dashboard.financial_stats`. Reja pul yozuvi emas: bo'shatilgan katak o'chiriladi, o'zgarishlar (oldingi va yangi
 * summa bilan) jurnalga yoziladi.
 */

const t = uz.reports.plan;

export async function saveFinancePlansAction(input: unknown): Promise<ActionResult<{ changed: number }>> {
  return crmAction<{ changed: number }>("payments", "dashboard.financial_stats", async (ctx) => {
    const parsed = financePlanInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const branchId = resolveBranch(ctx.branch, v.branchId);
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    const months = yearMonths(v.year);
    if (v.cells.some((c) => !months.includes(c.month))) return { ok: false, error: t.wrongYear };

    const changes = await ctx.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(financePlans)
        .where(and(eq(financePlans.branchId, branchId), inArray(financePlans.month, months)));
      const out: { month: string; line: string; before: number | null; after: number | null }[] = [];
      for (const c of v.cells) {
        const cur = existing.find((e) => e.month === c.month && e.line === c.line);
        const before = cur ? Number(cur.amount) : null;
        if (before === c.amount) continue;
        if (cur && c.amount === null) await tx.delete(financePlans).where(eq(financePlans.id, cur.id));
        else if (cur) await tx.update(financePlans).set({ amount: c.amount! }).where(eq(financePlans.id, cur.id));
        else
          await tx
            .insert(financePlans)
            .values({ branchId, month: c.month, line: c.line, amount: c.amount!, createdBy: ctx.staff.id });
        out.push({ month: c.month, line: c.line, before, after: c.amount });
      }
      return out;
    });

    if (changes.length) {
      await ctx.audit("finance_plan.update", { type: "branch", id: branchId }, { year: v.year, changes });
      revalidatePath("/reports/plan");
    }
    return { ok: true, changed: changes.length };
  });
}
