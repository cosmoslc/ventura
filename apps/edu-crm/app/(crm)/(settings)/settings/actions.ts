"use server";

import { revalidatePath } from "next/cache";
import { CENTER_KEY, centerInput } from "@/lib/center-settings";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { putSetting } from "@/lib/server/center";
import { firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";

/*
 * Markaz sozlamalari (E6a, ADR 0036): aloqa, ijtimoiy tarmoqlar va ish vaqti. "Filiallarni boshqarish" ruxsati bilan
 * (markaz tuzilmasi sozlamalari, kunlar va bayramlar bilan bir joy). Har saqlash jurnalga: oldingi va yangi qiymat.
 */

export async function saveCenterSettingsAction(input: unknown): Promise<ActionResult> {
  return crmAction("students", "settings.branches", async ({ db, staff, audit }) => {
    const parsed = centerInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const before = await putSetting(db, CENTER_KEY, parsed.data, staff.id);
    await audit("settings.update", { type: "setting", id: CENTER_KEY }, { before, after: parsed.data });
    revalidatePath("/settings");
    revalidatePath("/ariza");
    return { ok: true };
  });
}
