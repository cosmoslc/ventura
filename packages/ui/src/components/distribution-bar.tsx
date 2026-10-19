import * as React from "react";
import { cn } from "../lib/utils";

/*
 * DistributionBar — taqsimot chizig'i (STYLE.md 11.39): bitta gorizontal chiziq bo'laklarga bo'lingan (har bo'lak
 * ulushi bo'yicha), ostida izoh: rang, nom, soni va foizi. Rang faqat holat tokenlaridan. Masalan, o'quvchilar
 * baho darajalari bo'yicha (a'lo / yaxshi / qoniqarli / past).
 */

export type DistributionTone = "success" | "info" | "warning" | "danger" | "neutral" | "primary";

const FILL: Record<DistributionTone, string> = {
  success: "bg-(--success-fg)",
  info: "bg-(--info-fg)",
  warning: "bg-(--warning-fg)",
  danger: "bg-(--danger-fg)",
  neutral: "bg-muted-foreground/40",
  primary: "bg-primary",
};

export interface DistributionSegment {
  key: string;
  label: string;
  value: number;
  tone: DistributionTone;
}

export function DistributionBar({
  segments,
  unit,
  emptyLabel,
  className,
}: {
  segments: readonly DistributionSegment[];
  /** Son yonidagi birlik ("nafar") */
  unit?: (n: number) => string;
  emptyLabel?: string;
  className?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
      >
        {total
          ? segments
              .filter((s) => s.value > 0)
              .map((s) => (
                <div
                  key={s.key}
                  className={cn("h-full", FILL[s.tone])}
                  style={{ width: `${(s.value / total) * 100}%` }}
                />
              ))
          : null}
      </div>
      {total ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-2 text-caption">
              <span className={cn("size-2.5 shrink-0 rounded-full", FILL[s.tone])} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{s.label}</span>
              <span className="font-mono font-semibold text-foreground tabular-nums">
                {unit ? unit(s.value) : s.value}
              </span>
              <span className="w-9 text-right font-mono text-muted-foreground tabular-nums">{pct(s.value)}%</span>
            </li>
          ))}
        </ul>
      ) : emptyLabel ? (
        <div className="text-center text-caption text-muted-foreground">{emptyLabel}</div>
      ) : null}
    </div>
  );
}
