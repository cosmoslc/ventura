import { cn } from "@ventura/ui/lib/utils";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";

const k = uz.reports.funnel;

/**
 * Voronka: har pog'ona uchun bosqich rangidagi chiziq — eni birinchi pog'onaga nisbatan, markazda (torayib
 * boradi). Chapda nom va o'rtacha turish, o'ngda yetganlar soni (jamidan ulushi) va oldingi pog'onadan o'tganlar
 * foizi (qolib ketganlar soni). Eng katta tushish — qizil matn.
 */
export function FunnelBars({ data }: { data: FunnelViewData }) {
  const first = data.steps[0]?.count ?? 0;
  const col = "md:grid-cols-[10rem_minmax(0,1fr)_4.5rem_4.5rem]";
  return (
    <div>
      <div className={cn("hidden gap-x-4 px-1 pb-2 text-caption font-semibold text-muted-foreground md:grid", col)}>
        <span>{k.stage}</span>
        <span />
        <span className="text-right">{k.colReached}</span>
        <span className="text-right">{k.colConv}</span>
      </div>
      <ol className="divide-y divide-border-soft">
        {data.steps.map((s, i) => {
          const worst = data.dropIndex === i;
          return (
            <li
              key={s.name}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 px-1 py-3 md:py-2.5",
                col,
              )}
            >
              <div className="min-w-0 md:col-start-1 md:row-start-1">
                <div className="truncate text-body font-semibold text-foreground" title={s.name}>
                  {s.name}
                </div>
                {s.days !== null ? <div className="text-caption text-muted-foreground">{k.avgDays(s.days)}</div> : null}
              </div>
              <div className="col-span-3 row-start-2 md:col-span-1 md:col-start-2 md:row-start-1">
                <div
                  className="mx-auto h-7 min-w-1 rounded-control md:h-8"
                  style={{
                    width: `${first ? Math.max(1, (s.count / first) * 100) : 0}%`,
                    background: s.count ? s.color : "var(--border)",
                  }}
                  aria-hidden
                />
              </div>
              <div className="text-right tabular-nums md:col-start-3 md:row-start-1">
                <div className="text-body font-bold text-foreground">{money(s.count)}</div>
                <div className="text-caption text-muted-foreground">
                  {s.share === null ? "—" : `${s.share.toFixed(0)}%`}
                </div>
              </div>
              <div className="text-right tabular-nums md:col-start-4 md:row-start-1">
                {i === 0 ? (
                  <div className="text-body text-muted-foreground">—</div>
                ) : (
                  <>
                    <div className={cn("text-body font-bold", worst ? "text-(--danger-fg)" : "text-foreground")}>
                      {s.conv === null ? "—" : `${s.conv.toFixed(0)}%`}
                    </div>
                    <div className={cn("text-caption", worst ? "text-(--danger-fg)" : "text-muted-foreground")}>
                      {s.drop ? k.dropCaption(s.drop) : " "}
                    </div>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
