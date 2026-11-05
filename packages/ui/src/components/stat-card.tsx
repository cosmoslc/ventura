import * as React from "react";
import { cn } from "../lib/utils";

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: React.ReactNode;
  label: string;
  value: string;
  /** Tokenlardagi --stat-N-bg / --stat-N-fg juftligi. */
  tone: 1 | 2 | 3 | 4;
  trend?: { value: string; up: boolean };
  /** Yorliq ostidagi qo'shimcha izoh (masalan, taqsimot: "3 ta erkak • 2 ta ayol") */
  hint?: React.ReactNode;
  /** Sahifaga xos ixcham qiymat ko'rinishi; masalan, bir qatorda turishi kerak bo'lgan pul summasi. */
  valueClassName?: string;
}

export function StatCard({ icon, label, value, tone, trend, hint, valueClassName, className, ...props }: StatCardProps) {
  return (
    <div
      className={cn(
        "group relative flex items-center gap-3.5 rounded-card border border-border-soft bg-card p-4 shadow-card",
        "transition-[transform,box-shadow,border-color] duration-300 ease-ios",
        "hover:translate-y-(--card-hover-y) hover:border-(--card-hover-border) hover:shadow-card-hover",
        className,
      )}
      {...props}
    >
      <div
        className="grid size-[42px] shrink-0 place-items-center rounded-stat-icon [&_svg]:size-[19px]"
        style={{
          background: `var(--stat-${tone}-bg)`,
          color: `var(--stat-${tone}-fg)`,
          boxShadow: "var(--stat-icon-ring)",
        }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("type-stat leading-tight text-foreground", valueClassName)}>{value}</div>
        <div className="mt-0.5 truncate text-body font-medium text-muted-foreground">{label}</div>
        {hint ? <div className="mt-1 space-y-0.5 text-caption text-muted-foreground">{hint}</div> : null}
      </div>
      {trend ? (
        <span
          className={cn(
            "self-start rounded-badge px-2 py-0.5 font-mono text-caption font-semibold",
            trend.up ? "bg-(--success-bg) text-(--success-fg)" : "bg-(--danger-bg) text-(--danger-fg)",
          )}
        >
          {trend.up ? "↑" : "↓"} {trend.value}
        </span>
      ) : null}
    </div>
  );
}
