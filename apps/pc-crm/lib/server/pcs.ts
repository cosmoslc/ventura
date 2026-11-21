import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import {
  categories,
  pcBuilds,
  pcComponents,
  pcSpecs,
  pcOrders,
  pcOrderItems,
  sales,
  saleItems,
  stockMovements,
  products,
  productImages,
  brands,
  type I18nText,
  type PcBuildStatus,
  type PcOrderStatus,
  type PcComponentRole,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";
import { calcFinalPrice } from "../calc/formulas";
import type { PcBuildItem, PcComponentItem, PcSpecItem, ConfiguratorPart, PcOrderItem } from "../pc-data";

type PcBuildMutationInput = {
  id?: string;
  slug: string;
  name: string;
  images: string[];
  sellPrice: bigint;
  discountPercent: number;
  status: Extract<PcBuildStatus, "available" | "hidden">;
  components: { role: PcComponentRole; productId: string; qty: number }[];
  specs: { key: string; title: string; value: string; filterable?: boolean; helpTitle?: string; helpText?: string }[];
};

export async function saveDbPcBuild(input: PcBuildMutationInput) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const oldBuild = input.id
      ? (await tx.select().from(pcBuilds).where(eq(pcBuilds.id, input.id)).for("update"))[0]
      : undefined;
    if (input.id && !oldBuild) throw new Error("PC build topilmadi");
    if (oldBuild?.status === "sold") throw new Error("Sotilgan PC build tahrirlanmaydi");

    const oldComponents = oldBuild
      ? await tx.select().from(pcComponents).where(eq(pcComponents.pcId, oldBuild.id))
      : [];
    const oldQty = new Map<string, number>();
    for (const item of oldComponents) oldQty.set(item.productId, (oldQty.get(item.productId) ?? 0) + item.qty);
    const newQty = new Map<string, number>();
    for (const item of input.components) newQty.set(item.productId, (newQty.get(item.productId) ?? 0) + item.qty);
    const productIds = [...new Set([...oldQty.keys(), ...newQty.keys()])].sort();
    const productRows = new Map<string, typeof products.$inferSelect>();
    for (const productId of productIds) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product || !product.isActive) throw new Error("PC komponenti topilmadi yoki faol emas");
      const delta = (newQty.get(productId) ?? 0) - (oldQty.get(productId) ?? 0);
      if (delta > 0 && product.stock - product.reserved < delta)
        throw new Error("PC yig'ish uchun komponent qoldig'i yetarli emas");
      productRows.set(productId, product);
    }

    const costPrice = input.components.reduce(
      (total, item) => total + (productRows.get(item.productId)?.costPrice ?? 0n) * BigInt(item.qty),
      0n,
    );
    const values = {
      slug: input.slug,
      name: { uz: input.name },
      images: input.images,
      costPrice,
      sellPrice: input.sellPrice,
      discountPercent: input.discountPercent,
      status: input.status,
    };
    const build = oldBuild
      ? (await tx.update(pcBuilds).set(values).where(eq(pcBuilds.id, oldBuild.id)).returning())[0]
      : (await tx.insert(pcBuilds).values(values).returning())[0];
    if (!build) throw new Error("PC build saqlanmadi");

    for (const productId of productIds) {
      const delta = (newQty.get(productId) ?? 0) - (oldQty.get(productId) ?? 0);
      if (!delta) continue;
      await tx
        .update(products)
        .set({ reserved: sql`${products.reserved} + ${delta}` })
        .where(eq(products.id, productId));
      await tx.insert(stockMovements).values({
        productId,
        reason: delta > 0 ? "reserve" : "release",
        delta: -delta,
        refType: "pc_build",
        refId: build.id,
      });
    }

    await tx.delete(pcComponents).where(eq(pcComponents.pcId, build.id));
    if (input.components.length)
      await tx.insert(pcComponents).values(
        input.components.map((item) => ({
          pcId: build.id,
          role: item.role,
          productId: item.productId,
          qty: item.qty,
          costSnapshot: productRows.get(item.productId)!.costPrice,
        })),
      );
    await tx.delete(pcSpecs).where(eq(pcSpecs.pcId, build.id));
    if (input.specs.length)
      await tx.insert(pcSpecs).values(
        input.specs.map((spec) => ({
          pcId: build.id,
          key: spec.key,
          title: { uz: spec.title },
          value: { uz: spec.value },
          filterable: spec.filterable ?? false,
          helpTitle: spec.helpTitle ? { uz: spec.helpTitle } : undefined,
          helpText: spec.helpText ? { uz: spec.helpText } : undefined,
        })),
      );
    return build;
  });
}

export async function sellDbPcBuild(input: { id: string; buyerName: string; buyerPhone: string; soldAt: string }) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [build] = await tx.select().from(pcBuilds).where(eq(pcBuilds.id, input.id)).for("update");
    if (!build || build.status !== "available") throw new Error("PC build sotuvda mavjud emas");
    const components = await tx.select().from(pcComponents).where(eq(pcComponents.pcId, build.id));
    if (!components.length) throw new Error("PC build komponentlari kiritilmagan");
    for (const productId of [...new Set(components.map((component) => component.productId))].sort()) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product) throw new Error("PC komponenti topilmadi");
    }
    for (const component of components) {
      const [updated] = await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${component.qty}`,
          reserved: sql`${products.reserved} - ${component.qty}`,
          soldCount: sql`${products.soldCount} + ${component.qty}`,
        })
        .where(
          and(
            eq(products.id, component.productId),
            sql`${products.stock} >= ${component.qty}`,
            sql`${products.reserved} >= ${component.qty}`,
          ),
        )
        .returning({ id: products.id });
      if (!updated) throw new Error("PC komponentlari uchun zaxira yetarli emas");
      await tx
        .insert(stockMovements)
        .values({
          productId: component.productId,
          reason: "sale",
          delta: -component.qty,
          refType: "pc_build",
          refId: build.id,
        });
    }
    const soldPrice = calcFinalPrice(build.sellPrice, build.discountPercent);
    const costTotal = components.reduce((sum, component) => sum + component.costSnapshot * BigInt(component.qty), 0n);
    const profit = soldPrice - costTotal;
    const [sale] = await tx
      .insert(sales)
      .values({
        source: "offline",
        type: "pc",
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        soldAt: new Date(input.soldAt),
        total: soldPrice,
        costTotal,
        profit,
      })
      .returning();
    if (!sale) throw new Error("PC sotuv yozuvi saqlanmadi");
    await tx.insert(saleItems).values({
      saleId: sale.id,
      pcId: build.id,
      nameSnapshot: (build.name as I18nText)?.uz ?? build.slug,
      qty: 1,
      listPrice: build.sellPrice,
      soldPrice,
      costSnapshot: costTotal,
      profit,
    });
    await tx
      .update(pcBuilds)
      .set({ status: "sold", buyerName: input.buyerName, buyerPhone: input.buyerPhone, soldAt: new Date(input.soldAt) })
      .where(eq(pcBuilds.id, build.id));
    return { saleId: sale.id };
  });
}

export async function getDbPcBuilds(options?: { status?: PcBuildStatus }): Promise<PcBuildItem[]> {
  const db = getDb();

  const builds = options?.status
    ? await db.select().from(pcBuilds).where(eq(pcBuilds.status, options.status)).orderBy(desc(pcBuilds.createdAt))
    : await db.select().from(pcBuilds).orderBy(desc(pcBuilds.createdAt));
  if (builds.length === 0) return [];

  const buildIds = builds.map((b) => b.id);

  // Komponentlarni olish
  const comps = await db
    .select({
      comp: pcComponents,
      prod: products,
    })
    .from(pcComponents)
    .innerJoin(products, eq(pcComponents.productId, products.id))
    .where(sql`${pcComponents.pcId} IN ${buildIds}`);

  // Spetsifikatsiyalarni olish
  const specs = await db
    .select()
    .from(pcSpecs)
    .where(sql`${pcSpecs.pcId} IN ${buildIds}`);

  // Komponentlar xaritasi
  const compMap = new Map<string, PcComponentItem[]>();
  for (const { comp, prod } of comps) {
    const list = compMap.get(comp.pcId) ?? [];
    const prodName = (prod.name as I18nText)?.uz ?? "Komponent";
    list.push({
      role: comp.role as PcComponentItem["role"],
      roleNameUz: getRoleNameUz(comp.role),
      productId: prod.id,
      productName: prodName,
      qty: comp.qty,
      costSnapshot: comp.costSnapshot,
      sellPrice: prod.sellPrice,
      inStock: prod.stock - prod.reserved > 0,
    });
    compMap.set(comp.pcId, list);
  }

  // Specs xaritasi
  const specMap = new Map<string, PcSpecItem[]>();
  for (const s of specs) {
    const list = specMap.get(s.pcId) ?? [];
    list.push({
      key: s.key,
      title: (s.title as I18nText)?.uz ?? s.key,
      value: (s.value as I18nText)?.uz ?? "",
      filterable: s.filterable,
      helpTitle: (s.helpTitle as I18nText)?.uz,
      helpText: (s.helpText as I18nText)?.uz,
    });
    specMap.set(s.pcId, list);
  }

  return builds.map((b) => {
    const bComps = compMap.get(b.id) ?? [];
    const bSpecs = specMap.get(b.id) ?? [];

    const cpuComp = bComps.find((c) => c.role === "cpu")?.productName ?? "Intel / AMD CPU";
    const gpuComp = bComps.find((c) => c.role === "gpu")?.productName ?? "GeForce RTX / Radeon";
    const ramComp = bComps.find((c) => c.role === "ram")?.productName ?? "32GB DDR5";
    const ssdComp = bComps.find((c) => c.role === "ssd")?.productName ?? "1TB / 2TB NVMe SSD";

    return {
      id: b.id,
      slug: b.slug,
      name: (b.name as I18nText)?.uz ?? b.slug,
      images: (b.images as string[]) ?? [],
      costPrice: b.costPrice,
      sellPrice: b.sellPrice,
      discountPercent: b.discountPercent,
      status: b.status as "available" | "sold" | "hidden",
      buyerName: b.buyerName ?? undefined,
      buyerPhone: b.buyerPhone ?? undefined,
      soldAt: b.soldAt?.toISOString(),
      ratingAvg: Number(b.ratingAvg),
      ratingCount: b.ratingCount,
      cpu: cpuComp,
      gpu: gpuComp,
      ram: ramComp,
      storage: ssdComp,
      components: bComps,
      specs: bSpecs,
      description:
        "Ventura muhandislari tomonidan 24 soatlik stress-testdan oʻtkazilgan professional oʻyin kompyuteri.",
      warrantyMonths: 12,
    };
  });
}

export async function getDbPcBuildBySlug(slug: string): Promise<PcBuildItem | null> {
  const all = await getDbPcBuilds();
  return all.find((b) => b.slug === slug) ?? null;
}

export async function getDbConfiguratorParts(): Promise<ConfiguratorPart[]> {
  const db = getDb();

  const prods = await db
    .select({
      prod: products,
      cat: categories,
      brand: brands,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.isActive, true));

  const images = await db.select().from(productImages).orderBy(productImages.sort);

  const imgMap = new Map<string, string>();
  for (const img of images) {
    if (!imgMap.has(img.productId)) {
      imgMap.set(img.productId, img.url);
    }
  }

  const roleMap: Record<string, ConfiguratorPart["role"]> = {
    protsessorlar: "cpu",
    videokartalar: "gpu",
    "ona-platalar": "motherboard",
    "operativ-xotira": "ram",
    "ssd-disklar": "ssd",
    "blok-pitaniya": "psu",
    korpuslar: "case",
    "sovutish-tizimi": "cooler",
  };

  const parts: ConfiguratorPart[] = [];

  for (const { prod, cat, brand } of prods) {
    const role = roleMap[cat.slug];
    if (!role) continue;

    parts.push({
      id: prod.id,
      role,
      roleLabel: getRoleNameUz(role),
      name: (prod.name as I18nText)?.uz ?? "Komponent",
      brand: brand?.name ?? "Ventura",
      price: prod.sellPrice,
      costPrice: prod.costPrice,
      stock: prod.stock - prod.reserved,
      imageUrl: imgMap.get(prod.id) ?? "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
      specsSummary: (prod.desc as I18nText)?.uz ?? "",
    });
  }

  return parts;
}

export async function getDbPcOrders(): Promise<PcOrderItem[]> {
  const db = getDb();

  const orders = await db
    .select({
      order: pcOrders,
      build: pcBuilds,
    })
    .from(pcOrders)
    .leftJoin(pcBuilds, eq(pcOrders.convertedPcId, pcBuilds.id))
    .orderBy(desc(pcOrders.createdAt));

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.order.id);

  const items = await db
    .select({
      item: pcOrderItems,
      prod: products,
    })
    .from(pcOrderItems)
    .innerJoin(products, eq(pcOrderItems.productId, products.id))
    .where(sql`${pcOrderItems.pcOrderId} IN ${orderIds}`);

  const itemMap = new Map<string, typeof items>();
  for (const it of items) {
    const list = itemMap.get(it.item.pcOrderId) ?? [];
    list.push(it);
    itemMap.set(it.item.pcOrderId, list);
  }

  // Barcha tayyor buildlar va komponentlar (agar convertedPcId ulanmagan bo'lsa)
  const allBuilds = await db.select().from(pcBuilds);
  const allBuildComps = await db.select().from(pcComponents);

  return orders.map(({ order: o, build: b }) => {
    const oItems = itemMap.get(o.id) ?? [];
    const costTotal = oItems.reduce((sum, it) => sum + it.prod.costPrice * BigInt(it.item.qty), 0n);

    let pcName = "";
    if (b?.name) {
      pcName = (b.name as I18nText)?.uz ?? (b.name as I18nText)?.ru ?? "";
    }

    if (!pcName) {
      // Komponentlar (CPU & GPU) bo'yicha mos keluvchi tayyor PC nomini qidirish
      const cpuItem = oItems.find((it) => it.item.role === "cpu");
      const gpuItem = oItems.find((it) => it.item.role === "gpu");

      if (cpuItem && gpuItem) {
        for (const build of allBuilds) {
          const comps = allBuildComps.filter((c) => c.pcId === build.id);
          const hasCpu = comps.some((c) => c.role === "cpu" && c.productId === cpuItem.item.productId);
          const hasGpu = comps.some((c) => c.role === "gpu" && c.productId === gpuItem.item.productId);
          if (hasCpu && hasGpu) {
            pcName = (build.name as I18nText)?.uz ?? (build.name as I18nText)?.ru ?? "";
            break;
          }
        }
      }
    }

    if (!pcName) {
      pcName = "Custom PC Build";
    }

    return {
      id: o.id,
      orderNumber: `PCO-${o.id.slice(0, 8).toUpperCase()}`,
      customerName: o.name,
      customerPhone: o.phone,
      deliveryAddress: o.address ?? "Toshkent shahri",
      customerNote: o.note ?? undefined,
      status: o.status as PcOrderItem["status"],
      quotedPrice: o.quotedPrice ?? undefined,
      costPrice: costTotal,
      createdAt: o.createdAt.toISOString().slice(0, 10),
      operatorNote: o.note ?? undefined,
      pcName,
      components: oItems.map((it) => ({
        role: it.item.role,
        roleNameUz: getRoleNameUz(it.item.role),
        productName: (it.prod.name as I18nText)?.uz ?? "Komponent",
        price: it.prod.sellPrice,
        costPrice: it.prod.costPrice,
        inStock: it.prod.stock - it.prod.reserved > 0,
      })),
    };
  });
}

export async function createDbPcOrder(input: {
  userId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  customerNote?: string;
  componentIds: { role: string; productId: string }[];
}) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const qtyByProduct = new Map<string, number>();
    for (const item of input.componentIds)
      qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + 1);
    for (const productId of [...qtyByProduct.keys()].sort()) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product || !product.isActive || product.stock - product.reserved < (qtyByProduct.get(productId) ?? 0)) {
        throw new Error("Tanlangan komponentlardan biri sotuvda yoki yetarli qoldiqda emas");
      }
    }
    const [order] = await tx
      .insert(pcOrders)
      .values({
        name: input.customerName,
        phone: input.customerPhone,
        address: input.deliveryAddress,
        note: input.customerNote,
        userId: input.userId,
        status: "new",
      })
      .returning();
    if (!order) throw new Error("PC buyurtmasi yozilmadi");
    if (input.componentIds.length)
      await tx.insert(pcOrderItems).values(
        input.componentIds.map((component) => ({
          pcOrderId: order.id,
          role: component.role as PcComponentRole,
          productId: component.productId,
          qty: 1,
        })),
      );
    return order;
  });
}

export async function updateDbPcOrderStatus(
  id: string,
  status: PcOrderStatus,
  quotedPrice?: bigint,
  operatorNote?: string,
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(pcOrders).where(eq(pcOrders.id, id)).for("update");
    if (!order) throw new Error("PC buyurtmasi topilmadi");
    const statusChanged = order.status !== status;
    if (quotedPrice !== undefined && quotedPrice < 0n) throw new Error("Taklif narxi noto'g'ri");

    const items = await tx.select().from(pcOrderItems).where(eq(pcOrderItems.pcOrderId, id));
    if (!items.length) throw new Error("PC buyurtmasida komponentlar yo'q");
    const qtyByProduct = new Map<string, number>();
    for (const item of items) qtyByProduct.set(item.productId, (qtyByProduct.get(item.productId) ?? 0) + item.qty);
    const productRows = new Map<string, typeof products.$inferSelect>();

    // Lock products in stable order so concurrent orders cannot oversell or deadlock.
    for (const productId of [...qtyByProduct.keys()].sort()) {
      const [product] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
      if (!product) throw new Error("PC buyurtmasi komponenti topilmadi");
      productRows.set(productId, product);
    }

    const isReservedState = (s: string) => ["confirmed", "assembling", "ready"].includes(s);
    const wasReserved = isReservedState(order.status);
    const willBeReserved = isReservedState(status);

    // 1. Zaxiraga o'tkazish
    if (statusChanged && !wasReserved && willBeReserved && order.status !== "delivered") {
      for (const [productId, qty] of qtyByProduct) {
        const product = productRows.get(productId)!;
        if (!product.isActive || product.stock - product.reserved < qty) {
          throw new Error("Komponentlardan birining mavjud qoldig'i yetarli emas");
        }
        await tx
          .update(products)
          .set({ reserved: sql`${products.reserved} + ${qty}` })
          .where(eq(products.id, productId));
        await tx
          .insert(stockMovements)
          .values({ productId, reason: "reserve", delta: -qty, refType: "pc_order", refId: id });
      }
    }

    // 2. Zaxirani bekor qilish / bo'shatish
    if (statusChanged && wasReserved && !willBeReserved && status !== "delivered") {
      for (const [productId, qty] of qtyByProduct) {
        await tx
          .update(products)
          .set({ reserved: sql`GREATEST(0, ${products.reserved} - ${qty})` })
          .where(eq(products.id, productId));
        await tx
          .insert(stockMovements)
          .values({ productId, reason: "release", delta: qty, refType: "pc_order", refId: id });
      }
    }

    // 3. Yetkazildi (sotuvga aylantirish)
    if (statusChanged && status === "delivered" && order.status !== "delivered") {
      let costTotal = 0n;
      let listTotal = 0n;
      for (const [productId, qty] of qtyByProduct) {
        const product = productRows.get(productId)!;
        costTotal += product.costPrice * BigInt(qty);
        listTotal += product.sellPrice * BigInt(qty);
      }
      const finalQuote = quotedPrice ?? order.quotedPrice ?? (listTotal > 0n ? listTotal : costTotal);
      const [sale] = await tx
        .insert(sales)
        .values({
          source: "site",
          type: "pc",
          buyerName: order.name,
          buyerPhone: order.phone,
          total: finalQuote,
          costTotal,
          profit: finalQuote - costTotal,
        })
        .returning();
      if (!sale) throw new Error("PC savdosi jurnalga yozilmadi");

      let allocated = 0n;
      for (const [index, item] of items.entries()) {
        const product = productRows.get(item.productId)!;
        const listPrice = product.sellPrice * BigInt(item.qty);
        const soldPrice =
          index === items.length - 1
            ? finalQuote - allocated
            : listTotal > 0n
              ? (finalQuote * listPrice) / listTotal
              : finalQuote / BigInt(items.length);
        allocated += soldPrice;
        const costSnapshot = product.costPrice * BigInt(item.qty);
        await tx.insert(saleItems).values({
          saleId: sale.id,
          productId: item.productId,
          nameSnapshot: (product.name as I18nText)?.uz ?? "Komponent",
          qty: item.qty,
          listPrice,
          soldPrice,
          costSnapshot,
          profit: soldPrice - costSnapshot,
        });
      }

      for (const [productId, qty] of qtyByProduct) {
        if (wasReserved) {
          await tx
            .update(products)
            .set({
              stock: sql`GREATEST(0, ${products.stock} - ${qty})`,
              reserved: sql`GREATEST(0, ${products.reserved} - ${qty})`,
              soldCount: sql`${products.soldCount} + ${qty}`,
            })
            .where(eq(products.id, productId));
        } else {
          await tx
            .update(products)
            .set({
              stock: sql`GREATEST(0, ${products.stock} - ${qty})`,
              soldCount: sql`${products.soldCount} + ${qty}`,
            })
            .where(eq(products.id, productId));
        }
        await tx
          .insert(stockMovements)
          .values({ productId, reason: "sale", delta: -qty, refType: "pc_order", refId: id });
      }
    }

    await tx
      .update(pcOrders)
      .set({
        status,
        quotedPrice: quotedPrice ?? undefined,
        note: operatorNote ?? undefined,
      })
      .where(eq(pcOrders.id, id));
    return { unchanged: !statusChanged };
  });
}

function getRoleNameUz(role: string): string {
  const map: Record<string, string> = {
    cpu: "Protsessor (CPU)",
    gpu: "Videokarta (GPU)",
    motherboard: "Ona plata (Motherboard)",
    ram: "Operativ xotira (RAM)",
    ssd: "SSD toʻplovchi",
    psu: "Blok pitaniya (PSU)",
    cooler: "Sovutish tizimi (Cooler)",
    case: "Korpus (Case)",
    monitor: "Monitor",
    other: "Qoʻshimcha",
  };
  return map[role] ?? role;
}
