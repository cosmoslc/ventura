"use server";

import { revalidatePath } from "next/cache";
import { RECEIPT_KEY, receiptConfigInput } from "@/lib/receipt-config";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { putSetting } from "@/lib/server/center";
import { uz } from "@/lib/uz";

/* Chek sozlamalari (E6b, ADR 0036): "Chek va printer sozlamalari" ruxsati; har saqlash jurnalga yoziladi. */

export async function saveReceiptConfigAction(input: unknown): Promise<ActionResult> {
  return crmAction("payments", "settings.receipt", async ({ db, staff, audit }) => {
    const parsed = receiptConfigInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const before = await putSetting(db, RECEIPT_KEY, parsed.data, staff.id);
    await audit("settings.update", { type: "setting", id: RECEIPT_KEY }, { before, after: parsed.data });
    revalidatePath("/payment-settings");
    revalidatePath("/payments", "layout");
    return { ok: true };
  });
}
