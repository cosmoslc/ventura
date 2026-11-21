import { notFound } from "next/navigation";
import { ProductDetailClient } from "./detail-client";
import { getDbProductBySlug } from "@/lib/server/products";
import { calcFinalPrice } from "@/lib/calc/formulas";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const row = await getDbProductBySlug(slug);
  if (!row || !row.isActive) notFound();

  return (
    <ProductDetailClient
      product={{
        id: row.id,
        slug: row.slug,
        name: row.name,
        brandName: row.brandName,
        categoryName: row.categoryName,
        sku: row.sku,
        price: calcFinalPrice(row.sellPrice, row.discountPercent),
        originalPrice: row.discountPercent > 0 ? row.sellPrice : undefined,
        discountPercent: row.discountPercent,
        stock: Math.max(0, row.stock - (row.reserved ?? 0)),
        ratingAvg: row.ratingAvg,
        ratingCount: row.ratingCount,
        description: row.desc,
        images: row.images.length ? row.images : ["/product-placeholder.svg"],
        // Variant inventory is not part of checkout's stock reservation yet.
        variants: [],
        specs: row.specs,
      }}
    />
  );
}
