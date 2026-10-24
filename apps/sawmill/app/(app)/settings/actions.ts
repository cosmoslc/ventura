"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { workTypes } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";
import {
  getSawmillSettings,
  saveSawmillSettings,
  sawmillSettingsSchema,
} from "@/lib/settings/schema";

export type SettingsActionResult = {
  ok: boolean;
  error?: string;
};

export async function saveGeneralSettingsAction(formData: FormData): Promise<SettingsActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "settings.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = sawmillSettingsSchema.safeParse({
    profitMode: formData.get("profitMode"),
    qtyDisplay: formData.get("qtyDisplay"),
    cubeInputMode: formData.get("cubeInputMode"),
    dimensionUnit: formData.get("dimensionUnit"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Sozlama noto'g'ri" };
  }

  try {
    await saveSawmillSettings(deps.db, user.id, parsed.data);

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "settings.updated",
      metadata: parsed.data,
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const workTypeSchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 harfdan iborat bo'lishi kerak").max(100),
  kind: z.enum(["regular", "sorting"]).default("regular"),
});

export async function createWorkTypeAction(formData: FormData): Promise<SettingsActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "settings.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = workTypeSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { name, kind } = parsed.data;

  try {
    const [inserted] = await deps.db
      .insert(workTypes)
      .values({
        name,
        kind,
        isSystem: false,
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "work_type.created",
        target: { type: "work_types", id: inserted.id },
        metadata: { name, kind },
      });
    }

    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteWorkTypeAction(workTypeId: string): Promise<SettingsActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "settings.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    const [wt] = await deps.db
      .select()
      .from(workTypes)
      .where(eq(workTypes.id, workTypeId))
      .limit(1);

    if (!wt) return { ok: false, error: "Ish turi topilmadi" };
    if (wt.isSystem) return { ok: false, error: "Tizim standart ish turini o'chirib bo'lmaydi" };

    await deps.db.delete(workTypes).where(eq(workTypes.id, workTypeId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "work_type.deleted",
      target: { type: "work_types", id: workTypeId },
      metadata: { name: wt.name },
    });

    revalidatePath("/settings");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getSettingsData(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const settings = await getSawmillSettings(db);
  const types = await db.select().from(workTypes).orderBy(workTypes.name);
  return { settings, workTypes: types };
}
