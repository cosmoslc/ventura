import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
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
    const names = [...new Set(sItems.map(({ item, prod }) =>
      item.nameSnapshot ?? ((prod?.name as I18nText)?.uz ?? "Kompyuter / Tovar")
    ))];
    const name = names.length > 2 ? `${names.slice(0, 2).join(", ")} va yana ${names.length - 2} ta` : names.join(", ") || "Kompyuter / Tovar";

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
      qty: sItems.reduce((sum, item) => sum + item.item.qty, 0) || 1,
      listPrice: sItems.reduce((sum, item) => sum + item.item.listPrice * BigInt(item.item.qty), 0n) || s.total,
      soldPrice: s.total,
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
  return db.transaction(async (tx) => {
    let product: typeof products.$inferSelect | undefined;
    let costSnapshot = input.costSnapshot;
    let productName = input.productName;
    let listPrice = input.listPrice;
    if (input.productId) {
      const [row] = await tx.select().from(products).where(eq(products.id, input.productId)).for("update");
      if (!row || !row.isActive) throw new Error("Mahsulot topilmadi");
      product = row;
      costSnapshot = row.costPrice;
      productName = (row.name as I18nText)?.uz ?? "Mahsulot";
      listPrice = row.sellPrice;
    }
    const totalRevenue = input.soldPrice * BigInt(input.qty);
    const totalCost = costSnapshot * BigInt(input.qty);
    const netProfit = totalRevenue - totalCost;
    const [newSale] = await tx.insert(sales).values({
      source: input.source,
      type: input.type,
      buyerName: input.buyerName,
      buyerPhone: input.buyerPhone,
      soldAt: input.soldAt ? new Date(input.soldAt) : new Date(),
      total: totalRevenue,
      costTotal: totalCost,
      profit: netProfit,
    }).returning();
    if (!newSale) throw new Error("Sotuv yozilmadi");

    if (product) {
      const [updated] = await tx.update(products).set({
        stock: sql`${products.stock} - ${input.qty}`,
        soldCount: sql`${products.soldCount} + ${input.qty}`,
      }).where(and(
        eq(products.id, product.id),
        sql`${products.stock} - ${products.reserved} >= ${input.qty}`,
      )).returning({ id: products.id });
      if (!updated) throw new Error("Sotuv uchun qoldiq yetarli emas");
    }
    await tx.insert(saleItems).values({
      saleId: newSale.id,
      productId: input.productId,
      nameSnapshot: productName,
      qty: input.qty,
      listPrice,
      soldPrice: input.soldPrice,
      costSnapshot,
      profit: netProfit,
    });
    if (input.productId) await tx.insert(stockMovements).values({
      productId: input.productId,
      reason: "sale",
      delta: -input.qty,
      refType: "sale",
      refId: newSale.id,
    });
    return newSale;
  });
}

export async function voidDbSale(id: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [sale] = await tx.select().from(sales).where(eq(sales.id, id)).for("update");
    if (!sale || sale.voidedAt) return null;
    if (sale.orderId) throw new Error("Sayt buyurtmasi sotuvini buyurtma qaytarish oqimi orqali tuzatish kerak");
    const items = await tx.select().from(saleItems).where(eq(saleItems.saleId, id));
    for (const item of items) {
      if (!item.productId) continue;
      await tx.update(products).set({
        stock: sql`${products.stock} + ${item.qty}`,
        soldCount: sql`GREATEST(0, ${products.soldCount} - ${item.qty})`,
      }).where(eq(products.id, item.productId));
      await tx.insert(stockMovements).values({
        productId: item.productId,
        reason: "return",
        delta: item.qty,
        refType: "sale",
        refId: sale.id,
      });
    }
    const [updated] = await tx.update(sales).set({ voidedAt: new Date() })
      .where(and(eq(sales.id, id), sql`${sales.voidedAt} IS NULL`)).returning();
    return updated;
  });
}
