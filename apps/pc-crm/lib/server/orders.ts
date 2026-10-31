import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import {
  orders,
  orderItems,
  products,
  sales,
  saleItems,
  type OrderStatus,
  type PaymentProvider,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface CreateOrderInput {
  userId?: string;
  name: string;
  phone: string;
  region: string;
  address: string;
  paymentMethod: PaymentProvider;
  note?: string;
  subtotal: bigint;
  shipping: bigint;
  discount?: bigint;
  tax?: bigint;
  total: bigint;
  items: {
    productId: string;
    name: string;
    price: bigint;
    qty: number;
  }[];
}

export async function createDbOrder(input: CreateOrderInput) {
  const db = getDb();
  const publicId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Buyurtmani yaratish
  const [newOrder] = await db
    .insert(orders)
    .values({
      publicId,
      userId: input.userId,
      name: input.name,
      phone: input.phone,
      region: input.region,
      address: input.address,
      subtotal: input.subtotal,
      shipping: input.shipping,
      discount: input.discount ?? 0n,
      tax: input.tax ?? 0n,
      total: input.total,
      paymentMethod: input.paymentMethod,
      note: input.note,
      status: "new",
    })
    .returning();

  if (!newOrder) {
    throw new Error("Buyurtmani yaratishda xatolik yuz berdi");
  }

  // 2. Buyurtma tovarlari va tannarxlarni olish
  let totalCost = 0n;

  for (const item of input.items) {
    // Tovar tannarxini olish
    const [prod] = await db
      .select({ costPrice: products.costPrice, stock: products.stock })
      .from(products)
      .where(eq(products.id, item.productId))
      .limit(1);

    const costSnapshot = prod?.costPrice ?? 0n;
    totalCost += costSnapshot * BigInt(item.qty);

    await db.insert(orderItems).values({
      orderId: newOrder.id,
      productId: item.productId,
      nameSnapshot: item.name,
      priceSnapshot: item.price,
      costSnapshot,
      qty: item.qty,
    });

    // Qoldiqni kamaytirish
    if (prod && prod.stock >= item.qty) {
      await db
        .update(products)
        .set({
          stock: prod.stock - item.qty,
          soldCount: sql`${products.soldCount} + ${item.qty}`,
        })
        .where(eq(products.id, item.productId));
    }
  }

  // 3. Sotuvlar jurnaliga (sales) yozish
  const netProfit = input.total > totalCost ? input.total - totalCost : 0n;

  const [sale] = await db
    .insert(sales)
    .values({
      source: "site",
      type: "product",
      orderId: newOrder.id,
      buyerName: input.name,
      buyerPhone: input.phone,
      total: input.total,
      costTotal: totalCost,
      profit: netProfit,
    })
    .returning();

  if (sale) {
    for (const item of input.items) {
      const [prod] = await db
        .select({ costPrice: products.costPrice })
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);

      const costSnapshot = prod?.costPrice ?? 0n;
      const profit = (item.price - costSnapshot) * BigInt(item.qty);

      await db.insert(saleItems).values({
        saleId: sale.id,
        productId: item.productId,
        nameSnapshot: item.name,
        qty: item.qty,
        listPrice: item.price,
        soldPrice: item.price,
        costSnapshot,
        profit: profit > 0n ? profit : 0n,
      });
    }
  }

  return {
    success: true,
    orderId: newOrder.publicId,
    id: newOrder.id,
  };
}

export async function getDbOrders(limit = 50) {
  const db = getDb();

  const orderRows = await db
    .select()
    .from(orders)
    .orderBy(desc(orders.createdAt))
    .limit(limit);

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

  const orderRows = await db
    .select()
    .from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));

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
  return db
    .update(orders)
    .set({ status })
    .where(eq(orders.id, id));
}
