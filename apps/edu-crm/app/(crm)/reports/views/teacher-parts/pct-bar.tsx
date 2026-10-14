import { cn } from "@ventura/ui/lib/utils";

/** Foiz ko'rsatkichi: yorliq, qiymat va ingichka yo'l. Hisoblanmagan (null) — "—" va bo'sh yo'l. */
export function PctBar({
  label,
  value,
  color,
  className,
}: {
  label: string;
  value: number | null;
  /** Token, masalan `var(--chart-1)` */
  color: string;
  className?: string;
}) {
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="truncate font-semibold text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground">{value === null ? "—" : `${value.toFixed(1)}%`}</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value === null ? undefined : Math.round(width)}
        className="h-1.5 overflow-hidden rounded-full"
        style={{ background: `color-mix(in oklab, ${color} 16%, transparent)` }}
      >
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
    </div>
  );
}
