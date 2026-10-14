import { cn } from "@ventura/ui/lib/utils";
import type { DonutSegment } from "@ventura/ui/donut-chart";
import { MetricCard } from "@ventura/ui/metric-card";
import { Td } from "@ventura/ui/table";
import { compact, compactStr, topWithOther } from "@/lib/dashboard";
import { change, signedPercent } from "@/lib/finance-views";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { formatCell } from "../../report-table";

/** Karta: tepada sarlavha (va ixtiyoriy o'ng qism), ostida tarkib */
export { Panel } from "../blocks";

/**
 * Oldingi davrga nisbatan o'zgarish (kartaning izohi): "+12.5% Sentabr 2026"; to'liq jumla — maslahatda.
 * `good` — o'sish yaxshimi (tushum — "up", xarajat va chegirma — "down"): yomon tomonga o'zgarish qizil.
 */
export function DeltaFoot({
  cur,
  prev,
  good,
  vs,
  none,
}: {
  cur: number;
  prev: { value: number; label: string } | null;
  good: "up" | "down";
  vs: (label: string) => string;
  none: string;
}) {
  const pct = prev ? change(cur, prev.value) : null;
  if (!prev || pct === null) return <span>{none}</span>;
  const better = pct === 0 ? null : pct > 0 === (good === "up");
  return (
    <span title={vs(prev.label)}>
      <b
        className={cn(
          "font-semibold",
          better === null ? "text-muted-foreground" : better ? "text-(--success-fg)" : "text-(--danger-fg)",
        )}
      >
        {signedPercent(pct)}
      </b>{" "}
      {prev.label}
    </span>
  );
}

/** Ingichka ulush chizig'i, 0–100 */
export function ShareBar({ value, className }: { value: number; className?: string }) {
  const v = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("h-1 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Raqam katagi: o'ngda, bo'sh — "—", manfiy farq / rejadan oshgan bajarilish — qizil; `kind` — son yoki foiz */
export function NumTd({
  value,
  percent: isPercent,
  count,
  signed,
  strong,
  bad,
}: {
  value: number | null;
  percent?: boolean;
  /** Pul emas, oddiy son (guruhlar, o'quvchilar) */
  count?: boolean;
  signed?: boolean;
  strong?: boolean;
  bad?: boolean;
}) {
  return (
    <Td
      className={cn(
        "text-right whitespace-nowrap tabular-nums",
        strong && "font-semibold text-foreground",
        value === null && "text-muted-foreground",
        (bad || (signed && value !== null && value < 0)) && "text-(--danger-fg)",
      )}
    >
      {formatCell(value, isPercent ? "percent" : count ? "number" : "money")}
    </Td>
  );
}

/** Halqa diagramma bo'laklari: eng kattasidan 3 tasi, qolgani "Boshqa" (chart-1 ... chart-4 rangida) */
export function donutSegments(entries: readonly [string, number][], other: string): DonutSegment[] {
  return topWithOther(entries, other).map(([label, value], i) => ({
    label,
    value,
    color: `var(--chart-${i + 1})`,
    display: compactStr(value),
  }));
}

/** Halqa markazi: qisqa son va birlik ("1.2" / "mln so'm") */
export function donutCenter(total: number): { center: string; unit: string } {
  const c = compact(total);
  return { center: c.v, unit: c.u ? `${c.u} ${uz.common.som}` : uz.common.som };
}

/** Pul ko'rsatkichi: qisqa yozuv ("28 mln so'm"; tor ekranda ham sig'adi), to'liq summa — maslahatda */
export function MoneyCard({ label, amount, foot }: { label: string; amount: number | null; foot?: React.ReactNode }) {
  if (amount === null) return <MetricCard label={label} value="—" foot={foot} />;
  const c = compact(amount);
  return (
    <MetricCard
      label={label}
      value={c.v}
      unit={c.u ? `${c.u} ${uz.common.som}` : uz.common.som}
      foot={foot}
      title={`${money(amount)} ${uz.common.som}`}
    />
  );
}
