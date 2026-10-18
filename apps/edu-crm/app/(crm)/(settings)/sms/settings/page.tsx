import { ESKIZ_DEFAULT_SENDER, ESKIZ_TEST_MESSAGE } from "@ventura/integrations/eskiz";
import { getTenantDb, tenantDeps } from "@/lib/server/deps";
import { getProviderRow, providerView, smsOverview } from "@/lib/server/sms/provider";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { SmsSettingsView } from "./sms-settings-view";

export const metadata = { title: uz.sms.settingsTitle };

/** SMS sozlamalari (docs/EDU-CRM-SMS.md, S1): Eskiz ulash, yuboruvchi nomi, tinch soatlar, test SMS. */
export default async function SmsSettingsPage() {
  const { tenant } = await requirePage("sms", "/sms/settings");
  const db = getTenantDb(tenant);
  const secret = tenantDeps(tenant)!.secret;
  const row = await getProviderRow(db);
  const overview = await smsOverview(db, row, secret);
  return (
    <SmsSettingsView
      provider={providerView(row, secret)}
      nicks={overview?.nicks ?? []}
      eskizError={overview?.error ?? null}
      defaultSender={ESKIZ_DEFAULT_SENDER}
      testMessage={ESKIZ_TEST_MESSAGE}
    />
  );
}
