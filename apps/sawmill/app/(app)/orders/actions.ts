"use server";

import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  materials,
  orders,
  terakMaterials,
  teraks,
} from "@ventura/db/schema/sawmill";
import { tenantAudit } from "@ventura/security";
import { can } from "@/lib/auth/roles";
import {
  getOrderStatus,
  isOrderDueSoon,
  type OrderStatus,
} from "@/lib/calc/orders";
import { pieceVolumeM3 } from "@/lib/calc/units";
import { currentDeps, requireUser } from "@/lib/server/session";

export interface OrderActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

const createOrderSchema = z.object({
  terakId: z.string().uuid(),
  materialId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  customerName: z.string().min(1),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

export async function createOrderAction(
  formData: FormData,
): Promise<OrderActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "orders.manage")) {
    return { ok: false, error: "Zakaz qo'shish uchun ruxsat yo'q" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const rawDueDate = formData.get("dueDate");
  const parsed = createOrderSchema.safeParse({
    terakId: formData.get("terakId"),
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    customerName: formData.get("customerName"),
    phone: formData.get("phone") || null,
    address: formData.get("address") || null,
    dueDate: rawDueDate && String(rawDueDate).trim() ? String(rawDueDate).trim() : null,
  });

  if (!parsed.success) {
    return { ok: false, error: "Ma'lumotlar to'liq kiritilmadi" };
  }

  const {
    terakId,
    materialId,
    quantity,
    customerName,
    phone,
    address,
    dueDate,
  } = parsed.data;

  const [newOrder] = await deps.db
    .insert(orders)
    .values({
      terakId,
      materialId,
      quantity: quantity.toFixed(4),
      customerName,
      phone,
      address,
      dueDate: dueDate || null,
    })
    .returning();

  if (!newOrder) {
    return { ok: false, error: "Zakaz saqlanmadi" };
  }

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "order.created",
    target: { type: "orders", id: newOrder.id },
    metadata: { terakId, materialId, quantity, customerName, dueDate },
  });

  revalidatePath("/orders");
  revalidatePath(`/teraks/${terakId}`);
  revalidatePath("/");

  return { ok: true, id: newOrder.id };
}

export async function updateOrderAction(
  orderId: string,
  formData: FormData,
): Promise<OrderActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "orders.manage")) {
    return { ok: false, error: "Zakazni tahrirlash uchun ruxsat yo'q" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const rawDueDate = formData.get("dueDate");
  const customerName = String(formData.get("customerName") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 0);
  const phone = formData.get("phone") ? String(formData.get("phone")).trim() : null;
  const address = formData.get("address") ? String(formData.get("address")).trim() : null;
  const dueDate = rawDueDate && String(rawDueDate).trim() ? String(rawDueDate).trim() : null;

  if (!customerName || quantity <= 0) {
    return { ok: false, error: "Mijoz ismi va miqdori to'g'ri kiritilishi shart" };
  }

  // K20: readyNotifiedAt va dueNotifiedAt o'chib ketmasligi kafolatlanadi (preserve flags)
  await deps.db
    .update(orders)
    .set({
      customerName,
      quantity: quantity.toFixed(4),
      phone,
      address,
      dueDate,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "order.updated",
    target: { type: "orders", id: orderId },
    metadata: { customerName, quantity, dueDate },
  });

  revalidatePath("/orders");
  revalidatePath("/");

  return { ok: true };
}

export async function toggleOrderCompletionAction(
  orderId: string,
): Promise<OrderActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "orders.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const [order] = await deps.db
    .select({ id: orders.id, completedAt: orders.completedAt, terakId: orders.terakId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false, error: "Zakaz topilmadi" };
  }

  const newCompletedAt = order.completedAt ? null : new Date();

  await deps.db
    .update(orders)
    .set({ completedAt: newCompletedAt, updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "order.toggled",
    target: { type: "orders", id: order.id },
    metadata: { isCompleted: newCompletedAt !== null },
  });

  revalidatePath("/orders");
  revalidatePath(`/teraks/${order.terakId}`);
  revalidatePath("/");

  return { ok: true };
}

export async function deleteOrderAction(
  orderId: string,
): Promise<OrderActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "orders.manage")) {
    return { ok: false, error: "Zakazni o'chirish uchun ruxsat yo'q" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const [order] = await deps.db
    .select({ id: orders.id, terakId: orders.terakId })
    .from(orders)
    .where(eq(orders.id, orderId))
    .limit(1);

  if (!order) {
    return { ok: false, error: "Zakaz topilmadi" };
  }

  await deps.db.delete(orders).where(eq(orders.id, orderId));

  await tenantAudit.record(deps.db, {
    actor: { type: "user", id: user.id, name: user.name },
    action: "order.deleted",
    target: { type: "orders", id: order.id },
    metadata: { terakId: order.terakId },
  });

  revalidatePath("/orders");
  revalidatePath(`/teraks/${order.terakId}`);
  revalidatePath("/");

  return { ok: true };
}

export async function markOrderNotifiedAction(
  orderId: string,
  type: "ready" | "due_soon",
): Promise<OrderActionResult> {
  const { user } = await requireUser();
  if (!can(user.role, "orders.manage")) {
    return { ok: false, error: "Ruxsat yo'q" };
  }

  const { deps } = await currentDeps();
  if (!deps) {
    return { ok: false, error: "Sessiya xatosi" };
  }

  const updateFields: { readyNotifiedAt?: Date; dueNotifiedAt?: Date } = {};
  if (type === "ready") {
    updateFields.readyNotifiedAt = new Date();
  } else {
    updateFields.dueNotifiedAt = new Date();
  }

  await deps.db
    .update(orders)
    .set(updateFields)
    .where(eq(orders.id, orderId));

  revalidatePath("/orders");
  return { ok: true };
}

export async function getOrdersList(
  db: NonNullable<Awaited<ReturnType<typeof currentDeps>>["deps"]>["db"],
  filters?: {
    terakId?: string;
    completedOnly?: boolean;
    activeOnly?: boolean;
  },
) {
  const conditions = [];
  if (filters?.terakId) {
    conditions.push(eq(orders.terakId, filters.terakId));
  }
  if (filters?.completedOnly) {
    conditions.push(isNotNull(orders.completedAt));
  }
  if (filters?.activeOnly) {
    conditions.push(isNull(orders.completedAt));
  }

  const rows = await db
    .select({
      id: orders.id,
      terakId: orders.terakId,
      terakName: teraks.name,
      materialId: orders.materialId,
      materialName: materials.name,
      materialUnit: materials.unit,
      thicknessCm: materials.thicknessCm,
      widthCm: materials.widthCm,
      lengthCm: materials.lengthCm,
      quantity: orders.quantity,
      customerName: orders.customerName,
      phone: orders.phone,
      address: orders.address,
      dueDate: orders.dueDate,
      completedAt: orders.completedAt,
      readyNotifiedAt: orders.readyNotifiedAt,
      dueNotifiedAt: orders.dueNotifiedAt,
      createdAt: orders.createdAt,
      stockQuantity: terakMaterials.quantity,
    })
    .from(orders)
    .innerJoin(teraks, eq(teraks.id, orders.terakId))
    .innerJoin(materials, eq(materials.id, orders.materialId))
    .leftJoin(
      terakMaterials,
      and(
        eq(terakMaterials.terakId, orders.terakId),
        eq(terakMaterials.materialId, orders.materialId),
      ),
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(orders.createdAt));

  const today = new Date();

  return rows.map((r) => {
    const qty = Number(r.quantity);
    const stockQty = Number(r.stockQuantity ?? 0);
    const status: OrderStatus = getOrderStatus(
      { quantity: qty, completedAt: r.completedAt },
      stockQty,
    );
    const dueSoon = isOrderDueSoon(r.dueDate, today);

    const vol = pieceVolumeM3({
      thicknessCm: r.thicknessCm ? Number(r.thicknessCm) : null,
      widthCm: r.widthCm ? Number(r.widthCm) : null,
      lengthCm: r.lengthCm ? Number(r.lengthCm) : null,
    });
    const volumeTotalM3 = vol ? Math.round(qty * vol * 1000) / 1000 : null;

    return {
      ...r,
      quantity: qty,
      stockQuantity: stockQty,
      status,
      isDueSoon: dueSoon,
      volumeM3: vol,
      volumeTotalM3,
    };
  });
}
