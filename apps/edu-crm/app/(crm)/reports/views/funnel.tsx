import { DonutChart } from "@ventura/ui/donut-chart";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { FunnelBars } from "./lead-parts/funnel-bars";
import { FunnelLeads } from "./lead-parts/funnel-leads";
import { FunnelSettings } from "./lead-parts/funnel-settings";
import { StaffMatrix } from "./lead-parts/staff-matrix";
import { EmptyPanel, KpiRow, Panel } from "./blocks";
import type { ReportViewProps } from "./types";

const t = uz.reports;
const k = t.funnel;

/**
 * CRM voronka (eski CRM sahifasidagi barcha imkoniyatlar): ko'rsatkichlar (tanlangan bosqich bo'yicha), bosilsa
 * bosqichni tanlaydigan voronka (bosqichda o'rtacha turish va o'tish ham shu yerda), lidlar holati, mas'ul xodimlar
 * kesimi va tanlangan bosqichdagi lidlar ro'yxati. Kurs va manba filtri — umumiy filtr qatorida; ko'rinadigan
 * bosqichlar — sozlamada.
 */
export function FunnelView({ data, query = {} }: ReportViewProps) {
  const view = data.view as FunnelViewData;
  const { outcome } = view;
  const total = outcome.open + outcome.won + outcome.lost;
  const staff = data.extra?.find((x) => x.title === k.byStaff);
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {total === 0 ? (
        <EmptyPanel text={k.none} />
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_21rem]">
            <Panel
              title={k.chartTitle}
              sub={view.selected ? undefined : k.listHint}
              aside={view.canConfigure ? <FunnelSettings stages={view.stages} /> : undefined}
            >
              <FunnelBars data={view} query={query} />
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
                    label: view.wonName,
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
          {staff ? (
            <Panel title={staff.title} flush className="overflow-hidden">
              <StaffMatrix table={staff.table} empty={k.none} />
            </Panel>
          ) : null}
          <Panel title={k.list} flush className="overflow-hidden">
            <FunnelLeads data={view} />
          </Panel>
        </>
      )}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
