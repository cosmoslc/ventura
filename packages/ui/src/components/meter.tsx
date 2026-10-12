import * as React from "react";
import { cn } from "../lib/utils";

export interface MeterProps {
  label: string;
  /** 0–1 */
  value: number;
  /** O'ngdagi matn, masalan "3.1 / 8 GB" */
  detail?: string;
  /** Shundan boshlab sariq (ogohlantirish) */
  warnAt?: number;
  /** Shundan boshlab qizil */
  dangerAt?: number;
  className?: string;
}

/**
 * Chegaraga nisbatan bitta ulush (CPU, xotira, disk). To'ldirilgan qism holatni bildiradi: asosiy rang →
 * ogohlantirish → xavf; bo'sh yo'l — shu rangning och qatlami. Qiymat har doim matn bilan ham yoziladi.
 */
export function Meter({ label, value, detail, warnAt = 0.75, dangerAt = 0.9, className }: MeterProps) {
  const v = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  const tone = v >= dangerAt ? "var(--danger-fg)" : v >= warnAt ? "var(--warning-fg)" : "var(--primary)";
  const percent = Math.round(v * 100);
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="font-semibold text-muted-foreground">{label}</span>
        <span className="truncate font-mono text-foreground">
          {percent}%{detail ? <span className="text-muted-foreground"> · {detail}</span> : null}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={detail ? `${percent}% (${detail})` : `${percent}%`}
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${tone} 16%, transparent)` }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-ios"
          style={{ width: `${percent}%`, background: tone }}
        />
      </div>
    </div>
  );
}
