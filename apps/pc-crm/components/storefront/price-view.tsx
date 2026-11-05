"use client";

import { formatMoney } from "@/lib/format";

interface PriceViewProps {
  price: bigint | number;
  originalPrice?: bigint | number;
  discountPercent?: number;
  currency?: "UZS" | "USD";
  usdRate?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PriceView({
  price,
  originalPrice,
  discountPercent = 0,
  currency = "UZS",
  usdRate = 12800,
  size = "md",
  className = "",
}: PriceViewProps) {
  const sizeClasses = {
    sm: "text-sm font-semibold",
    md: "text-base font-bold",
    lg: "text-xl font-extrabold",
  };

  const hasDiscount = discountPercent > 0 || (originalPrice && originalPrice > price);

  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span className={`text-foreground ${sizeClasses[size]}`}>
        {formatMoney(price, currency, usdRate)}
      </span>

      {hasDiscount && originalPrice && (
        <span className="text-xs text-muted-foreground line-through">
          {formatMoney(originalPrice, currency, usdRate)}
        </span>
      )}

      {discountPercent > 0 && (
        <span className="rounded bg-(--danger-bg) px-1.5 py-0.5 text-caption font-bold text-(--danger-fg)">
          -{discountPercent}%
        </span>
      )}
    </div>
  );
}
