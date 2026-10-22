"use client";

import {
  ExternalLink,
  GraduationCap,
  type LucideIcon,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PageHeader } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import {
  type BotNotificationOption,
  type BotRole,
  PARENT_NOTIFICATIONS,
  STUDENT_NOTIFICATIONS,
  TEACHER_NOTIFICATIONS,
  type TelegramBotsConfig,
  type TelegramBotsStats,
} from "@/lib/telegram-bots";
import { uz } from "@/lib/uz";
import { saveBotConfigAction, sendTestBotMessageAction, syncBotWebhookAction } from "./actions";

const t = uz.telegramBots;

interface BotMeta {
  role: BotRole;
  name: string;
  icon: LucideIcon;
  colorClass: string;
  notificationOptions: readonly BotNotificationOption[];
  miniAppHint: string;
}

const BOTS_META: Record<BotRole, BotMeta> = {
  teacher: {
    role: "teacher",
    name: t.teacherBot,
    icon: GraduationCap,
    colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    notificationOptions: TEACHER_NOTIFICATIONS,
    miniAppHint: "O'qituvchilar kabineti (masalan: /kabinet)",
  },
  student: {
    role: "student",
    name: t.studentBot,
    icon: Users,
    colorClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    notificationOptions: STUDENT_NOTIFICATIONS,
    miniAppHint: "O'quvchilar portali (masalan: /portal)",
  },
  parent: {
    role: "parent",
    name: t.parentBot,
    icon: ShieldCheck,
    colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    notificationOptions: PARENT_NOTIFICATIONS,
    miniAppHint: "Ota-onalar uchun Mini App (ixtiyoriy)",
  },
};

export function TelegramBotsView({
  config,
  stats,
  tenantName,
  tenantSlug,
}: {
  config: TelegramBotsConfig;
  stats: TelegramBotsStats;
  tenantName: string;
  tenantSlug: string;
}) {
  const router = useRouter();

  // Tahrirlash modali
  const [editingRole, setEditingRole] = React.useState<BotRole | null>(null);
  const [token, setToken] = React.useState("");
  const [username, setUsername] = React.useState("");
  const [enabled, setEnabled] = React.useState(false);
  const [miniAppUrl, setMiniAppUrl] = React.useState("");
  const [notifications, setNotifications] = React.useState<Record<string, boolean>>({});
  const [pending, startTransition] = React.useTransition();

  // Test xabar modali
  const [testingRole, setTestingRole] = React.useState<BotRole | null>(null);
  const [testChatId, setTestChatId] = React.useState("");
  const [testMessage, setTestMessage] = React.useState(
    "Assalomu alaykum! Bu Ventura CRM dan sinov xabarnomasi.",
  );
  const [testPending, startTestTransition] = React.useTransition();

  function openEditModal(role: BotRole) {
    const bot =
      role === "teacher"
        ? config.teacherBot
        : role === "student"
          ? config.studentBot
          : config.parentBot;

    setEditingRole(role);
    setToken(bot.token || "");
    setUsername(bot.username || "");
    setEnabled(bot.enabled);
    setMiniAppUrl(bot.miniAppUrl || "");
    setNotifications({ ...bot.notifications });
  }

  function openTestModal(role: BotRole) {
    setTestingRole(role);
    setTestChatId("");
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRole) return;

    startTransition(async () => {
      const res = await saveBotConfigAction({
        role: editingRole,
        token: token.trim(),
        username: username.trim(),
        enabled,
        miniAppUrl: miniAppUrl.trim(),
        notifications,
      });

      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return;
      }

      toast({ tone: "success", title: t.saved });
      setEditingRole(null);
      router.refresh();
    });
  }

  function handleSyncWebhook(role: BotRole) {
    startTransition(async () => {
      const res = await syncBotWebhookAction({ role });
      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return;
      }
      toast({ tone: "success", title: t.webhookSynced });
      router.refresh();
    });
  }

  function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    if (!testingRole) return;
    if (!testChatId.trim()) {
      toast({ tone: "danger", title: "Chat ID kiriting" });
      return;
    }

    startTestTransition(async () => {
      const res = await sendTestBotMessageAction({
        role: testingRole,
        chatId: testChatId.trim(),
        message: testMessage.trim(),
      });

      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return;
      }

      toast({ tone: "success", title: t.testSent });
      setTestingRole(null);
    });
  }

  const roles: BotRole[] = ["teacher", "student", "parent"];

  return (
    <div className="space-y-5">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Badge tone="info" className="font-mono text-xs">
            Markaz: {tenantName}
          </Badge>
        }
      />

      {/* 3 ta Bot Boxlari (Kichikroq, ixcham va sodda) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => {
          const meta = BOTS_META[role];
          const bot =
            role === "teacher"
              ? config.teacherBot
              : role === "student"
                ? config.studentBot
                : config.parentBot;
          const stat = stats[role];
          const Icon = meta.icon;

          const isConfigured = !!bot.token?.trim();
          const activeNotificationsCount = Object.values(bot.notifications).filter(Boolean).length;

          return (
            <Card
              key={role}
              className="flex flex-col justify-between p-4 transition-all hover:border-primary/40 shadow-xs"
            >
              <div className="space-y-3">
                {/* 1. Sarlavha: Ikonka, Nomi va Holat nishoni */}
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`grid size-9 shrink-0 place-items-center rounded-lg border ${meta.colorClass}`}>
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="type-heading text-sm font-bold text-foreground leading-snug truncate">
                        {meta.name}
                      </h3>
                      {bot.username ? (
                        <a
                          href={`https://t.me/${bot.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-2xs text-primary hover:underline font-mono truncate"
                        >
                          @{bot.username} <ExternalLink className="size-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-2xs text-muted-foreground font-mono block">@username yo'q</span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {!isConfigured ? (
                      <Badge tone="neutral" className="text-2xs">{t.noToken}</Badge>
                    ) : bot.enabled ? (
                      <Badge tone="success" dot className="text-2xs">
                        {t.activeStatus}
                      </Badge>
                    ) : (
                      <Badge tone="warning" className="text-2xs">{t.inactiveStatus}</Badge>
                    )}
                  </div>
                </div>

                {/* 2. Foydalanuvchilar statistikasi: sodda va ixcham 1 qator */}
                <div className="flex items-center justify-between rounded-control border border-border/70 bg-muted/30 px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">{t.activeCount}:</span>
                    <b className="font-mono text-foreground font-semibold">{stat.active}</b>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>{t.inactiveCount}:</span>
                    <b className="font-mono text-foreground/80 font-semibold">{stat.inactive}</b>
                  </div>
                </div>

                {/* 3. Bildirishnomalar va Mini App holati */}
                <div className="flex items-center justify-between text-2xs text-muted-foreground pt-0.5">
                  <span>
                    Bildirishnomalar:{" "}
                    <b className="text-foreground font-mono">
                      {activeNotificationsCount}/{meta.notificationOptions.length}
                    </b>
                  </span>
                  {bot.miniAppUrl ? (
                    <span className="font-mono text-primary font-medium">{bot.miniAppUrl}</span>
                  ) : (
                    <span>Mini App: yo'q</span>
                  )}
                </div>
              </div>

              {/* 4. Pastki ixcham amallar (overflow bo'lmaydi) */}
              <div className="pt-3 mt-3 border-t border-border flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 justify-center text-xs h-8"
                  onClick={() => openTestModal(role)}
                  disabled={!isConfigured}
                >
                  <Send className="size-3" /> Test
                </Button>
                <Button
                  size="sm"
                  className="flex-1 justify-center text-xs h-8"
                  onClick={() => openEditModal(role)}
                >
                  <Settings2 className="size-3" /> Sozlash
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Ixcham yo'l-yo'riq maslahati (Katta kartochkalar o'rniga oddiy chiziqli panel) */}
      <div className="flex items-start gap-2.5 rounded-card border border-border/80 bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
        <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-semibold text-foreground">Botlarni sozlash: </span>
          Telegramda <b>@BotFather</b> orqali yangi bot yarating, olingan API tokenni tegishli bot sozlamasiga kiriting va yoqing. O'qituvchi, o'quvchi va ota-onalar botga kirib <code>/start</code> yuborish orqali akkauntlarini ulaydilar.
        </div>
      </div>

      {/* Bot Sozlamalari Modali */}
      {editingRole ? (
        <Modal
          open={editingRole !== null}
          onOpenChange={(v) => !v && setEditingRole(null)}
          position="center"
          wide
          title={`${BOTS_META[editingRole].name} sozlamalari`}
          description="Bot tokeni, username, Mini App va avtomatik bildirishnoma yoqgichlari"
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setEditingRole(null)} disabled={pending}>
                {uz.common.cancel}
              </Button>
              <Button form="bot-settings-form" type="submit" disabled={pending}>
                {pending ? "Saqlanmoqda..." : uz.common.save}
              </Button>
            </>
          }
        >
          <form id="bot-settings-form" onSubmit={handleSave} className="space-y-4">
            {/* Yoqish / O'chirish switchi */}
            <div className="flex items-center justify-between rounded-control border border-border bg-muted/30 p-3">
              <div className="space-y-0.5">
                <Label htmlFor="bot-enable-switch" className="text-body font-semibold cursor-pointer">
                  {t.enableSwitch}
                </Label>
                <p className="text-caption text-muted-foreground">
                  Bot faollashtirilsa, foydalanuvchilar undan foydalanishlari va xabarlar olishlari mumkin
                </p>
              </div>
              <Switch id="bot-enable-switch" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            {/* Token va Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bot-token">{t.tokenLabel}</Label>
                <Input
                  id="bot-token"
                  type="password"
                  placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  className="font-mono text-xs"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <FieldHint>{t.tokenHint}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bot-username">{t.usernameLabel}</Label>
                <Input
                  id="bot-username"
                  placeholder="edu_teacher_bot"
                  className="font-mono"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
                <FieldHint>{t.usernameHint}</FieldHint>
              </div>
            </div>

            {/* Mini App URL */}
            <div className="space-y-1.5">
              <Label htmlFor="bot-miniapp">{t.miniAppLabel}</Label>
              <Input
                id="bot-miniapp"
                placeholder={BOTS_META[editingRole].miniAppHint}
                value={miniAppUrl}
                onChange={(e) => setMiniAppUrl(e.target.value)}
              />
              <FieldHint>Bot ichida ochiladigan Telegram WebApp sahifasi yo'li</FieldHint>
            </div>

            {/* Bildirishnomalar Bo'limi */}
            <div className="space-y-2.5 pt-2">
              <div className="border-b border-border pb-1.5">
                <h4 className="type-heading text-body font-bold text-foreground">{t.notificationsSection}</h4>
                <p className="text-caption text-muted-foreground">
                  Kerakli bildirishnomalarni yoqing yoki o'chiring. Tizim tegishli hodisada xabarni avtomatik jo'natadi.
                </p>
              </div>

              <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                {BOTS_META[editingRole].notificationOptions.map((opt) => {
                  const on = notifications[opt.key] ?? opt.defaultEnabled;
                  return (
                    <div
                      key={opt.key}
                      className="flex items-start justify-between gap-3 rounded-control border border-border p-2.5 transition-colors hover:bg-muted/30"
                    >
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`notif-${opt.key}`}
                          className="text-body font-medium text-foreground cursor-pointer text-xs"
                        >
                          {opt.label}
                        </Label>
                        <p className="text-2xs text-muted-foreground">{opt.description}</p>
                      </div>
                      <Switch
                        id={`notif-${opt.key}`}
                        checked={on}
                        onCheckedChange={(checked) =>
                          setNotifications((prev) => ({ ...prev, [opt.key]: checked }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Webhook qismi */}
            <div className="rounded-control border border-border/80 bg-muted/20 p-2.5 space-y-1.5 text-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Webhook manzili:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-2xs"
                  onClick={() => handleSyncWebhook(editingRole)}
                  disabled={pending || !token.trim()}
                >
                  <RefreshCw className="size-3" /> {t.syncWebhook}
                </Button>
              </div>
              <code className="block bg-card border border-border p-1.5 rounded text-muted-foreground font-mono break-all text-2xs">
                https://{tenantSlug}.ventura.uz/api/telegram/webhook?role={editingRole}
              </code>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Test Xabar Yuborish Modali */}
      {testingRole ? (
        <Modal
          open={testingRole !== null}
          onOpenChange={(v) => !v && setTestingRole(null)}
          position="center"
          title={`${BOTS_META[testingRole].name} orqali test xabar`}
          description="Botning to'g'ri ulanganligini tekshirish uchun o'z Telegram Chat ID'ingizga xabar yuboring"
          footer={
            <>
              <Button type="button" variant="ghost" onClick={() => setTestingRole(null)} disabled={testPending}>
                {uz.common.cancel}
              </Button>
              <Button form="test-message-form" type="submit" disabled={testPending}>
                <Send className="size-3.5" /> {testPending ? "Yuborilmoqda..." : t.sendTestBtn}
              </Button>
            </>
          }
        >
          <form id="test-message-form" onSubmit={handleSendTest} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="test-chat-id">{t.chatIdLabel}</Label>
              <Input
                id="test-chat-id"
                placeholder="Masalan: 123456789"
                required
                className="font-mono text-xs"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
              />
              <FieldHint>
                O'z Telegram Chat ID'ingizni bilish uchun Telegramda <code>@userinfobot</code> ga yozing.
              </FieldHint>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="test-message-text">{t.messageTextLabel}</Label>
              <Textarea
                id="test-message-text"
                rows={3}
                required
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
              />
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
