"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { students } from "@ventura/db/schema/tenant";
import { COINS_KEY, coinSettingsInput } from "@/lib/coins";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { putSetting } from "@/lib/server/center";
import { type CoinHistoryRow, coinHistory } from "@/lib/server/coins";
import { visibleTo } from "@/lib/server/branch";
import { canSeeStudent } from "@/lib/server/teacher-scope";
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
