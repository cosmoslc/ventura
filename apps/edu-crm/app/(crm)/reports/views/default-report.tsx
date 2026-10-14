import { Card } from "@ventura/ui/card";
import { MetricCard } from "@ventura/ui/metric-card";
import { uz } from "@/lib/uz";
import { ReportTableView, formatCell } from "../report-table";
import type { ReportViewProps } from "./types";

const t = uz.reports;

/** Umumiy ko'rinish: qisqa ko'rsatkichlar, jadval, izoh va qo'shimcha jadvallar */
export function DefaultReport({ data }: Pick<ReportViewProps, "data">) {
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

      <Card className="overflow-hidden">
        <ReportTableView table={data.table} empty={t.empty} />
      </Card>
      {data.note ? <p className="text-caption text-muted-foreground">{data.note}</p> : null}
      {data.extra?.map((x) => (
        <section key={x.title} className="space-y-3">
          <h2 className="type-heading text-lg text-foreground">{x.title}</h2>
          <Card className="overflow-hidden">
            <ReportTableView table={x.table} empty={t.empty} />
          </Card>
        </section>
      ))}
    </>
  );
}
