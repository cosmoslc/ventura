import { STAFF_ROLE_LABELS, can } from "@ventura/auth/staff/policy";
import { navFor } from "@ventura/tenants";
import { brandMark } from "@/components/brand";
import { features } from "@/lib/manifest";
import { requireStaff, requireTenant } from "@/lib/server/session";
import { CrmShell } from "./crm-shell";

/**
 * Markaz sahifalari: faqat to'liq kirgan xodimlar uchun. Menyuda faqat yoqilgan va xodimga ko'rish
 * ruxsati bor bo'limlar (bo'limning o'zi va manzili baribir serverda yana tekshiriladi).
 */
export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  const staff = await requireStaff();
  const nav = navFor(features, tenant.features, (key) => can(staff.role, `${key}.view`));
  return (
    <CrmShell
      staff={{ name: staff.name, roleLabel: STAFF_ROLE_LABELS[staff.role] }}
      brand={{ name: tenant.name, mark: brandMark(tenant) }}
      nav={nav}
    >
      {children}
    </CrmShell>
  );
}
