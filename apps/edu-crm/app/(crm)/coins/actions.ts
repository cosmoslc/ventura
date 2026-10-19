"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { groupMemberships, groups, students } from "@ventura/db/schema/tenant";
import { COINS_KEY, COIN_AMOUNT_MAX, MANUAL_REASON_MAX, coinSettingsInput } from "@/lib/coins";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { putSetting } from "@/lib/server/center";
import { type CoinHistoryRow, coinHistory, coinRuntime, giveManualCoin } from "@/lib/server/coins";
import { lockStudent } from "@/lib/server/leave-debt";
import { todayTashkent } from "@/lib/server/memberships";
import { visibleTo } from "@/lib/server/branch";
import { canSeeStudent, ownsGroup } from "@/lib/server/teacher-scope";
import { uz } from "@/lib/uz";

/*
 * Coinlar (ADR 0061). Coin qo'lda berilmaydi — bu yerda faqat qoidalar sozlamasi va o'quvchi tarixini o'qish.
 */

const FEATURE = "coins";

export async function saveCoinSettingsAction(input: unknown): Promise<ActionResult> {
  return crmAction(FEATURE, "settings.coins", async (ctx) => {
    const parsed = coinSettingsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.coinSettings.amountInvalid };
    const before = await putSetting(ctx.db, COINS_KEY, parsed.data, ctx.staff.id);
    await ctx.audit("coin_settings.update", { type: "settings", id: COINS_KEY }, { before, after: parsed.data });
    revalidatePath("/coin-settings");
    revalidatePath("/coins");
    return { ok: true };
  });
}

/** O'quvchi coin tarixi (reyting sahifasidagi oyna uchun), filial cheklovi bilan */
export async function coinHistoryAction(studentId: unknown): Promise<ActionResult<{ rows: CoinHistoryRow[] }>> {
  return crmAction<{ rows: CoinHistoryRow[] }>(
    FEATURE,
    "bonuses.manage",
    async (ctx) => {
      const id = z.uuid().safeParse(studentId);
      if (!id.success) return { ok: false, error: uz.common.invalid };
      const [s] = await ctx.db.select({ branchId: students.branchId }).from(students).where(eq(students.id, id.data));
      if (!s || !visibleTo(ctx.branch, s.branchId) || !(await canSeeStudent(ctx.db, ctx.staff, id.data)))
        return { ok: false, error: uz.common.gone };
      return { ok: true, rows: await coinHistory(ctx.db, id.data) };
    },
    { teacher: true },
  );
}

/* ---------- Qo'lda berish (ADR 0062) ---------- */

const manualInput = z.object({
  groupId: z.uuid(),
  studentId: z.uuid(),
  amount: z.number().int().min(1).max(COIN_AMOUNT_MAX),
  reason: z.string().trim().min(1, uz.coins.manualReasonRequired).max(MANUAL_REASON_MAX),
});

/**
 * O'qituvchi (yoki admin) guruhdagi o'quvchiga coin beradi: sabab majburiy, bir o'quvchiga kunlik cheklov
 * sozlamada, direktor sozlamada o'chira oladi. O'qituvchi faqat o'z guruhidagi o'quvchiga beradi.
 */
export async function giveCoinAction(input: unknown): Promise<ActionResult> {
  return crmAction(
    FEATURE,
    "bonuses.manage",
    async (ctx) => {
      const parsed = manualInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? uz.common.invalid };
      const v = parsed.data;
      const rt = await coinRuntime(ctx.tenant, ctx.db);
      if (!rt.active || !rt.settings.manual.enabled) return { ok: false, error: uz.coins.manualOff };
      const [g] = await ctx.db
        .select()
        .from(groups)
        .where(and(eq(groups.id, v.groupId), isNull(groups.archivedAt)));
      if (!g || !visibleTo(ctx.branch, g.branchId) || !ownsGroup(ctx.staff, g))
        return { ok: false, error: uz.common.gone };
      const [member] = await ctx.db
        .select({ id: groupMemberships.id })
        .from(groupMemberships)
        .where(
          and(
            eq(groupMemberships.groupId, v.groupId),
            eq(groupMemberships.studentId, v.studentId),
            isNull(groupMemberships.leftAt),
          ),
        )
        .limit(1);
      if (!member) return { ok: false, error: uz.coins.manualNotMember };
      const date = todayTashkent();
      const res = await ctx.db.transaction(async (tx) => {
        await lockStudent(tx, v.studentId);
        return giveManualCoin(
          tx,
          { studentId: v.studentId, groupId: v.groupId, amount: v.amount, note: v.reason, staffId: ctx.staff.id, date },
          rt.settings.manual.dailyLimit,
        );
      });
      if (!res.ok) return { ok: false, error: uz.coins.manualLimit(res.remaining) };
      await ctx.audit(
        "coin.manual",
        { type: "student", id: v.studentId },
        { group: g.name, groupId: v.groupId, amount: v.amount, reason: v.reason, entryId: res.id },
      );
      revalidatePath("/coins");
      return { ok: true };
    },
    { teacher: true },
  );
}
