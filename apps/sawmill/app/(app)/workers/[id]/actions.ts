"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  materials,
  materialSizes,
  payments,
  teraks,
  wageAccruals,
  workerMaterialPrices,
  workers,
  workEntries,
  workTypes,
} from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { calculateWorkerBalance } from "@/lib/calc/balance";
import { currentDeps, requireUser } from "@/lib/server/session";

export type WorkerActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

// 1. To'lov berish (K6)
const paymentSchema = z.object({
  workerId: z.string().uuid("Ishchi tanlanishi shart"),
  amount: z.coerce.number().positive("To'lov summasi 0 dan katta bo'lishi kerak"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function recordPaymentAction(formData: FormData): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = paymentSchema.safeParse({
    workerId: formData.get("workerId"),
    amount: formData.get("amount"),
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    note: formData.get("note") ? String(formData.get("note")).trim() : null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { workerId, amount, date, note } = parsed.data;

  try {
    const [inserted] = await deps.db
      .insert(payments)
      .values({
        workerId,
        amount: Math.round(amount),
        date,
        note,
      })
      .returning();

    if (!inserted) throw new Error("To'lov saqlanmadi");

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "payment.created",
      target: { type: "payments", id: inserted.id },
      metadata: { workerId, amount, date, note },
    });

    revalidatePath(`/workers/${workerId}`);
    revalidatePath("/workers");

    return { ok: true, id: inserted.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deletePaymentAction(paymentId: string, workerId: string): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db.delete(payments).where(eq(payments.id, paymentId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "payment.deleted",
      target: { type: "payments", id: paymentId },
      metadata: { workerId },
    });

    revalidatePath(`/workers/${workerId}`);
    revalidatePath("/workers");

    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// 2. Maosh hisoblash (K1)
const wageAccrualSchema = z.object({
  workerId: z.string().uuid("Ishchi tanlanishi shart"),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  units: z.coerce.number().positive("Soni 0 dan katta bo'lishi kerak"),
  rate: z.coerce.number().min(0, "Stavka manfiy bo'lishi mumkin emas"),
  terakId: z.string().uuid().optional().nullable(),
});

export async function accrueWageAction(formData: FormData): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = wageAccrualSchema.safeParse({
    workerId: formData.get("workerId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    units: formData.get("units"),
    rate: formData.get("rate"),
    terakId: formData.get("terakId") || null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const { workerId, periodStart, periodEnd, units, rate, terakId } = parsed.data;

  if (periodStart > periodEnd) {
    return { ok: false, error: "Boshlanish sanasi tugash sanasidan katta bo'lishi mumkin emas" };
  }

  // Takroriy davr tekshiruvi (K1)
  const [existing] = await deps.db
    .select({ id: wageAccruals.id })
    .from(wageAccruals)
    .where(
      and(
        eq(wageAccruals.workerId, workerId),
        eq(wageAccruals.periodStart, periodStart),
        eq(wageAccruals.periodEnd, periodEnd),
      ),
    )
    .limit(1);

  if (existing) {
    return { ok: false, error: "Ushbu davr uchun maosh avval hisoblangan" };
  }

  const amount = Math.round(units * rate);

  try {
    // Tizim "Maosh" ish turini topish yoki yaratish
    let [maoshType] = await deps.db
      .select({ id: workTypes.id })
      .from(workTypes)
      .where(eq(workTypes.name, "Maosh"))
      .limit(1);

    if (!maoshType) {
      const [insertedType] = await deps.db
        .insert(workTypes)
        .values({
          name: "Maosh",
          kind: "regular",
          isSystem: true,
        })
        .returning();
      maoshType = insertedType;
    }

    // Companion work_entries yozuvi (K1)
    const [entry] = await deps.db
      .insert(workEntries)
      .values({
        workerId,
        terakId: terakId ?? null,
        workTypeId: maoshType?.id ?? null,
        kind: "regular",
        date: periodEnd,
        amount,
        note: `Maosh (${periodStart} — ${periodEnd})`,
      })
      .returning();

    if (!entry) throw new Error("Ish yozuvi saqlanmadi");

    // wage_accruals yozuvi
    const [accrual] = await deps.db
      .insert(wageAccruals)
      .values({
        workerId,
        periodStart,
        periodEnd,
        units: String(units),
        rate: Math.round(rate),
        amount,
        terakId: terakId ?? null,
        workEntryId: entry.id,
      })
      .returning();

    if (!accrual) throw new Error("Maosh hisoblash yozuvi saqlanmadi");

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "wage_accrual.created",
      target: { type: "wage_accruals", id: accrual.id },
      metadata: { workerId, periodStart, periodEnd, units, rate, amount, terakId },
    });

    revalidatePath(`/workers/${workerId}`);
    revalidatePath("/work");
    if (terakId) revalidatePath(`/teraks/${terakId}`);

    return { ok: true, id: accrual.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteWageAccrualAction(accrualId: string, workerId: string): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    const [accrual] = await deps.db
      .select({ workEntryId: wageAccruals.workEntryId })
      .from(wageAccruals)
      .where(eq(wageAccruals.id, accrualId))
      .limit(1);

    if (accrual?.workEntryId) {
      await deps.db.delete(workEntries).where(eq(workEntries.id, accrual.workEntryId));
    }
    await deps.db.delete(wageAccruals).where(eq(wageAccruals.id, accrualId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "wage_accrual.deleted",
      target: { type: "wage_accruals", id: accrualId },
      metadata: { workerId },
    });

    revalidatePath(`/workers/${workerId}`);
    revalidatePath("/work");

    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// 3. Maxsus narxlar (worker_material_prices)
export async function setWorkerSpecialPriceAction(formData: FormData): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const workerId = String(formData.get("workerId"));
  const materialId = String(formData.get("materialId"));
  const price = Number(formData.get("price") ?? 0);

  if (!workerId || !materialId) {
    return { ok: false, error: "Ishchi va material tanlanishi shart" };
  }

  try {
    if (price <= 0) {
      // Narx 0 bo'lsa maxsus narx o'chiriladi
      await deps.db
        .delete(workerMaterialPrices)
        .where(and(eq(workerMaterialPrices.workerId, workerId), eq(workerMaterialPrices.materialId, materialId)));
    } else {
      await deps.db
        .insert(workerMaterialPrices)
        .values({
          workerId,
          materialId,
          price: Math.round(price),
        })
        .onConflictDoUpdate({
          target: [workerMaterialPrices.tenantId, workerMaterialPrices.workerId, workerMaterialPrices.materialId],
          set: {
            price: Math.round(price),
            updatedAt: new Date(),
          },
        });
    }

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "worker_material_price.set",
      target: { type: "worker_material_prices", id: `${workerId}_${materialId}` },
      metadata: { workerId, materialId, price },
    });

    revalidatePath(`/workers/${workerId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteWorkerSpecialPriceAction(
  workerId: string,
  materialId: string,
): Promise<WorkerActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "workers.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db
      .delete(workerMaterialPrices)
      .where(and(eq(workerMaterialPrices.workerId, workerId), eq(workerMaterialPrices.materialId, materialId)));

    revalidatePath(`/workers/${workerId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

// 4. Ishchi ma'lumotlarini to'liq olish
export async function getWorkerProfileData(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  workerId: string,
) {
  const [worker] = await db.select().from(workers).where(eq(workers.id, workerId)).limit(1);

  if (!worker) return null;

  // Ishlar ro'yxati
  const works = await db
    .select({
      id: workEntries.id,
      date: workEntries.date,
      terakId: workEntries.terakId,
      terakName: teraks.name,
      workTypeId: workEntries.workTypeId,
      workTypeName: workTypes.name,
      kind: workEntries.kind,
      groupId: workEntries.groupId,
      amount: workEntries.amount,
      materialId: workEntries.materialId,
      materialName: materials.name,
      sizeId: workEntries.sizeId,
      thicknessCm: materialSizes.thicknessCm,
      widthCm: materialSizes.widthCm,
      lengthCm: materialSizes.lengthCm,
      quantity: workEntries.quantity,
      rows: workEntries.rows,
      payUnit: workEntries.payUnit,
      note: workEntries.note,
      createdAt: workEntries.createdAt,
    })
    .from(workEntries)
    .leftJoin(teraks, eq(teraks.id, workEntries.terakId))
    .leftJoin(workTypes, eq(workTypes.id, workEntries.workTypeId))
    .leftJoin(materials, eq(materials.id, workEntries.materialId))
    .leftJoin(materialSizes, eq(materialSizes.id, workEntries.sizeId))
    .where(eq(workEntries.workerId, workerId))
    .orderBy(desc(workEntries.date), desc(workEntries.createdAt));

  // To'lovlar ro'yxati
  const paymentRows = await db
    .select()
    .from(payments)
    .where(eq(payments.workerId, workerId))
    .orderBy(desc(payments.date), desc(payments.createdAt));

  // Hisoblangan maoshlar ro'yxati
  const accrualRows = await db
    .select({
      id: wageAccruals.id,
      periodStart: wageAccruals.periodStart,
      periodEnd: wageAccruals.periodEnd,
      units: wageAccruals.units,
      rate: wageAccruals.rate,
      amount: wageAccruals.amount,
      terakId: wageAccruals.terakId,
      terakName: teraks.name,
      workEntryId: wageAccruals.workEntryId,
      createdAt: wageAccruals.createdAt,
    })
    .from(wageAccruals)
    .leftJoin(teraks, eq(teraks.id, wageAccruals.terakId))
    .where(eq(wageAccruals.workerId, workerId))
    .orderBy(desc(wageAccruals.periodStart), desc(wageAccruals.createdAt));

  // Maxsus narxlar
  const specialPrices = await db
    .select({
      materialId: materials.id,
      materialName: materials.name,
      unit: materials.unit,
      pricingMode: materials.pricingMode,
      price: workerMaterialPrices.price,
    })
    .from(workerMaterialPrices)
    .innerJoin(materials, eq(materials.id, workerMaterialPrices.materialId))
    .where(eq(workerMaterialPrices.workerId, workerId));

  // Barcha faol materiallar (maxsus narx o'rnatish uchun)
  const allMaterials = await db
    .select({
      id: materials.id,
      name: materials.name,
      unit: materials.unit,
      pricingMode: materials.pricingMode,
    })
    .from(materials)
    .where(sql`${materials.archivedAt} is null`)
    .orderBy(materials.name);

  // Barcha faol teraklar
  const activeTeraks = await db
    .select({
      id: teraks.id,
      name: teraks.name,
    })
    .from(teraks)
    .where(sql`${teraks.deletedAt} is null`)
    .orderBy(desc(teraks.purchaseDate));

  // Balans hisob-kitobi (SAWMILL-TAHLIL 7-qism)
  // Eslatma: wageAccruals yaratilganda companion workEntries yozuvi tushadi.
  // Shuning uchun works summasining o'zi barcha ishlangan mablag'ni o'z ichiga oladi.
  const totalWorkEarned = works.reduce((sum, w) => sum + Number(w.amount), 0);
  const totalPaid = paymentRows.reduce((sum, p) => sum + Number(p.amount), 0);

  const balance = calculateWorkerBalance({
    totalWorkEarned,
    totalWageAccruals: 0,
    totalPayments: totalPaid,
  });

  return {
    worker,
    works: works.map((r) => {
      let sizeName: string | null = null;
      if (r.thicknessCm && r.widthCm && r.lengthCm) {
        sizeName = `${r.thicknessCm}×${r.widthCm}×${r.lengthCm} sm`;
      }
      return {
        ...r,
        amount: Number(r.amount),
        sizeName,
      };
    }),
    payments: paymentRows.map((p) => ({
      ...p,
      amount: Number(p.amount),
    })),
    accruals: accrualRows.map((a) => ({
      ...a,
      rate: Number(a.rate),
      amount: Number(a.amount),
      units: Number(a.units),
    })),
    specialPrices: specialPrices.map((sp) => ({
      ...sp,
      price: Number(sp.price),
    })),
    allMaterials,
    activeTeraks,
    balance,
  };
}
