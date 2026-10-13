import * as React from "react";
import { cn } from "../lib/utils";

export interface GaugeProps {
  /** 0–1 */
  value: number;
  /** Markazdagi qiymat ostidagi so'z, masalan "yig'ildi" */
  label: string;
  size?: number;
  className?: string;
}

const R = 40;
const FULL = 2 * Math.PI * R;
/** 270° yoy */
const ARC = FULL * 0.75;

/** Bitta ulush 270° yoyda, markazda foiz (STYLE.md 11.32). Rang — `--success-fg` (maqsadga yaqinlik). */
export function Gauge({ value, label, size = 112, className }: GaugeProps) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const percent = (v * 100).toFixed(1);
  return (
    <div className={cn("relative mx-auto", className)} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Number(percent)}
      >
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--border-soft)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${ARC.toFixed(1)} ${FULL.toFixed(1)}`}
          transform="rotate(135 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke="var(--success-fg)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${(ARC * v).toFixed(1)} ${FULL.toFixed(1)}`}
          transform="rotate(135 50 50)"
          className="transition-[stroke-dasharray] duration-700 ease-ios"
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
        <b className="type-stat leading-none text-foreground">{percent}%</b>
        <span className="mt-1 text-caption text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}
