import "server-only";
import { and, eq, desc, ne, sql } from "drizzle-orm";
import { purchases, products, stockMovements, type I18nText, type PurchaseType } from "@ventura/db/schema/pc-crm";
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
  if (!Number.isInteger(input.qty) || input.qty <= 0 || input.totalCost < 0n) {
    throw new Error("Kirim ma'lumotlari noto'g'ri");
  }
  const unitCost = input.totalCost / BigInt(input.qty);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(purchases)
      .values({
        productId: input.productId,
        type: input.type,
        qty: input.qty,
        totalCost: input.totalCost,
        unitCost,
        supplier: input.supplier,
        note: input.note,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : new Date(),
      })
      .returning();
    if (!row) throw new Error("Kirim yozilmadi");
    const [updated] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} + ${input.qty}`, costPrice: unitCost })
      .where(eq(products.id, input.productId))
      .returning({ id: products.id });
    if (!updated) throw new Error("Mahsulot topilmadi");
    await tx.insert(stockMovements).values({
      productId: input.productId,
      reason: "purchase",
      delta: input.qty,
      refType: "purchase",
      refId: row.id,
    });
    return row;
  });
}

export async function voidDbPurchase(id: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [pur] = await tx.select().from(purchases).where(eq(purchases.id, id)).for("update");
    if (!pur || pur.voidedAt) return null;
    const [updatedProduct] = await tx
      .update(products)
      .set({ stock: sql`${products.stock} - ${pur.qty}` })
      .where(and(eq(products.id, pur.productId), sql`${products.stock} - ${products.reserved} >= ${pur.qty}`))
      .returning({ id: products.id });
    if (!updatedProduct) throw new Error("Kirimni bekor qilib bo'lmaydi: mahsulotning bir qismi band yoki sotilgan");
    const [updated] = await tx
      .update(purchases)
      .set({ voidedAt: new Date() })
      .where(and(eq(purchases.id, id), sql`${purchases.voidedAt} IS NULL`))
      .returning();
    const [latestPurchase] = await tx
      .select({ unitCost: purchases.unitCost })
      .from(purchases)
      .where(and(eq(purchases.productId, pur.productId), ne(purchases.id, pur.id), sql`${purchases.voidedAt} IS NULL`))
      .orderBy(desc(purchases.purchasedAt))
      .limit(1);
    if (latestPurchase)
      await tx.update(products).set({ costPrice: latestPurchase.unitCost }).where(eq(products.id, pur.productId));
    await tx.insert(stockMovements).values({
      productId: pur.productId,
      reason: "adjust",
      delta: -pur.qty,
      refType: "purchase",
      refId: pur.id,
    });
    return updated;
  });
}
