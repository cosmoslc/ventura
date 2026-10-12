"use client";

import { Check } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

export interface ColorOption {
  /** #rrggbb — ma'lumot (foydalanuvchi tanlaydigan rang), token emas */
  value: string;
  label: string;
}

export interface ColorSwatchesProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly ColorOption[];
  /** Ro'yxatdan tashqari rang tanlash (brauzerning rang tanlagichi) */
  custom?: { label: string };
  className?: string;
}

/**
 * Rang tanlash: tayyor ranglar to'ri va ixtiyoriy erkin rang. Ranglar chaqiruvchidan keladi (kurs, filial rangi —
 * ma'lumot), komponentning o'z ko'rinishi esa faqat tokenlardan.
 */
export function ColorSwatches({ value, onChange, options, custom, className }: ColorSwatchesProps) {
  const id = React.useId();
  const current = value.toLowerCase();
  return (
    <div className={cn("space-y-3", className)}>
      <div role="radiogroup" className="grid grid-cols-6 gap-2 sm:grid-cols-9">
        {options.map((o) => {
          const selected = o.value.toLowerCase() === current;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={o.label}
              title={o.label}
              onClick={() => onChange(o.value)}
              className={cn(
                "grid aspect-square place-items-center rounded-control border border-border-soft text-primary-foreground shadow-card",
                "transition-transform duration-150 ease-ios hover:scale-105",
                selected && "scale-105 outline-2 outline-offset-2 outline-(--focus-outline)",
              )}
              style={{ background: o.value }}
            >
              {selected ? <Check className="size-4" strokeWidth={3} /> : null}
            </button>
          );
        })}
      </div>
      {custom ? (
        <label htmlFor={id} className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
          <input
            id={id}
            type="color"
            value={current}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="h-(--control-h-sm) w-16 cursor-pointer rounded-control border border-input bg-input-bg p-1"
          />
          {custom.label}
        </label>
      ) : null}
    </div>
  );
}
