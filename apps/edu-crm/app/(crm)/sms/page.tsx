import { ESKIZ_DEFAULT_SENDER } from "@ventura/integrations/eskiz";
import { getTenantDb, tenantDeps } from "@/lib/server/deps";
import { getProviderRow, providerView, smsOverview } from "@/lib/server/sms/provider";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { SmsView } from "./sms-view";

export const metadata = { title: uz.sms.title };

/** SMS bosh sahifasi (docs/EDU-CRM-SMS.md, S1): Eskiz balansi va hisob holati; ulanmagan bo'lsa — ulashga yo'l. */
export default async function SmsPage() {
  const { tenant } = await requirePage("sms", "/sms");
  const db = getTenantDb(tenant);
  const secret = tenantDeps(tenant)!.secret;
  const row = await getProviderRow(db);
  const provider = providerView(row, secret);
  const overview = provider.connected ? await smsOverview(db, row, secret) : null;
  return (
    <SmsView
      connected={provider.connected}
      balance={overview?.balance ?? null}
      sender={provider.sender ?? uz.sms.senderDefault(ESKIZ_DEFAULT_SENDER)}
      accountStatus={overview?.accountStatus ?? null}
      error={overview?.error ?? null}
    />
  );
}
