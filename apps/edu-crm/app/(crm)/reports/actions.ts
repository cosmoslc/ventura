"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { financePlans, settings } from "@ventura/db/schema/tenant";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { resolveBranch } from "@/lib/server/branch";
import { getOpeningBalances } from "@/lib/server/opening-balance";
import { todayTashkent } from "@/lib/server/memberships";
import { OPENING_BALANCE_KEY, type OpeningEntry, openingBalanceInput, openingEntry } from "@/lib/opening-balance";
import { yearMonths } from "@/lib/reports";
import { financePlanInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Pul oqimi rejasi (ADR 0030): bir filialning bir yillik rejasini bir martada saqlash. Ruxsat — hisobotni ko'radigan
 * `dashboard.financial_stats`. Reja pul yozuvi emas: bo'shatilgan katak o'chiriladi, o'zgarishlar (oldingi va yangi
 * summa bilan) jurnalga yoziladi.
 */

const t = uz.reports.cashflow;
const tp = uz.reports.plan;

export async function saveFinancePlansAction(input: unknown): Promise<ActionResult<{ changed: number }>> {
  return crmAction<{ changed: number }>("payments", "dashboard.financial_stats", async (ctx) => {
    const parsed = financePlanInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const v = parsed.data;
    const branchId = resolveBranch(ctx.branch, v.branchId);
    if (!branchId) return { ok: false, error: uz.common.branchRequired };
    const months = yearMonths(v.year);
    if (v.cells.some((c) => !months.includes(c.month))) return { ok: false, error: tp.wrongYear };

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
      revalidatePath("/reports/cashflow");
    }
    return { ok: true, changed: changes.length };
  });
}

/*
 * Boshlang'ich qoldiq (E6j, ADR 0038): pul oqimi hisobotidagi yig'ma qoldiq boshlanadigan summa va sana, har filial
 * uchun. `settings` jadvalida bitta kalit; xodim faqat o'zi ko'radigan filiallarnikini o'zgartiradi, boshqalariniki
 * saqlanadi. Ruxsat — hisobotni ko'radigan `dashboard.financial_stats`. Bo'sh summa — qoldiq olib tashlanadi.
 */
export async function saveOpeningBalanceAction(input: unknown): Promise<ActionResult<{ changed: number }>> {
  return crmAction<{ changed: number }>("payments", "dashboard.financial_stats", async (ctx) => {
    const parsed = openingBalanceInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const today = todayTashkent();
    const allowed = new Set(ctx.branch.options.map((b) => b.id));
    const next = { ...(await getOpeningBalances(ctx.db)) };
    const changes: { branchId: string; before: OpeningEntry | null; after: OpeningEntry | null }[] = [];
    for (const e of parsed.data.entries) {
      if (!allowed.has(e.branchId)) return { ok: false, error: uz.common.invalid };
      const prev = next[e.branchId] ?? null;
      let after: OpeningEntry | null = null;
      if (e.amount !== null) {
        const date = openingEntry.shape.date.safeParse(e.date);
        if (!date.success || new Date(`${date.data}T00:00:00Z`).toISOString().slice(0, 10) !== date.data)
          return { ok: false, error: t.opening.dateInvalid };
        if (date.data > today) return { ok: false, error: t.opening.dateFuture };
        after = { amount: e.amount, date: date.data };
      }
      if (prev?.amount === after?.amount && prev?.date === after?.date) continue;
      if (after) next[e.branchId] = after;
      else delete next[e.branchId];
      changes.push({ branchId: e.branchId, before: prev, after });
    }
    if (!changes.length) return { ok: true, changed: 0 };

    await ctx.db
      .insert(settings)
      .values({ key: OPENING_BALANCE_KEY, value: next, updatedBy: ctx.staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: next, updatedBy: ctx.staff.id, updatedAt: new Date() },
      });
    await ctx.audit("finance_opening_balance.update", { type: "settings", id: OPENING_BALANCE_KEY }, { changes });
    revalidatePath("/reports/cashflow");
    return { ok: true, changed: changes.length };
  });
}
