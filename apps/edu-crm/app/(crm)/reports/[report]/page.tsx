import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { PageHeader } from "@ventura/ui/page-header";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { getLeaveReasons } from "@/lib/server/leave-reasons";
import { todayTashkent } from "@/lib/server/memberships";
import { PLAN_EDIT, planEditorRows } from "@/lib/server/cashflow-reports";
import { getOpeningBalances } from "@/lib/server/opening-balance";
import { REPORTS, isReportKey, reportPeriod } from "@/lib/server/reports";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { LeaveReasonsButton } from "../leave-reasons-button";
import { OpeningBalanceEditor } from "../opening-balance-editor";
import { PlanEditor } from "../plan-editor";
import { ReportFilters } from "../report-filters";
import { REPORT_VIEWS } from "../views";

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
  const finance = canAny(staff.access, ["dashboard.financial_stats"]);
  const data = await def.load({ db: getTenantDb(tenant), filter: branch.filter, period, today, finance });
  const View = REPORT_VIEWS[report];
  const cy = Number(today.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => cy - i);
  const q = new URLSearchParams();
  if (def.periodMode !== "none") q.set("yil", period.year === null ? "all" : String(period.year));
  if (def.periodMode !== "year" && def.periodMode !== "none")
    q.set("oy", period.month === null ? "all" : String(period.month));
  const editor =
    report === "plan" && period.year !== null && canAny(staff.access, PLAN_EDIT)
      ? await planEditorRows(getTenantDb(tenant), branch, period.year)
      : null;
  // Boshlang'ich qoldiq (E6j): hisobotni ko'radigan xodim kiritadi
  const openings =
    report === "cashflow" && canAny(staff.access, PLAN_EDIT) && branch.options.length
      ? await getOpeningBalances(getTenantDb(tenant))
      : null;
  const leaveReasons =
    report === "leaves" && can(staff.access, "groups.edit") ? await getLeaveReasons(getTenantDb(tenant)) : null;

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
        actions={
          editor && period.year !== null ? (
            <PlanEditor year={period.year} rows={editor} branches={branch.options} selectedBranch={branch.selected} />
          ) : openings ? (
            <OpeningBalanceEditor branches={branch.options} openings={openings} today={today} />
          ) : leaveReasons ? (
            <LeaveReasonsButton reasons={leaveReasons} />
          ) : null
        }
      />

      <View data={data} period={period} today={today} finance={finance} />
    </div>
  );
}
