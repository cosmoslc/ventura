import { can } from "@ventura/auth/staff/policy";
import { qrTarget } from "@/lib/center-settings";
import { getCenterSettings, getReceiptConfig } from "@/lib/server/center";
import { getTenantDb } from "@/lib/server/deps";
import { ensurePaymentMethods, getFinanceSettings } from "@/lib/server/finance";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { PaymentSettingsView } from "./settings-view";

export const metadata = { title: uz.financeSettings.title };

export default async function PaymentSettingsPage() {
  const { tenant, staff } = await requirePage("payments", "/payment-settings");
  const db = getTenantDb(tenant);
  const [methods, settings, receipt, center] = await Promise.all([
    ensurePaymentMethods(db),
    getFinanceSettings(db),
    getReceiptConfig(db),
    getCenterSettings(db),
  ]);
  return (
    <PaymentSettingsView
      methods={methods}
      settings={settings}
      canMethods={can(staff.access, "settings.receipt")}
      canBilling={can(staff.access, "settings.courses")}
      receipt={{
        config: receipt,
        centerName: tenant.name,
        phone: center.phone,
        place: center.address,
        qrLink: qrTarget(center),
        canEdit: can(staff.access, "settings.receipt"),
      }}
    />
  );
}
