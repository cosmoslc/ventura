import { Card } from "@ventura/ui/card";
import { uz } from "@/lib/uz";
import type { LeavesViewData } from "@/lib/server/academic-reports";
import { KpiRow, PanelEmpty } from "./blocks";
import { LeavesBoard } from "./academic-parts/leaves-board";
import type { ReportViewProps } from "./types";

const t = uz.reports;

/** leaves — KPI, dinamika, muddat, sabablar va guruhlar, chiqishlar ro'yxati */
export function LeavesView({ data }: ReportViewProps) {
  const view = data.view as LeavesViewData;
  return (
    <>
      <KpiRow metrics={data.metrics} />
      {view.list.length ? (
        <LeavesBoard view={view} />
      ) : (
        <Card>
          <PanelEmpty>{t.empty}</PanelEmpty>
        </Card>
      )}
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
