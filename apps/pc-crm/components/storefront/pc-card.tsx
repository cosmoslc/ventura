"use client";

import Link from "next/link";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { PriceView } from "./price-view";
import { RatingStars } from "./rating-stars";

export interface PcBuildCardData {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  cpu?: string;
  gpu?: string;
  ram?: string;
  storage?: string;
  price: bigint | number;
  originalPrice?: bigint | number;
  discountPercent?: number;
  ratingAvg?: number;
  ratingCount?: number;
  isAvailable?: boolean;
}

interface PcCardProps {
  pc: PcBuildCardData;
  onAddToCart?: (pcId: string) => void;
  onToggleLike?: (pcId: string) => void;
  isLiked?: boolean;
  className?: string;
}

export function PcCard({
  pc,
  onAddToCart,
  onToggleLike,
  isLiked = false,
  className = "",
}: PcCardProps) {
  const isAvailable = pc.isAvailable !== false;

  return (
    <div
      className={`group relative flex flex-col justify-between rounded-[var(--r-card,12px)] border border-border bg-card p-3.5 transition-shadow duration-200 hover:shadow-[var(--card-shadow-hover,0_8px_24px_rgba(0,0,0,0.06))] ${className}`}
    >
      {/* Rasm qismi */}
      <div className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[calc(var(--r-card,12px)-4px)] bg-white p-3">
        {/* Liked button */}
        <button
          type="button"
          onClick={() => onToggleLike?.(pc.id)}
          aria-label="Sevimlilarga qo'shish"
          className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-foreground shadow-sm transition-transform hover:scale-110 active:scale-95"
        >
          <Heart
            size={16}
            className={isLiked ? "fill-rose-500 text-rose-500" : "text-muted-foreground hover:text-rose-500"}
          />
        </button>

        <Link href={`/computers/${pc.slug}`} className="flex h-full w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pc.imageUrl}
            alt={pc.name}
            className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </Link>
      </div>

      {/* Nomi va reytingi */}
      <div className="mb-3">
        <Link
          href={`/computers/${pc.slug}`}
          className="line-clamp-2 text-base font-bold text-foreground transition-colors hover:text-primary"
        >
          {pc.name}
        </Link>

        <div className="mt-1 flex items-center justify-between text-xs">
          <RatingStars rating={pc.ratingAvg ?? 0} count={pc.ratingCount} size="sm" />
          <span className={isAvailable ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-rose-500 font-semibold"}>
            {isAvailable ? "Mavjud" : "Sotilgan"}
          </span>
        </div>
      </div>

      {/* Narx va tugmalar */}
      <div className="border-t border-border pt-3">
        <PriceView
          price={pc.price}
          originalPrice={pc.originalPrice}
          discountPercent={pc.discountPercent}
          size="lg"
          className="mb-3"
        />

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/computers/${pc.slug}`} className="w-full">
            <Button variant="ghost" size="sm" className="w-full text-xs">
              Konfiguratsiya
            </Button>
          </Link>

          <Button
            variant="primary"
            size="sm"
            disabled={!isAvailable}
            className="w-full gap-1.5 text-xs"
            onClick={() => onAddToCart?.(pc.id)}
          >
            <ShoppingCart size={13} />
            Sotib olish
          </Button>
        </div>
      </div>
    </div>
  );
}
