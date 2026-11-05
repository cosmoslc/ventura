import "server-only";
import { eq, desc, and, ilike, sql } from "drizzle-orm";
import {
  brands,
  categories,
  products,
  productImages,
  productSpecs,
  productVariants,
  type I18nText,
} from "@ventura/db/schema/pc-crm";
import { getDb } from "../db";

export interface DbProductListItem {
  id: string;
  slug: string;
  name: string;
  nameRu?: string;
  desc?: string;
  categorySlug: string;
  categoryName: string;
  brandName?: string;
  sku?: string;
  imageUrl: string;
  costPrice: bigint;
  sellPrice: bigint;
  marginPercent?: number;
  discountPercent: number;
  stock: number;
  availableStock: number;
  minStock: number;
  ratingAvg: number;
  ratingCount: number;
  isNew: boolean;
  isHit: boolean;
  isActive: boolean;
  variants?: {
    id: string;
    colorName: string;
    colorHex: string;
    stock: number;
  }[];
  specs?: {
    key: string;
    title: string;
    value: string;
    helpText?: string;
  }[];
}

export async function getDbProducts(options?: {
  categorySlug?: string;
  brandSlug?: string;
  isHit?: boolean;
  isNew?: boolean;
  includeInactive?: boolean;
  search?: string;
  limit?: number;
}): Promise<DbProductListItem[]> {
  const db = getDb();

  const conditions = options?.includeInactive ? [] : [eq(products.isActive, true)];

  if (options?.categorySlug) {
    const cat = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, options.categorySlug))
      .limit(1);
    if (cat[0]) {
      conditions.push(eq(products.categoryId, cat[0].id));
    }
  }

  if (options?.brandSlug) {
    const br = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, options.brandSlug))
      .limit(1);
    if (br[0]) {
      conditions.push(eq(products.brandId, br[0].id));
    }
  }

  if (options?.isHit !== undefined) {
    conditions.push(eq(products.isHit, options.isHit));
  }

  if (options?.isNew !== undefined) {
    conditions.push(eq(products.isNew, options.isNew));
  }

  const query = db
    .select({
      product: products,
      category: categories,
      brand: brands,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt));

  if (options?.limit) {
    query.limit(options.limit);
  }

  const rows = await query;

  // Rasmlar va variantlarni bir martalik so'rov bilan olish
  const productIds = rows.map((r) => r.product.id);
  const images = productIds.length > 0
    ? await db
        .select()
        .from(productImages)
        .where(sql`${productImages.productId} IN ${productIds}`)
        .orderBy(productImages.sort)
    : [];

  const variants = productIds.length > 0
    ? await db
        .select()
        .from(productVariants)
        .where(sql`${productVariants.productId} IN ${productIds}`)
    : [];
  const specs = productIds.length > 0
    ? await db.select().from(productSpecs).where(sql`${productSpecs.productId} IN ${productIds}`)
    : [];

  const imageMap = new Map<string, string>();
  for (const img of images) {
    if (!imageMap.has(img.productId)) {
      imageMap.set(img.productId, img.url);
    }
  }

  const variantMap = new Map<string, typeof variants>();
  for (const v of variants) {
    const list = variantMap.get(v.productId) ?? [];
    list.push(v);
    variantMap.set(v.productId, list);
  }
  const specMap = new Map<string, typeof specs>();
  for (const spec of specs) {
    const list = specMap.get(spec.productId) ?? [];
    list.push(spec);
    specMap.set(spec.productId, list);
  }

  return rows.map(({ product, category, brand }) => {
    const nameUz = (product.name as I18nText)?.uz ?? "Mahsulot";
    const nameRu = (product.name as I18nText)?.ru;
    const catName = (category.name as I18nText)?.uz ?? category.slug;
    const pVariants = variantMap.get(product.id)?.map((v) => ({
      id: v.id,
      colorName: v.colorName,
      colorHex: v.colorHex,
      stock: v.stock,
    }));

    const cost = Number(product.costPrice);
    const sell = Number(product.sellPrice);
    const margin = sell > 0 ? Number((((sell - cost) / sell) * 100).toFixed(1)) : 0;

    return {
      id: product.id,
      slug: product.slug,
      name: nameUz,
      nameRu,
      desc: (product.desc as I18nText)?.uz,
      categorySlug: category.slug,
      categoryName: catName,
      brandName: brand?.name,
      sku: product.sku ?? undefined,
      imageUrl:
        imageMap.get(product.id) ??
        "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
      costPrice: product.costPrice,
      sellPrice: product.sellPrice,
      marginPercent: margin,
      discountPercent: product.discountPercent,
      stock: product.stock,
      availableStock: Math.max(0, product.stock - product.reserved),
      minStock: product.minStock,
      ratingAvg: Number(product.ratingAvg),
      ratingCount: product.ratingCount,
      isNew: product.isNew,
      isHit: product.isHit,
      isActive: product.isActive,
      variants: pVariants,
      specs: (specMap.get(product.id) ?? []).map((spec) => ({
        key: spec.key,
        title: (spec.title as I18nText)?.uz ?? spec.key,
        value: (spec.value as I18nText)?.uz ?? "",
        helpText: (spec.helpText as I18nText)?.uz,
      })),
    };
  });
}

export async function getDbProductBySlug(slug: string) {
  const db = getDb();

  const [row] = await db
    .select({
      product: products,
      category: categories,
      brand: brands,
    })
    .from(products)
    .innerJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(eq(products.slug, slug))
    .limit(1);

  if (!row) return null;

  const [images, specs, variants] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, row.product.id))
      .orderBy(productImages.sort),
    db
      .select()
      .from(productSpecs)
      .where(eq(productSpecs.productId, row.product.id)),
    db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, row.product.id)),
  ]);

  const { product, category, brand } = row;
  const nameUz = (product.name as I18nText)?.uz ?? "Mahsulot";

  return {
    id: product.id,
    slug: product.slug,
    name: nameUz,
    desc: (product.desc as I18nText)?.uz ?? "",
    categorySlug: category.slug,
    categoryName: (category.name as I18nText)?.uz ?? category.slug,
    brandName: brand?.name ?? "",
    sku: product.sku ?? "",
    costPrice: product.costPrice,
    sellPrice: product.sellPrice,
    discountPercent: product.discountPercent,
    stock: product.stock,
    reserved: product.reserved,
    minStock: product.minStock,
    ratingAvg: Number(product.ratingAvg),
    ratingCount: product.ratingCount,
    isNew: product.isNew,
    isHit: product.isHit,
    isActive: product.isActive,
    images: images.map((img) => img.url),
    variants: variants.map((v) => ({
      id: v.id,
      colorName: v.colorName,
      colorHex: v.colorHex,
      stock: v.stock,
      price: v.price ?? product.sellPrice,
    })),
    specs: specs.map((s) => ({
      key: s.key,
      title: (s.title as I18nText)?.uz ?? s.key,
      value: (s.value as I18nText)?.uz ?? "",
      helpTitle: (s.helpTitle as I18nText)?.uz,
      helpText: (s.helpText as I18nText)?.uz,
    })),
  };
}

export async function createDbProduct(input: {
  slug: string;
  nameUz: string;
  nameRu?: string;
  categorySlug: string;
  brandName?: string;
  sku?: string;
  costPrice: bigint;
  sellPrice: bigint;
  discountPercent?: number;
  stock?: number;
  minStock?: number;
  isNew?: boolean;
  isHit?: boolean;
  isActive?: boolean;
  imageUrl?: string;
  specs?: { key: string; title: string; value: string; helpText?: string }[];
}) {
  const db = getDb();

  // Kategoriya ID topish yoki yaratish
  let [cat] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, input.categorySlug))
    .limit(1);

  if (!cat) {
    [cat] = await db
      .insert(categories)
      .values({
        slug: input.categorySlug,
        name: { uz: input.categorySlug },
      })
      .returning({ id: categories.id });
  }

  // Brend ID topish yoki yaratish
  let brandId: string | undefined;
  if (input.brandName) {
    const brandSlug = input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const [br] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.slug, brandSlug))
      .limit(1);

    if (br) {
      brandId = br.id;
    } else {
      const [newBr] = await db
        .insert(brands)
        .values({
          name: input.brandName,
          slug: brandSlug,
        })
        .returning({ id: brands.id });
      brandId = newBr?.id;
    }
  }

  const [newProd] = await db
    .insert(products)
    .values({
      slug: input.slug,
      categoryId: cat!.id,
      brandId,
      sku: input.sku,
      name: { uz: input.nameUz, ru: input.nameRu },
      costPrice: input.costPrice,
      sellPrice: input.sellPrice,
      discountPercent: input.discountPercent ?? 0,
      stock: input.stock ?? 0,
      minStock: input.minStock ?? 2,
      isNew: input.isNew ?? true,
      isHit: input.isHit ?? false,
      isActive: input.isActive ?? true,
    })
    .returning();

  if (newProd && input.imageUrl) {
    await db.insert(productImages).values({
      productId: newProd.id,
      url: input.imageUrl,
      sort: 0,
    });
  }

  if (newProd && input.specs && input.specs.length > 0) {
    await db.insert(productSpecs).values(
      input.specs.map((s) => ({
        productId: newProd.id,
        key: s.key,
        title: { uz: s.title },
        value: { uz: s.value },
        helpText: s.helpText ? { uz: s.helpText } : undefined,
      }))
    );
  }

  return newProd;
}

export async function updateDbProduct(
  id: string,
  input: Partial<{
    nameRu: string;
    slug: string;
    nameUz: string;
    categorySlug: string;
    brandName: string;
    sku: string;
    costPrice: bigint;
    sellPrice: bigint;
    discountPercent: number;
    stock: number;
    minStock: number;
    isNew: boolean;
    isHit: boolean;
    isActive: boolean;
    imageUrl: string;
    specs: { key: string; title: string; value: string; helpText?: string }[];
  }>
) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};

    if (input.stock !== undefined) {
      const [current] = await tx.select({ reserved: products.reserved }).from(products).where(eq(products.id, id)).for("update");
      if (!current) return undefined;
      if (input.stock < current.reserved) throw new Error("Yangi qoldiq mavjud zaxiradan kam bo'lishi mumkin emas");
    }

    if (input.nameUz !== undefined || input.nameRu !== undefined) {
      const [current] = await tx.select({ name: products.name }).from(products).where(eq(products.id, id)).limit(1);
      if (!current) return undefined;
      const currentName = current.name as I18nText;
      updateData.name = {
        uz: input.nameUz ?? currentName.uz,
        ...(input.nameRu !== undefined ? (input.nameRu ? { ru: input.nameRu } : {}) : currentName.ru ? { ru: currentName.ru } : {}),
      };
    }

    if (input.categorySlug !== undefined) {
      let [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.slug, input.categorySlug)).limit(1);
      if (!category) {
        [category] = await tx.insert(categories).values({ slug: input.categorySlug, name: { uz: input.categorySlug } }).returning({ id: categories.id });
      }
      if (!category) throw new Error("Mahsulot kategoriyasini saqlab bo'lmadi");
      updateData.categoryId = category.id;
    }

    if (input.brandName !== undefined) {
      if (!input.brandName.trim()) {
        updateData.brandId = null;
      } else {
        const brandSlug = input.brandName.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        let [brand] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.slug, brandSlug)).limit(1);
        if (!brand) {
          [brand] = await tx.insert(brands).values({ name: input.brandName.trim(), slug: brandSlug }).returning({ id: brands.id });
        }
        if (!brand) throw new Error("Mahsulot brendini saqlab bo'lmadi");
        updateData.brandId = brand.id;
      }
    }

    if (input.slug !== undefined) updateData.slug = input.slug;
    if (input.sku !== undefined) updateData.sku = input.sku || null;
    if (input.costPrice !== undefined) updateData.costPrice = input.costPrice;
    if (input.sellPrice !== undefined) updateData.sellPrice = input.sellPrice;
    if (input.discountPercent !== undefined) updateData.discountPercent = input.discountPercent;
    if (input.stock !== undefined) updateData.stock = input.stock;
    if (input.minStock !== undefined) updateData.minStock = input.minStock;
    if (input.isNew !== undefined) updateData.isNew = input.isNew;
    if (input.isHit !== undefined) updateData.isHit = input.isHit;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [updated] = await tx.update(products).set(updateData).where(eq(products.id, id)).returning();

    if (updated && input.imageUrl !== undefined) {
      const [firstImage] = await tx
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, id))
        .orderBy(productImages.sort)
        .limit(1);
      if (firstImage && input.imageUrl) {
        await tx.update(productImages).set({ url: input.imageUrl }).where(eq(productImages.id, firstImage.id));
      } else if (firstImage) {
        await tx.delete(productImages).where(eq(productImages.id, firstImage.id));
      } else if (input.imageUrl) {
        await tx.insert(productImages).values({ productId: id, url: input.imageUrl, sort: 0 });
      }
    }

    if (updated && input.specs !== undefined) {
      await tx.delete(productSpecs).where(eq(productSpecs.productId, id));
      if (input.specs.length) {
        await tx.insert(productSpecs).values(input.specs.map((spec) => ({
          productId: id,
          key: spec.key,
          title: { uz: spec.title },
          value: { uz: spec.value },
          helpText: spec.helpText ? { uz: spec.helpText } : undefined,
        })));
      }
    }

    return updated;
  });
}

export async function deleteDbProduct(id: string) {
  const db = getDb();
  return db.delete(products).where(eq(products.id, id));
}
