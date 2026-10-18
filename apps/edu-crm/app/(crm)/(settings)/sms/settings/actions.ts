"use server";

import { revalidatePath } from "next/cache";
import { ESKIZ_TEST_MESSAGE, EskizError } from "@ventura/integrations/eskiz";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { tenantDeps } from "@/lib/server/deps";
import { connectEskiz, disconnectEskiz, eskizFor, getProviderRow, saveSmsPrefs } from "@/lib/server/sms/provider";
import { firstError } from "@/lib/rules";
import { smsConnectInput, smsPrefsInput, smsTestInput } from "@/lib/sms";
import { uz } from "@/lib/uz";

/*
 * SMS sozlamalari (docs/EDU-CRM-SMS.md, S1): "SMS provayder va avto-SMS shablonlari" ruxsati bilan. Jurnalga email,
 * yuboruvchi va soatlar yoziladi — maxfiy kalit va token hech qachon yozilmaydi.
 */

const PERM = "settings.sms_gateways";

function refresh() {
  revalidatePath("/sms");
  revalidatePath("/sms/settings");
}

export async function connectSmsAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ tenant, db, staff, audit }) => {
    const parsed = smsConnectInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const res = await connectEskiz(db, parsed.data, staff.id, tenantDeps(tenant)!.secret);
    if (!res.ok) return { ok: false, error: uz.sms.eskizError(res.error) };
    await audit("sms.connect", { type: "sms_provider", id: "eskiz" }, { before: res.before, after: parsed.data.email });
    refresh();
    return { ok: true };
  });
}

export async function disconnectSmsAction(): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, staff, audit }) => {
    const before = (await getProviderRow(db))?.email ?? null;
    await disconnectEskiz(db, staff.id);
    await audit("sms.disconnect", { type: "sms_provider", id: "eskiz" }, { email: before });
    refresh();
    return { ok: true };
  });
}

export async function saveSmsPrefsAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, staff, audit }) => {
    const parsed = smsPrefsInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const row = await getProviderRow(db);
    const before = row ? { sender: row.sender ?? "", quietFrom: row.quietFrom, quietTo: row.quietTo } : null;
    await saveSmsPrefs(db, parsed.data, staff.id);
    await audit("sms.settings", { type: "sms_provider", id: "eskiz" }, { before, after: parsed.data });
    refresh();
    return { ok: true };
  });
}

/** Eskiz test matnini yuboradi (hisob faollashguncha boshqa matn ketmaydi) */
export async function sendTestSmsAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ tenant, db, audit }) => {
    const parsed = smsTestInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const row = await getProviderRow(db);
    const eskiz = eskizFor(db, row, tenantDeps(tenant)!.secret);
    if (!eskiz) return { ok: false, error: uz.sms.notConnected };
    try {
      const sent = await eskiz.send({
        phone: parsed.data.phone,
        text: ESKIZ_TEST_MESSAGE,
        from: row?.sender ?? undefined,
      });
      await audit("sms.test", { type: "sms_provider", id: "eskiz" }, { phone: parsed.data.phone, providerId: sent.id });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: uz.sms.eskizError(e instanceof EskizError ? e.message : String(e)) };
    }
  });
}
