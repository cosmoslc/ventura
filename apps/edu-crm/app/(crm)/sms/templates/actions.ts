"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { EskizError } from "@ventura/integrations/eskiz";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { moderatorFor, smsContext } from "@/lib/server/sms/context";
import { addPresets, archiveTemplate, saveTemplate, submitTemplate, syncTemplates } from "@/lib/server/sms/templates";
import { firstError } from "@/lib/rules";
import { smsTemplateInput } from "@/lib/sms-text";
import { uz } from "@/lib/uz";

/*
 * SMS shablonlari (docs/EDU-CRM-SMS.md, S2): "SMS provayder va avto-SMS shablonlari" ruxsati bilan. Har o'zgarish
 * jurnalga (matni bilan); moderatsiya joriy rejim hisobida (Ventura paketi yoki o'z Eskiz hisobi).
 */

const PERM = "settings.sms_gateways";
const t = uz.smsTemplates;
const idInput = z.uuid();

const eskizMessage = (e: unknown) => uz.sms.eskizError(e instanceof EskizError ? e.message : String(e));

export async function saveSmsTemplateAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return crmAction<{ id: string }>("sms", PERM, async ({ tenant, db, staff, audit }) => {
    const parsed = smsTemplateInput.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) || uz.common.invalid };
    const res = await saveTemplate(db, parsed.data, tenant.name, staff.id);
    if (!res.ok) return res;
    await audit(
      parsed.data.id ? "sms_template.update" : "sms_template.create",
      { type: "sms_template", id: res.id },
      { name: parsed.data.name, kind: parsed.data.kind, before: res.before, after: parsed.data.body },
    );
    revalidatePath("/sms/templates");
    return { ok: true, id: res.id };
  });
}

export async function archiveSmsTemplateAction(id: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ db, audit }) => {
    const parsed = idInput.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const name = await archiveTemplate(db, parsed.data);
    if (!name) return { ok: false, error: t.notFound };
    await audit("sms_template.archive", { type: "sms_template", id: parsed.data }, { name });
    revalidatePath("/sms/templates");
    return { ok: true };
  });
}

export async function addSmsPresetsAction(): Promise<ActionResult<{ added: number }>> {
  return crmAction<{ added: number }>("sms", PERM, async ({ tenant, db, staff, audit }) => {
    const added = await addPresets(db, tenant.name, staff.id);
    if (added) await audit("sms_template.presets", { type: "sms_template", id: "presets" }, { count: added });
    revalidatePath("/sms/templates");
    return { ok: true, added };
  });
}

export async function submitSmsTemplateAction(id: unknown): Promise<ActionResult> {
  return crmAction("sms", PERM, async ({ tenant, db, audit }) => {
    const parsed = idInput.safeParse(id);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const moderator = moderatorFor(await smsContext(tenant));
    if (!moderator) return { ok: false, error: uz.sms.notConnected };
    try {
      const res = await submitTemplate(db, moderator, parsed.data);
      if (!res) return { ok: false, error: t.notFound };
      await audit("sms_template.submit", { type: "sms_template", id: parsed.data }, { name: res.name });
    } catch (e) {
      return { ok: false, error: eskizMessage(e) };
    }
    revalidatePath("/sms/templates");
    return { ok: true };
  });
}

export async function syncSmsTemplatesAction(): Promise<ActionResult<{ changed: number }>> {
  return crmAction<{ changed: number }>("sms", PERM, async ({ tenant, db }) => {
    const moderator = moderatorFor(await smsContext(tenant));
    if (!moderator) return { ok: false, error: uz.sms.notConnected };
    try {
      const changed = await syncTemplates(db, moderator);
      revalidatePath("/sms/templates");
      return { ok: true, changed };
    } catch (e) {
      return { ok: false, error: eskizMessage(e) };
    }
  });
}
