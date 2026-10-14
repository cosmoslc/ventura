import { BLOCK_TITLE } from "./blocks";
import { Card } from "@ventura/ui/card";
import { DonutChart } from "@ventura/ui/donut-chart";
import { MetricCard } from "@ventura/ui/metric-card";
import { money } from "@/lib/format";
import type { DiscountViewData } from "@/lib/server/finance-reports";
import { uz } from "@/lib/uz";
import { ReportTableView, formatCell } from "../report-table";
import { MonthlyChart } from "./finance-parts/monthly-chart";
import { DeltaFoot, MoneyCard, Panel, ShareBar, donutCenter, donutSegments } from "./finance-parts/parts";
import type { ReportViewProps } from "./types";

const d = uz.reports.discounts;
const som = uz.common.som;
const pct = (part: number, whole: number) => formatCell(whole > 0 ? (part / whole) * 100 : null, "percent");

/** Chegirmalar tahlili: ko'rsatkichlar, kurslar ulushi, oylar dinamikasi, guruhlar reytingi va o'quvchilar jadvali */
export function DiscountsView({ data }: ReportViewProps) {
  const v = data.view as DiscountViewData;
  const segments = donutSegments(
    v.courses.map((c): [string, number] => [c.name, c.total]),
    d.other,
  );
  const { center, unit } = donutCenter(v.total);
  const top = Math.max(1, ...v.groups.map((g) => g.total));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoneyCard
          label={d.total}
          amount={v.total}
          foot={<DeltaFoot cur={v.total} prev={v.prev} good="down" vs={d.vsPrev} none={d.noPrev} />}
        />
        <MetricCard label={d.recipients} value={money(v.recipients)} foot={d.rulesFoot(v.activeRules, v.endedRules)} />
        <MetricCard label={d.share} value={pct(v.total, v.base)} foot={d.shareFoot} />
        <MoneyCard label={d.average} amount={v.recipients ? Math.round(v.total / v.recipients) : null} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title={d.courseTitle}>
          <DonutChart segments={segments} center={center} unit={unit} size={150} emptyText={d.noData} />
        </Panel>
        <Panel title={d.trendTitle}>
          <MonthlyChart
            caption={d.trendCaption}
            emptyText={d.noData}
            series={[
              { key: "permanent", label: d.permanent, color: 1 },
              { key: "once", label: d.once, color: 2 },
            ]}
            points={v.trend.map((t) => ({
              month: t.month,
              values: [t.permanent, t.once],
              note: d.totalNote(`${money(t.permanent + t.once)} ${som}`),
            }))}
          />
        </Panel>
      </div>

      <Panel title={d.groupTitle}>
        {v.groups.length ? (
          <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
            {v.groups.map((g, i) => (
              <li key={`${g.name}-${i}`} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-body font-semibold text-foreground" title={g.name}>
                    {g.name}
                  </span>
                  <span className="shrink-0 text-body font-semibold text-foreground tabular-nums">
                    {money(g.total)} <small className="font-normal text-muted-foreground">{som}</small>
                  </span>
                </div>
                <div className="truncate text-caption text-muted-foreground">
                  {d.groupFoot(g.course, g.base > 0 ? pct(g.total, g.base) : "")}
                </div>
                <ShareBar value={(g.total / top) * 100} className="mt-1.5" />
              </li>
            ))}
          </ul>
        ) : (
          <p className="grid min-h-24 place-items-center text-center text-caption text-muted-foreground">{d.noData}</p>
        )}
      </Panel>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className={BLOCK_TITLE}>{d.tableTitle}</h2>
        </div>
        <ReportTableView table={data.table} empty={uz.reports.empty} />
      </Card>
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
