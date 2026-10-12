import { can } from "@ventura/auth/staff/policy";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { PaymentSettingsView } from "./settings-view";

export const metadata = { title: uz.financeSettings.title };

export default async function PaymentSettingsPage() {
  const { tenant, staff } = await requirePage("payments", "/payment-settings");
  const db = getTenantDb(tenant);
  const [methods, settings] = await Promise.all([ensurePaymentMethods(db), getFinanceSettings(db)]);
  return (
    <PaymentSettingsView
      methods={methods}
      settings={settings}
      canMethods={can(staff.access, "settings.receipt")}
      canBilling={can(staff.access, "settings.courses")}
    />
  );
}
