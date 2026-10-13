import { ArrowRight, Building2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type StaffAccess, can, canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { type Tenant, hasFeature, navFor } from "@ventura/tenants";
import { Card, CardContent } from "@ventura/ui/card";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { features } from "@/lib/manifest";
import { resolvePeriod } from "@/lib/dashboard";
import { getBranchContext } from "@/lib/server/branch";
import { type DashboardData, loadDashboard } from "@/lib/server/dashboard";
import { getTenantDb } from "@/lib/server/deps";
import { todayTashkent } from "@/lib/server/memberships";
import { type Staff, requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { FeatureIcon } from "./crm-shell";
import { type DashboardLinks, DashboardView } from "./dashboard-view";

export const metadata = { title: uz.home.title };

const DASHBOARD = ["dashboard.view", "dashboard.financial_stats", "dashboard.conversion_stats"] as const;
const LINK_PAGES = {
  payments: ["payments", "/payments"],
  salaries: ["salaries", "/salaries"],
  expenses: ["expenses", "/expenses"],
  debtors: ["debtors", "/debtors"],
  attendance: ["attendance", "/attendance"],
  students: ["students", "/students"],
  groups: ["groups", "/groups"],
  teachers: ["teachers", "/teachers"],
  rooms: ["groups", "/rooms"],
} as const;

const yearParam = (v: string | undefined, current: number): number | null =>
  v === "all" ? null : v && /^\d{4}$/.test(v) ? Number(v) : current;
const monthParam = (v: string | undefined, current: number): number | null =>
  v === "all" ? null : v && /^(?:[1-9]|1[0-2])$/.test(v) ? Number(v) : current;

/**
 * Bosh sahifa. Boshqaruv paneli ruxsati bor xodimga — eski tizimdagi Bosh panel (ADR 0017), qolganlarga — kim
 * kirgani va ochiq bo'limlar.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ ruxsat?: string; yil?: string; oy?: string }>;
}) {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const sp = await searchParams;
  const notice = sp.ruxsat === "yoq" ? <Notice tone="warning">{uz.home.noPermission}</Notice> : null;
  if (!canAny(staff.access, DASHBOARD)) return <SimpleHome tenant={tenant} staff={staff} notice={notice} />;

  const today = todayTashkent();
  const period = resolvePeriod(
    yearParam(sp.yil, Number(today.slice(0, 4))),
    monthParam(sp.oy, Number(today.slice(5, 7))),
    today,
  );
  const branch = await getBranchContext();
  const finance = can(staff.access, "dashboard.financial_stats");
  const data = await loadDashboard(getTenantDb(tenant), branch.filter, period, today);
  return (
    <div className="space-y-4">
      {notice}
      <DashboardView
        data={finance ? data : withoutMoney(data)}
        period={period}
        generatedAt={new Date().toISOString()}
        finance={finance}
        conversion={can(staff.access, "dashboard.conversion_stats")}
        links={await linksFor(tenant, staff.access)}
      />
    </div>
  );
}

/** Ruxsat bo'lmasa pul raqamlari brauzerga umuman yuborilmaydi */
function withoutMoney(d: DashboardData): DashboardData {
  const zero = {
    income: 0,
    expense: 0,
    refund: 0,
    salary: 0,
    advance: 0,
    advanceCount: 0,
    outflow: 0,
    profit: 0,
    payCount: 0,
    categories: {},
  };
  return {
    ...d,
    cur: zero,
    prev: null,
    months: d.months.map((m) => ({ ...m, income: 0, outflow: 0, profit: 0, refund: 0, advance: 0, payCount: 0 })),
    days: [],
    expected: 0,
    covered: 0,
    totalDebt: 0,
    debtors: 0,
    groups: d.groups.map((g) => ({ ...g, expected: 0, covered: 0, payPct: 0, debt: 0, debtors: 0 })),
    events: [],
  };
}

async function linksFor(tenant: Tenant, access: StaffAccess): Promise<DashboardLinks> {
  const out: DashboardLinks = {};
  for (const [key, [feature, href]] of Object.entries(LINK_PAGES) as [
    keyof DashboardLinks,
    readonly [string, string],
  ][]) {
    if (canAny(access, pagePermissions(href)) && (await hasFeature(tenant, feature))) out[key] = href;
  }
  return out;
}

function SimpleHome({ tenant, staff, notice }: { tenant: Tenant; staff: Staff; notice: React.ReactNode }) {
  const links = navFor(features, tenant.features, (_key, href) => canAny(staff.access, pagePermissions(href))).flatMap(
    (g) => g.links,
  );
  const branches = staff.scope === "all" ? uz.home.allBranches : uz.home.branchCount(staff.scope.length);

  return (
    <div className="space-y-6">
      <PageHeader title={uz.home.greeting(staff.name)} description={tenant.name} />
      {notice}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <ShieldCheck className="mt-0.5 size-5 text-primary-text" />
            <div>
              <div className="text-caption text-muted-foreground">{uz.home.role}</div>
              <div className="text-body font-bold text-foreground">
                {staff.director
                  ? uz.staff.director
                  : staff.positions.map((p) => p.name).join(", ") || uz.staff.noPosition}
              </div>
              <div className="text-caption text-muted-foreground">
                {staff.director ? uz.staff.directorHint : uz.staff.permissionCount(staff.access.permissions.size)}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-start gap-3 pt-6">
            <Building2 className="mt-0.5 size-5 text-primary-text" />
            <div>
              <div className="text-caption text-muted-foreground">{uz.home.branches}</div>
              <div className="text-body font-bold text-foreground">{branches}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <section>
        <h2 className="type-heading text-title text-foreground">{uz.home.sections}</h2>
        <p className="mt-1 text-body text-muted-foreground">{uz.home.sectionsHint}</p>
        {links.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="group">
                <Card className="transition-shadow group-hover:shadow-card-hover">
                  <CardContent className="flex items-center gap-3 pt-6">
                    <FeatureIcon feature={l.feature} href={l.href} className="size-5" />
                    <span className="flex-1 text-body font-semibold text-foreground">{l.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4">
            <EmptyState icon={<ShieldCheck />} title={uz.home.noSections} description={uz.home.noSectionsHint} />
          </Card>
        )}
      </section>
    </div>
  );
}
