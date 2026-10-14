import { DonutChart } from "@ventura/ui/donut-chart";
import type { LostViewData } from "@/lib/server/lead-reports";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { ReportTableView } from "../report-table";
import { EmptyPanel, KpiRow, Panel } from "./blocks";
import { RankBars, type RankItem } from "./lead-parts/rank-bars";
import type { ReportViewProps } from "./types";

const t = uz.reports;
const k = t.lost;

const items = (list: LostViewData["reasons"]): RankItem[] =>
  list.map((r) => ({ key: r.key, label: r.key, value: r.count, display: k.countUnit(money(r.count)), share: r.share }));

/** Yo'qotilgan lidlar: sabablar, bosqichlar halqasi, mas'ullar kesimi va ro'yxat */
export function LostView({ data }: ReportViewProps) {
  const view = data.view as LostViewData;
  const total = view.reasons.reduce((s, r) => s + r.count, 0);
  const list = data.extra?.find((x) => x.title === k.list);
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {total === 0 ? (
        <EmptyPanel text={k.none} />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-3">
            <Panel title={k.byReason}>
              <RankBars items={items(view.reasons)} color="var(--chart-2)" />
            </Panel>
            <Panel title={k.byStage}>
              <DonutChart
                segments={view.stages.map((s) => ({
                  label: s.key,
                  value: s.count,
                  color: s.color ?? "var(--placeholder)",
                  display: k.countUnit(money(s.count)),
                }))}
                center={money(total)}
                unit={k.unitLead}
                size={140}
                emptyText={t.empty}
              />
            </Panel>
            <Panel title={k.byStaff}>
              <RankBars items={items(view.staff)} />
            </Panel>
          </div>
          {list ? (
            <Panel title={list.title} flush className="overflow-hidden">
              <div className="border-t border-border-soft">
                <ReportTableView table={list.table} empty={t.empty} />
              </div>
            </Panel>
          ) : null}
        </>
      )}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
