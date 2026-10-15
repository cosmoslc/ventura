import { cn } from "@ventura/ui/lib/utils";

export interface RankItem {
  key: string;
  label: string;
  /** Ustun uzunligi uchun qiymat */
  value: number;
  /** O'ngdagi matn: "5 ta" */
  display: string;
  /** Ulush, % — qiymat yonida */
  share?: number | null;
}

/**
 * Kamayish tartibidagi gorizontal ustunlar: yorliq va qiymat tepada, ostida ingichka chiziq (eng kattasiga
 * nisbatan). Qiymat matn bilan ham yoziladi — rang yolg'iz ma'no tashimaydi.
 */
export function RankBars({
  items,
  color = "var(--chart-1)",
  className,
}: {
  items: readonly RankItem[];
  color?: string;
  className?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn("flex flex-col gap-3", className)}>
      {items.map((i) => (
        <li key={i.key} className="min-w-0">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body font-semibold text-foreground" title={i.label}>
              {i.label}
            </span>
            <span className="shrink-0 text-body font-semibold text-foreground tabular-nums">
              {i.display}
              {i.share != null ? (
                <small className="ml-1.5 text-caption font-medium text-muted-foreground">{i.share.toFixed(1)}%</small>
              ) : null}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(2, (i.value / max) * 100)}%`, background: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
