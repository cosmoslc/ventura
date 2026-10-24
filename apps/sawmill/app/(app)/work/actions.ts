"use server";

import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  materials,
  materialSizes,
  stockMovements,
  terakCosts,
  terakMaterials,
  teraks,
  workerMaterialPrices,
  workers,
  workEntries,
  workGroups,
  workTypes,
} from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import { calculateGroupWork, calculateSingleWork, resolveWorkerCubePrice, resolveWorkerPrice } from "@/lib/calc/pay";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { getSettings } from "@/lib/settings/schema";
import { currentDeps, requireUser } from "@/lib/server/session";

export type WorkActionResult = {
  ok: boolean;
  error?: string;
  id?: string;
};

export async function getRemainingRes(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  terakId: string,
): Promise<number> {
  const costs = await db
    .select({ trips: terakCosts.trips })
    .from(terakCosts)
    .where(and(eq(terakCosts.terakId, terakId), eq(terakCosts.kind, "res")));
  const totalRes = costs.reduce((acc, c) => acc + Number(c.trips ?? 0), 0);

  const sortingTypes = await db
    .select({ id: workTypes.id })
    .from(workTypes)
    .where(eq(workTypes.kind, "sorting"));
  if (sortingTypes.length === 0) return totalRes;

  const sortingIds = sortingTypes.map((t) => t.id);

  // Single sorting work entries
  const [singleCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(workEntries)
    .where(
      and(
        eq(workEntries.terakId, terakId),
        inArray(workEntries.workTypeId, sortingIds),
        isNull(workEntries.groupId),
      ),
    );

  // Group sorting jobs (har bir guruh bitta sartirofka hisoblanadi)
  const [groupCount] = await db
    .select({ count: sql<number>`count(distinct ${workGroups.id})` })
    .from(workGroups)
    .where(
      and(
        eq(workGroups.terakId, terakId),
        inArray(workGroups.workTypeId, sortingIds),
      ),
    );

  const sartirofkaSoni = Number(singleCount?.count ?? 0) + Number(groupCount?.count ?? 0);
  return Math.max(0, totalRes - sartirofkaSoni);
}

const singleWorkSchema = z.object({
  workerId: z.string().uuid("Ishchi tanlanishi shart"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  kind: z.enum(["regular", "material"]),
  terakId: z.string().uuid().optional().nullable(),
  workTypeId: z.string().uuid().optional().nullable(),
  manualAmount: z.coerce.number().min(0).optional(),
  materialId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid().optional().nullable(),
  payUnit: z.enum(["piece", "row", "cube"]).optional(),
  quantity: z.coerce.number().min(0).optional(),
  rows: z.coerce.number().min(0).optional(),
  cubeM3: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function createSingleWorkAction(formData: FormData): Promise<WorkActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "work.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const parsed = singleWorkSchema.safeParse({
    workerId: formData.get("workerId"),
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    kind: formData.get("kind"),
    terakId: formData.get("terakId") || null,
    workTypeId: formData.get("workTypeId") || null,
    manualAmount: formData.get("manualAmount") || 0,
    materialId: formData.get("materialId") || null,
    sizeId: formData.get("sizeId") || null,
    payUnit: formData.get("payUnit") || "piece",
    quantity: formData.get("quantity") || 0,
    rows: formData.get("rows") || 0,
    cubeM3: formData.get("cubeM3") || 0,
    note: formData.get("note") ? String(formData.get("note")).trim() : null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const {
    workerId,
    date,
    kind,
    terakId,
    workTypeId,
    manualAmount,
    materialId,
    sizeId,
    payUnit,
    quantity,
    rows,
    cubeM3,
    note,
  } = parsed.data;

  // 1. Ishchi ma'lumotlarini tekshirish
  const [worker] = await deps.db
    .select()
    .from(workers)
    .where(eq(workers.id, workerId))
    .limit(1);
  if (!worker) return { ok: false, error: "Ishchi topilmadi" };

  let amount = 0;
  let stockDelta = 0;

  // 2. Sartirofka va Res tekshiruvi
  if (workTypeId) {
    const [wt] = await deps.db
      .select()
      .from(workTypes)
      .where(eq(workTypes.id, workTypeId))
      .limit(1);

    if (wt && wt.kind === "sorting") {
      if (!terakId) {
        return { ok: false, error: "Sartirofka ishi uchun terak tanlanishi shart" };
      }
      const remainingRes = await getRemainingRes(deps.db, terakId);
      if (remainingRes <= 0) {
        return { ok: false, error: "Bu terakda res qolmagan (sartirofka qo'shib bo'lmaydi)" };
      }
    }
  }

  const settings = await getSettings(deps.db);

  if (kind === "regular") {
    amount = Math.max(0, Math.round(manualAmount ?? 0));
  } else {
    // Material ishi
    if (!terakId) return { ok: false, error: "Material ishi uchun terak tanlanishi shart" };
    if (!materialId) return { ok: false, error: "Material tanlanishi shart" };

    // Material bazaviy o'lchamlari
    const [mat] = await deps.db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .limit(1);
    if (!mat) return { ok: false, error: "Material topilmadi" };

    // Terakdagi material narxlari
    const [tm] = await deps.db
      .select()
      .from(terakMaterials)
      .where(and(eq(terakMaterials.terakId, terakId), eq(terakMaterials.materialId, materialId)))
      .limit(1);

    // Ishchiga maxsus narx
    const [sp] = await deps.db
      .select({ price: workerMaterialPrices.price })
      .from(workerMaterialPrices)
      .where(and(eq(workerMaterialPrices.workerId, workerId), eq(workerMaterialPrices.materialId, materialId)))
      .limit(1);

    const baseWorkerPrice = tm?.workerPrice ?? 0;
    const baseCubeWorkerPrice = tm?.cubeWorkerPrice ?? 0;

    const workerPrice = resolveWorkerPrice({
      salaryType: worker.salaryType,
      baseWorkerPrice,
      specialPrice: sp?.price,
    });

    const workerCubePrice = resolveWorkerCubePrice({
      salaryType: worker.salaryType,
      baseCubeWorkerPrice,
    });

    // O'lcham hajmi: agar sizeId bo'lsa o'lchamdan, aks holda materialdan
    let volumeM3: number | null = null;
    if (sizeId) {
      const [sz] = await deps.db
        .select()
        .from(materialSizes)
        .where(eq(materialSizes.id, sizeId))
        .limit(1);
      if (sz) {
        volumeM3 = pieceVolumeM3({
          thicknessCm: sz.thicknessCm ? Number(sz.thicknessCm) : null,
          widthCm: sz.widthCm ? Number(sz.widthCm) : null,
          lengthCm: sz.lengthCm ? Number(sz.lengthCm) : null,
        });
      }
    }
    if (!volumeM3) {
      volumeM3 = pieceVolumeM3({
        thicknessCm: mat.thicknessCm ? Number(mat.thicknessCm) : null,
        widthCm: mat.widthCm ? Number(mat.widthCm) : null,
        lengthCm: mat.lengthCm ? Number(mat.lengthCm) : null,
      });
    }

    const calcResult = calculateSingleWork({
      kind: "material",
      payUnit,
      cubeMode: settings.cubeInputMode,
      workerPrice,
      workerCubePrice,
      quantity,
      rows,
      cubeM3,
      volumeM3,
    });

    amount = calcResult.amount;
    stockDelta = calcResult.stockDelta;
  }

  try {
    const [entry] = await deps.db
      .insert(workEntries)
      .values({
        workerId,
        terakId: terakId ?? null,
        workTypeId: workTypeId ?? null,
        kind,
        date,
        amount,
        materialId: materialId ?? null,
        sizeId: sizeId ?? null,
        quantity: quantity != null && quantity > 0 ? String(quantity) : null,
        rows: rows != null && rows > 0 ? String(rows) : null,
        payUnit: kind === "material" ? payUnit : null,
        note,
      })
      .returning();

    if (!entry) throw new Error("Ish saqlanmadi");

    // Ombor qoldig'i va ombor harakati
    if (kind === "material" && stockDelta > 0 && terakId && materialId) {
      await deps.db
        .update(terakMaterials)
        .set({
          quantity: sql`${terakMaterials.quantity} + ${stockDelta}`,
        })
        .where(and(eq(terakMaterials.terakId, terakId), eq(terakMaterials.materialId, materialId)));

      await deps.db.insert(stockMovements).values({
        terakId,
        materialId,
        sizeId: sizeId ?? null,
        delta: String(stockDelta),
        source: "work",
        sourceId: entry.id,
        at: new Date(date),
        note: note ?? "Yakka ish",
      });
    }

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "work_entry.created",
      target: { type: "work_entries", id: entry.id },
      metadata: { workerId, amount, kind, terakId, materialId, stockDelta },
    });

    revalidatePath("/work");
    if (terakId) revalidatePath(`/teraks/${terakId}`);
    revalidatePath(`/workers/${workerId}`);

    return { ok: true, id: entry.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

const groupWorkSchema = z.object({
  workerIds: z.array(z.string().uuid()).min(1, "Kamida bitta ishchi tanlanishi kerak"),
  payFullToEach: z.boolean().default(false),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Sana formati: YYYY-MM-DD"),
  kind: z.enum(["regular", "material"]),
  terakId: z.string().uuid().optional().nullable(),
  workTypeId: z.string().uuid().optional().nullable(),
  totalAmountInput: z.coerce.number().min(0).optional(),
  materialId: z.string().uuid().optional().nullable(),
  sizeId: z.string().uuid().optional().nullable(),
  payUnit: z.enum(["piece", "row", "cube"]).optional(),
  quantity: z.coerce.number().min(0).optional(),
  rows: z.coerce.number().min(0).optional(),
  cubeM3: z.coerce.number().min(0).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export async function createGroupWorkAction(formData: FormData): Promise<WorkActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "work.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  let rawWorkerIds: string[] = [];
  const workerIdsStr = formData.get("workerIds");
  if (workerIdsStr) {
    try {
      const parsed = JSON.parse(String(workerIdsStr));
      if (Array.isArray(parsed)) rawWorkerIds = parsed;
    } catch {
      rawWorkerIds = formData.getAll("workerIds").map(String);
    }
  } else {
    rawWorkerIds = formData.getAll("workerIds").map(String);
  }

  const parsed = groupWorkSchema.safeParse({
    workerIds: rawWorkerIds,
    payFullToEach: formData.get("payFullToEach") === "true",
    date: formData.get("date") || new Date().toISOString().slice(0, 10),
    kind: formData.get("kind"),
    terakId: formData.get("terakId") || null,
    workTypeId: formData.get("workTypeId") || null,
    totalAmountInput: formData.get("totalAmountInput") || 0,
    materialId: formData.get("materialId") || null,
    sizeId: formData.get("sizeId") || null,
    payUnit: formData.get("payUnit") || "piece",
    quantity: formData.get("quantity") || 0,
    rows: formData.get("rows") || 0,
    cubeM3: formData.get("cubeM3") || 0,
    note: formData.get("note") ? String(formData.get("note")).trim() : null,
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Ma'lumot noto'g'ri" };
  }

  const {
    workerIds,
    payFullToEach,
    date,
    kind,
    terakId,
    workTypeId,
    totalAmountInput,
    materialId,
    sizeId,
    payUnit,
    quantity,
    rows,
    cubeM3,
    note,
  } = parsed.data;

  // Ishchilarni bazadan olish
  const workerRows = await deps.db
    .select()
    .from(workers)
    .where(inArray(workers.id, workerIds));

  if (workerRows.length === 0) {
    return { ok: false, error: "Tanlangan ishchilar topilmadi" };
  }

  // Sartirofka tekshiruvi
  if (workTypeId) {
    const [wt] = await deps.db
      .select()
      .from(workTypes)
      .where(eq(workTypes.id, workTypeId))
      .limit(1);

    if (wt && wt.kind === "sorting") {
      if (!terakId) {
        return { ok: false, error: "Sartirofka ishi uchun terak tanlanishi shart" };
      }
      const remainingRes = await getRemainingRes(deps.db, terakId);
      if (remainingRes <= 0) {
        return { ok: false, error: "Bu terakda res qolmagan (sartirofka qo'shib bo'lmaydi)" };
      }
    }
  }

  const settings = await getSettings(deps.db);

  let baseWorkerPrice = 0;
  let baseCubeWorkerPrice = 0;
  let volumeM3: number | null = null;
  const specialPricesMap = new Map<string, number>();

  if (kind === "material") {
    if (!terakId) return { ok: false, error: "Material ishi uchun terak tanlanishi shart" };
    if (!materialId) return { ok: false, error: "Material tanlanishi shart" };

    const [mat] = await deps.db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .limit(1);
    if (!mat) return { ok: false, error: "Material topilmadi" };

    const [tm] = await deps.db
      .select()
      .from(terakMaterials)
      .where(and(eq(terakMaterials.terakId, terakId), eq(terakMaterials.materialId, materialId)))
      .limit(1);

    baseWorkerPrice = tm?.workerPrice ?? 0;
    baseCubeWorkerPrice = tm?.cubeWorkerPrice ?? 0;

    // Maxsus narxlar
    const spRows = await deps.db
      .select()
      .from(workerMaterialPrices)
      .where(and(inArray(workerMaterialPrices.workerId, workerIds), eq(workerMaterialPrices.materialId, materialId)));
    for (const sp of spRows) {
      specialPricesMap.set(sp.workerId, sp.price);
    }

    if (sizeId) {
      const [sz] = await deps.db
        .select()
        .from(materialSizes)
        .where(eq(materialSizes.id, sizeId))
        .limit(1);
      if (sz) {
        volumeM3 = pieceVolumeM3({
          thicknessCm: sz.thicknessCm ? Number(sz.thicknessCm) : null,
          widthCm: sz.widthCm ? Number(sz.widthCm) : null,
          lengthCm: sz.lengthCm ? Number(sz.lengthCm) : null,
        });
      }
    }
    if (!volumeM3) {
      volumeM3 = pieceVolumeM3({
        thicknessCm: mat.thicknessCm ? Number(mat.thicknessCm) : null,
        widthCm: mat.widthCm ? Number(mat.widthCm) : null,
        lengthCm: mat.lengthCm ? Number(mat.lengthCm) : null,
      });
    }
  }

  const groupWorkers = workerRows.map((w) => ({
    workerId: w.id,
    salaryType: w.salaryType,
    specialPrice: specialPricesMap.get(w.id),
  }));

  const groupResult = calculateGroupWork({
    kind,
    totalAmountInput,
    payUnit,
    cubeMode: settings.cubeInputMode,
    baseWorkerPrice,
    baseCubeWorkerPrice,
    quantity,
    rows,
    cubeM3,
    volumeM3,
    payFullToEach,
    workers: groupWorkers,
  });

  try {
    // 1. work_groups yozuvi
    const [group] = await deps.db
      .insert(workGroups)
      .values({
        terakId: terakId ?? null,
        workTypeId: workTypeId ?? null,
        date,
        totalAmount: groupResult.totalAmount,
        payFullToEach,
        materialId: materialId ?? null,
        quantity: quantity != null && quantity > 0 ? String(quantity) : null,
        rows: rows != null && rows > 0 ? String(rows) : null,
        payUnit: kind === "material" ? payUnit : null,
        note,
      })
      .returning();

    if (!group) throw new Error("Guruh ishi saqlanmadi");

    // 2. Har bir ishchi uchun work_entries yozuvi
    for (const dist of groupResult.distributions) {
      await deps.db.insert(workEntries).values({
        workerId: dist.workerId,
        terakId: terakId ?? null,
        workTypeId: workTypeId ?? null,
        kind,
        groupId: group.id,
        date,
        amount: dist.amount,
        materialId: materialId ?? null,
        sizeId: sizeId ?? null,
        quantity: quantity != null && quantity > 0 ? String(quantity) : null,
        rows: rows != null && rows > 0 ? String(rows) : null,
        payUnit: kind === "material" ? payUnit : null,
        note,
      });
    }

    // 3. Omborga miqdor FAQAT BIR MARTA qo'shiladi (K3, K15)
    if (kind === "material" && groupResult.stockDelta > 0 && terakId && materialId) {
      await deps.db
        .update(terakMaterials)
        .set({
          quantity: sql`${terakMaterials.quantity} + ${groupResult.stockDelta}`,
        })
        .where(and(eq(terakMaterials.terakId, terakId), eq(terakMaterials.materialId, materialId)));

      await deps.db.insert(stockMovements).values({
        terakId,
        materialId,
        sizeId: sizeId ?? null,
        delta: String(groupResult.stockDelta),
        source: "work",
        sourceId: group.id,
        at: new Date(date),
        note: note ?? "Guruh ishi",
      });
    }

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "work_group.created",
      target: { type: "work_groups", id: group.id },
      metadata: {
        totalAmount: groupResult.totalAmount,
        workersCount: workerRows.length,
        stockDelta: groupResult.stockDelta,
        payFullToEach,
      },
    });

    revalidatePath("/work");
    if (terakId) revalidatePath(`/teraks/${terakId}`);
    for (const w of workerRows) {
      revalidatePath(`/workers/${w.id}`);
    }

    return { ok: true, id: group.id };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteWorkAction(entryId: string): Promise<WorkActionResult> {
  const { user } = await requireUser();
  const { deps } = await currentDeps();
  if (!deps) return { ok: false, error: "Baza sozlanmagan" };
  if (!can(user.role, "work.manage")) return { ok: false, error: "Ruxsat etilmagan amal" };

  const [entry] = await deps.db
    .select()
    .from(workEntries)
    .where(eq(workEntries.id, entryId))
    .limit(1);

  if (!entry) return { ok: false, error: "Ish topilmadi" };

  try {
    if (entry.groupId) {
      // Guruh ishi bo'lsa: butun guruh o'chiriladi va ombor qoldig'i qaytariladi
      const [movement] = await deps.db
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.source, "work"), eq(stockMovements.sourceId, entry.groupId)))
        .limit(1);

      if (movement) {
        const deltaNum = Number(movement.delta);
        if (deltaNum > 0) {
          await deps.db
            .update(terakMaterials)
            .set({
              quantity: sql`${terakMaterials.quantity} - ${deltaNum}`,
            })
            .where(
              and(
                eq(terakMaterials.terakId, movement.terakId),
                eq(terakMaterials.materialId, movement.materialId),
              ),
            );
        }
        await deps.db.delete(stockMovements).where(eq(stockMovements.id, movement.id));
      }

      await deps.db.delete(workGroups).where(eq(workGroups.id, entry.groupId));
    } else {
      // Yakka ish bo'lsa
      const [movement] = await deps.db
        .select()
        .from(stockMovements)
        .where(and(eq(stockMovements.source, "work"), eq(stockMovements.sourceId, entry.id)))
        .limit(1);

      if (movement) {
        const deltaNum = Number(movement.delta);
        if (deltaNum > 0) {
          await deps.db
            .update(terakMaterials)
            .set({
              quantity: sql`${terakMaterials.quantity} - ${deltaNum}`,
            })
            .where(
              and(
                eq(terakMaterials.terakId, movement.terakId),
                eq(terakMaterials.materialId, movement.materialId),
              ),
            );
        }
        await deps.db.delete(stockMovements).where(eq(stockMovements.id, movement.id));
      }

      await deps.db.delete(workEntries).where(eq(workEntries.id, entry.id));
    }

    await tenantAudit.record(deps.db, {
      actor: { type: "user", id: user.id, name: user.name },
      action: "work_entry.deleted",
      target: { type: "work_entries", id: entry.id },
      metadata: { entryId, groupId: entry.groupId },
    });

    revalidatePath("/work");
    if (entry.terakId) revalidatePath(`/teraks/${entry.terakId}`);
    revalidatePath(`/workers/${entry.workerId}`);

    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export type WorkListItem = {
  id: string;
  date: string;
  workerId: string;
  workerName: string;
  terakId: string | null;
  terakName: string | null;
  workTypeId: string | null;
  workTypeName: string | null;
  kind: "regular" | "material";
  groupId: string | null;
  amount: number;
  materialId: string | null;
  materialName: string | null;
  sizeId: string | null;
  sizeName: string | null;
  quantity: string | null;
  rows: string | null;
  payUnit: "piece" | "row" | "cube" | null;
  note: string | null;
  createdAt: Date;
};

export async function getWorkList(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    date?: string;
    workerId?: string;
    terakId?: string;
  },
): Promise<WorkListItem[]> {
  const conditions = [];

  if (filters?.date) {
    conditions.push(eq(workEntries.date, filters.date));
  }
  if (filters?.workerId) {
    conditions.push(eq(workEntries.workerId, filters.workerId));
  }
  if (filters?.terakId) {
    conditions.push(eq(workEntries.terakId, filters.terakId));
  }

  const query = db
    .select({
      id: workEntries.id,
      date: workEntries.date,
      workerId: workEntries.workerId,
      workerName: workers.name,
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
    .innerJoin(workers, eq(workers.id, workEntries.workerId))
    .leftJoin(teraks, eq(teraks.id, workEntries.terakId))
    .leftJoin(workTypes, eq(workTypes.id, workEntries.workTypeId))
    .leftJoin(materials, eq(materials.id, workEntries.materialId))
    .leftJoin(materialSizes, eq(materialSizes.id, workEntries.sizeId))
    .orderBy(desc(workEntries.date), desc(workEntries.createdAt));

  const rows = conditions.length > 0 ? await query.where(and(...conditions)) : await query;

  return rows.map((r) => {
    let sizeName: string | null = null;
    if (r.thicknessCm && r.widthCm && r.lengthCm) {
      sizeName = `${r.thicknessCm}×${r.widthCm}×${r.lengthCm} sm`;
    }
    return {
      id: r.id,
      date: r.date,
      workerId: r.workerId,
      workerName: r.workerName,
      terakId: r.terakId,
      terakName: r.terakName,
      workTypeId: r.workTypeId,
      workTypeName: r.workTypeName,
      kind: r.kind,
      groupId: r.groupId,
      amount: Number(r.amount),
      materialId: r.materialId,
      materialName: r.materialName,
      sizeId: r.sizeId,
      sizeName,
      quantity: r.quantity,
      rows: r.rows,
      payUnit: r.payUnit,
      note: r.note,
      createdAt: r.createdAt,
    };
  });
}
