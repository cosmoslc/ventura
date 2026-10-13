import * as React from "react";
import { cn } from "../lib/utils";

/*
 * MetricCard — profil tepasidagi ixcham ko'rsatkich: yorliq va rangli ikonka (yoki belgi), katta qiymat + birlik,
 * chiziq ostida izoh. StatCard'dan farqi: ikonka kichik va o'ngda, qiymat yorliq ostida, izoh alohida qatorda —
 * bir qatorda 5–6 ta karta sig'adi. `highlight` — karta fonini ohangga bo'yaydi (masalan, balans qarzda).
 */

export type MetricTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const CHIP: Record<MetricTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary-soft text-primary-text",
  success: "bg-(--success-bg) text-(--success-fg)",
  warning: "bg-(--warning-bg) text-(--warning-fg)",
  danger: "bg-(--danger-bg) text-(--danger-fg)",
  info: "bg-(--info-bg) text-(--info-fg)",
};

const VALUE: Record<MetricTone, string> = {
  neutral: "text-foreground",
  primary: "text-primary-text",
  success: "text-(--success-fg)",
  warning: "text-(--warning-fg)",
  danger: "text-(--danger-fg)",
  info: "text-(--info-fg)",
};

const HIGHLIGHT: Record<MetricTone, string> = {
  neutral: "",
  primary: "border-(--ring-border) bg-primary-soft",
  success: "border-(--success-border) bg-(--success-bg)",
  warning: "border-(--warning-border) bg-(--warning-bg)",
  danger: "border-(--danger-border) bg-(--danger-bg)",
  info: "border-(--info-border) bg-(--info-bg)",
};

export interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string;
  /** Qiymat yonidagi kichik birlik ("ta guruh", "so'm") */
  unit?: string;
  icon?: React.ReactNode;
  /** Ikonka o'rnida qisqa belgi (masalan "Qarz") */
  badge?: string;
  tone?: MetricTone;
  /** Qiymat ham ohang rangida */
  colorValue?: boolean;
  highlight?: boolean;
  /** Chiziq ostidagi izoh */
  foot?: React.ReactNode;
}

export function MetricCard({
  label,
  value,
  unit,
  icon,
  badge,
  tone = "neutral",
  colorValue = false,
  highlight = false,
  foot,
  className,
  ...props
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2.5 rounded-card border border-border-soft bg-card p-4 shadow-card",
        highlight && HIGHLIGHT[tone],
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-caption font-semibold text-muted-foreground">{label}</span>
        {badge ? (
          <span className={cn("shrink-0 rounded-badge px-2 py-0.5 text-2xs font-bold uppercase", CHIP[tone])}>
            {badge}
          </span>
        ) : icon ? (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-control [&_svg]:size-4", CHIP[tone])}>
            {icon}
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("type-stat truncate leading-tight", colorValue ? VALUE[tone] : "text-foreground")}>
          {value}
        </span>
        {unit ? <span className="shrink-0 text-caption text-muted-foreground">{unit}</span> : null}
      </div>
      {foot ? (
        <div className="truncate border-t border-border-soft pt-2.5 text-caption text-muted-foreground">{foot}</div>
      ) : null}
    </div>
  );
}
