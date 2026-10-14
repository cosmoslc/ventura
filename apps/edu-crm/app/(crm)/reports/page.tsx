import { ArrowRight, BarChart3, CalendarCheck, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { Card, CardContent } from "@ventura/ui/card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { pagePermissions } from "@/lib/access";
import { REPORTS, type ReportDef, type ReportKey } from "@/lib/server/reports";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";

const t = uz.reports;
export const metadata = { title: t.title };

const ORDER: ReportDef["group"][] = ["finance", "academic", "leads", "teachers"];

interface Item {
  href: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
}

/**
 * Hisobotlar sahifasi (ADR 0030): guruhlangan kartalar. Xodim faqat ruxsati va bo'limi bor hisobotlarni ko'radi;
 * boshqa sahifalardagi hisobotlar (bosh panel, davomat) — havola bilan, qayta yozilmaydi.
 */
export default async function ReportsPage() {
  const { tenant, staff } = await requirePage("reports", "/reports");
  const groups = new Map<ReportDef["group"], Item[]>();
  const push = (g: ReportDef["group"], item: Item) => groups.set(g, [...(groups.get(g) ?? []), item]);

  if (canAny(staff.access, ["dashboard.view", "dashboard.financial_stats", "dashboard.conversion_stats"]))
    push("finance", { href: "/", title: t.linkDashboard, hint: t.linkDashboardHint, icon: <LayoutDashboard /> });
  for (const [key, def] of Object.entries(REPORTS) as [ReportKey, ReportDef][]) {
    if (!canAny(staff.access, def.permissions) || !(await hasFeature(tenant, def.feature))) continue;
    push(def.group, { href: `/reports/${key}`, title: t.titles[key]!, hint: t.hints[key]!, icon: <BarChart3 /> });
  }
  if (canAny(staff.access, pagePermissions("/attendance")) && (await hasFeature(tenant, "attendance")))
    push("academic", {
      href: "/attendance",
      title: t.linkAttendance,
      hint: t.linkAttendanceHint,
      icon: <CalendarCheck />,
    });

  const sections = ORDER.filter((g) => groups.get(g)?.length);
  return (
    <div className="space-y-8">
      <PageHeader title={t.title} description={t.description} />
      {sections.length ? (
        sections.map((g) => (
          <section key={g} className="space-y-3">
            <h2 className="text-caption font-bold tracking-wide text-muted-foreground uppercase">{t.groups[g]}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.get(g)!.map((r) => (
                <Link key={r.href} href={r.href} className="group">
                  <Card className="h-full transition-shadow group-hover:shadow-card-hover">
                    <CardContent className="flex items-start gap-3 p-4">
                      <span className="mt-0.5 text-primary-text [&_svg]:size-5">{r.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-body font-semibold text-foreground">{r.title}</span>
                        <span className="mt-0.5 block text-caption text-muted-foreground">{r.hint}</span>
                      </span>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      ) : (
        <Card>
          <EmptyState icon={<BarChart3 />} title={t.noAccess} />
        </Card>
      )}
    </div>
  );
}
