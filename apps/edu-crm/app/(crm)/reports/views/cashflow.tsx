import { Card } from "@ventura/ui/card";
import { DonutChart } from "@ventura/ui/donut-chart";
import { MetricCard } from "@ventura/ui/metric-card";
import { Meter } from "@ventura/ui/meter";
import { flowHighlights } from "@/lib/cashflow-views";
import { compactStr, topWithOther } from "@/lib/dashboard";
import { formatMonth, money } from "@/lib/format";
import type { CashflowViewData } from "@/lib/server/cashflow-reports";
import { uz } from "@/lib/uz";
import { ReportTableView, formatCell } from "../report-table";
import { FlowChart, NetChart } from "./cashflow-parts/charts";
import { BLOCK_TITLE, Panel } from "./blocks";
import type { ReportViewProps } from "./types";

const t = uz.reports.cashflow;
const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

/** Pul oqimi: ko'rsatkichlar, oyma-oy kirim/chiqim, sof oqim, chiqim tarkibi va 12 oylik jadval */
export function CashflowView({ data }: ReportViewProps) {
  const view = data.view as CashflowViewData;
  const hl = flowHighlights(view.months);
  const flowed = view.months.some((m) => m.income || m.outflow);
  const segments = topWithOther(view.breakdown, t.other).map(([label, value], i) => ({
    label,
    value,
    color: COLORS[i] ?? COLORS[3]!,
    display: `${compactStr(value)} ${uz.common.som}`,
  }));
  const share = hl.outflowShare;
  const empty = <p className="grid min-h-40 place-items-center text-caption text-muted-foreground">{t.noData}</p>;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {data.metrics.map((m) => (
          <MetricCard
            key={m.label}
            label={m.label}
            value={formatCell(m.value, m.kind)}
            unit={m.kind === "money" && m.value !== null ? uz.common.som : undefined}
            tone={m.tone ?? "neutral"}
            colorValue={!!m.tone && m.tone !== "neutral"}
            foot={m.foot}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t.flowTitle} className="min-w-0 lg:col-span-2">
          {flowed ? <FlowChart months={view.months} /> : empty}
        </Panel>
        <Panel title={t.breakdownTitle} className="min-w-0">
          <DonutChart
            segments={segments}
            center={compactStr(hl.outflow)}
            unit={t.breakdownUnit}
            size={132}
            emptyText={t.noData}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={t.net} className="min-w-0 lg:col-span-2">
          {flowed ? <NetChart months={view.months} /> : empty}
        </Panel>
        <Panel title={t.summaryTitle} className="min-w-0">
          {share !== null ? (
            <Meter
              label={t.outflowShare}
              value={share / 100}
              overflow
              detail={`${money(hl.outflow)} / ${money(hl.income)}`}
            />
          ) : null}
          <dl className="flex flex-col gap-3 text-body">
            {[
              { label: t.bestIncome, best: hl.bestIncome },
              { label: t.bestOutflow, best: hl.bestOutflow },
            ].map(({ label, best }) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-semibold text-foreground tabular-nums">
                  {best ? (
                    <>
                      {money(best.amount)}
                      <span className="block text-caption font-normal text-muted-foreground">
                        {formatMonth(best.month)}
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <section className="space-y-3">
        <h2 className={BLOCK_TITLE}>{t.tableTitle}</h2>
        <Card className="overflow-hidden">
          <ReportTableView table={data.table} empty={uz.reports.empty} />
        </Card>
      </section>
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
