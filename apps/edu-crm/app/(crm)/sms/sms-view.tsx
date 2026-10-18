import { MessageSquareText, Send, UserCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";

const t = uz.sms;

/** SMS bosh sahifasi: balans, yuboruvchi nomi va Eskiz hisobi holati (S1). Avto-SMS va hisobot — keyingi bosqichlar. */
export function SmsView({
  connected,
  balance,
  sender,
  accountStatus,
  error,
}: {
  connected: boolean;
  balance: number | null;
  sender: string;
  accountStatus: string | null;
  error: string | null;
}) {
  const settings = (
    <Button asChild variant="ghost">
      <Link href="/sms/settings">{t.settingsLink}</Link>
    </Button>
  );
  if (!connected) {
    return (
      <div className="space-y-section">
        <PageHeader title={t.title} description={t.description} />
        <Card>
          <EmptyState
            icon={<MessageSquareText />}
            title={t.emptyTitle}
            description={t.emptyText}
            action={
              <Button asChild>
                <Link href="/sms/settings">{t.emptyAction}</Link>
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} actions={settings} />
      {error ? <Notice tone="danger">{t.eskizError(error)}</Notice> : null}
      <div className="grid gap-grid sm:grid-cols-3">
        <StatCard icon={<Wallet />} tone={1} label={t.balance} value={balance == null ? "—" : money(balance)} />
        <StatCard icon={<Send />} tone={2} label={t.sender} value={sender} />
        <StatCard
          icon={<UserCheck />}
          tone={3}
          label={t.account}
          value={accountStatus == null ? "—" : accountStatus === "active" ? t.accountActive : accountStatus}
        />
      </div>
    </div>
  );
}
