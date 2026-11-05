"use client";

import Link from "next/link";
import { Cpu, HardDrive, Heart, MemoryStick, Monitor, ShoppingCart } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
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
    <Card
      className={cn(
        "group relative flex flex-col justify-between p-3.5 transition-[transform,box-shadow,border-color] duration-300 ease-ios",
        "hover:translate-y-(--card-hover-y) hover:border-(--card-hover-border) hover:shadow-card-hover",
        className,
      )}
    >
      {/* Rasm qismi */}
      <div className="relative mb-3 flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-control bg-media p-3">
        {/* Chegirma tegi */}
        {pc.discountPercent !== undefined && pc.discountPercent > 0 && (
          <div className="absolute left-2 top-2 z-10">
            <Badge tone="danger" className="text-2xs font-extrabold tracking-tight shadow-xs">
              -{pc.discountPercent}%
            </Badge>
          </div>
        )}

        {/* Liked button */}
        <Button
          variant="icon"
          size="icon-sm"
          onClick={() => onToggleLike?.(pc.id)}
          aria-label="Sevimlilarga qo'shish"
          className="absolute top-2 right-2 z-10 rounded-avatar bg-card/85 text-foreground shadow-card backdrop-blur-sm transition-transform active:scale-90 hover:scale-110"
        >
          <Heart
            size={16}
            className={isLiked ? "fill-(--danger-fg) text-(--danger-fg)" : "text-muted-foreground hover:text-(--danger-fg)"}
          />
        </Button>

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
      <div className="mb-2">
        <Link
          href={`/computers/${pc.slug}`}
          className="line-clamp-2 text-sm sm:text-base font-bold text-foreground transition-colors hover:text-primary"
        >
          {pc.name}
        </Link>

        <div className="mt-1 flex items-center justify-between text-xs">
          <RatingStars rating={pc.ratingAvg ?? 0} count={pc.ratingCount} size="sm" />
          <span className={isAvailable ? "font-semibold text-(--success-fg)" : "font-semibold text-(--danger-fg)"}>
            {isAvailable ? "Mavjud" : "Sotilgan"}
          </span>
        </div>
      </div>

      {/* Mini Tech Specs pimlari */}
      {(pc.cpu || pc.gpu || pc.ram || pc.storage) && (
        <div className="mb-3 grid grid-cols-2 gap-1.5 text-2xs">
          {pc.cpu && (
            <div className="flex items-center gap-1.5 rounded-control bg-secondary/50 px-2 py-1 text-muted-foreground truncate" title={pc.cpu}>
              <Cpu size={12} className="text-primary shrink-0" />
              <span className="truncate">{pc.cpu.replace(/^Intel\s+|^AMD\s+/i, "")}</span>
            </div>
          )}
          {pc.gpu && (
            <div className="flex items-center gap-1.5 rounded-control bg-secondary/50 px-2 py-1 text-muted-foreground truncate" title={pc.gpu}>
              <Monitor size={12} className="text-primary shrink-0" />
              <span className="truncate">{pc.gpu.replace(/^NVIDIA\s+|^GeForce\s+/i, "")}</span>
            </div>
          )}
          {pc.ram && (
            <div className="flex items-center gap-1.5 rounded-control bg-secondary/50 px-2 py-1 text-muted-foreground truncate" title={pc.ram}>
              <MemoryStick size={12} className="text-primary shrink-0" />
              <span className="truncate">{pc.ram.split(" ")[0]}</span>
            </div>
          )}
          {pc.storage && (
            <div className="flex items-center gap-1.5 rounded-control bg-secondary/50 px-2 py-1 text-muted-foreground truncate" title={pc.storage}>
              <HardDrive size={12} className="text-primary shrink-0" />
              <span className="truncate">{pc.storage.split(" ")[0]}</span>
            </div>
          )}
        </div>
      )}

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
    </Card>
  );
}
