import { can } from "@ventura/auth/staff/policy";
import { smsContext } from "@/lib/server/sms/context";
import { listTemplates } from "@/lib/server/sms/templates";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { TemplatesView } from "./templates-view";

export const metadata = { title: uz.smsTemplates.title };

/** SMS shablonlari (docs/EDU-CRM-SMS.md, S2): matnlar, qismlar soni va Eskiz moderatsiyasi. */
export default async function SmsTemplatesPage() {
  const { tenant, staff } = await requirePage("sms", "/sms/templates");
  const ctx = await smsContext(tenant);
  const rows = await listTemplates(ctx.db);
  return (
    <TemplatesView
      rows={rows}
      centerName={tenant.name}
      connected={ctx.view.connected}
      canWrite={can(staff.access, "settings.sms_gateways")}
    />
  );
}
