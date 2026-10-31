"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { type PcBuildCardData, PcCard } from "@/components/storefront/pc-card";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";
import { SAMPLE_PC_BUILDS } from "@/lib/pc-data";

export default function ProfileLikedPage() {
  const { addItem } = useCart();

  const [likedBuilds, setLikedBuilds] = useState<PcBuildCardData[]>([
    {
      id: SAMPLE_PC_BUILDS[0]!.id,
      slug: SAMPLE_PC_BUILDS[0]!.slug,
      name: SAMPLE_PC_BUILDS[0]!.name,
      imageUrl: SAMPLE_PC_BUILDS[0]!.images[0] ?? "",
      cpu: SAMPLE_PC_BUILDS[0]!.cpu,
      gpu: SAMPLE_PC_BUILDS[0]!.gpu,
      ram: SAMPLE_PC_BUILDS[0]!.ram,
      storage: SAMPLE_PC_BUILDS[0]!.storage,
      price: SAMPLE_PC_BUILDS[0]!.sellPrice,
      ratingAvg: SAMPLE_PC_BUILDS[0]!.ratingAvg,
      ratingCount: SAMPLE_PC_BUILDS[0]!.ratingCount,
      isAvailable: true,
    },
    {
      id: SAMPLE_PC_BUILDS[1]!.id,
      slug: SAMPLE_PC_BUILDS[1]!.slug,
      name: SAMPLE_PC_BUILDS[1]!.name,
      imageUrl: SAMPLE_PC_BUILDS[1]!.images[0] ?? "",
      cpu: SAMPLE_PC_BUILDS[1]!.cpu,
      gpu: SAMPLE_PC_BUILDS[1]!.gpu,
      ram: SAMPLE_PC_BUILDS[1]!.ram,
      storage: SAMPLE_PC_BUILDS[1]!.storage,
      price: SAMPLE_PC_BUILDS[1]!.sellPrice,
      ratingAvg: SAMPLE_PC_BUILDS[1]!.ratingAvg,
      ratingCount: SAMPLE_PC_BUILDS[1]!.ratingCount,
      isAvailable: true,
    },
  ]);

  const [likedProducts, setLikedProducts] = useState<ProductCardData[]>([
    {
      id: "p-2",
      slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
      name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
      brandName: "ASUS",
      imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&auto=format&fit=crop&q=80",
      price: 13_500_000n,
      originalPrice: 14_200_000n,
      discountPercent: 5,
      stock: 4,
      ratingAvg: 5.0,
      ratingCount: 22,
      isHit: true,
    },
  ]);

  const handleRemoveBuild = (id: string) => {
    setLikedBuilds((prev) => prev.filter((b) => b.id !== id));
  };

  const handleRemoveProduct = (id: string) => {
    setLikedProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const totalLikedCount = likedBuilds.length + likedProducts.length;

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
        <h1 className="text-2xl font-black tracking-tight">Saralanganlar (Liked)</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Siz yoqtirgan va keyinroq sotib olish uchun saqlab qoʻygan mahsulotlar ({totalLikedCount} ta)
        </p>
      </div>

      {totalLikedCount === 0 ? (
        <div className="rounded-[var(--r-card,12px)] border border-dashed border-border bg-card p-12 text-center">
          <Heart size={44} className="text-muted-foreground/30 mx-auto mb-2" />
          <h3 className="font-bold text-base">Hozircha hech narsa yoqtirilmagan</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mahsulotlar kartasidagi yurakcha belgisini bosib saralanganlarga qoʻshishingiz mumkin.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/products">
              <Button variant="ghost" size="sm">
                Mahsulotlar
              </Button>
            </Link>
            <Link href="/computers">
              <Button variant="primary" size="sm">
                Kompyuterlar
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* 1. Yoqtirilgan Kompyuterlar */}
          {likedBuilds.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4">Tayyor kompyuterlar ({likedBuilds.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5">
                {likedBuilds.map((b) => (
                  <PcCard
                    key={b.id}
                    pc={b}
                    isLiked={true}
                    onToggleLike={handleRemoveBuild}
                  />
                ))}
              </div>
            </div>
          )}

          {/* 2. Yoqtirilgan Ehtiyot qismlar */}
          {likedProducts.length > 0 && (
            <div>
              <h2 className="text-lg font-bold mb-4">Komponentlar va ehtiyot qismlar ({likedProducts.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {likedProducts.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    isLiked={true}
                    onToggleLike={handleRemoveProduct}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
