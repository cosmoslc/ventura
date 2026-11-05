"use client";

import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { PcCard } from "@/components/storefront/pc-card";
import { ProductCard } from "@/components/storefront/product-card";
import { useLiked } from "@/lib/liked-context";

export default function ProfileLikedPage() {
  const { likedBuilds, likedProducts, likedCount, toggleLike, removeLiked } = useLiked();

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="rounded-card border border-border bg-card p-5">
        <h1 className="text-2xl font-black tracking-tight">Saralanganlar (Liked)</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Siz yoqtirgan va profilingizda saqlangan mahsulotlar ({likedCount} ta)
        </p>
      </div>

      {likedCount === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-card p-12 text-center">
          <Heart size={44} className="text-muted-foreground/30 mx-auto mb-2" />
          <h3 className="font-bold text-base">Hozircha hech narsa yoqtirilmagan</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Mahsulotlar kartasidagi yurakcha belgisini bosib, ularni profilingizda saqlashingiz mumkin.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/products">
              <Button variant="ghost" size="sm">
                Mahsulotlar katalogi
              </Button>
            </Link>
            <Link href="/computers">
              <Button variant="primary" size="sm">
                Tayyor kompyuterlar
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
                    pc={{
                      id: b.id,
                      slug: b.slug,
                      name: b.name,
                      imageUrl: b.imageUrl,
                      price: b.price,
                      ratingAvg: b.ratingAvg,
                      ratingCount: b.ratingCount,
                      isAvailable: b.isAvailable,
                    }}
                    isLiked={true}
                    onToggleLike={() => removeLiked(b.id)}
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
                    product={{
                      id: p.id,
                      slug: p.slug,
                      name: p.name,
                      brandName: p.brandName,
                      imageUrl: p.imageUrl,
                      price: p.price,
                      originalPrice: p.originalPrice,
                      stock: 10,
                      ratingAvg: p.ratingAvg,
                      ratingCount: p.ratingCount,
                    }}
                    isLiked={true}
                    onToggleLike={() => removeLiked(p.id)}
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
