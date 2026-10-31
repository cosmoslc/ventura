"use client";

import { Star } from "lucide-react";

interface RatingStarsProps {
  rating: number; // 0..5
  count?: number;
  showText?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function RatingStars({
  rating,
  count,
  showText = true,
  size = "sm",
  className = "",
}: RatingStarsProps) {
  const starSize = size === "sm" ? 14 : 16;
  const rounded = Math.round(rating * 10) / 10;

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="flex items-center gap-0.5 text-amber-500">
        {[1, 2, 3, 4, 5].map((index) => {
          const filled = rating >= index;
          const half = !filled && rating >= index - 0.5;

          return (
            <Star
              key={index}
              size={starSize}
              className={
                filled
                  ? "fill-amber-400 text-amber-400"
                  : half
                    ? "fill-amber-400/50 text-amber-400"
                    : "text-muted-foreground/30"
              }
            />
          );
        })}
      </div>

      {showText && (
        <span className="text-xs font-medium text-muted-foreground">
          {rounded > 0 ? rounded.toFixed(1) : "0"}
          {typeof count === "number" && ` (${count})`}
        </span>
      )}
    </div>
  );
}
