"use client";

import {
  Bell,
  ExternalLink,
  GraduationCap,
  type LucideIcon,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Smartphone,
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
  badgeTone: "success" | "neutral" | "warning";
  notificationOptions: readonly BotNotificationOption[];
  miniAppHint: string;
}

const BOTS_META: Record<BotRole, BotMeta> = {
  teacher: {
    role: "teacher",
    name: t.teacherBot,
    icon: GraduationCap,
    colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    badgeTone: "success",
    notificationOptions: TEACHER_NOTIFICATIONS,
    miniAppHint: "O'qituvchilar kabineti (masalan: /kabinet)",
  },
  student: {
    role: "student",
    name: t.studentBot,
    icon: Users,
    colorClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    badgeTone: "success",
    notificationOptions: STUDENT_NOTIFICATIONS,
    miniAppHint: "O'quvchilar portali (masalan: /portal)",
  },
  parent: {
    role: "parent",
    name: t.parentBot,
    icon: ShieldCheck,
    colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    badgeTone: "success",
    notificationOptions: PARENT_NOTIFICATIONS,
    miniAppHint: "Ota-onalar uchun Mini App (ixtiyoriy)",
  },
};

export function TelegramBotsView({
  config,
  stats,
  tenantName,
}: {
  config: TelegramBotsConfig;
  stats: TelegramBotsStats;
  tenantName: string;
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

  // Modallarni ochish
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

  // Sozlamalarni saqlash
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

  // Webhookni sinxronlash
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

  // Test xabar yuborish
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
    <div className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge tone="info" className="font-mono text-xs">
              Markaz: {tenantName}
            </Badge>
          </div>
        }
      />

      {/* 3 ta Bot Kartochkalari (Boxlar) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
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
              className="flex flex-col justify-between p-5 transition-all hover:border-primary/40 shadow-xs"
            >
              <div className="space-y-4">
                {/* Tepasi: Ikonka, Nomi va Holati */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`grid size-11 place-items-center rounded-xl border ${meta.colorClass}`}>
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <h3 className="type-heading text-body font-bold text-foreground">{meta.name}</h3>
                      {bot.username ? (
                        <a
                          href={`https://t.me/${bot.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-caption text-primary hover:underline font-mono"
                        >
                          @{bot.username} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-caption text-muted-foreground font-mono">@username yo'q</span>
                      )}
                    </div>
                  </div>

                  <div>
                    {!isConfigured ? (
                      <Badge tone="neutral">{t.noToken}</Badge>
                    ) : bot.enabled ? (
                      <Badge tone="success" dot>
                        {t.activeStatus}
                      </Badge>
                    ) : (
                      <Badge tone="warning">{t.inactiveStatus}</Badge>
                    )}
                  </div>
                </div>

                {/* Foydalanuvchilar Statistikasi Boxi */}
                <div className="rounded-control border border-border bg-muted/40 p-3.5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="space-y-0.5 border-r border-border pr-2">
                      <div className="text-caption text-muted-foreground font-medium">{t.activeCount}</div>
                      <div className="type-heading text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                        {stat.active}
                      </div>
                    </div>
                    <div className="space-y-0.5 pl-2">
                      <div className="text-caption text-muted-foreground font-medium">{t.inactiveCount}</div>
                      <div className="type-heading text-xl font-bold text-muted-foreground font-mono">
                        {stat.inactive}
                      </div>
                    </div>
                  </div>

                  {/* Ulanganlik foizi progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-2xs text-muted-foreground font-mono">
                      <span>Ulanganlik darajasi</span>
                      <span>{stat.percentage}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
                      <div
                        className="h-full bg-emerald-500 transition-all duration-300"
                        style={{ width: `${stat.percentage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Bot Imkoniyatlari qisqacha */}
                <div className="space-y-2 text-caption">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Bell className="size-3.5" /> Bildirishnomalar
                    </span>
                    <Badge tone={activeNotificationsCount > 0 ? "info" : "neutral"} className="font-mono text-2xs">
                      {activeNotificationsCount}/{meta.notificationOptions.length} faol
                    </Badge>
                  </div>

                  {bot.miniAppUrl ? (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Smartphone className="size-3.5" /> Mini App (Web App)
                      </span>
                      <span className="font-mono text-2xs text-foreground font-semibold">{bot.miniAppUrl}</span>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Pastki tugmalar */}
              <div className="pt-5 mt-4 border-t border-border flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openTestModal(role)}
                  disabled={!isConfigured}
                >
                  <Send /> {t.testMessage}
                </Button>
                <Button size="sm" onClick={() => openEditModal(role)}>
                  <Settings2 /> Sozlamalar
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Qo'llanma bloki */}
      <Card className="p-5 bg-card/60 space-y-3">
        <div className="flex items-center gap-2 text-body font-bold text-foreground">
          <Sparkles className="size-4 text-primary" />
          <span>Telegram botlarni qanday sozlash kerak?</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-caption text-muted-foreground">
          <div className="space-y-1 rounded-control border border-border p-3 bg-card">
            <span className="font-bold text-foreground block font-mono">1. Bot yaratish</span>
            <span>
              Telegramda rasmiy <b>@BotFather</b> ga o'ting va <code>/newbot</code> buyrug'i orqali yangi bot yarating.
            </span>
          </div>
          <div className="space-y-1 rounded-control border border-border p-3 bg-card">
            <span className="font-bold text-foreground block font-mono">2. Tokenni kiritish</span>
            <span>
              BotFather bergan <b>HTTP API token</b> va bot username'ni yuqoridagi mos bot sozlamalariga kiriting.
            </span>
          </div>
          <div className="space-y-1 rounded-control border border-border p-3 bg-card">
            <span className="font-bold text-foreground block font-mono">3. Akkauntlarni ulash</span>
            <span>
              O'qituvchilar, o'quvchilar va ota-onalar botga <code>/start</code> bosib o'z telefon raqamlarini yuborishadi.
            </span>
          </div>
        </div>
      </Card>

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
          <form id="bot-settings-form" onSubmit={handleSave} className="space-y-5">
            {/* Yoqish / O'chirish switchi */}
            <div className="flex items-center justify-between rounded-control border border-border bg-muted/30 p-3.5">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="bot-token">{t.tokenLabel}</Label>
                <div className="relative">
                  <Input
                    id="bot-token"
                    type="password"
                    placeholder="1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="font-mono text-xs"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </div>
                <FieldHint>{t.tokenHint}</FieldHint>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bot-username">{t.usernameLabel}</Label>
                <div className="relative">
                  <Input
                    id="bot-username"
                    placeholder="edu_teacher_bot"
                    className="font-mono"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
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
            <div className="space-y-3 pt-2">
              <div className="border-b border-border pb-2">
                <h4 className="type-heading text-body font-bold text-foreground">{t.notificationsSection}</h4>
                <p className="text-caption text-muted-foreground">
                  Kerakli bildirishnomalarni yoqing yoki o'chiring. Tizim tegishli hodisa yuz berganda xabarni avtomatik jo'natadi.
                </p>
              </div>

              <div className="space-y-2">
                {BOTS_META[editingRole].notificationOptions.map((opt) => {
                  const on = notifications[opt.key] ?? opt.defaultEnabled;
                  return (
                    <div
                      key={opt.key}
                      className="flex items-start justify-between gap-3 rounded-control border border-border p-3 transition-colors hover:bg-muted/30"
                    >
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`notif-${opt.key}`}
                          className="text-body font-medium text-foreground cursor-pointer"
                        >
                          {opt.label}
                        </Label>
                        <p className="text-caption text-muted-foreground">{opt.description}</p>
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
            <div className="rounded-control border border-border/80 bg-muted/20 p-3 space-y-2 text-2xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">Webhook manzili:</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSyncWebhook(editingRole)}
                  disabled={pending || !token.trim()}
                >
                  <RefreshCw className="size-3" /> {t.syncWebhook}
                </Button>
              </div>
              <code className="block bg-card border border-border p-2 rounded text-muted-foreground font-mono break-all">
                /api/telegram/webhook?role={editingRole}
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
                <Send /> {testPending ? "Yuborilmoqda..." : t.sendTestBtn}
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
                className="font-mono"
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
