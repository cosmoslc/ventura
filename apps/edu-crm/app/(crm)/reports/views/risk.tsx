import { Card } from "@ventura/ui/card";
import { uz } from "@/lib/uz";
import type { RiskViewData } from "@/lib/server/academic-reports";
import { KpiRow } from "./blocks";
import { RiskBoard } from "./academic-parts/risk-board";
import type { ReportViewProps } from "./types";

const k = uz.reports.risk;

/** risk — KPI, daraja va omillar bo'yicha taqsimot, guruhlar, darajalar bo'yicha ro'yxat */
export function RiskView({ data }: ReportViewProps) {
  const view = data.view as RiskViewData;
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {view.list.length ? (
        <RiskBoard view={view} />
      ) : (
        <Card className="grid min-h-40 place-content-center gap-1 p-6 text-center">
          <p className="text-body font-semibold text-foreground">{k.emptyTitle}</p>
          <p className="text-caption text-muted-foreground">{k.emptyHint}</p>
        </Card>
      )}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
