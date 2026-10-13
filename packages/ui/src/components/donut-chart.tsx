"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  /** Token: kategoriya — `var(--chart-N)`, holat — `var(--success-fg)` va h.k. */
  color: string;
  /** Legendadagi qiymat matni, masalan "12 ta" yoki "1.2 mln" */
  display: string;
}

export interface DonutChartProps {
  segments: readonly DonutSegment[];
  /** Markazdagi katta qiymat va uning ostidagi birlik */
  center: string;
  unit: string;
  size?: number;
  /** Ma'lumot bo'lmaganda */
  emptyText: string;
  className?: string;
}

const C = 2 * Math.PI * 40;
const GAP = 2;

const pct = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "");

/**
 * Halqa diagramma va yonida legenda (STYLE.md 11.32): bo'laklar orasida 2px oraliq, ustiga kelganda bo'lak
 * qalinlashadi, qolganlari xiralashadi va markazda shu bo'lak foizi chiqadi. Legenda har doim bor (rang yolg'iz
 * ma'no tashimaydi); har band — tugma, klaviatura bilan ham ochiladi.
 */
export function DonutChart({ segments, center, unit, size = 140, emptyText, className }: DonutChartProps) {
  const [hot, setHot] = React.useState<number | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (!total) {
    return (
      <div className={cn("grid min-h-28 flex-1 place-items-center text-caption text-muted-foreground", className)}>
        {emptyText}
      </div>
    );
  }
  const stroke = 12;
  const lens = segments.map((s) => (s.value / total) * C);
  const offsets = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className={cn("flex flex-1 flex-wrap items-center gap-4", className)} onPointerLeave={() => setHot(null)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${center} ${unit}`}>
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border-soft)" strokeWidth={stroke} />
          {segments.map((s, i) => {
            const dash = Math.max(lens[i]! - GAP, 0.8);
            return (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={s.color}
                strokeWidth={hot === i ? stroke + 3 : stroke}
                strokeDasharray={`${dash.toFixed(2)} ${C.toFixed(2)}`}
                strokeDashoffset={(-offsets[i]!).toFixed(2)}
                transform="rotate(-90 50 50)"
                className="transition-[stroke-width,opacity] duration-200"
                opacity={hot === null || hot === i ? 1 : 0.35}
                onPointerEnter={() => setHot(i)}
              >
                <title>{`${s.label}: ${s.display}`}</title>
              </circle>
            );
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <b className="type-stat leading-none text-foreground">
            {hot === null ? center : pct(segments[hot]!.value, total)}
          </b>
          <span className="mt-1 text-caption text-muted-foreground">{hot === null ? unit : segments[hot]!.label}</span>
        </div>
      </div>
      <ul className="flex min-w-36 flex-1 flex-col gap-1">
        {segments.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-2 rounded-control px-2 py-1 text-left transition-colors",
                hot === i ? "bg-muted" : "hover:bg-muted",
              )}
              onPointerEnter={() => setHot(i)}
              onFocus={() => setHot(i)}
              onBlur={() => setHot(null)}
            >
              <i className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="min-w-0">
                <span className="block truncate text-caption text-muted-foreground">{s.label}</span>
                <span className="block text-body font-semibold text-foreground">
                  {s.display} <small className="font-medium text-muted-foreground">{pct(s.value, total)}</small>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
