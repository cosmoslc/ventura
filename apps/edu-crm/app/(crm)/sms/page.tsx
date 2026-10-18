import { ESKIZ_DEFAULT_SENDER } from "@ventura/integrations/eskiz";
import { getTenantDb, tenantDeps } from "@/lib/server/deps";
import { recentMessages } from "@/lib/server/sms/messages";
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
  const [overview, messages] = await Promise.all([
    provider.connected ? smsOverview(db, row, secret) : null,
    provider.connected ? recentMessages(db) : [],
  ]);
  return (
    <SmsView
      connected={provider.connected}
      balance={overview?.balance ?? null}
      sender={provider.sender ?? uz.sms.senderDefault(ESKIZ_DEFAULT_SENDER)}
      accountStatus={overview?.accountStatus ?? null}
      error={overview?.error ?? null}
      messages={messages}
    />
  );
}
