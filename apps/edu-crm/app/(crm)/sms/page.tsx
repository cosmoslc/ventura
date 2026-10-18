import { can } from "@ventura/auth/staff/policy";
import { ESKIZ_DEFAULT_SENDER } from "@ventura/integrations/eskiz";
import type { RelayWallet } from "@ventura/integrations/relay";
import { smsContext } from "@/lib/server/sms/context";
import { recentMessages } from "@/lib/server/sms/messages";
import { smsOverview } from "@/lib/server/sms/provider";
import { requirePage } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { SmsView } from "./sms-view";

export const metadata = { title: uz.sms.title };

/**
 * SMS bosh sahifasi: Ventura paketida — SMS qoldig'i va paketlar (ADR 0056); o'z Eskiz hisobida — balans va hisob holati
 * (ADR 0053). Ikkalasida ham pastda so'nggi xabarlar.
 */
export default async function SmsPage() {
  const { tenant, staff } = await requirePage("sms", "/sms");
  const ctx = await smsContext(tenant);
  const { view } = ctx;
  const messages = view.connected ? await recentMessages(ctx.db) : [];

  if (view.mode === "ventura") {
    let wallet: RelayWallet | null = null;
    let error: string | null = null;
    if (ctx.relay) {
      try {
        wallet = await ctx.relay.wallet();
      } catch (e) {
        error = (e as Error).message;
      }
    }
    return (
      <SmsView
        view={view}
        ventura={{ wallet, canBuy: can(staff.access, "settings.sms_gateways") }}
        own={null}
        error={error}
        messages={messages}
      />
    );
  }

  const overview = view.connected ? await smsOverview(ctx.db, ctx.row, ctx.secret) : null;
  return (
    <SmsView
      view={view}
      ventura={null}
      own={{
        balance: overview?.balance ?? null,
        sender: view.sender ?? uz.sms.senderDefault(ESKIZ_DEFAULT_SENDER),
        accountStatus: overview?.accountStatus ?? null,
      }}
      error={overview?.error ?? null}
      messages={messages}
    />
  );
}
