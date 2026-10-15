import { BLOCK_TITLE } from "./blocks";
import { Card } from "@ventura/ui/card";
import { DonutChart } from "@ventura/ui/donut-chart";
import { MetricCard } from "@ventura/ui/metric-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { money } from "@/lib/format";
import { percent } from "@/lib/reports";
import type { ExpenseViewData } from "@/lib/server/finance-reports";
import { uz } from "@/lib/uz";
import { formatCell } from "../report-table";
import { DeltaFoot, MoneyCard, NumTd, Panel, ShareBar, donutCenter, donutSegments } from "./finance-parts/parts";
import { MonthlyChart } from "./finance-parts/monthly-chart";
import type { ReportViewProps } from "./types";

const e = uz.reports.expenses;
const som = uz.common.som;
const pct = (v: number | null) => formatCell(v, "percent");

/** Xarajatlar tahlili: ko'rsatkichlar, toifalar ulushi, oylar dinamikasi va toifalar jadvali */
export function ExpensesView({ data }: ReportViewProps) {
  const v = data.view as ExpenseViewData;
  const done = v.plan ? percent(v.fact, v.plan) : null;
  const over = done !== null && done > 100;
  const segments = donutSegments(
    v.rows.map((r): [string, number] => [r.category, r.fact]),
    e.other,
  );
  const { center, unit } = donutCenter(v.fact);

  const scale = 100 / Math.max(1, ...v.rows.map((r) => r.share ?? 0));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoneyCard
          label={e.kpiTotal}
          amount={v.fact}
          foot={<DeltaFoot cur={v.fact} prev={v.prev} good="down" vs={e.vsPrev} none={e.noPrev} />}
        />
        <MoneyCard label={e.fixed} amount={v.fixed} foot={e.ofTotal(pct(percent(v.fixed, v.fact)))} />
        <MoneyCard label={e.variable} amount={v.variable} foot={e.ofTotal(pct(percent(v.variable, v.fact)))} />
        <MetricCard
          label={e.vsPlan}
          value={pct(done)}
          tone={over ? "danger" : "neutral"}
          colorValue={over}
          foot={v.plan ? e.planOf(money(v.plan)) : e.noPlan}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title={e.shareTitle}>
          <DonutChart segments={segments} center={center} unit={unit} size={150} emptyText={e.noData} />
        </Panel>
        <Panel title={e.trendTitle}>
          <MonthlyChart
            caption={e.trendCaption}
            emptyText={e.noData}
            series={[
              { key: "fixed", label: e.fixed, color: 1 },
              { key: "variable", label: e.variable, color: 2 },
            ]}
            points={v.trend.map((t) => ({
              month: t.month,
              values: [t.fixed, t.variable],
              note: e.totalNote(`${money(t.fixed + t.variable)} ${som}`),
            }))}
          />
        </Panel>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className={BLOCK_TITLE}>{e.tableTitle}</h2>
          <span className="text-caption text-muted-foreground">{e.incomeFoot(money(v.income))}</span>
        </div>
        {v.rows.length ? (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th className="sticky left-0 z-(--z-raised) bg-card">{e.category}</Th>
                  {[e.plan, e.fact, e.diff, e.done, e.share, e.ofIncome].map((l) => (
                    <Th key={l} className="text-right">
                      {l}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {v.rows.map((r) => (
                  <Tr key={r.category}>
                    <Td className="sticky left-0 z-(--z-raised) min-w-44 bg-card">
                      <div className="truncate font-semibold text-foreground" title={r.category}>
                        {r.category}
                      </div>
                      <ShareBar value={r.share * scale} className="mt-1.5 max-w-40" />
                    </Td>
                    <NumTd value={r.plan} />
                    <NumTd value={r.fact} strong />
                    <NumTd value={r.diff} signed />
                    <NumTd value={r.done} percent bad={r.done !== null && r.done > 100} />
                    <NumTd value={r.share} percent />
                    <NumTd value={r.ofIncome} percent />
                  </Tr>
                ))}
                <Tr className="border-t-2 border-border font-bold hover:bg-transparent">
                  <Td className="sticky left-0 z-(--z-raised) bg-card text-foreground">{uz.reports.total}</Td>
                  <NumTd value={v.plan} />
                  <NumTd value={v.fact} strong />
                  <NumTd value={v.plan ? v.plan - v.fact : null} signed />
                  <NumTd value={done} percent bad={over} />
                  <NumTd value={v.fact ? 100 : null} percent />
                  <NumTd value={percent(v.fact, v.income)} percent />
                </Tr>
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <p className="py-16 text-center text-body text-muted-foreground">{uz.reports.empty}</p>
        )}
      </Card>
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
