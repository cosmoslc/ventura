import "server-only";
import { canAny } from "@ventura/auth/staff/policy";
import { pagePermissions } from "@/lib/access";
import { type SettingsGroup, visibleSettings } from "@/lib/settings-nav";
import type { requireStaff, requireTenant } from "./session";

/**
 * Xodim ko'ra oladigan sozlamalar (ADR 0051): bo'lim yoqilgan va sahifa ruxsati bor (ruxsati yozilmagan sahifa —
 * o'z profili, bildirishnomalar — har bir xodimga ochiq; sahifaning o'zi serverda yana tekshiradi).
 */
export function settingsFor(
  tenant: Awaited<ReturnType<typeof requireTenant>>,
  staff: Awaited<ReturnType<typeof requireStaff>>,
): SettingsGroup[] {
  const on = new Set<string>(tenant.features);
  return visibleSettings((item) => {
    if (item.feature && !on.has(item.feature)) return false;
    const needed = pagePermissions(item.href);
    return needed.length === 0 || canAny(staff.access, needed);
  });
}
