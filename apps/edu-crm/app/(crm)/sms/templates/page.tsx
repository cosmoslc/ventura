import { can } from "@ventura/auth/staff/policy";
import { getTenantDb, tenantDeps } from "@/lib/server/deps";
import { getProviderRow, providerView } from "@/lib/server/sms/provider";
import { listTemplates } from "@/lib/server/sms/templates";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { TemplatesView } from "./templates-view";

export const metadata = { title: uz.smsTemplates.title };

/** SMS shablonlari (docs/EDU-CRM-SMS.md, S2): matnlar, qismlar soni va Eskiz moderatsiyasi. */
export default async function SmsTemplatesPage() {
  const { tenant, staff } = await requirePage("sms", "/sms/templates");
  const db = getTenantDb(tenant);
  const [rows, row] = await Promise.all([listTemplates(db), getProviderRow(db)]);
  return (
    <TemplatesView
      rows={rows}
      centerName={tenant.name}
      connected={providerView(row, tenantDeps(tenant)!.secret).connected}
      canWrite={can(staff.access, "settings.sms_gateways")}
    />
  );
}
