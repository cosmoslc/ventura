import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { navFor } from "@ventura/tenants";
import { brandMark } from "@/components/brand";
import { features } from "@/lib/manifest";
import { getBranchContext } from "@/lib/server/branch";
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
      branches={
        branch.enabled && branch.options.length > 1 ? { options: branch.options, selected: branch.selected } : null
      }
    >
      {children}
    </CrmShell>
  );
}
