"use client";

import { Bot, Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { ConfirmModal } from "@ventura/ui/modal";
import { PageHeader } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatWhen } from "@/lib/devices";
import type { PermissionGroup } from "@/lib/devices";
import type { OwnDevice } from "@/lib/server/devices";
import { uz } from "@/lib/uz";
import { endOtherSessionsAction, toggle2FAAction, unlinkTelegramAction } from "./actions";

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
  twoFactorEnabled = false,
  hasTelegramBot = false,
  groups,
  devices,
  sessionCount,
  header = true,
}: {
  name: string;
  phone: string;
  director: boolean;
  positions: { id: string; name: string }[];
  telegramLinked: boolean;
  twoFactorEnabled?: boolean;
  hasTelegramBot?: boolean;
  groups: PermissionGroup[];
  devices: OwnDevice[];
  sessionCount: number;
  /** Sahifa sarlavhasi; o'qituvchi kabinetida sarlavha profil formasida (ADR 0062) */
  header?: boolean;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [unlinkOpen, setUnlinkOpen] = React.useState(false);
  const [pending2FA, start2FATransition] = React.useTransition();

  async function endOthers() {
    const res = await endOtherSessionsAction();
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: t.ended(res.count) });
    router.refresh();
  }

  function handleToggle2FA(checked: boolean) {
    start2FATransition(async () => {
      const res = await toggle2FAAction(checked);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({
        tone: "success",
        title: checked ? "2FA muvaffaqiyatli yoqildi" : "2FA o'chirildi",
      });
      router.refresh();
    });
  }

  function handleUnlinkTelegram() {
    start2FATransition(async () => {
      const res = await unlinkTelegramAction();
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: "Telegram hisob uzildi" });
      router.refresh();
    });
  }

  const roleLine = director ? uz.staff.director : positions.map((p) => p.name).join(", ") || uz.staff.noPosition;

  return (
    <div className="space-y-section">
      {header ? <PageHeader title={t.title} description={t.description} /> : null}

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

      {/* 2FA (Ikki bosqichli tasdiqlash) Kartochkasi — Muallif / Agent: Google Gemini */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="size-5 text-primary" />
            <div>
              <CardTitle>Ikki bosqichli tasdiqlash (2FA)</CardTitle>
              <CardDescription>
                Tizimga kirishda Telegram orqali xavfsizlik kodini so'rash
              </CardDescription>
            </div>
          </div>
          <Badge tone={twoFactorEnabled ? "success" : "neutral"} dot={twoFactorEnabled}>
            {twoFactorEnabled ? "Yoqilgan" : "O'chiq"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4 pt-1">
          {!hasTelegramBot ? (
            <div className="flex flex-col gap-3 rounded-control border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-body text-muted-foreground">
                Markazning Telegram boti sozlanmagan. 2FA ishlashi uchun avval Telegram bot sozlanishi kerak.
              </div>
              {director ? (
                <Button variant="ghost" size="sm" asChild className="shrink-0">
                  <Link href="/telegram-bots">
                    <Bot className="size-4" /> Telegram botlarni sozlash
                  </Link>
                </Button>
              ) : null}
            </div>
          ) : !telegramLinked ? (
            <div className="flex flex-col gap-3 rounded-control border border-border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-0.5">
                <div className="text-body font-semibold text-foreground">Telegram hisobingiz ulanmagan</div>
                <div className="text-caption text-muted-foreground">
                  2FA'ni yoqish uchun avval hisobingizni markaz Telegram botiga ulang
                </div>
              </div>
              <Button size="sm" asChild className="shrink-0">
                <Link href="/connect-telegram?next=/account">
                  <Send className="size-3.5" /> Telegramni ulash
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border-soft rounded-control border border-border-soft">
              <div className="flex items-center justify-between p-3.5">
                <div>
                  <div className="text-body font-semibold text-foreground">2FA orqali kirish</div>
                  <div className="text-caption text-muted-foreground">
                    Har safar paroldan so'ng Telegram botga 6 xonali tasdiq kodi yuboriladi
                  </div>
                </div>
                <Switch
                  checked={twoFactorEnabled}
                  disabled={pending2FA}
                  onCheckedChange={handleToggle2FA}
                />
              </div>
              <div className="flex items-center justify-between p-3.5">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-body text-foreground">Telegram hisob ulangan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-caption text-muted-foreground hover:text-destructive"
                    onClick={() => setUnlinkOpen(true)}
                    disabled={pending2FA}
                  >
                    Uzish
                  </Button>
                  <Button variant="ghost" size="sm" asChild className="text-caption">
                    <Link href="/connect-telegram?next=/account">Qayta ulash</Link>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
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

      <ConfirmModal
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title="Telegram hisobni uzish"
        message="Telegram hisob uzilsa, 2FA ham avtomatik o'chiriladi. Davom etasizmi?"
        confirmLabel="Ha, uzish"
        cancelLabel={uz.common.cancel}
        onConfirm={() => void handleUnlinkTelegram()}
      />
    </div>
  );
}
