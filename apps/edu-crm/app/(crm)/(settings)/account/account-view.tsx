"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatWhen } from "@/lib/devices";
import type { PermissionGroup } from "@/lib/devices";
import type { OwnDevice } from "@/lib/server/devices";
import { uz } from "@/lib/uz";
import { endOtherSessionsAction } from "./actions";

const t = uz.account;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:items-center sm:gap-4">
      <dt className="text-caption font-semibold text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-body text-foreground">{children}</dd>
    </div>
  );
}

export function AccountView({
  name,
  phone,
  director,
  positions,
  telegramLinked,
  groups,
  devices,
  sessionCount,
}: {
  name: string;
  phone: string;
  director: boolean;
  positions: { id: string; name: string }[];
  telegramLinked: boolean;
  groups: PermissionGroup[];
  devices: OwnDevice[];
  sessionCount: number;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  async function endOthers() {
    const res = await endOtherSessionsAction();
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: t.ended(res.count) });
    router.refresh();
  }

  const roleLine = director ? uz.staff.director : positions.map((p) => p.name).join(", ") || uz.staff.noPosition;

  return (
    <div className="space-y-4">
      <PageHeader title={t.title} description={t.description} />

      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Avatar name={name} size={56} />
          <div className="min-w-0 flex-1">
            <div className="type-heading text-lg text-foreground">{name}</div>
          </div>
          <Button variant="ghost" asChild>
            <Link href="/account/password">{t.changePassword}</Link>
          </Button>
        </CardContent>
        <dl className="divide-y divide-border-soft border-t border-border-soft px-5">
          <Row label={t.phone}>
            <span className="font-mono">{phone || "—"}</span>
          </Row>
          <Row label={t.positions}>{roleLine}</Row>
          <Row label={t.telegram}>{telegramLinked ? t.telegramLinked : t.telegramNot}</Row>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.permissions}</CardTitle>
        </CardHeader>
        {director ? (
          <CardContent className="text-body text-muted-foreground">{t.permissionsAll}</CardContent>
        ) : groups.length ? (
          <CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2">
            {groups.map((g) => (
              <section key={g.id} className="min-w-0">
                <h3 className="mb-1.5 text-body font-bold text-foreground">{g.title}</h3>
                <ul className="space-y-1">
                  {g.items.map((p) => (
                    <li key={p.id} className="text-body text-secondary-foreground">
                      {p.name}
                      {p.approval ? (
                        <span className="text-caption text-muted-foreground"> — {t.withApproval}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </CardContent>
        ) : (
          <CardContent className="text-body text-muted-foreground">{t.permissionsNone}</CardContent>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <div className="min-w-0">
            <CardTitle>{t.devices}</CardTitle>
            <CardDescription>
              {t.devicesHint} · {t.sessions}: {t.sessionsCount(sessionCount)}
            </CardDescription>
          </div>
          {sessionCount > 1 ? (
            <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
              {t.endOthers}
            </Button>
          ) : null}
        </CardHeader>
        {devices.length ? (
          <TableWrap className="rounded-none border-0">
            <Table className="min-w-[560px]">
              <THead>
                <Tr>
                  <Th>{uz.devices.colDevice}</Th>
                  <Th>{uz.devices.colIp}</Th>
                  <Th>{t.lastLogin}</Th>
                  <Th className="text-right">{uz.devices.colLogins}</Th>
                </Tr>
              </THead>
              <TBody>
                {devices.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      <div className="text-body font-bold text-foreground">{d.name ?? uz.devices.unknown}</div>
                      {d.current ? <div className="text-caption text-muted-foreground">{t.current}</div> : null}
                    </Td>
                    <Td className="font-mono text-caption whitespace-nowrap">{d.ip ?? "—"}</Td>
                    <Td className="font-mono text-caption whitespace-nowrap">{formatWhen(d.lastSeenAt)}</Td>
                    <Td className="text-right font-mono font-semibold text-foreground">{d.loginCount}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <CardContent className="text-body text-muted-foreground">{t.devicesEmpty}</CardContent>
        )}
        {sessionCount > 1 ? (
          <p className="border-t border-border-soft px-5 py-3 text-caption text-muted-foreground">{t.endOthersHint}</p>
        ) : null}
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.endTitle}
        message={t.endMessage}
        confirmLabel={t.endConfirm}
        cancelLabel={uz.common.cancel}
        onConfirm={() => void endOthers()}
      />
    </div>
  );
}
