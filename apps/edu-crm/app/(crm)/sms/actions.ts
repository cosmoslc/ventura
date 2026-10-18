"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Permission } from "@ventura/auth/staff/policy";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { sendManualSms } from "@/lib/server/sms/manual";
import { smsContext } from "@/lib/server/sms/context";
import { flushTenant } from "@/lib/server/sms/scheduler";
import { listTemplates } from "@/lib/server/sms/templates";
import type { SmsTemplateKind, SmsModeration } from "@/lib/sms-text";
import { uz } from "@/lib/uz";

/*
 * Qo'lda SMS (docs/EDU-CRM-SMS.md, S3): o'quvchilar ro'yxati, qarzdorlar va guruh sahifasidan. Ruxsat manbaga qarab:
 * o'quvchilar va guruh — "Shaxsiy SMS xabar yuborish", qarzdorlar — "Qarzdorlarga eslatma yuborish".
 * Xabarlar navbatga yoziladi va shu so'rovdan keyin darhol yuboriladi (keyingisi — fon vazifasi).
 */

const SOURCE_PERM: Record<"students" | "debtors" | "group", Permission> = {
  students: "students.sms_send",
  debtors: "finance.debtors_remind",
  group: "students.sms_send",
};

const sendInput = z.object({
  source: z.enum(["students", "debtors", "group"]),
  templateId: z.uuid(),
  audience: z.enum(["student", "parent", "both"]),
  studentIds: z.array(z.uuid()).min(1).max(5000),
  groupId: z.uuid().nullish(),
  title: z.string().trim().min(1).max(200),
});

export interface SendableTemplate {
  id: string;
  name: string;
  kind: SmsTemplateKind;
  body: string;
  moderation: SmsModeration;
}

/** Yuborish oynasi ochilganda: ulanganmi va shablonlar */
export async function smsSendOptionsAction(): Promise<
  ActionResult<{ connected: boolean; templates: SendableTemplate[] }>
> {
  return crmAction<{ connected: boolean; templates: SendableTemplate[] }>(
    "sms",
    Object.values(SOURCE_PERM),
    async ({ tenant, db }) => {
      const [ctx, rows] = await Promise.all([smsContext(tenant), listTemplates(db)]);
      return {
        ok: true,
        connected: ctx.view.connected,
        templates: rows
          .filter((r) => r.moderation !== "rejected")
          .map(({ id, name, kind, body, moderation }) => ({ id, name, kind, body, moderation })),
      };
    },
  );
}

export async function sendSmsAction(input: unknown): Promise<ActionResult<{ queued: number; skipped: number }>> {
  return crmAction<{ queued: number; skipped: number }>(
    "sms",
    Object.values(SOURCE_PERM),
    async ({ tenant, db, staff, audit, requireAny }) => {
      const parsed = sendInput.safeParse(input);
      if (!parsed.success) return { ok: false, error: uz.common.invalid };
      const denied = await requireAny([SOURCE_PERM[parsed.data.source]]);
      if (denied) return denied;
      if (!(await smsContext(tenant)).view.connected) {
        return { ok: false, error: uz.sms.notConnected };
      }
      const res = await sendManualSms(db, { ...parsed.data, createdBy: staff.id }, tenant.name);
      if ("error" in res)
        return { ok: false, error: res.error === "template" ? uz.smsTemplates.notFound : uz.common.invalid };
      await audit(
        "sms.send",
        { type: "sms_dispatch", id: res.dispatchId },
        { title: parsed.data.title, template: res.templateName, queued: res.queued, skipped: res.skipped },
      );
      after(() => flushTenant(tenant));
      revalidatePath("/sms");
      return { ok: true, queued: res.queued, skipped: res.skipped };
    },
  );
}

/** Ventura paketini so'rash (ADR 0056): panelda to'lov so'rovi; to'lov tasdiqlangach qismlar hisobga tushadi */
export async function buySmsPackageAction(packageId: unknown): Promise<ActionResult> {
  return crmAction("sms", "settings.sms_gateways", async ({ tenant, staff, audit }) => {
    const parsed = z.uuid().safeParse(packageId);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const ctx = await smsContext(tenant);
    if (ctx.view.mode !== "ventura" || !ctx.relay) return { ok: false, error: uz.sms.venturaUnavailableTitle };
    try {
      const res = await ctx.relay.purchase(parsed.data, staff.name);
      await audit("sms.purchase", { type: "sms_purchase", id: res.id }, { packageId: parsed.data });
    } catch (e) {
      return { ok: false, error: uz.sms.venturaError((e as Error).message) };
    }
    revalidatePath("/sms");
    return { ok: true };
  });
}
