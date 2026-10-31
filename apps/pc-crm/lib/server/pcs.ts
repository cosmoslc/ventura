import "server-only";
import { eq, desc, sql } from "drizzle-orm";
import {
  categories,
  pcBuilds,
  pcComponents,
  pcSpecs,
  pcOrders,
  pcOrderItems,
  products,
  productImages,
  brands,
  type I18nText,
  type PcBuildStatus,
  type PcOrderStatus,
  type PcComponentRole,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";
import type { PcBuildItem, PcComponentItem, PcSpecItem, ConfiguratorPart, PcOrderItem } from "../pc-data";

export async function getDbPcBuilds(options?: { status?: PcBuildStatus }): Promise<PcBuildItem[]> {
  const db = getDb();

  const query = db
    .select()
    .from(pcBuilds)
    .orderBy(desc(pcBuilds.createdAt));

  if (options?.status) {
    query.where(eq(pcBuilds.status, options.status));
  }

  const builds = await query;
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
      inStock: prod.stock > 0,
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
      description: "Ventura muhandislari tomonidan 24 soatlik stress-testdan oʻtkazilgan professional oʻyin kompyuteri.",
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

  const images = await db
    .select()
    .from(productImages)
    .orderBy(productImages.sort);

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
      stock: prod.stock,
      imageUrl:
        imgMap.get(prod.id) ??
        "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
      specsSummary: (prod.desc as I18nText)?.uz ?? "",
    });
  }

  return parts;
}

export async function getDbPcOrders(): Promise<PcOrderItem[]> {
  const db = getDb();

  const orders = await db
    .select()
    .from(pcOrders)
    .orderBy(desc(pcOrders.createdAt));

  if (orders.length === 0) return [];

  const orderIds = orders.map((o) => o.id);

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

  return orders.map((o, idx) => {
    const oItems = itemMap.get(o.id) ?? [];
    const costTotal = oItems.reduce((sum, it) => sum + it.prod.costPrice * BigInt(it.item.qty), 0n);

    return {
      id: o.id,
      orderNumber: `PCO-2026-${String(90 - idx).padStart(3, "0")}`,
      customerName: o.name,
      customerPhone: o.phone,
      deliveryAddress: o.address ?? "Toshkent shahri",
      customerNote: o.note ?? undefined,
      status: o.status as PcOrderItem["status"],
      quotedPrice: o.quotedPrice ?? undefined,
      costPrice: costTotal,
      createdAt: o.createdAt.toISOString().slice(0, 10),
      operatorNote: o.note ?? undefined,
      components: oItems.map((it) => ({
        role: it.item.role,
        roleNameUz: getRoleNameUz(it.item.role),
        productName: (it.prod.name as I18nText)?.uz ?? "Komponent",
        price: it.prod.sellPrice,
        inStock: it.prod.stock > 0,
      })),
    };
  });
}

export async function createDbPcOrder(input: {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  customerNote?: string;
  componentIds: { role: string; productId: string }[];
}) {
  const db = getDb();

  const [order] = await db
    .insert(pcOrders)
    .values({
      name: input.customerName,
      phone: input.customerPhone,
      address: input.deliveryAddress,
      note: input.customerNote,
      status: "new",
    })
    .returning();

  if (order && input.componentIds.length > 0) {
    await db.insert(pcOrderItems).values(
      input.componentIds.map((c) => ({
        pcOrderId: order.id,
        role: c.role as PcComponentRole,
        productId: c.productId,
        qty: 1,
      }))
    );
  }

  return order;
}

export async function updateDbPcOrderStatus(
  id: string,
  status: PcOrderStatus,
  quotedPrice?: bigint,
  operatorNote?: string
) {
  const db = getDb();
  return db
    .update(pcOrders)
    .set({
      status,
      quotedPrice: quotedPrice ?? undefined,
      note: operatorNote ?? undefined,
    })
    .where(eq(pcOrders.id, id));
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
