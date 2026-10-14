import Link from "next/link";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { uz } from "@/lib/uz";
import type { RetentionViewData } from "@/lib/server/academic-reports";
import { BarList, type BarItem } from "./academic-parts/bar-list";
import { CohortHeatmap } from "./academic-parts/cohort-heatmap";
import { durationLabel, pct1 } from "./academic-parts/format";
import { BLOCK_TITLE, KpiRow, Panel, PanelEmpty } from "./blocks";
import { RetentionTrend } from "./academic-parts/retention-trend";
import type { ReportViewProps } from "./types";

const k = uz.reports.retention;

/** retention — KPI, oylik dinamika, kohorta matritsasi, kurslar va sabablar, ketgan o'quvchilar */
export function RetentionView({ data }: ReportViewProps) {
  const view = data.view as RetentionViewData;
  const maxReason = Math.max(1, ...view.reasons.map((r) => r.count));
  const courseItems: BarItem[] = view.courses.map((c) => ({
    key: c.name,
    label: c.name,
    sub: k.coursesFoot(c.churned, c.base),
    display: pct1(c.churnRate),
    fraction: c.churnRate / 100,
    tone: "danger",
  }));
  const reasonItems: BarItem[] = view.reasons.map((r) => ({
    key: r.reason,
    label: r.reason,
    display: String(r.count),
    share: pct1(r.share),
    fraction: r.count / maxReason,
    tone: r.none ? "muted" : "primary",
  }));

  return (
    <>
      <KpiRow metrics={data.metrics} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={k.trendTitle}>
          {view.trend.length >= 2 && view.trend.some((p) => p.churned > 0) ? (
            <RetentionTrend trend={view.trend} />
          ) : (
            <PanelEmpty>{uz.reports.empty}</PanelEmpty>
          )}
        </Panel>
        <Panel title={k.cohorts} sub={k.cohortsSub}>
          <CohortHeatmap cohorts={view.cohorts} />
        </Panel>
        <Panel title={k.coursesTitle}>
          {view.courses.some((c) => c.churned > 0) ? (
            <BarList items={courseItems} limit={6} moreLabel={k.showAll(courseItems.length)} lessLabel={k.showLess} />
          ) : (
            <PanelEmpty>{uz.reports.empty}</PanelEmpty>
          )}
        </Panel>
        <Panel title={k.reasonsTitle}>
          {reasonItems.length ? (
            <BarList items={reasonItems} limit={6} moreLabel={k.showAll(reasonItems.length)} lessLabel={k.showLess} />
          ) : (
            <PanelEmpty>{uz.reports.empty}</PanelEmpty>
          )}
        </Panel>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 px-4 pt-4 pb-2">
          <h2 className={BLOCK_TITLE}>{k.listTitle}</h2>
          {view.listTotal > view.list.length ? (
            <span className="text-caption text-muted-foreground">{k.shownCap(view.list.length, view.listTotal)}</span>
          ) : null}
        </div>
        {view.list.length ? (
          <TableWrap>
            <Table className="min-w-[760px]">
              <THead>
                <tr>
                  <Th>{k.student}</Th>
                  <Th>{k.course}</Th>
                  <Th>{k.joined}</Th>
                  <Th>{k.left}</Th>
                  <Th>{k.tenureCol}</Th>
                  <Th>{k.reason}</Th>
                </tr>
              </THead>
              <TBody>
                {view.list.map((r) => (
                  <Tr key={r.studentId}>
                    <Td className="font-semibold whitespace-nowrap text-foreground">
                      <Link href={`/students/${r.studentId}`} className="hover:text-primary-text">
                        {r.student}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{r.course}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{r.joined}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{r.left}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{durationLabel(r.days)}</Td>
                    <Td
                      className={cn("max-w-72 truncate", r.none ? "text-muted-foreground" : "text-foreground")}
                      title={r.reason}
                    >
                      {r.reason}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <PanelEmpty>{uz.reports.empty}</PanelEmpty>
        )}
      </Card>
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
    </>
  );
}
