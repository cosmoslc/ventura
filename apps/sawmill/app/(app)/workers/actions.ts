"use server";

import { eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { normalizeUzPhone } from "@ventura/auth";
import { workers } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { currentDeps, requireUser } from "@/lib/server/session";

const workerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Ism kamida 2 harfdan iborat bo'lishi kerak").max(100),
  phone: z
    .string()
    .trim()
    .transform((val, ctx) => {
      if (!val) return null;
      const normalized = normalizeUzPhone(val);
      if (!normalized) {
        ctx.addIssue({ code: "custom", message: "Telefon raqami noto'g'ri formatda" });
      }
      return normalized;
    })
    .nullable(),
  salaryType: z.enum(["piecework", "daily", "weekly", "monthly"]),
  wageAmount: z.coerce.number().min(0, "Stavka manfiy bo'lishi mumkin emas").default(0),
});

export type WorkerActionResult = {
  ok: boolean;
  error?: string;
};

export async function createWorkerAction(formData: FormData): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = workerSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    salaryType: formData.get("salaryType"),
    wageAmount: formData.get("wageAmount") || 0,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { name, phone, salaryType, wageAmount } = parsed.data;

  try {
    const [inserted] = await deps.db
      .insert(workers)
      .values({
        name,
        phone,
        salaryType,
        wageAmount: Math.round(wageAmount),
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "worker.created",
        target: { type: "workers", id: inserted.id },
        metadata: { name, salaryType, wageAmount },
      });
    }

    revalidatePath("/workers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateWorkerAction(formData: FormData): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = workerSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    phone: formData.get("phone") || null,
    salaryType: formData.get("salaryType"),
    wageAmount: formData.get("wageAmount") || 0,
  });

  if (!parsed.success || !parsed.data.id) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Ishchi identifikatori noto'g'ri" };
  }

  const { id, name, phone, salaryType, wageAmount } = parsed.data;

  try {
    const [updated] = await deps.db
      .update(workers)
      .set({
        name,
        phone,
        salaryType,
        wageAmount: Math.round(wageAmount),
        updatedAt: new Date(),
      })
      .where(eq(workers.id, id))
      .returning();

    if (!updated) return { ok: false, error: "Ishchi topilmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "worker.updated",
      target: { type: "workers", id: updated.id },
      metadata: { name, salaryType, wageAmount },
    });

    revalidatePath("/workers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function toggleArchiveWorkerAction(workerId: string): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    const [existing] = await deps.db
      .select({ id: workers.id, archivedAt: workers.archivedAt })
      .from(workers)
      .where(eq(workers.id, workerId))
      .limit(1);

    if (!existing) return { ok: false, error: "Ishchi topilmadi" };

    const isArchived = !!existing.archivedAt;
    const newArchivedAt = isArchived ? null : new Date();

    await deps.db
      .update(workers)
      .set({
        archivedAt: newArchivedAt,
        updatedAt: new Date(),
      })
      .where(eq(workers.id, workerId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: isArchived ? "worker.restored" : "worker.archived",
      target: { type: "workers", id: workerId },
    });

    revalidatePath("/workers");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getWorkersList(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const active = await db.select().from(workers).where(isNull(workers.archivedAt)).orderBy(workers.name);

  const archived = await db.select().from(workers).where(isNotNull(workers.archivedAt)).orderBy(workers.name);

  return { active, archived };
}
