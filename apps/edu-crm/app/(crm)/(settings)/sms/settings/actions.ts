"use server";

import { revalidatePath } from "next/cache";
import { ESKIZ_TEST_MESSAGE } from "@ventura/integrations/eskiz";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { tenantDeps } from "@/lib/server/deps";
import {
  connectEskiz,
  disconnectEskiz,
  getProviderRow,
  modeOf,
  saveSmsPrefs,
  setSmsMode,
} from "@/lib/server/sms/provider";
import { senderFor } from "@/lib/server/sms/sender";
import { resetModeration } from "@/lib/server/sms/templates";
import { firstError } from "@/lib/rules";
import { smsConnectInput, smsModeInput, smsPrefsInput, smsTestInput } from "@/lib/sms";
import { uz } from "@/lib/uz";

/*
 * SMS sozlamalari (docs/EDU-CRM-SMS.md): "SMS provayder va avto-SMS shablonlari" ruxsati bilan. Jurnalga rejim, email,
 * yuboruvchi va soatlar yoziladi — maxfiy kalit va token hech qachon yozilmaydi. Rejim almashsa (Ventura paketi ↔ o'z
 * Eskiz hisobi) shablonlar yangi hisobda qayta moderatsiyadan o'tadi (ADR 0056).
 */

const PERM = "settings.sms_gateways";

function refresh() {
  revalidatePath("/sms");
  revalidatePath("/sms/settings");
  revalidatePath("/sms/templates");
}

export async function setSmsModeAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, staff, audit }) => {
    const parsed = smsModeInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const before = modeOf(await getProviderRow(db));
    if (before === parsed.data.mode) return { ok: true };
    await setSmsMode(db, parsed.data.mode, staff.id);
    await resetModeration(db);
    await audit("sms.mode", { type: "sms_provider", id: "mode" }, { before, after: parsed.data.mode });
    refresh();
    return { ok: true };
  });
}

export async function connectSmsAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ tenant, db, staff, audit }) => {
    const parsed = smsConnectInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const wasOwn = modeOf(await getProviderRow(db)) === "own";
    const res = await connectEskiz(db, parsed.data, staff.id, tenantDeps(tenant)!.secret);
    if (!res.ok) return { ok: false, error: uz.sms.eskizError(res.error) };
    if (!wasOwn) await resetModeration(db);
    await audit("sms.connect", { type: "sms_provider", id: "eskiz" }, { before: res.before, after: parsed.data.email });
    refresh();
    return { ok: true };
  });
}

export async function disconnectSmsAction(): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, staff, audit }) => {
    const row = await getProviderRow(db);
    await disconnectEskiz(db, staff.id);
    if (modeOf(row) === "own") await resetModeration(db);
    await audit("sms.disconnect", { type: "sms_provider", id: "eskiz" }, { email: row?.email ?? null });
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

/** Eskiz test matnini joriy rejim orqali yuboradi (test holatidagi hisob boshqa matnni o'tkazmaydi) */
export async function sendTestSmsAction(input: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ tenant, db, audit }) => {
    const parsed = smsTestInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const sender = await senderFor(tenant, db, tenantDeps(tenant)!.secret);
    if (!sender) return { ok: false, error: uz.sms.notConnected };
    try {
      const sent = await sender.send({ phone: `998${parsed.data.phone}`, text: ESKIZ_TEST_MESSAGE });
      await audit(
        "sms.test",
        { type: "sms_provider", id: "test" },
        { phone: parsed.data.phone, providerId: sent.providerId },
      );
      return { ok: true };
    } catch (e) {
      return { ok: false, error: uz.sms.eskizError((e as Error).message) };
    }
  });
}
