"use server";

import { eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trucks } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";

const truckSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Mashina nomi yoki raqami kiritilishi shart").max(100),
  amount: z.coerce.number().min(0, "Reys narxi manfiy bo'lishi mumkin emas").default(0),
});

export type TruckActionResult = {
  ok: boolean;
  error?: string;
};

export async function createTruckAction(formData: FormData): Promise<TruckActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "trucks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = truckSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount") || 0,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { name, amount } = parsed.data;

  try {
    const [inserted] = await deps.db
      .insert(trucks)
      .values({
        name,
        amount: Math.round(amount),
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "truck.created",
        target: { type: "trucks", id: inserted.id },
        metadata: { name, amount },
      });
    }

    revalidatePath("/trucks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateTruckAction(formData: FormData): Promise<TruckActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "trucks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = truckSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    amount: formData.get("amount") || 0,
  });

  if (!parsed.success || !parsed.data.id) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Mashina identifikatori noto'g'ri" };
  }

  const { id, name, amount } = parsed.data;

  try {
    const [updated] = await deps.db
      .update(trucks)
      .set({
        name,
        amount: Math.round(amount),
        updatedAt: new Date(),
      })
      .where(eq(trucks.id, id))
      .returning();

    if (!updated) return { ok: false, error: "Mashina topilmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "truck.updated",
      target: { type: "trucks", id: updated.id },
      metadata: { name, amount },
    });

    revalidatePath("/trucks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleArchiveTruckAction(truckId: string): Promise<TruckActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "trucks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    const [existing] = await deps.db
      .select({ id: trucks.id, archivedAt: trucks.archivedAt })
      .from(trucks)
      .where(eq(trucks.id, truckId))
      .limit(1);

    if (!existing) return { ok: false, error: "Mashina topilmadi" };

    const isArchived = !!existing.archivedAt;
    const newArchivedAt = isArchived ? null : new Date();

    await deps.db
      .update(trucks)
      .set({
        archivedAt: newArchivedAt,
        updatedAt: new Date(),
      })
      .where(eq(trucks.id, truckId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: isArchived ? "truck.restored" : "truck.archived",
      target: { type: "trucks", id: truckId },
    });

    revalidatePath("/trucks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getTrucksList(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const active = await db
    .select()
    .from(trucks)
    .where(isNull(trucks.archivedAt))
    .orderBy(trucks.name);

  const archived = await db
    .select()
    .from(trucks)
    .where(isNotNull(trucks.archivedAt))
    .orderBy(trucks.name);

  return { active, archived };
}
