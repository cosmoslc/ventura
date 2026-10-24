"use server";

import { desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { materials, terakCosts, terakMaterials, teraks, workers, workEntries, workTypes } from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { currentDeps, requireUser } from "@/lib/server/session";

const terakSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().max(100).optional(),
  purchaseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  purchasePrice: z.coerce.number().min(0, "Xarid narxi manfiy bo'lishi mumkin emas").default(0),
  note: z.string().trim().max(500).optional(),
});

export type TerakActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function createTerakAction(formData: FormData): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  let inputName = formData.get("name") ? String(formData.get("name")).trim() : "";
  const purchaseDate = formData.get("purchaseDate") ? String(formData.get("purchaseDate")) : new Date().toISOString().slice(0, 10);
  const purchasePrice = formData.get("purchasePrice") ? Number(formData.get("purchasePrice")) : 0;
  const note = formData.get("note") ? String(formData.get("note")).trim() : null;

  // Standart nom berish: "Terak N"
  if (!inputName) {
    const [countRow] = await deps.db
      .select({ count: sql<number>`count(*)` })
      .from(teraks);
    const num = Number(countRow?.count ?? 0) + 1;
    inputName = `Terak ${num}`;
  }

  const parsed = terakSchema.safeParse({
    name: inputName,
    purchaseDate,
    purchasePrice,
    note: note || undefined,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  try {
    const [inserted] = await deps.db
      .insert(teraks)
      .values({
        name: parsed.data.name!,
        purchaseDate: parsed.data.purchaseDate,
        purchasePrice: Math.round(parsed.data.purchasePrice),
        note: parsed.data.note ?? null,
      })
      .returning();

    if (!inserted) throw new Error("Terak yaratilmadi");

    // Terakka katalogdagi barcha faol materiallarni 0 qiymatlar bilan ulab chiqish (SAWMILL-TAHLIL 4-qism)
    const activeMaterials = await deps.db
      .select({ id: materials.id })
      .from(materials)
      .where(isNull(materials.archivedAt));

    if (activeMaterials.length > 0) {
      await deps.db.insert(terakMaterials).values(
        activeMaterials.map((m) => ({
          terakId: inserted.id,
          materialId: m.id,
          quantity: "0",
          workerPrice: 0,
          sellingPrice: 0,
          cubeWorkerPrice: 0,
          cubePrice: 0,
          goal: "0",
        })),
      );
    }

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak.created",
      target: { type: "teraks", id: inserted.id },
      metadata: { name: inserted.name, purchaseDate, purchasePrice },
    });

    revalidatePath("/teraks");
    return { ok: true, id: inserted.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateTerakAction(formData: FormData): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = terakSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    purchaseDate: formData.get("purchaseDate"),
    purchasePrice: formData.get("purchasePrice"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success || !parsed.data.id) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Terak ID noto'g'ri" };
  }

  const { id, name, purchaseDate, purchasePrice, note } = parsed.data;

  try {
    const [updated] = await deps.db
      .update(teraks)
      .set({
        name: name || undefined,
        purchaseDate,
        purchasePrice: Math.round(purchasePrice),
        note: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(teraks.id, id))
      .returning();

    if (!updated) return { ok: false, error: "Terak topilmadi" };

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak.updated",
      target: { type: "teraks", id: updated.id },
      metadata: { name: updated.name, purchaseDate, purchasePrice },
    });

    revalidatePath("/teraks");
    revalidatePath(`/teraks/${id}`);
    return { ok: true, id: updated.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function trashTerakAction(terakId: string): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db
      .update(teraks)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(teraks.id, terakId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak.trashed",
      target: { type: "teraks", id: terakId },
    });

    revalidatePath("/teraks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function restoreTerakAction(terakId: string): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db
      .update(teraks)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(teraks.id, terakId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak.restored",
      target: { type: "teraks", id: terakId },
    });

    revalidatePath("/teraks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function permanentDeleteTerakAction(terakId: string): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.delete")) return { ok: false, error: "Faqat sex egasi butunlay o'chira oladi" };

  try {
    await deps.db.delete(teraks).where(eq(teraks.id, terakId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak.permanently_deleted",
      target: { type: "teraks", id: terakId },
    });

    revalidatePath("/teraks");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const priceUpdateSchema = z.object({
  terakId: z.string().uuid(),
  materialId: z.string().uuid(),
  workerPrice: z.coerce.number().min(0).default(0),
  sellingPrice: z.coerce.number().min(0).default(0),
  cubeWorkerPrice: z.coerce.number().min(0).default(0),
  cubePrice: z.coerce.number().min(0).default(0),
  goal: z.coerce.number().min(0).default(0),
});

export async function updateMaterialPricesAction(formData: FormData): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "stock.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = priceUpdateSchema.safeParse({
    terakId: formData.get("terakId"),
    materialId: formData.get("materialId"),
    workerPrice: formData.get("workerPrice"),
    sellingPrice: formData.get("sellingPrice"),
    cubeWorkerPrice: formData.get("cubeWorkerPrice"),
    cubePrice: formData.get("cubePrice"),
    goal: formData.get("goal"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Narxlar noto'g'ri" };
  }

  const { terakId, materialId, workerPrice, sellingPrice, cubeWorkerPrice, cubePrice, goal } = parsed.data;

  try {
    await deps.db
      .insert(terakMaterials)
      .values({
        terakId,
        materialId,
        workerPrice: Math.round(workerPrice),
        sellingPrice: Math.round(sellingPrice),
        cubeWorkerPrice: Math.round(cubeWorkerPrice),
        cubePrice: Math.round(cubePrice),
        goal: String(goal),
      })
      .onConflictDoUpdate({
        target: [terakMaterials.tenantId, terakMaterials.terakId, terakMaterials.materialId],
        set: {
          workerPrice: Math.round(workerPrice),
          sellingPrice: Math.round(sellingPrice),
          cubeWorkerPrice: Math.round(cubeWorkerPrice),
          cubePrice: Math.round(cubePrice),
          goal: String(goal),
          updatedAt: new Date(),
        },
      });

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak_material.prices_updated",
      target: { type: "terak_materials", id: `${terakId}:${materialId}` },
      metadata: { workerPrice, sellingPrice, cubeWorkerPrice, cubePrice, goal },
    });

    revalidatePath(`/teraks/${terakId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const costSchema = z.object({
  id: z.string().uuid().optional(),
  terakId: z.string().uuid(),
  kind: z.enum(["transport", "res", "truck", "other"]),
  title: z.string().trim().min(1, "Nomi yoki izoh kiritilishi shart").max(100),
  amount: z.coerce.number().min(0, "Summa manfiy bo'lishi mumkin emas").default(0),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  trips: z.coerce.number().min(0).nullable().optional(),
  pricePerTrip: z.coerce.number().min(0).nullable().optional(),
});

export async function addTerakCostAction(formData: FormData): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const kind = formData.get("kind") as "transport" | "res" | "truck" | "other";
  const trips = formData.get("trips") ? Number(formData.get("trips")) : null;
  const pricePerTrip = formData.get("pricePerTrip") ? Number(formData.get("pricePerTrip")) : null;

  let amount = formData.get("amount") ? Number(formData.get("amount")) : 0;
  if (kind === "res" && trips && pricePerTrip) {
    amount = trips * pricePerTrip;
  }

  const parsed = costSchema.safeParse({
    terakId: formData.get("terakId"),
    kind,
    title: formData.get("title"),
    amount,
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    trips,
    pricePerTrip,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Xarajat ma'lumoti noto'g'ri" };
  }

  const { terakId, title, date } = parsed.data;

  try {
    const [inserted] = await deps.db
      .insert(terakCosts)
      .values({
        terakId,
        kind,
        title,
        amount: Math.round(amount),
        date,
        trips,
        pricePerTrip: pricePerTrip ? Math.round(pricePerTrip) : null,
      })
      .returning();

    if (inserted) {
      await tenantAudit.record(deps.db, {
        actor: { type: "user", id: user.id, name: user.name },
        action: "terak_cost.created",
        target: { type: "terak_costs", id: inserted.id },
        metadata: { terakId, kind, title, amount, trips },
      });
    }

    revalidatePath(`/teraks/${terakId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteTerakCostAction(costId: string, terakId: string): Promise<TerakActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "teraks.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  try {
    await deps.db.delete(terakCosts).where(eq(terakCosts.id, costId));

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "terak_cost.deleted",
      target: { type: "terak_costs", id: costId },
    });

    revalidatePath(`/teraks/${terakId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function getTeraksList(db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"]) {
  const active = await db
    .select({
      id: teraks.id,
      name: teraks.name,
      purchaseDate: teraks.purchaseDate,
      purchasePrice: teraks.purchasePrice,
      note: teraks.note,
      createdAt: teraks.createdAt,
    })
    .from(teraks)
    .where(isNull(teraks.deletedAt))
    .orderBy(desc(teraks.purchaseDate));

  const trashed = await db
    .select({
      id: teraks.id,
      name: teraks.name,
      purchaseDate: teraks.purchaseDate,
      purchasePrice: teraks.purchasePrice,
      note: teraks.note,
      deletedAt: teraks.deletedAt,
    })
    .from(teraks)
    .where(isNotNull(teraks.deletedAt))
    .orderBy(desc(teraks.deletedAt));

  return { active, trashed };
}

export async function getTerakDetail(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  terakId: string,
) {
  const [terak] = await db
    .select()
    .from(teraks)
    .where(eq(teraks.id, terakId))
    .limit(1);

  if (!terak) return null;

  // Materiallar
  const stockRows = await db
    .select({
      tmId: terakMaterials.id,
      materialId: materials.id,
      name: materials.name,
      unit: materials.unit,
      pricingMode: materials.pricingMode,
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
      quantity: terakMaterials.quantity,
      workerPrice: terakMaterials.workerPrice,
      sellingPrice: terakMaterials.sellingPrice,
      cubeWorkerPrice: terakMaterials.cubeWorkerPrice,
      cubePrice: terakMaterials.cubePrice,
      goal: terakMaterials.goal,
      archivedAt: terakMaterials.archivedAt,
    })
    .from(terakMaterials)
    .innerJoin(materials, eq(materials.id, terakMaterials.materialId))
    .where(eq(terakMaterials.terakId, terakId));

  const stockWithVolumes = stockRows.map((r) => {
    const vol = pieceVolumeM3({
      thicknessCm: r.thicknessCm ? Number(r.thicknessCm) : null,
      widthCm: r.widthCm ? Number(r.widthCm) : null,
      lengthCm: r.lengthCm ? Number(r.lengthCm) : null,
    });
    const qty = Number(r.quantity ?? 0);
    const goalNum = Number(r.goal ?? 0);
    const progress = goalNum > 0 ? Math.min(1, qty / goalNum) : 0;

    // Ombor qiymati (SAWMILL-TAHLIL 8-qism)
    let stockValue = 0;
    if (r.sellingPrice > 0) {
      stockValue = qty * r.sellingPrice;
    } else if (r.cubePrice > 0 && vol) {
      stockValue = qty * vol * r.cubePrice;
    }

    return {
      ...r,
      volumeM3: vol,
      progress,
      stockValue: Math.round(stockValue),
    };
  });

  // Xarajatlar
  const costs = await db
    .select()
    .from(terakCosts)
    .where(eq(terakCosts.terakId, terakId))
    .orderBy(desc(terakCosts.date));

  const totalCostsAmount = costs.reduce((acc, c) => acc + Number(c.amount ?? 0), 0);

  // Res va Sartirofka hisobi (SAWMILL-TAHLIL 8-qism)
  // resSoni = sum(trips where kind='res' and trips > 0)
  const totalRes = costs
    .filter((c) => c.kind === "res")
    .reduce((acc, c) => acc + Number(c.trips ?? 0), 0);

  // sartirofkaSoni = workType='Sartirofka' (kind='sorting') entries soni
  const sortingWorkTypes = await db
    .select({ id: workTypes.id })
    .from(workTypes)
    .where(eq(workTypes.kind, "sorting"));

  const sortingTypeIds = sortingWorkTypes.map((wt) => wt.id);

  let sartirofkaSoni = 0;
  if (sortingTypeIds.length > 0) {
    const [sortingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workEntries)
      .where(sql`${workEntries.terakId} = ${terakId} and ${workEntries.workTypeId} in ${sortingTypeIds}`);
    sartirofkaSoni = Number(sortingCount?.count ?? 0);
  }

  const remainingRes = Math.max(0, totalRes - sartirofkaSoni);

  // Terakka tegishli ishlar ro'yxati (S3)
  const terakWorks = await db
    .select({
      id: workEntries.id,
      date: workEntries.date,
      workerId: workEntries.workerId,
      workerName: workers.name,
      workTypeId: workEntries.workTypeId,
      workTypeName: workTypes.name,
      kind: workEntries.kind,
      groupId: workEntries.groupId,
      amount: workEntries.amount,
      materialId: workEntries.materialId,
      materialName: materials.name,
      quantity: workEntries.quantity,
      rows: workEntries.rows,
      payUnit: workEntries.payUnit,
      note: workEntries.note,
    })
    .from(workEntries)
    .innerJoin(workers, eq(workers.id, workEntries.workerId))
    .leftJoin(workTypes, eq(workTypes.id, workEntries.workTypeId))
    .leftJoin(materials, eq(materials.id, workEntries.materialId))
    .where(eq(workEntries.terakId, terakId))
    .orderBy(desc(workEntries.date), desc(workEntries.createdAt));

  const totalWorkAmount = terakWorks.reduce((acc, w) => acc + Number(w.amount), 0);

  return {
    terak,
    stock: stockWithVolumes,
    costs,
    totalCostsAmount,
    totalRes,
    sartirofkaSoni,
    remainingRes,
    works: terakWorks.map((w) => ({
      ...w,
      amount: Number(w.amount),
    })),
    totalWorkAmount,
  };
}
