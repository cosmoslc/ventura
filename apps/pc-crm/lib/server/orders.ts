import "server-only";
import { and, eq, desc, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  orders,
  orderItems,
  products,
  sales,
  saleItems,
  stockMovements,
  settings,
  shippingRates,
  type OrderStatus,
  type PaymentProvider,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";
import { calcFinalPrice, calcOrderTotal } from "../calc/formulas";

export interface CreateOrderInput {
  userId?: string;
  name: string;
  phone: string;
  region: string;
  address: string;
  paymentMethod: Extract<PaymentProvider, "cod_operator">;
  note?: string;
  items: {
    productId: string;
    qty: number;
  }[];
}

export async function createDbOrder(input: CreateOrderInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const qtyByProduct = new Map<string, number>();
    for (const item of input.items) {
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
    }

    const productRows = new Map<string, typeof products.$inferSelect>();
    for (const productId of [...qtyByProduct.keys()].sort()) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product || !product.isActive) throw new Error("Mahsulot mavjud emas yoki sotuvda emas");
      const requestedQty = qtyByProduct.get(productId) ?? 0;
      if (product.stock - product.reserved < requestedQty) throw new Error("Mahsulot qoldig'i yetarli emas");
      productRows.set(productId, product);
    }

    let subtotal = 0n;
    let discount = 0n;
    const snapshots = input.items.map((item) => {
      const product = productRows.get(item.productId)!;
      const listPrice = product.sellPrice;
      const price = calcFinalPrice(listPrice, product.discountPercent);
      subtotal += listPrice * BigInt(item.qty);
      discount += (listPrice - price) * BigInt(item.qty);
      return {
        productId: item.productId,
        name: (product.name as { uz?: string }).uz ?? "Mahsulot",
        listPrice,
        price,
        cost: product.costPrice,
        qty: item.qty,
      };
    });

    const [shippingRate] = await tx
      .select({ price: shippingRates.price })
      .from(shippingRates)
      .where(and(eq(shippingRates.region, input.region), eq(shippingRates.enabled, true)))
      .limit(1);
    if (!shippingRate) throw new Error("Tanlangan hududga yetkazib berish sozlanmagan");

    const settingRows = await tx
      .select()
      .from(settings)
      .where(inArray(settings.key, ["free_shipping_from", "tax_percent"]));
    const settingMap = new Map(settingRows.map((row) => [row.key, row.value as Record<string, unknown>]));
    const freeFromValue = settingMap.get("free_shipping_from")?.amount;
    const taxPercentValue = settingMap.get("tax_percent")?.percent;
    const freeFrom =
      typeof freeFromValue === "string" && /^\d+$/.test(freeFromValue)
        ? BigInt(freeFromValue)
        : typeof freeFromValue === "number" && Number.isSafeInteger(freeFromValue) && freeFromValue >= 0
          ? BigInt(freeFromValue)
          : 1_000_000n;
    const taxPercent =
      typeof taxPercentValue === "number" && Number.isFinite(taxPercentValue)
        ? Math.min(100, Math.max(0, taxPercentValue))
        : 0;
    const goodsAfterDiscount = subtotal - discount;
    const tax = (goodsAfterDiscount * BigInt(Math.round(taxPercent * 100))) / 10_000n;
    const shipping = goodsAfterDiscount >= freeFrom ? 0n : shippingRate.price;
    const total = calcOrderTotal({ subtotal, discount, tax, shipping });
    const publicId = `ORD-${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

    const [newOrder] = await tx
      .insert(orders)
      .values({
        publicId,
        userId: input.userId,
        name: input.name,
        phone: input.phone,
        region: input.region,
        address: input.address,
        subtotal,
        shipping,
        discount,
        tax,
        total,
        paymentMethod: input.paymentMethod,
        note: input.note,
        status: "new",
      })
      .returning();
    if (!newOrder) throw new Error("Buyurtmani yaratishda xatolik yuz berdi");

    await tx.insert(orderItems).values(
      snapshots.map((item) => ({
        orderId: newOrder.id,
        productId: item.productId,
        nameSnapshot: item.name,
        priceSnapshot: item.price,
        costSnapshot: item.cost,
        qty: item.qty,
      })),
    );

    return { success: true as const, orderId: newOrder.publicId, id: newOrder.id };
  });
}

export async function getDbOrders(limit = 50) {
  const db = getDb();

  const orderRows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(limit);

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);

  const items = await db
    .select()
    .from(orderItems)
    .where(sql`${orderItems.orderId} IN ${orderIds}`);

  const itemMap = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemMap.get(it.orderId) ?? [];
    list.push(it);
    itemMap.set(it.orderId, list);
  }

  return orderRows.map((o) => ({
    id: o.id,
    publicId: o.publicId,
    status: o.status,
    name: o.name,
    phone: o.phone,
    region: o.region,
    address: o.address,
    subtotal: o.subtotal,
    shipping: o.shipping,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    paymentMethod: o.paymentMethod,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    items: (itemMap.get(o.id) ?? []).map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.nameSnapshot,
      price: it.priceSnapshot,
      cost: it.costSnapshot,
      qty: it.qty,
    })),
  }));
}

export async function getDbUserOrders(userId: string) {
  const db = getDb();

  const orderRows = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));

  if (orderRows.length === 0) return [];

  const orderIds = orderRows.map((o) => o.id);

  const items = await db
    .select()
    .from(orderItems)
    .where(sql`${orderItems.orderId} IN ${orderIds}`);

  const itemMap = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemMap.get(it.orderId) ?? [];
    list.push(it);
    itemMap.set(it.orderId, list);
  }

  return orderRows.map((o) => ({
    id: o.id,
    publicId: o.publicId,
    status: o.status,
    name: o.name,
    phone: o.phone,
    region: o.region,
    address: o.address,
    subtotal: o.subtotal,
    shipping: o.shipping,
    discount: o.discount,
    tax: o.tax,
    total: o.total,
    paymentMethod: o.paymentMethod,
    note: o.note,
    createdAt: o.createdAt.toISOString(),
    items: (itemMap.get(o.id) ?? []).map((it) => ({
      id: it.id,
      productId: it.productId,
      name: it.nameSnapshot,
      price: it.priceSnapshot,
      cost: it.costSnapshot,
      qty: it.qty,
    })),
  }));
}

export async function updateDbOrderStatus(id: string, status: OrderStatus) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    if (!order) throw new Error("Buyurtma topilmadi");
    if (order.status === status) return order;

    const allowed: Record<OrderStatus, OrderStatus[]> = {
      new: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };
    if (!allowed[order.status as OrderStatus]?.includes(status)) {
      throw new Error("Buyurtma holatini bu bosqichga o'tkazib bo'lmaydi");
    }

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id));
    const qtyByProduct = new Map<string, number>();
    for (const item of items) {
      if (!item.productId) continue;
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
    }

    if (status === "confirmed") {
      for (const [productId, qty] of [...qtyByProduct.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const [reserved] = await tx
          .update(products)
          .set({ reserved: sql`${products.reserved} + ${qty}` })
          .where(
            and(
              eq(products.id, productId),
              eq(products.isActive, true),
              sql`${products.stock} - ${products.reserved} >= ${qty}`,
            ),
          )
          .returning({ id: products.id });
        if (!reserved) throw new Error("Tasdiqlash uchun mahsulot qoldig'i yetarli emas");
        await tx
          .insert(stockMovements)
          .values({ productId, reason: "reserve", delta: -qty, refType: "order", refId: id });
      }
    }

    if (status === "cancelled" && order.status !== "new") {
      for (const [productId, qty] of [...qtyByProduct.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const [updated] = await tx
          .update(products)
          .set({ reserved: sql`GREATEST(0, ${products.reserved} - ${qty})` })
          .where(and(eq(products.id, productId), sql`${products.reserved} >= ${qty}`))
          .returning({ id: products.id });
        if (!updated) throw new Error("Buyurtma zaxirasini bo'shatib bo'lmadi");
        await tx
          .insert(stockMovements)
          .values({ productId, reason: "release", delta: qty, refType: "order", refId: id });
      }
    }

    if (status === "delivered") {
      for (const [productId, qty] of [...qtyByProduct.entries()].sort(([a], [b]) => a.localeCompare(b))) {
        const [updated] = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${qty}`,
            reserved: sql`${products.reserved} - ${qty}`,
            soldCount: sql`${products.soldCount} + ${qty}`,
          })
          .where(and(eq(products.id, productId), sql`${products.reserved} >= ${qty}`, sql`${products.stock} >= ${qty}`))
          .returning({ id: products.id });
        if (!updated) throw new Error("Yetkazilgan buyurtma zaxirasi mos kelmadi");
        await tx.insert(stockMovements).values({ productId, reason: "sale", delta: -qty, refType: "order", refId: id });
      }

      const costTotal = items.reduce((sum, item) => sum + item.costSnapshot * BigInt(item.qty), 0n);
      const revenue = items.reduce((sum, item) => sum + item.priceSnapshot * BigInt(item.qty), 0n);
      const [sale] = await tx
        .insert(sales)
        .values({
          source: "site",
          type: "product",
          orderId: id,
          buyerName: order.name,
          buyerPhone: order.phone,
          total: revenue,
          costTotal,
          profit: revenue - costTotal,
        })
        .returning();
      if (!sale) throw new Error("Buyurtma sotuvini yaratib bo'lmadi");
      await tx.insert(saleItems).values(
        items.map((item) => ({
          saleId: sale.id,
          productId: item.productId,
          nameSnapshot: item.nameSnapshot,
          qty: item.qty,
          listPrice: item.priceSnapshot,
          soldPrice: item.priceSnapshot,
          costSnapshot: item.costSnapshot,
          profit: (item.priceSnapshot - item.costSnapshot) * BigInt(item.qty),
        })),
      );
    }

    const [updatedOrder] = await tx.update(orders).set({ status }).where(eq(orders.id, id)).returning();
    if (!updatedOrder) throw new Error("Buyurtma holatini yangilab bo'lmadi");
    return updatedOrder;
  });
}
