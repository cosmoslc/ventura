import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { navFor } from "@ventura/tenants";
import { brandMark } from "@/components/brand";
import { features } from "@/lib/manifest";
import { pendingApprovalCount } from "@/lib/server/approvals";
import { getBranchContext } from "@/lib/server/branch";
import { getTenantDb } from "@/lib/server/deps";
import { REPORTS, REPORT_GROUPS, visibleReports } from "@/lib/server/reports";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { CrmShell } from "./crm-shell";

/**
 * Markaz sahifalari: faqat to'liq kirgan xodimlar uchun. Menyuda faqat yoqilgan va xodimga ko'rish
 * ruxsati bor bo'limlar (bo'limning o'zi va manzili baribir serverda yana tekshiriladi).
 */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const nav = navFor(features, tenant.features, (_key, href) => canAny(staff.access, pagePermissions(href)));
  const branch = await getBranchContext();
  // Tasdiqlar (ADR 0019): direktorga — hammasi, "tasdiq bilan" ruxsati bor xodimga — o'z so'rovlari
  const showApprovals = staff.director || staff.access.approvals.size > 0;
  const approvals = showApprovals
    ? {
        label: staff.director ? uz.approvals.navDirector : uz.approvals.navStaff,
        count: await pendingApprovalCount(getTenantDb(tenant), staff),
      }
    : null;
  // Hisobotlar ichki menyusi (eski tizimdagidek: Hisobotlar → guruh → hisobot)
  const reportKeys = nav.some((g) => g.links.some((l) => l.href === "/reports"))
    ? await visibleReports(tenant, staff.access)
    : [];
  const reportMenu = REPORT_GROUPS.map((g) => ({
    id: `reports:${g}`,
    label: uz.reports.navGroups[g]!,
    children: reportKeys
      .filter((k) => REPORTS[k].group === g)
      .map((k) => ({ id: `/reports/${k}`, label: uz.reports.titles[k]! })),
  })).filter((g) => g.children.length);
  return (
    <CrmShell
      staff={{
        name: staff.name,
        roleLabel: staff.director
          ? uz.staff.director
          : staff.positions.map((p) => p.name).join(", ") || uz.staff.noPosition,
      }}
      brand={{ name: tenant.name, mark: brandMark(tenant) }}
      nav={nav}
      approvals={approvals}
      reportMenu={reportMenu}
      branches={
        branch.enabled && branch.options.length > 1 ? { options: branch.options, selected: branch.selected } : null
      }
    >
      {children}
    </CrmShell>
  );
}
