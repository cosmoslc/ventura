import type { MonthAdvice } from "@/lib/lead-reports";
import { uz } from "@/lib/uz";

const k = uz.reports.seasonal;

const COLOR: Record<string, string> = {
  peak: "var(--chart-1)",
  boost: "var(--chart-4)",
  save: "var(--placeholder)",
};
const NONE = "color-mix(in oklab, var(--muted-foreground) 25%, transparent)";

const avgText = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

/**
 * Reklama oylari: kalendar oylari bo'yicha o'rtacha lidlar (12 ustun, rang — tavsiya turi) va ostida tavsiyalar
 * matn bilan: cho'qqi, reklamani kuchaytirish, tejash oylari.
 */
export function AdviceStrip({ advice }: { advice: readonly MonthAdvice[] }) {
  const max = Math.max(1, ...advice.map((a) => a.avg));
  const groups = (["peak", "boost", "save"] as const).map((tag) => ({
    tag,
    months: advice.filter((a) => a.tag === tag).map((a) => uz.months[a.month - 1]!),
  }));
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-12 gap-1" aria-label={k.adviceTitle}>
        {advice.map((a) => (
          <li key={a.month} className="flex min-w-0 flex-col items-center gap-1">
            <span className="font-mono text-2xs text-foreground">{avgText(a.avg)}</span>
            <div className="flex h-24 w-full max-w-5 items-end overflow-hidden rounded-control bg-secondary">
              <div
                className="w-full rounded-control"
                style={{ height: `${Math.max(2, (a.avg / max) * 100)}%`, background: a.tag ? COLOR[a.tag] : NONE }}
              />
            </div>
            <span className="font-mono text-2xs text-muted-foreground">{uz.monthsShort[a.month - 1]}</span>
          </li>
        ))}
      </ol>
      <ul className="grid gap-2 sm:grid-cols-3">
        {groups.map((g) => (
          <li key={g.tag} className="flex items-start gap-2">
            <i className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: COLOR[g.tag] }} aria-hidden />
            <span className="min-w-0">
              <span className="block text-caption text-muted-foreground">{k.tags[g.tag]}</span>
              <span className="block text-body font-semibold text-foreground">
                {g.months.length ? g.months.join(", ") : "—"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
