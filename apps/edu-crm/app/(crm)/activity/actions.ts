"use server";

import { tenantAudit } from "@ventura/security";
import { type ActionResult, crmAction } from "@/lib/server/action";

/*
 * Jurnal butunligini tekshirish (ADR 0002 verify): butun xesh zanjiri qayta hisoblanadi. Faqat o'qiydi —
 * jurnalga hech narsa yozmaydi.
 */

export type VerifyResult = ActionResult<{ intact: boolean; count: number; brokenAtSeq?: number; reason?: string }>;

export async function verifyActivityAction(): Promise<VerifyResult> {
  return crmAction<{ intact: boolean; count: number; brokenAtSeq?: number; reason?: string }>(
    "students",
    "settings.logs",
    async ({ db }) => {
      const v = await tenantAudit.verify(db);
      return v.ok
        ? { ok: true, intact: true, count: v.count }
        : { ok: true, intact: false, count: v.count, brokenAtSeq: v.brokenAtSeq, reason: v.reason };
    },
  );
}
