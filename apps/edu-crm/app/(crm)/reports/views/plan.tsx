import { Card } from "@ventura/ui/card";
import { hasForecastGap, planPoints } from "@/lib/cashflow-views";
import type { PlanViewData } from "@/lib/server/cashflow-reports";
import { uz } from "@/lib/uz";
import { PlanTrend } from "./cashflow-parts/charts";
import { PlanGroup, PlanLegend, type PlanRowData } from "./cashflow-parts/plan-rows";
import { BLOCK_TITLE } from "./blocks";
import type { ReportViewProps } from "./types";

const p = uz.reports.plan;

/**
 * Reja, fakt va prognoz: har qator uchun fakt chizig'i, reja belgisi va prognoz; bir necha oy tanlangan bo'lsa —
 * oyma-oy kirim va chiqim grafigi. Jadvaldagi raqamlar (Excel ham) shu qatorlarda: bajarilish va prognoz/reja ham.
 */
export function PlanView({ data, today }: ReportViewProps) {
  const view = data.view as PlanViewData;
  const { lines, income, outflow, net } = view;
  const incomeRows: PlanRowData[] = [
    { label: p.incomeTotal, cell: income, total: true },
    { label: p.payments, cell: lines.payments },
    { label: p.extra, cell: lines.income },
  ];
  const outflowRows: PlanRowData[] = [
    { label: p.outflowTotal, cell: outflow, total: true },
    { label: p.salary, cell: lines.salary },
    { label: p.expenses, cell: lines.expenses },
    { label: p.refunds, cell: lines.refunds },
  ];
  const all = [...incomeRows, ...outflowRows, { label: p.net, cell: net }].map((r) => r.cell);
  const multi = view.months.length > 1;

  return (
    <>
      <PlanLegend forecast={all.some(hasForecastGap)} plan={all.some((c) => c.plan)} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="min-w-0">
          <PlanGroup title={p.income} rows={incomeRows} />
        </Card>
        <Card className="min-w-0">
          <PlanGroup title={p.outflow} rows={outflowRows} lowerIsBetter />
        </Card>
      </div>

      <Card>
        <PlanGroup rows={[{ label: p.net, cell: net, total: true }]} />
      </Card>

      {multi ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(
            [
              ["income", p.trendIncome, p.trendIncomeCaption],
              ["outflow", p.trendOutflow, p.trendOutflowCaption],
            ] as const
          ).map(([key, title, caption]) => (
            <Card key={key} className="relative min-w-0 overflow-hidden">
              <div className="flex flex-col gap-4 p-5">
                <h2 className={BLOCK_TITLE}>{title}</h2>
                <PlanTrend points={planPoints(view.months, key, today)} caption={caption} />
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
