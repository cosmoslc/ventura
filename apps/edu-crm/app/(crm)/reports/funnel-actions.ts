"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { leadStages, settings } from "@ventura/db/schema/tenant";
import { FUNNEL_HIDDEN_KEY } from "@/lib/lead-reports";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { uz } from "@/lib/uz";

/*
 * CRM voronka sozlamasi (EDU-CRM-FIXES 1.3, ADR 0032): qaysi ochiq bosqichlar voronkada ko'rinishi. Sozlama markaz
 * uchun umumiy (`settings`), shuning uchun `leads.edit` ruxsati kerak. Yakuniy bosqich yashirilmaydi; mavjud
 * bo'lmagan id lar tashlanadi. O'zgarish jurnalga yoziladi.
 */

const input = z.object({ hidden: z.array(z.string().uuid()).max(100) });

export async function saveFunnelStagesAction(raw: unknown): Promise<ActionResult> {
  return crmAction("leads", "leads.edit", async ({ db, staff, audit }) => {
    const parsed = input.safeParse(raw);
    if (!parsed.success) return { ok: false, error: uz.common.invalid };
    const open = await db.select({ id: leadStages.id }).from(leadStages).where(eq(leadStages.kind, "open"));
    const known = new Set(open.map((s) => s.id));
    const hidden = [...new Set(parsed.data.hidden)].filter((id) => known.has(id));
    await db
      .insert(settings)
      .values({ key: FUNNEL_HIDDEN_KEY, value: hidden, updatedBy: staff.id })
      .onConflictDoUpdate({
        target: [settings.tenantId, settings.key],
        set: { value: hidden, updatedBy: staff.id, updatedAt: new Date() },
      });
    await audit("settings.update", { type: "setting", id: FUNNEL_HIDDEN_KEY }, { hidden });
    revalidatePath("/reports/funnel");
    return { ok: true };
  });
}
