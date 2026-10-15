import { canAny } from "@ventura/auth/staff/policy";
import { hasFeature } from "@ventura/tenants";
import { pagePermissions } from "@/lib/access";
import { REPORTS, visibleReports } from "@/lib/server/reports";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { type HubItem, ReportsHub } from "./hub";

const t = uz.reports;
export const metadata = { title: t.title };

/**
 * Hisobotlar sahifasi (ADR 0030): guruhlangan kartalar. Xodim faqat ruxsati va bo'limi bor hisobotlarni ko'radi;
 * boshqa sahifalardagi hisobotlar (bosh panel, davomat) — havola bilan, qayta yozilmaydi.
 */
export default async function ReportsPage() {
  const { tenant, staff } = await requirePage("reports", "/reports");
  const items: HubItem[] = [];

  if (canAny(staff.access, ["dashboard.view", "dashboard.financial_stats", "dashboard.conversion_stats"]))
    items.push({ group: "finance", href: "/", title: t.linkDashboard, hint: t.linkDashboardHint });
  for (const key of await visibleReports(tenant, staff.access))
    items.push({ group: REPORTS[key].group, href: `/reports/${key}`, title: t.titles[key]!, hint: t.hints[key]! });
  if (canAny(staff.access, pagePermissions("/attendance")) && (await hasFeature(tenant, "attendance")))
    items.push({ group: "academic", href: "/attendance", title: t.linkAttendance, hint: t.linkAttendanceHint });

  return <ReportsHub items={items} />;
}
