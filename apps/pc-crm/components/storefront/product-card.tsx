"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, Heart, ShoppingCart } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
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
    <div
      className={`group relative flex flex-col justify-between rounded-[var(--r-card,12px)] border border-border bg-card p-3 transition-shadow duration-200 hover:shadow-[var(--card-shadow-hover,0_8px_24px_rgba(0,0,0,0.06))] ${className}`}
    >
      {/* Rasm va brend bloki */}
      <div className="relative mb-3 flex aspect-square w-full items-center justify-center overflow-hidden rounded-[calc(var(--r-card,12px)-4px)] bg-white p-3">
        {/* Teglar: Yangi / Hit */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {product.isHit && (
            <Badge tone="danger" className="text-[10px] uppercase font-bold tracking-wider">
              Hit
            </Badge>
          )}
          {product.isNew && (
            <Badge tone="info" className="text-[10px] uppercase font-bold tracking-wider">
              Yangi
            </Badge>
          )}
        </div>

        {/* Yurakcha (Liked) */}
        <button
          type="button"
          onClick={() => onToggleLike?.(product.id)}
          aria-label="Sevimlilarga qo'shish"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-foreground shadow-sm transition-transform hover:scale-110 active:scale-95"
        >
          <Heart
            size={16}
            className={isLiked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-500"}
          />
        </button>

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
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {product.brandName}
          </span>
        )}

        {/* Tezkor ko'rish hover overlay tugmasi */}
        {onQuickView && (
          <div className="absolute inset-x-2 bottom-2 z-10 hidden justify-center group-hover:flex">
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-1.5 bg-white/90 shadow-md backdrop-blur-sm text-foreground"
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
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Omborda: {product.stock} dona
                </span>
              ) : (
                <span className="text-rose-500 font-medium">Tugagan</span>
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
    </div>
  );
}
