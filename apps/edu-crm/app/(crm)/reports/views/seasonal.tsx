import type { TrendPoint } from "@ventura/ui/trend-chart";
import type { SeasonalViewData } from "@/lib/server/lead-reports";
import { uz } from "@/lib/uz";
import { ReportTableView } from "../report-table";
import { AdviceStrip } from "./lead-parts/advice-strip";
import { KpiRow, Panel } from "./blocks";
import { SeasonChart } from "./lead-parts/season-chart";
import type { ReportViewProps } from "./types";

const t = uz.reports;
const k = t.seasonal;

/** Mavsumiy oqim: 12 oy bo'yicha lidlar, o'tgan yil va o'quvchi bo'lganlar; reklama oylari; oylik jadval */
export function SeasonalView({ data }: ReportViewProps) {
  const view = data.view as SeasonalViewData;
  const { year, months, advice } = view;
  const any = months.some((m) => m.leads || m.prevLeads);
  const points: TrendPoint[] = months.map((m, i) => ({
    label: uz.monthsShort[i]!,
    tip: `${uz.months[i]} ${year}`,
    values: [m.prevLeads, m.future ? 0 : m.leads, m.future ? 0 : m.won],
    note: m.future ? k.futureNote : undefined,
  }));
  return (
    <>
      <KpiRow metrics={data.metrics} />
      <Panel title={k.chartTitle}>
        {any ? (
          <SeasonChart
            points={points}
            series={[
              { key: "prev", label: k.prevYear(year - 1), color: "var(--placeholder)" },
              { key: "leads", label: `${k.seriesLeads} ${year}`, color: "var(--chart-1)" },
              { key: "won", label: k.won, color: "var(--chart-3)" },
            ]}
            caption={k.chartTitle}
          />
        ) : (
          <p className="grid min-h-40 place-items-center text-body text-muted-foreground">{k.none}</p>
        )}
      </Panel>
      <Panel title={k.adviceTitle}>
        {advice ? (
          <AdviceStrip advice={advice} />
        ) : (
          <p className="grid min-h-24 place-items-center text-center text-body text-muted-foreground">
            {k.adviceLater}
          </p>
        )}
      </Panel>
      {any ? (
        <Panel title={k.tableTitle} flush className="overflow-hidden">
          <div className="border-t border-border-soft">
            <ReportTableView table={data.table} empty={t.empty} />
          </div>
        </Panel>
      ) : null}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
