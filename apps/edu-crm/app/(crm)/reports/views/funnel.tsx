import { DonutChart } from "@ventura/ui/donut-chart";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { ReportTableView } from "../report-table";
import { FunnelBars } from "./lead-parts/funnel-bars";
import { EmptyPanel, KpiRow, Panel } from "./blocks";
import type { ReportViewProps } from "./types";

const t = uz.reports;
const k = t.funnel;

/** CRM voronka: pog'onalar bo'yicha torayib boruvchi chiziqlar, lidlar holati va xodimlar kesimi */
export function FunnelView({ data }: ReportViewProps) {
  const view = data.view as FunnelViewData;
  const { outcome } = view;
  const total = outcome.open + outcome.won + outcome.lost;
  const staff = data.extra?.[0];
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {total === 0 ? (
        <EmptyPanel text={k.none} />
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <Panel title={k.chartTitle}>
            <FunnelBars data={view} />
          </Panel>
          <Panel title={k.outcomeTitle}>
            <DonutChart
              segments={[
                {
                  label: k.open,
                  value: outcome.open,
                  color: "var(--chart-1)",
                  display: `${money(outcome.open)} ${k.unitCount}`,
                },
                {
                  label: k.won,
                  value: outcome.won,
                  color: "var(--success-fg)",
                  display: `${money(outcome.won)} ${k.unitCount}`,
                },
                {
                  label: k.lost,
                  value: outcome.lost,
                  color: "var(--danger-fg)",
                  display: `${money(outcome.lost)} ${k.unitCount}`,
                },
              ]}
              center={money(total)}
              unit={k.unitLead}
              size={150}
              emptyText={t.empty}
            />
          </Panel>
        </div>
      )}
      {staff ? (
        <Panel title={staff.title} flush className="overflow-hidden">
          <div className="border-t border-border-soft">
            <ReportTableView table={staff.table} empty={k.none} />
          </div>
        </Panel>
      ) : null}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
