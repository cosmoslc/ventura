"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type Permission } from "@ventura/auth/staff/policy";
import { type SalaryEntryKind, salaryEntries, teachers, userBranches, users } from "@ventura/db/schema/tenant";
import { type ActionCtx, type ActionResult, crmAction } from "@/lib/server/action";
import { checkMethod, moneyDateError, parsePerson } from "@/lib/server/expenses";
import { firstError, salaryEntryInput } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Ish haqi yozuvlari (EDU-CRM-PLAN E3c, ADR 0018). Ruxsat yozuv turiga qarab (eski katalog):
 * maosh — `salaries.pay`, avans — `salaries.advance_manage` yoki `finance.advance_give`, bonus va jarima —
 * `salaries.kpi_edit`. Yozuv o'chirilmaydi — bekor qilinadi (sabab bilan), tiklash mumkin.
 */

const FEATURE = "salaries";
const t = uz.salaries;

const KIND_PERMS: Record<SalaryEntryKind, readonly Permission[]> = {
  salary: ["salaries.pay"],
  advance: ["salaries.advance_manage", "finance.advance_give"],
  bonus: ["salaries.kpi_edit"],
  penalty: ["salaries.kpi_edit"],
};
const ANY: readonly Permission[] = [...new Set(Object.values(KIND_PERMS).flat())];
const voidInput = z.object({ id: z.uuid(), reason: z.string().trim().min(1, uz.expenses.voidReasonRequired).max(500) });

function refresh() {
  revalidatePath("/salaries");
}

/** Xodim yoki o'qituvchi bor, (yangi tanlanganda) bo'shatilmagan va xodimning filiallariga tegishli */
async function personOk(
  ctx: ActionCtx,
  ref: { userId: string | null; teacherId: string | null },
  changed: boolean,
): Promise<boolean> {
  if (ref.teacherId) {
    const [tc] = await ctx.db.select().from(teachers).where(eq(teachers.id, ref.teacherId));
    if (!tc || (changed && tc.archivedAt)) return false;
    return ctx.branch.options.some((b) => b.id === tc.branchId);
  }
  if (!ref.userId) return false;
  const [u] = await ctx.db.select().from(users).where(eq(users.id, ref.userId));
  if (!u || (changed && u.archivedAt)) return false;
  if (ctx.staff.scope === "all") return true;
  const links = await ctx.db.select().from(userBranches).where(eq(userBranches.userId, u.id));
  return links.some((l) => ctx.branch.options.some((b) => b.id === l.branchId));
}

async function loadEntry(ctx: ActionCtx, id: string) {
  const [row] = await ctx.db.select().from(salaryEntries).where(eq(salaryEntries.id, id));
  if (!row || !(await personOk(ctx, row, false))) return null;
  return row;
}

export async function saveSalaryEntryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>(
    FEATURE,
    ANY,
    async (ctx) => {
      const parsed = salaryEntryInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const v = parsed.data;
      {
        const gate = await ctx.requireAny(KIND_PERMS[v.kind]);
        if (gate) return gate;
      }

      let before: typeof salaryEntries.$inferSelect | null = null;
      if (v.id) {
        before = await loadEntry(ctx, v.id);
        if (!before) return { ok: false, error: uz.common.gone };
        if (before.voidedAt) return { ok: false, error: uz.expenses.alreadyVoided };
        {
          const gate = await ctx.requireAny(KIND_PERMS[before.kind]);
          if (gate) return gate;
        }
      }
      const person = parsePerson(v.person);
      const personChanged = before?.userId !== person.userId || before?.teacherId !== person.teacherId;
      if (!(await personOk(ctx, person, personChanged))) return { ok: false, error: t.personGone };

      const cash = v.kind === "salary" || v.kind === "advance";
      if (cash) {
        if (!v.methodId) return { ok: false, error: t.methodRequired };
        const err = await checkMethod(ctx, v.methodId, before?.methodId !== v.methodId);
        if (err) return { ok: false, error: err === uz.expenses.methodInactive ? t.methodInactive : t.methodRequired };
      }
      const bad = before?.date === v.date ? null : moneyDateError(v.date);
      if (bad) return { ok: false, error: bad };

      const values = {
        ...person,
        kind: v.kind,
        amount: v.amount,
        month: v.month,
        date: v.date,
        methodId: cash ? v.methodId : null,
        note: v.note || null,
      };
      let id: string;
      if (before) {
        await ctx.db.update(salaryEntries).set(values).where(eq(salaryEntries.id, before.id));
        id = before.id;
        await ctx.audit(
          "salary_entry.update",
          { type: "salary_entry", id },
          {
            before: { kind: before.kind, amount: before.amount, month: before.month, date: before.date },
            after: { kind: v.kind, amount: v.amount, month: v.month, date: v.date },
          },
        );
      } else {
        const [row] = await ctx.db
          .insert(salaryEntries)
          .values({ ...values, createdBy: ctx.staff.id })
          .returning({ id: salaryEntries.id });
        id = row!.id;
        await ctx.audit(
          "salary_entry.create",
          { type: "salary_entry", id },
          { kind: v.kind, amount: v.amount, month: v.month, date: v.date, person: v.person },
        );
      }
      refresh();
      return { ok: true, id };
    },
    { approval: { action: "salaries.save", input: input } },
  );
}

export async function voidSalaryEntryAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    ANY,
    async (ctx) => {
      const parsed = voidInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
      const row = await loadEntry(ctx, parsed.data.id);
      if (!row) return { ok: false, error: uz.common.gone };
      {
        const gate = await ctx.requireAny(KIND_PERMS[row.kind]);
        if (gate) return gate;
      }
      const updated = await ctx.db
        .update(salaryEntries)
        .set({ voidedAt: new Date(), voidedBy: ctx.staff.id, voidReason: parsed.data.reason })
        .where(and(eq(salaryEntries.id, row.id), isNull(salaryEntries.voidedAt)))
        .returning({ id: salaryEntries.id });
      if (!updated.length) return { ok: false, error: uz.expenses.alreadyVoided };
      await ctx.audit(
        "salary_entry.void",
        { type: "salary_entry", id: row.id },
        { kind: row.kind, amount: row.amount, month: row.month, reason: parsed.data.reason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "salaries.void", input: input } },
  );
}

export async function restoreSalaryEntryAction(id: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    ANY,
    async (ctx) => {
      const parsed = z.uuid().safeParse(id);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const row = await loadEntry(ctx, parsed.data);
      if (!row) return { ok: false, error: uz.common.gone };
      {
        const gate = await ctx.requireAny(KIND_PERMS[row.kind]);
        if (gate) return gate;
      }
      const updated = await ctx.db
        .update(salaryEntries)
        .set({ voidedAt: null, voidedBy: null, voidReason: null })
        .where(and(eq(salaryEntries.id, row.id), isNotNull(salaryEntries.voidedAt)))
        .returning({ id: salaryEntries.id });
      if (!updated.length) return { ok: true };
      await ctx.audit(
        "salary_entry.restore",
        { type: "salary_entry", id: row.id },
        { kind: row.kind, amount: row.amount, month: row.month, voidReason: row.voidReason },
      );
      refresh();
      return { ok: true };
    },
    { approval: { action: "salaries.restore", input: id } },
  );
}
