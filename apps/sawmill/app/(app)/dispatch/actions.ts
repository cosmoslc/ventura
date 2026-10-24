"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  dispatches,
  materials,
  stockMovements,
  terakCosts,
  terakMaterials,
  teraks,
  trucks,
} from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import {
  type DispatchUnit,
  validateAndCalculateDispatch,
} from "@/lib/calc/dispatch";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { currentDeps, requireUser } from "@/lib/server/session";

export interface DispatchActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const createDispatchSchema = z.object({
  terakId: z.string().uuid(),
  materialId: z.string().uuid(),
  unit: z.enum(["piece", "cube"]),
  quantity: z.coerce.number().positive(),
  price: z.coerce.number().nonnegative(),
  date: z.string().min(10),
  recipientName: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  truckId: z.string().uuid().optional().nullable(),
});

export async function createDispatchAction(
  formData: FormData,
): Promise<DispatchActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "dispatch.manage")) {
    return { ok: false, error: "Ruxsat etilmagan" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const rawTruckId = formData.get("truckId");
  const parsed = createDispatchSchema.safeParse({
    terakId: formData.get("terakId"),
    materialId: formData.get("materialId"),
    unit: formData.get("unit") ?? "piece",
    quantity: formData.get("quantity"),
    price: formData.get("price"),
    date: formData.get("date"),
    recipientName: formData.get("recipientName") || null,
    phone: formData.get("phone") || null,
    address: formData.get("address") || null,
    truckId: rawTruckId && String(rawTruckId).trim() ? String(rawTruckId).trim() : null,
  });

  if (!parsed.success) {
    return { ok: false, error: "Ma'lumotlar to'liq yoki to'g'ri kiritilmadi" };
  }

  const {
    terakId,
    materialId,
    unit,
    quantity,
    price,
    date,
    recipientName,
    phone,
    address,
    truckId,
  } = parsed.data;

  // 1. Ombordagi material holati va 1 dona hajmini olish
  const [tm] = await deps.db
    .select({
      id: terakMaterials.id,
      quantity: terakMaterials.quantity,
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
      materialName: materials.name,
    })
    .from(terakMaterials)
    .innerJoin(materials, eq(materials.id, terakMaterials.materialId))
    .where(
      and(
        eq(terakMaterials.terakId, terakId),
        eq(terakMaterials.materialId, materialId),
      ),
    )
    .limit(1);

  if (!tm) {
    return { ok: false, error: "Tanlangan material ushbu terak omborida topilmadi" };
  }

  const volumeM3 = pieceVolumeM3({
    thicknessCm: tm.thicknessCm ? Number(tm.thicknessCm) : null,
    widthCm: tm.widthCm ? Number(tm.widthCm) : null,
    lengthCm: tm.lengthCm ? Number(tm.lengthCm) : null,
  });

  const currentStock = Number(tm.quantity ?? 0);

  // 2. Hisob-kitob va qoldiq tekshiruvi (SAWMILL-TAHLIL 9-qism)
  const calc = validateAndCalculateDispatch({
    unit: unit as DispatchUnit,
    quantityInput: quantity,
    priceInput: price,
    volumeM3,
    currentStock,
  });

  if (!calc.valid) {
    if (calc.error === "OUT_OF_STOCK") {
      return { ok: false, error: `Omborda "${tm.materialName}" yo'q` };
    }
    if (calc.error === "INSUFFICIENT_STOCK") {
      return {
        ok: false,
        error: `Omborda yetarli "${tm.materialName}" yo'q (bor: ${currentStock} dona)`,
      };
    }
    if (calc.error === "MISSING_VOLUME") {
      return { ok: false, error: "Material o'lchamlari to'liq emas, kubda hisoblab bo'lmaydi" };
    }
    return { ok: false, error: "Kiritilgan miqdor yoki narx noto'g'ri" };
  }

  // 3. Yuk mashinasi tekshiruvi (agar tanlangan bo'lsa)
  let truckData: { id: string; name: string; amount: number } | null = null;
  if (truckId) {
    const [tr] = await deps.db
      .select({ id: trucks.id, name: trucks.name, amount: trucks.amount })
      .from(trucks)
      .where(and(eq(trucks.id, truckId), isNull(trucks.archivedAt)))
      .limit(1);
    if (!tr) {
      return { ok: false, error: "Tanlangan yuk mashinasi topilmadi" };
    }
    truckData = { id: tr.id, name: tr.name, amount: Number(tr.amount) };
  }

  // 4. Tranzaksiya: yuk chiqarish, ombor yangilash, harakat qayd etish, yuk mashinasi xarajati (K5)
  const createdDispatch = await deps.db.transaction(async (tx) => {
    // 4.1. Ombordan chiqarish
    const newStock = Math.max(0, currentStock - calc.quantityPiece);
    await tx
      .update(terakMaterials)
      .set({ quantity: newStock.toFixed(4) })
      .where(eq(terakMaterials.id, tm.id));

    // 4.2. Yuk chiqarish yozuvi
    const [dispatch] = await tx
      .insert(dispatches)
      .values({
        terakId,
        materialId,
        quantity: calc.quantityPiece.toFixed(4),
        enteredUnit: unit,
        enteredQty: quantity.toFixed(4),
        totalAmount: calc.totalAmount,
        date,
        recipientName: recipientName || null,
        phone: phone || null,
        address: address || null,
        truckId: truckData ? truckData.id : null,
      })
      .returning();

    if (!dispatch) {
      throw new Error("Yuk chiqarish yaratilmadi");
    }

    // 4.3. Ombor harakati (stock_movements)
    await tx.insert(stockMovements).values({
      terakId,
      materialId,
      delta: (-calc.quantityPiece).toFixed(4),
      source: "dispatch",
      sourceId: dispatch.id,
      at: new Date(date),
      note: recipientName ? `Yuk chiqarish: ${recipientName}` : "Yuk chiqarish",
    });

    // 4.4. K5: Yuk mashinasi xarajati terakka (terak_costs.kind = truck)
    if (truckData && truckData.amount > 0) {
      await tx.insert(terakCosts).values({
        terakId,
        kind: "truck",
        title: `Yuk mashina xarajati: ${truckData.name}`,
        amount: truckData.amount,
        date,
        dispatchId: dispatch.id,
        truckId: truckData.id,
      });
    }

    return dispatch;
  });

  // Audit
  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "dispatch.created",
    target: { type: "dispatches", id: createdDispatch.id },
    metadata: {
      terakId,
      materialId,
      quantityPiece: calc.quantityPiece,
      totalAmount: calc.totalAmount,
      truckId: truckData?.id ?? null,
    },
  });

  revalidatePath("/dispatch");
  revalidatePath(`/teraks/${terakId}`);
  revalidatePath("/");

  return { ok: true, id: createdDispatch.id };
}

export async function deleteDispatchAction(
  dispatchId: string,
): Promise<DispatchActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "dispatch.delete")) {
    return { ok: false, error: "Yuk chiqarishni o'chirish uchun ruxsat yetarli emas" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const [dispatch] = await deps.db
    .select()
    .from(dispatches)
    .where(eq(dispatches.id, dispatchId))
    .limit(1);

  if (!dispatch) {
    return { ok: false, error: "Yuk chiqarish topilmadi" };
  }

  // 1. Ombordagi joriy qoldiqni olish
  const [tm] = await deps.db
    .select({ id: terakMaterials.id, quantity: terakMaterials.quantity })
    .from(terakMaterials)
    .where(
      and(
        eq(terakMaterials.terakId, dispatch.terakId),
        eq(terakMaterials.materialId, dispatch.materialId),
      ),
    )
    .limit(1);

  await deps.db.transaction(async (tx) => {
    // 2. Qoldiqni qaytarish
    if (tm) {
      const restoredStock = Number(tm.quantity ?? 0) + Number(dispatch.quantity);
      await tx
        .update(terakMaterials)
        .set({ quantity: restoredStock.toFixed(4) })
        .where(eq(terakMaterials.id, tm.id));
    }

    // 3. Ombor harakatini o'chirish
    await tx
      .delete(stockMovements)
      .where(
        and(
          eq(stockMovements.source, "dispatch"),
          eq(stockMovements.sourceId, dispatch.id),
        ),
      );

    // 4. K5: Mashina xarajatini o'chirish (terak_costs cascade bor, lekin aniq tozalaymiz)
    await tx.delete(terakCosts).where(eq(terakCosts.dispatchId, dispatch.id));

    // 5. Yuk chiqarishni o'chirish
    await tx.delete(dispatches).where(eq(dispatches.id, dispatch.id));
  });

  // Audit
  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "dispatch.deleted",
    target: { type: "dispatches", id: dispatch.id },
    metadata: {
      terakId: dispatch.terakId,
      materialId: dispatch.materialId,
      quantity: dispatch.quantity,
      totalAmount: dispatch.totalAmount,
    },
  });

  revalidatePath("/dispatch");
  revalidatePath(`/teraks/${dispatch.terakId}`);
  revalidatePath("/");

  return { ok: true };
}

export async function getDispatchList(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    terakId?: string;
    materialId?: string;
  },
) {
  const conditions = [];
  if (filters?.terakId) {
    conditions.push(eq(dispatches.terakId, filters.terakId));
  }
  if (filters?.materialId) {
    conditions.push(eq(dispatches.materialId, filters.materialId));
  }

  const rows = await db
    .select({
      id: dispatches.id,
      terakId: dispatches.terakId,
      terakName: teraks.name,
      materialId: dispatches.materialId,
      materialName: materials.name,
      materialUnit: materials.unit,
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
      quantity: dispatches.quantity,
      enteredUnit: dispatches.enteredUnit,
      enteredQty: dispatches.enteredQty,
      totalAmount: dispatches.totalAmount,
      date: dispatches.date,
      recipientName: dispatches.recipientName,
      phone: dispatches.phone,
      address: dispatches.address,
      truckId: dispatches.truckId,
      truckName: trucks.name,
      createdAt: dispatches.createdAt,
    })
    .from(dispatches)
    .innerJoin(teraks, eq(teraks.id, dispatches.terakId))
    .innerJoin(materials, eq(materials.id, dispatches.materialId))
    .leftJoin(trucks, eq(trucks.id, dispatches.truckId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(dispatches.date), desc(dispatches.createdAt));

  return rows.map((r) => {
    const vol = pieceVolumeM3({
      thicknessCm: r.thicknessCm ? Number(r.thicknessCm) : null,
      widthCm: r.widthCm ? Number(r.widthCm) : null,
      lengthCm: r.lengthCm ? Number(r.lengthCm) : null,
    });
    const qtyPiece = Number(r.quantity);
    const volumeTotalM3 = vol ? Math.round(qtyPiece * vol * 1000) / 1000 : null;

    return {
      ...r,
      quantity: qtyPiece,
      enteredQty: Number(r.enteredQty),
      totalAmount: Number(r.totalAmount),
      volumeM3: vol,
      volumeTotalM3,
    };
  });
}
