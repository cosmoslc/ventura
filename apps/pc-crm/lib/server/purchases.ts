import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import {
  purchases,
  products,
  stockMovements,
  type I18nText,
  type PurchaseType,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface PurchaseItemView {
  id: string;
  productId: string;
  productName: string;
  type: "piece" | "bulk";
  qty: number;
  totalCost: bigint;
  unitCost: bigint;
  supplier?: string;
  purchasedAt: string;
  note?: string;
  voidedAt?: string;
}

export async function getDbPurchases(): Promise<PurchaseItemView[]> {
  const db = getDb();

  const rows = await db
    .select({
      pur: purchases,
      prod: products,
    })
    .from(purchases)
    .innerJoin(products, eq(purchases.productId, products.id))
    .orderBy(desc(purchases.purchasedAt));

  return rows.map(({ pur, prod }) => ({
    id: pur.id,
    productId: pur.productId,
    productName: (prod.name as I18nText)?.uz ?? "Mahsulot",
    type: pur.type as "piece" | "bulk",
    qty: pur.qty,
    totalCost: pur.totalCost,
    unitCost: pur.unitCost,
    supplier: pur.supplier ?? undefined,
    purchasedAt: pur.purchasedAt.toISOString().slice(0, 10),
    note: pur.note ?? undefined,
    voidedAt: pur.voidedAt?.toISOString(),
  }));
}

export async function createDbPurchase(input: {
  productId: string;
  type: PurchaseType;
  qty: number;
  totalCost: bigint;
  unitCost: bigint;
  supplier?: string;
  purchasedAt?: string;
  note?: string;
}) {
  const db = getDb();

  const [row] = await db
    .insert(purchases)
    .values({
      productId: input.productId,
      type: input.type,
      qty: input.qty,
      totalCost: input.totalCost,
      unitCost: input.unitCost,
      supplier: input.supplier,
      note: input.note,
      purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : new Date(),
    })
    .returning();

  // Mahsulot qoldig'i va tannarxini yangilash
  await db
    .update(products)
    .set({
      stock: sql`${products.stock} + ${input.qty}`,
      costPrice: input.unitCost,
    })
    .where(eq(products.id, input.productId));

  // Ombor harakati
  if (row) {
    await db.insert(stockMovements).values({
      productId: input.productId,
      reason: "purchase",
      delta: input.qty,
      refType: "purchase",
      refId: row.id,
    });
  }

  return row;
}

export async function voidDbPurchase(id: string) {
  const db = getDb();

  const [pur] = await db
    .select()
    .from(purchases)
    .where(eq(purchases.id, id))
    .limit(1);

  if (!pur || pur.voidedAt) return null;

  // Bekor qilish belgisini qo'yish
  const [updated] = await db
    .update(purchases)
    .set({ voidedAt: new Date() })
    .where(eq(purchases.id, id))
    .returning();

  // Mahsulot qoldig'ini qaytarish
  await db
    .update(products)
    .set({
      stock: sql`GREATEST(0, ${products.stock} - ${pur.qty})`,
    })
    .where(eq(products.id, pur.productId));

  await db.insert(stockMovements).values({
    productId: pur.productId,
    reason: "adjust",
    delta: -pur.qty,
    refType: "purchase",
    refId: pur.id,
  });

  return updated;
}
