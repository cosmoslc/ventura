import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { Card } from "@ventura/ui/card";
import { MetricCard } from "@ventura/ui/metric-card";
import { PageHeader } from "@ventura/ui/page-header";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { REPORTS, isReportKey, reportPeriod } from "@/lib/server/reports";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { ReportFilters } from "../report-filters";
import { ReportTableView, formatCell } from "../report-table";

const t = uz.reports;

export async function generateMetadata({ params }: { params: Promise<{ report: string }> }) {
  const { report } = await params;
  return { title: t.titles[report] ?? t.title };
}

/** Bitta hisobot (ADR 0030): filtr qatori, qisqa ko'rsatkichlar, jadval va izoh */
export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>;
  searchParams: Promise<{ yil?: string; oy?: string }>;
}) {
  const { report } = await params;
  if (!isReportKey(report)) notFound();
  const def = REPORTS[report];
  const { tenant, staff } = await requirePage("reports", "/reports");
  if (!(await hasFeature(tenant, def.feature))) notFound();
  if (!canAny(staff.access, def.permissions)) redirect("/reports");

  const sp = await searchParams;
  const today = todayTashkent();
  const period = reportPeriod(sp, today, def.periodMode);
  const branch = await getBranchContext();
  const data = await def.load({ db: getTenantDb(tenant), filter: branch.filter, period, today });
  const cy = Number(today.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => cy - i);
  const q = new URLSearchParams();
  if (period.year === null) q.set("yil", "all");
  else q.set("yil", String(period.year));
  if (def.periodMode === "period") q.set("oy", period.month === null ? "all" : String(period.month));

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground hover:text-primary-text"
        >
          <ArrowLeft className="size-3.5" /> {t.back}
        </Link>
        <PageHeader title={t.titles[report]!} description={`${t.hints[report]} · ${period.label}`} />
      </div>

      <ReportFilters
        mode={def.periodMode}
        year={period.year}
        month={period.month}
        years={years}
        excelHref={`/reports/excel/${report}?${q.toString()}`}
      />

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
    </div>
  );
}
