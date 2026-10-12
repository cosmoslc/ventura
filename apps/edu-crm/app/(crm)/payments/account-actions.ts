"use server";

import { eq } from "drizzle-orm";
import { hasFeature } from "@ventura/tenants";
import { z } from "zod";
import { groupMemberships, groups, students } from "@ventura/db/schema/tenant";
import { suggestedAmount, suggestedMonth } from "@/lib/ledger";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { loadAccount, loadAccounts } from "@/lib/server/finance";
import { todayTashkent } from "@/lib/server/memberships";
import { uz } from "@/lib/uz";
import { type StudentGroupOption, studentGroupOptions } from "./data";

/** To'lov oynasi uchun o'quvchi hisobi: balans va har guruh bo'yicha yopilmagan oylar */
export interface AccountPreview {
  studentId: string;
  balance: number;
  debt: number;
  otherDebt: number;
  groups: (StudentGroupOption & {
    due: number;
    suggestedMonth: string;
    /** Taklif qilingan oyning chegirmali to'liq narxi (bir martalik chegirma foizi uchun) */
    monthPrice: number;
    unpaid: { month: string; due: number }[];
  })[];
}

export async function accountPreviewAction(studentId: unknown): Promise<ActionResult<{ account: AccountPreview }>> {
  return crmAction<{ account: AccountPreview }>(
    "payments",
    ["finance.payment_create", "finance.payment_edit", "finance.payment_view"],
    async (ctx) => {
      const parsed = z.uuid().safeParse(studentId);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const [s] = await ctx.db
        .select({ id: students.id, branchId: students.branchId })
        .from(students)
        .where(eq(students.id, parsed.data));
      if (!s || !ctx.branch.options.some((b) => b.id === s.branchId)) return { ok: false, error: uz.common.gone };
      const today = todayTashkent();
      const [{ summary }, groupList] = await Promise.all([
        loadAccount(ctx.db, s.id, today),
        studentGroupOptions(ctx.db, s.id),
      ]);
      const current = today.slice(0, 7);
      return {
        ok: true,
        account: {
          studentId: s.id,
          balance: summary.balance,
          debt: summary.debt,
          otherDebt: summary.otherDebt,
          groups: groupList.map((g) => {
            const gl = summary.groups.find((x) => x.groupId === g.id);
            const month = suggestedMonth(summary, g.id, current);
            return {
              ...g,
              due: suggestedAmount(summary, g.id),
              suggestedMonth: month,
              monthPrice: gl?.months.find((m) => m.month === month)?.fullPrice ?? 0,
              unpaid: (gl?.months ?? []).filter((m) => m.due > 0).map((m) => ({ month: m.month, due: m.due })),
            };
          }),
        },
      };
    },
  );
}

/** Guruhdan chiqarish oynasi uchun: shu sana bilan chiqarilsa o'quvchi balansi qanday bo'ladi */
export interface LeavePreview {
  before: number;
  after: number;
}

export async function leavePreviewAction(input: unknown): Promise<ActionResult<{ preview: LeavePreview | null }>> {
  return crmAction<{ preview: LeavePreview | null }>("groups", "groups.remove_student", async (ctx) => {
    const parsed = z.object({ id: z.uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    if (!(await hasFeature(ctx.tenant, "payments"))) return { ok: true, preview: null };
    const [row] = await ctx.db
      .select({ m: groupMemberships, branchId: groups.branchId })
      .from(groupMemberships)
      .innerJoin(groups, eq(groups.id, groupMemberships.groupId))
      .where(eq(groupMemberships.id, parsed.data.id));
    if (!row || !ctx.branch.options.some((b) => b.id === row.branchId)) return { ok: false, error: uz.common.gone };
    if (row.m.leftAt || parsed.data.date < row.m.enrolledAt) return { ok: true, preview: null };
    const today = todayTashkent();
    const [before, after] = await Promise.all([
      loadAccount(ctx.db, row.m.studentId, today),
      loadAccounts(ctx.db, [row.m.studentId], today, undefined, { membershipId: row.m.id, leftAt: parsed.data.date }),
    ]);
    return {
      ok: true,
      preview: { before: before.summary.balance, after: after.get(row.m.studentId)!.summary.balance },
    };
  });
}
