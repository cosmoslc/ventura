import { BLOCK_TITLE } from "./blocks";
import { Card } from "@ventura/ui/card";
import { DonutChart } from "@ventura/ui/donut-chart";
import { MetricCard } from "@ventura/ui/metric-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { money } from "@/lib/format";
import { percent } from "@/lib/reports";
import type { CourseViewData } from "@/lib/server/finance-reports";
import { uz } from "@/lib/uz";
import { formatCell } from "../report-table";
import { MonthlyChart } from "./finance-parts/monthly-chart";
import { DeltaFoot, MoneyCard, NumTd, Panel, ShareBar, donutCenter, donutSegments } from "./finance-parts/parts";
import type { ReportViewProps } from "./types";

const k = uz.reports.courses;

/** Kurs bo'yicha daromad: ko'rsatkichlar, kurslar ulushi, oylar dinamikasi va kurslar jadvali */
export function CoursesView({ data }: ReportViewProps) {
  const v = data.view as CourseViewData;
  const segments = donutSegments(
    v.rows.map((r): [string, number] => [r.course, r.charged]),
    k.other,
  );
  const { center, unit } = donutCenter(v.charged);
  const discountTotal = v.rows.reduce((s, r) => s + (r.discount ?? 0), 0);

  const scale = 100 / Math.max(1, ...v.rows.map((r) => r.share ?? 0));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MoneyCard
          label={k.charged}
          amount={v.charged}
          foot={<DeltaFoot cur={v.charged} prev={v.prev} good="up" vs={k.vsPrev} none={k.noPrev} />}
        />
        <MoneyCard
          label={k.cash}
          amount={v.cash}
          foot={v.charged ? k.cashFoot(formatCell(percent(v.cash, v.charged), "percent")) : undefined}
        />
        <MetricCard label={k.students} value={money(v.students)} foot={k.studentsFoot(v.courses, v.groups)} />
        <MoneyCard label={k.perStudent} amount={v.perStudent} foot={k.perStudentFoot} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <Panel title={k.shareTitle}>
          <DonutChart segments={segments} center={center} unit={unit} size={150} emptyText={k.noData} />
        </Panel>
        <Panel title={k.trendTitle}>
          <MonthlyChart
            caption={k.trendCaption}
            emptyText={k.noData}
            series={[
              { key: "charged", label: k.charged, color: 1 },
              { key: "cash", label: k.cash, color: 2 },
            ]}
            points={v.trend.map((t) => ({ month: t.month, values: [t.charged, t.cash] }))}
          />
        </Panel>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <h2 className={BLOCK_TITLE}>{k.tableTitle}</h2>
        </div>
        {v.rows.length ? (
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th className="sticky left-0 z-(--z-raised) bg-card">{k.course}</Th>
                  {[k.groups, k.students, k.base, k.discount, k.charged, k.cash, k.share].map((l) => (
                    <Th key={l} className="text-right">
                      {l}
                    </Th>
                  ))}
                </tr>
              </THead>
              <TBody>
                {v.rows.map((r) => (
                  <Tr key={r.course}>
                    <Td className="sticky left-0 z-(--z-raised) min-w-44 bg-card">
                      <div className="truncate font-semibold text-foreground" title={r.course}>
                        {r.course}
                      </div>
                      <ShareBar value={(r.share ?? 0) * scale} className="mt-1.5 max-w-40" />
                    </Td>
                    <NumTd value={r.groups} count />
                    <NumTd value={r.students} count />
                    <NumTd value={r.base} />
                    <NumTd value={r.discount} />
                    <NumTd value={r.charged} strong />
                    <NumTd value={r.cash} />
                    <NumTd value={r.share} percent />
                  </Tr>
                ))}
                <Tr className="border-t-2 border-border font-bold hover:bg-transparent">
                  <Td className="sticky left-0 z-(--z-raised) bg-card text-foreground">{uz.reports.total}</Td>
                  <NumTd value={v.groups} count />
                  <NumTd value={v.students} count />
                  <NumTd value={v.rows.reduce((s, r) => s + r.base, 0)} />
                  <NumTd value={discountTotal || null} />
                  <NumTd value={v.charged} strong />
                  <NumTd value={v.cash} />
                  <NumTd value={v.charged ? 100 : null} percent />
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
