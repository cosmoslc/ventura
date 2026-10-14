import { cn } from "@ventura/ui/lib/utils";
import { money } from "@/lib/format";
import type { SourceRow } from "@/lib/lead-reports";
import { uz } from "@/lib/uz";

const k = uz.reports.sources;

const WON = "var(--success-fg)";
const LOST = "var(--danger-fg)";
const OPEN = "color-mix(in oklab, var(--muted-foreground) 35%, transparent)";

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-caption text-muted-foreground">
      <i className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
      {label}
    </span>
  );
}

/**
 * Manbalar natijasi: har manba uchun ingichka ustun (eni lidlar soniga mutanosib) holatlarga bo'lingan —
 * o'quvchi bo'ldi, jarayonda, yo'qotilgan. O'ngda konversiya (va moliyaviy ruxsat bo'lsa tushum).
 */
export function SourceRows({
  rows,
  finance,
  best,
}: {
  rows: readonly SourceRow[];
  finance: boolean;
  best: string | null;
}) {
  const max = Math.max(1, ...rows.map((r) => r.leads));
  const sum = (key: "leads" | "won" | "lost" | "open" | "revenue") => rows.reduce((s, r) => s + r[key], 0);
  const leads = sum("leads");
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
        <Dot color={WON} label={k.won} />
        <Dot color={OPEN} label={k.open} />
        <Dot color={LOST} label={k.lost} />
      </div>
      <ul className="divide-y divide-border-soft">
        {rows.map((r) => (
          <li key={r.source} className="py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-body font-semibold text-foreground" title={r.source}>
                {r.source}
                {best === r.source ? (
                  <small className="ml-2 text-caption font-medium text-(--success-fg)">{k.bestMark}</small>
                ) : null}
              </span>
              <span
                className={cn(
                  "shrink-0 text-body font-bold tabular-nums",
                  best === r.source ? "text-(--success-fg)" : "text-foreground",
                )}
              >
                {r.conv === null ? "—" : `${r.conv.toFixed(1)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary" aria-hidden>
              <div className="flex h-full overflow-hidden rounded-full" style={{ width: `${(r.leads / max) * 100}%` }}>
                <div style={{ flex: r.won, background: WON }} />
                <div style={{ flex: r.open, background: OPEN }} />
                <div style={{ flex: r.lost, background: LOST }} />
              </div>
            </div>
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-caption text-muted-foreground">
              <span>{k.metaLine(money(r.leads), money(r.won), money(r.lost), money(r.open))}</span>
              {finance ? (
                <span className="font-semibold text-foreground tabular-nums">
                  {money(r.revenue)} {uz.common.som}
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-t-2 border-border pt-3 text-body font-bold text-foreground">
        <span>
          {uz.reports.total}{" "}
          <small className="font-medium text-muted-foreground">
            {k.metaLine(money(leads), money(sum("won")), money(sum("lost")), money(sum("open")))}
          </small>
        </span>
        <span className="tabular-nums">
          {leads ? `${((sum("won") / leads) * 100).toFixed(1)}%` : "—"}
          {finance ? ` · ${money(sum("revenue"))} ${uz.common.som}` : ""}
        </span>
      </div>
    </div>
  );
}
