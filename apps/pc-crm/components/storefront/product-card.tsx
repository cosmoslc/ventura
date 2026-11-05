"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Heart, ShoppingCart } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { PriceView } from "./price-view";
import { RatingStars } from "./rating-stars";

export interface ProductVariantItem {
  id: string;
  colorName: string;
  colorHex: string;
  imageUrl?: string;
  stock: number;
}

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  brandName?: string;
  categorySlug?: string;
  imageUrl: string;
  price: bigint | number;
  originalPrice?: bigint | number;
  discountPercent?: number;
  stock: number;
  ratingAvg?: number;
  ratingCount?: number;
  isNew?: boolean;
  isHit?: boolean;
  variants?: ProductVariantItem[];
}

interface ProductCardProps {
  product: ProductCardData;
  onQuickView?: (product: ProductCardData) => void;
  onAddToCart?: (productId: string, variantId?: string) => void;
  onToggleLike?: (productId: string) => void;
  isLiked?: boolean;
  className?: string;
}

export function ProductCard({
  product,
  onQuickView,
  onAddToCart,
  onToggleLike,
  isLiked = false,
  className = "",
}: ProductCardProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariantItem | undefined>(
    product.variants?.[0]
  );

  const activeImage = selectedVariant?.imageUrl || product.imageUrl;
  const inStock = product.stock > 0;

  return (
    <Card
      className={cn(
        "group relative flex flex-col justify-between p-3 transition-[transform,box-shadow,border-color] duration-300 ease-ios",
        "hover:translate-y-(--card-hover-y) hover:border-(--card-hover-border) hover:shadow-card-hover",
        className,
      )}
    >
      {/* Rasm va brend bloki */}
      <div className="relative mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-control bg-media p-3">
        {/* Teglar: Yangi / Hit */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {product.isHit && (
            <Badge tone="danger" className="text-2xs uppercase font-bold tracking-wider">
              Hit
            </Badge>
          )}
          {product.isNew && (
            <Badge tone="info" className="text-2xs uppercase font-bold tracking-wider">
              Yangi
            </Badge>
          )}
        </div>

        {/* Yurakcha (Liked) */}
        <Button
          variant="icon"
          size="icon-sm"
          onClick={() => onToggleLike?.(product.id)}
          aria-label="Sevimlilarga qo'shish"
          className="absolute top-2 right-2 z-10 rounded-avatar bg-card/80 text-foreground shadow-card backdrop-blur-sm"
        >
          <Heart
            size={16}
            className={isLiked ? "fill-(--danger-fg) text-(--danger-fg)" : "text-muted-foreground hover:text-(--danger-fg)"}
          />
        </Button>

        {/* Asosiy Rasm */}
        <Link href={`/products/${product.slug}`} className="flex h-full w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeImage}
            alt={product.name}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Link>

        {/* Brend nomi (yarim shaffof span) */}
        {product.brandName && (
          <span className="absolute bottom-2 left-2 rounded-badge bg-foreground/80 px-1.5 py-0.5 text-2xs font-medium text-background backdrop-blur-sm">
            {product.brandName}
          </span>
        )}

        {/* Tezkor ko'rish hover overlay tugmasi */}
        {onQuickView && (
          <div className="absolute inset-x-2 bottom-2 z-10 hidden justify-center group-hover:flex">
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-1.5 bg-card/90 shadow-card-hover backdrop-blur-sm text-foreground"
              onClick={() => onQuickView(product)}
            >
              <Eye size={14} />
              Tezkor ko'rish
            </Button>
          </div>
        )}
      </div>

      {/* Kontent qismi */}
      <div className="flex flex-1 flex-col justify-between">
        <div>
          {/* Rang tanlagich (agar variantlar bo'lsa) */}
          {product.variants && product.variants.length > 1 && (
            <div className="mb-2 flex items-center gap-1.5">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  title={v.colorName}
                  style={{ backgroundColor: v.colorHex }}
                  className={`h-4 w-4 rounded-full border border-black/10 transition-transform ${
                    selectedVariant?.id === v.id
                      ? "ring-2 ring-primary ring-offset-1 scale-110"
                      : "hover:scale-105"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Sarlavha */}
          <Link
            href={`/products/${product.slug}`}
            className="mb-1.5 line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-primary"
            title={product.name}
          >
            {product.name}
          </Link>

          {/* Reyting va qoldiq */}
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <RatingStars rating={product.ratingAvg ?? 0} count={product.ratingCount} size="sm" />
            <span>
              {inStock ? (
                <span className="font-medium text-(--success-fg)">
                  Omborda: {product.stock} dona
                </span>
              ) : (
                <span className="font-medium text-(--danger-fg)">Tugagan</span>
              )}
            </span>
          </div>
        </div>

        {/* Narx va harakat tugmalari */}
        <div className="mt-2 border-t border-border pt-2.5">
          <PriceView
            price={product.price}
            originalPrice={product.originalPrice}
            discountPercent={product.discountPercent}
            size="md"
            className="mb-3"
          />

          <div className="grid grid-cols-2 gap-2">
            <Link href={`/products/${product.slug}`} className="w-full">
              <Button variant="ghost" size="sm" className="w-full text-xs">
                Batafsil
              </Button>
            </Link>

            <Button
              variant="primary"
              size="sm"
              disabled={!inStock}
              className="w-full gap-1 text-xs"
              onClick={() => onAddToCart?.(product.id, selectedVariant?.id)}
            >
              <ShoppingCart size={13} />
              Savatga
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
