import Link from "next/link";
import { cn } from "@ventura/ui/lib/utils";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";

const k = uz.reports.funnel;

/**
 * Voronka: har pog'ona uchun bosqich rangidagi chiziq — eni birinchi pog'onaga nisbatan, markazda (torayib
 * boradi). Chapda nom va o'rtacha turish, o'ngda yetganlar soni (jamidan ulushi) va oldingi pog'onadan o'tganlar
 * foizi (qolib ketganlar soni). Eng katta tushish — qizil matn. Pog'onani bosish uni tanlaydi (manzilda `bosqich`):
 * ko'rsatkichlar va pastdagi ro'yxat shu bosqich bo'yicha; yana bosilsa — tanlov olinadi.
 */
export function FunnelBars({ data, query }: { data: FunnelViewData; query: Record<string, string> }) {
  const href = (id: string) => {
    const q = new URLSearchParams(query);
    if (data.selected === id) q.delete("bosqich");
    else q.set("bosqich", id);
    return `?${q.toString()}`;
  };
  const first = data.steps[0]?.count ?? 0;
  const col = "md:grid-cols-[10rem_minmax(0,1fr)_4.5rem_4.5rem]";
  return (
    <div>
      <div className={cn("hidden gap-x-4 px-2 pb-2 text-caption font-semibold text-muted-foreground md:grid", col)}>
        <span>{k.stage}</span>
        <span />
        <span className="text-right">{k.colReached}</span>
        <span className="text-right">{k.colConv}</span>
      </div>
      <ol className="divide-y divide-border-soft">
        {data.steps.map((s, i) => {
          const worst = data.dropIndex === i;
          const selected = data.selected === s.id;
          return (
            <li key={s.id}>
              <Link
                href={href(s.id)}
                scroll={false}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 rounded-control px-2 py-3 transition-colors md:py-2.5",
                  selected ? "bg-primary-soft" : "hover:bg-muted/50",
                  col,
                )}
              >
                <div className="min-w-0 md:col-start-1 md:row-start-1">
                  <div className="truncate text-body font-semibold text-foreground" title={s.name}>
                    {s.name}
                  </div>
                  {s.days !== null ? (
                    <div className="text-caption text-muted-foreground">{k.avgDays(s.days)}</div>
                  ) : null}
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
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
