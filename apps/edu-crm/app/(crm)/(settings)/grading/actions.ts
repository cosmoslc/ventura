"use server";

import { revalidatePath } from "next/cache";
import { GRADING_KEY, gradingSettingsInput } from "@/lib/grades";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { putSetting } from "@/lib/server/center";
import { uz } from "@/lib/uz";

/* Baholash shkalasi (ADR 0061). Oldin qo'yilgan baholar o'z shkalasida qoladi — bu yerda ular o'zgarmaydi. */

export async function saveGradingSettingsAction(input: unknown): Promise<ActionResult> {
  return crmAction("grades", "settings.courses", async (ctx) => {
    const parsed = gradingSettingsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const before = await putSetting(ctx.db, GRADING_KEY, parsed.data, ctx.staff.id);
    await ctx.audit("grading_settings.update", { type: "settings", id: GRADING_KEY }, { before, after: parsed.data });
    revalidatePath("/grading");
    revalidatePath("/groups", "layout");
    return { ok: true };
  });
}
