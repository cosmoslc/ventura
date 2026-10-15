import { cn } from "@ventura/ui/lib/utils";
import { uz } from "@/lib/uz";
import type { RetentionViewData } from "@/lib/server/academic-reports";

const k = uz.reports.retention;

/**
 * Kohorta matritsasi: qator — kelgan oyi, ustun — necha oydan keyin; katak foni qolganlar ulushiga qarab
 * `--chart-1` ning och-to'q qatlami (matn rangi o'zgarmaydi, qiymat har doim yoziladi). Hali kelmagan oy — "—".
 */
export function CohortHeatmap({ cohorts }: { cohorts: RetentionViewData["cohorts"] }) {
  const n = cohorts[0]?.cells.length ?? 0;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[460px] border-separate border-spacing-1 text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="pr-2 pb-1 text-left text-2xs font-semibold whitespace-nowrap">{k.cohortMonth}</th>
            <th className="px-1 pb-1 text-right text-2xs font-semibold">{k.cohortSize}</th>
            {Array.from({ length: n }, (_, i) => (
              <th key={i} className="px-1 pb-1 text-center text-2xs font-semibold whitespace-nowrap">
                {i === 0 ? k.cohortK(0) : k.durationMonths(i)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.month}>
              <td className="pr-2 font-semibold whitespace-nowrap text-foreground">{c.label}</td>
              <td className="px-1 text-right text-muted-foreground tabular-nums">{c.size}</td>
              {c.cells.map((v, i) => (
                <td
                  key={i}
                  className={cn(
                    "h-9 rounded-control text-center font-semibold tabular-nums",
                    v === null ? "text-muted-foreground" : "text-foreground",
                  )}
                  style={
                    v === null
                      ? undefined
                      : { background: `color-mix(in oklab, var(--chart-1) ${Math.round(8 + v * 0.5)}%, transparent)` }
                  }
                >
                  {v === null ? "—" : `${Math.round(v)}%`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
