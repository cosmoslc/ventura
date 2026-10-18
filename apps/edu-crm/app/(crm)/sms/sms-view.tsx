import { Clock, MessageSquareText, Send, UserCheck, Wallet } from "lucide-react";
import Link from "next/link";
import type { RelayWallet } from "@ventura/integrations/relay";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { money } from "@/lib/format";
import type { SmsMessageRow } from "@/lib/server/sms/messages";
import type { SmsProviderView } from "@/lib/sms";
import { uz } from "@/lib/uz";
import { SmsPackages } from "./packages";
import { RecentMessages } from "./recent-messages";
import { SmsNav } from "./sms-nav";

const t = uz.sms;

/** SMS bosh sahifasi: rejimga qarab kartalar (Ventura paketi — qoldiq va paketlar; o'z Eskiz — balans), so'nggi xabarlar. */
export function SmsView({
  view,
  ventura,
  own,
  error,
  messages,
}: {
  view: SmsProviderView;
  ventura: { wallet: RelayWallet | null; canBuy: boolean } | null;
  own: { balance: number | null; sender: string; accountStatus: string | null } | null;
  error: string | null;
  messages: SmsMessageRow[];
}) {
  const settings = (
    <Button asChild variant="ghost">
      <Link href="/sms/settings">{t.settingsLink}</Link>
    </Button>
  );
  if (!view.connected) {
    const ventura = view.mode === "ventura";
    return (
      <div className="space-y-section">
        <PageHeader title={t.title} description={t.description} />
        <Card>
          <EmptyState
            icon={<MessageSquareText />}
            title={ventura ? t.venturaUnavailableTitle : t.emptyTitle}
            description={ventura ? t.venturaUnavailableText : t.emptyText}
            action={
              <Button asChild>
                <Link href="/sms/settings">{ventura ? t.settingsLink : t.emptyAction}</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  const wallet = ventura?.wallet ?? null;
  const pendingSum = wallet?.pending.reduce((s, p) => s + p.price, 0) ?? 0;
  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} actions={settings} />
      <SmsNav />
      {error ? <Notice tone="danger">{ventura ? t.venturaError(error) : t.eskizError(error)}</Notice> : null}
      {ventura ? (
        <>
          <div className="grid gap-grid sm:grid-cols-3">
            <StatCard
              icon={<Wallet />}
              tone={1}
              label={t.venturaBalance}
              value={wallet ? t.smsCount(wallet.balance) : "—"}
            />
            <StatCard
              icon={<Clock />}
              tone={3}
              label={t.venturaPending}
              value={wallet?.pending.length ? `${money(pendingSum)} ${uz.common.som}` : "—"}
            />
            <StatCard icon={<Send />} tone={2} label={t.sender} value={t.senderDefault("4546")} />
          </div>
          {wallet ? <SmsPackages wallet={wallet} canBuy={ventura.canBuy} /> : null}
        </>
      ) : own ? (
        <div className="grid gap-grid sm:grid-cols-3">
          <StatCard
            icon={<Wallet />}
            tone={1}
            label={t.balance}
            value={own.balance == null ? "—" : money(own.balance)}
          />
          <StatCard icon={<Send />} tone={2} label={t.sender} value={own.sender} />
          <StatCard
            icon={<UserCheck />}
            tone={3}
            label={t.account}
            value={
              own.accountStatus == null ? "—" : own.accountStatus === "active" ? t.accountActive : own.accountStatus
            }
          />
        </div>
      ) : null}
      <RecentMessages rows={messages} />
    </div>
  );
}
