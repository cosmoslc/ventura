import { desc, eq } from "drizzle-orm";
import { KeyRound, MonitorSmartphone, Send } from "lucide-react";
import Link from "next/link";
import { can, formatPhone, getSessionPolicy } from "@ventura/auth";
import { knownDevices } from "@ventura/db/schema/panel";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { PageHeader } from "@ventura/ui/page-header";
import { formatDateTime } from "@/lib/format";
import { deps } from "@/lib/server/deps";
import { requireViewer } from "@/lib/server/session";
import { uz } from "@/lib/uz";
import { SessionPolicyForm } from "./session-policy-form";

export const metadata = { title: `${uz.settings.securityTitle} · ${uz.app.name}` };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ parol?: string }> }) {
  const viewer = await requireViewer();
  const { db } = deps();
  const [policy, devices] = await Promise.all([
    getSessionPolicy(db),
    db.select().from(knownDevices).where(eq(knownDevices.userId, viewer.id)).orderBy(desc(knownDevices.lastSeenAt)),
  ]);
  const { parol } = await searchParams;

  return (
    <>
      <PageHeader
        title={uz.settings.securityTitle}
        description={parol === "ok" ? uz.settings.passwordChanged : uz.settings.securityDescription}
      />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>{uz.settings.sessionTitle}</CardTitle>
              <CardDescription>{uz.settings.sessionHint}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <SessionPolicyForm value={policy} canEdit={can(viewer.role, "settings.manage")} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{uz.settings.accountTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="divide-y divide-border-soft rounded-card border border-border text-body">
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="text-muted-foreground">{uz.auth.phone}</dt>
                <dd className="font-mono text-foreground">{formatPhone(viewer.phone)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Send className="size-4" /> {uz.settings.telegram}
                </dt>
                <dd>
                  <Badge tone="success" dot>
                    {uz.settings.linked}
                  </Badge>
                </dd>
              </div>
            </dl>
            <Button variant="ghost" asChild>
              <Link href="/account/password">
                <KeyRound /> {uz.settings.changePassword}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{uz.settings.devicesTitle}</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border-soft">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <MonitorSmartphone className="size-4 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-body text-foreground">{d.userAgent ?? "—"}</span>
                <span className="font-mono text-xs text-muted-foreground">{d.lastIp}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {uz.settings.lastSeen}: {formatDateTime(d.lastSeenAt)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
