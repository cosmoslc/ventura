"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { type ActionResult, crmAction } from "@/lib/server/action";
import { setDeviceBlocked } from "@/lib/server/devices";
import { currentDeviceId } from "@/lib/server/request";
import { uz } from "@/lib/uz";

/*
 * Qurilmani bloklash va ochish (E6g, ADR 0040). Faqat direktor: bu xodimning kirishini to'xtatadi, shuning uchun
 * lavozim ruxsati bilan berilmaydi. Direktor o'zi ishlayotgan qurilmani bloklay olmaydi.
 */

const input = z.object({ id: z.uuid(), blocked: z.boolean() });

export async function setDeviceBlockedAction(raw: unknown): Promise<ActionResult> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: uz.common.invalid };
  return crmAction("students", "settings.roles_permissions", async ({ staff, db, audit }) => {
    if (!staff.director) return { ok: false, error: uz.common.forbidden };
    const r = await setDeviceBlocked(db, {
      id: parsed.data.id,
      blocked: parsed.data.blocked,
      actorId: staff.id,
      actorSessionId: staff.sessionId,
      currentDeviceId: await currentDeviceId(),
    });
    if (!r.ok) {
      const t = uz.devices;
      return {
        ok: false,
        error: r.failure === "self" ? t.selfBlock : r.failure === "unchanged" ? t.unchanged : uz.common.gone,
      };
    }
    await audit(
      parsed.data.blocked ? "device.block" : "device.unblock",
      { type: "user", id: r.userId! },
      {
        device: r.device,
        ...(r.endedSessions ? { endedSessions: r.endedSessions } : {}),
      },
    );
    revalidatePath("/devices");
    return { ok: true };
  });
}
