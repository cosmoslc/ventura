import { DonutChart } from "@ventura/ui/donut-chart";
import { compactStr, topWithOther } from "@/lib/dashboard";
import { money } from "@/lib/format";
import type { SourcesViewData } from "@/lib/server/lead-reports";
import { uz } from "@/lib/uz";
import { EmptyPanel, KpiRow, Panel } from "./blocks";
import { SourceRows } from "./lead-parts/source-rows";
import type { ReportViewProps } from "./types";

const t = uz.reports;
const k = t.sources;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

/** Manbalar samaradorligi: ulush halqalari va har manbaning natijasi (konversiya, tushum) */
export function SourcesView({ data, finance }: ReportViewProps) {
  const view = data.view as SourcesViewData;
  const leads = view.rows.reduce((s, r) => s + r.leads, 0);
  const revenue = view.rows.reduce((s, r) => s + r.revenue, 0);
  const donut = (entries: [string, number][], unit: string, center: string, fmt: (v: number) => string) => (
    <DonutChart
      segments={topWithOther(entries, k.other).map(([label, value], i) => ({
        label,
        value,
        color: COLORS[i]!,
        display: fmt(value),
      }))}
      center={center}
      unit={unit}
      size={130}
      emptyText={t.empty}
    />
  );
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {leads === 0 ? (
        <EmptyPanel text={k.none} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <Panel title={k.rowsTitle} className="lg:order-1">
            <SourceRows rows={view.rows} finance={view.finance} best={view.best} />
          </Panel>
          <div className="flex flex-col gap-3 lg:order-2">
            <Panel title={k.shareTitle}>
              {donut(
                view.rows.map((r) => [r.source, r.leads]),
                k.unitLead,
                money(leads),
                (v) => k.countUnit(money(v)),
              )}
            </Panel>
            {finance && view.finance && revenue > 0 ? (
              <Panel title={k.revenueShareTitle}>
                {donut(
                  view.rows.map((r) => [r.source, r.revenue]),
                  uz.common.som,
                  compactStr(revenue),
                  (v) => `${money(v)} ${uz.common.som}`,
                )}
              </Panel>
            ) : null}
          </div>
        </div>
      )}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
