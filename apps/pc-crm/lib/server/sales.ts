import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import {
  sales,
  saleItems,
  products,
  stockMovements,
  type I18nText,
  type SaleSource,
  type SaleType,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface SaleItemView {
  id: string;
  source: "site" | "offline";
  type: "product" | "pc";
  productName: string;
  buyerName: string;
  buyerPhone: string;
  qty: number;
  listPrice: bigint;
  soldPrice: bigint;
  costSnapshot: bigint;
  profit: bigint;
  marginPercent: number;
  soldAt: string;
  voidedAt?: string;
}

export async function getDbSales(): Promise<SaleItemView[]> {
  const db = getDb();

  const salesRows = await db
    .select()
    .from(sales)
    .orderBy(desc(sales.soldAt));

  if (salesRows.length === 0) return [];

  const saleIds = salesRows.map((s) => s.id);

  const items = await db
    .select({
      item: saleItems,
      prod: products,
    })
    .from(saleItems)
    .leftJoin(products, eq(saleItems.productId, products.id))
    .where(sql`${saleItems.saleId} IN ${saleIds}`);

  const itemMap = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemMap.get(it.item.saleId) ?? [];
    list.push(it);
    itemMap.set(it.item.saleId, list);
  }

  const result: SaleItemView[] = [];

  for (const s of salesRows) {
    const sItems = itemMap.get(s.id) ?? [];
    const firstItem = sItems[0];
    const name = firstItem?.item.nameSnapshot ??
      ((firstItem?.prod?.name as I18nText)?.uz ?? "Kompyuter / Tovar");

    const totalRevenue = Number(s.total);
    const profitNum = Number(s.profit);
    const margin = totalRevenue > 0 ? Number(((profitNum / totalRevenue) * 100).toFixed(2)) : 0;

    result.push({
      id: s.id,
      source: s.source as "site" | "offline",
      type: s.type as "product" | "pc",
      productName: name,
      buyerName: s.buyerName,
      buyerPhone: s.buyerPhone,
      qty: firstItem?.item.qty ?? 1,
      listPrice: firstItem?.item.listPrice ?? s.total,
      soldPrice: firstItem?.item.soldPrice ?? s.total,
      costSnapshot: s.costTotal,
      profit: s.profit,
      marginPercent: margin,
      soldAt: s.soldAt.toISOString().slice(0, 10),
      voidedAt: s.voidedAt?.toISOString(),
    });
  }

  return result;
}

export async function createDbSale(input: {
  source: SaleSource;
  type: SaleType;
  productId?: string;
  productName: string;
  buyerName: string;
  buyerPhone: string;
  qty: number;
  listPrice: bigint;
  soldPrice: bigint;
  costSnapshot: bigint;
  profit: bigint;
  soldAt?: string;
}) {
  const db = getDb();
  const totalRevenue = input.soldPrice * BigInt(input.qty);
  const totalCost = input.costSnapshot * BigInt(input.qty);
  const netProfit = totalRevenue > totalCost ? totalRevenue - totalCost : 0n;

  const [newSale] = await db
    .insert(sales)
    .values({
      source: input.source,
      type: input.type,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      soldAt: input.soldAt ? new Date(input.soldAt) : new Date(),
      total: totalRevenue,
      costTotal: totalCost,
      profit: netProfit,
    })
    .returning();

  if (newSale) {
    await db.insert(saleItems).values({
      saleId: newSale.id,
      productId: input.productId,
      nameSnapshot: input.productName,
      qty: input.qty,
      listPrice: input.listPrice,
      soldPrice: input.soldPrice,
      costSnapshot: input.costSnapshot,
      profit: netProfit,
    });

    if (input.productId) {
      await db
        .update(products)
        .set({
          stock: sql`GREATEST(0, ${products.stock} - ${input.qty})`,
          soldCount: sql`${products.soldCount} + ${input.qty}`,
        })
        .where(eq(products.id, input.productId));

      await db.insert(stockMovements).values({
        productId: input.productId,
        reason: "sale",
        delta: -input.qty,
        refType: "order",
        refId: newSale.id,
      });
    }
  }

  return newSale;
}

export async function voidDbSale(id: string) {
  const db = getDb();

  const [sale] = await db
    .select()
    .from(sales)
    .where(eq(sales.id, id))
    .limit(1);

  if (!sale || sale.voidedAt) return null;

  const [updated] = await db
    .update(sales)
    .set({ voidedAt: new Date() })
    .where(eq(sales.id, id))
    .returning();

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id));

  for (const it of items) {
    if (it.productId) {
      await db
        .update(products)
        .set({
          stock: sql`${products.stock} + ${it.qty}`,
          soldCount: sql`GREATEST(0, ${products.soldCount} - ${it.qty})`,
        })
        .where(eq(products.id, it.productId));

      await db.insert(stockMovements).values({
        productId: it.productId,
        reason: "return",
        delta: it.qty,
        refType: "order",
        refId: sale.id,
      });
    }
  }

  return updated;
}
