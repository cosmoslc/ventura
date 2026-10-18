"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { firstError } from "@/lib/rules";
import { type SmsMode, type SmsProviderView, hourLabel, smsConnectInput, smsPrefsInput, smsTestInput } from "@/lib/sms";
import { uz } from "@/lib/uz";
import {
  connectSmsAction,
  disconnectSmsAction,
  saveSmsPrefsAction,
  sendTestSmsAction,
  setSmsModeAction,
} from "./actions";

const t = uz.sms;
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const DEFAULT = "_";

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <div>
        <h2 className="type-heading text-base">{title}</h2>
        <p className="mt-0.5 text-body text-muted-foreground">{description}</p>
      </div>
      {children}
    </Card>
  );
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/**
 * SMS sozlamalari (docs/EDU-CRM-SMS.md). Rejim: Ventura paketi (standart) yoki o'z Eskiz hisobi (ADR 0056). Maxfiy
 * kalit faqat yuboriladi — sahifaga qaytmaydi; ulangan holatda faqat email va oxirgi tekshiruv vaqti ko'rinadi.
 */
export function SmsSettingsView({
  provider,
  nicks,
  eskizError,
  defaultSender,
  testMessage,
}: {
  provider: SmsProviderView;
  nicks: string[];
  eskizError: string | null;
  defaultSender: string;
  testMessage: string;
}) {
  const router = useRouter();
  const [replacing, setReplacing] = React.useState(!provider.ownConnected);
  const own = provider.mode === "own";
  const [confirm, setConfirm] = React.useState(false);
  const [disconnecting, startDisconnect] = React.useTransition();

  function disconnect() {
    startDisconnect(async () => {
      const res = await disconnectSmsAction();
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.disconnected });
      setReplacing(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-section">
      <PageHeader title={t.settingsTitle} description={t.settingsDescription} />
      {provider.broken ? <Notice tone="warning">{t.broken}</Notice> : null}
      {own && provider.connected && eskizError ? <Notice tone="danger">{t.eskizError(eskizError)}</Notice> : null}

      <ModeSection provider={provider} />

      {own ? (
        <Section title={t.connectTitle} description={t.connectDescription}>
          {provider.ownConnected && !replacing ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-body font-semibold text-foreground">{t.connectedAs(provider.email ?? "")}</div>
                {provider.checkedAt ? (
                  <div className="text-body text-muted-foreground">{t.checkedAt(when(provider.checkedAt))}</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => setReplacing(true)}>
                  {t.replace}
                </Button>
                <Button variant="ghost" onClick={() => setConfirm(true)} disabled={disconnecting}>
                  {t.disconnect}
                </Button>
              </div>
            </div>
          ) : (
            <ConnectForm
              email={provider.email ?? ""}
              onCancel={provider.ownConnected ? () => setReplacing(false) : null}
              onDone={() => {
                setReplacing(false);
                router.refresh();
              }}
            />
          )}
        </Section>
      ) : null}

      {provider.connected ? (
        <>
          <PrefsForm provider={provider} nicks={nicks} defaultSender={defaultSender} showSender={own} />
          <TestForm testMessage={testMessage} />
        </>
      ) : null}

      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title={t.disconnectTitle}
        message={t.disconnectText}
        confirmLabel={t.disconnect}
        onConfirm={disconnect}
      />
    </div>
  );
}

/** Rejim tanlash: ikki karta (radio). Almashsa shablonlar yangi hisobda qayta moderatsiyadan o'tadi */
function ModeSection({ provider }: { provider: SmsProviderView }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const choose = (mode: SmsMode) => {
    if (mode === provider.mode) return;
    startTransition(async () => {
      const res = await setSmsModeAction({ mode });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.modeSaved, description: t.modeResetHint });
      router.refresh();
    });
  };
  return (
    <Section title={t.modeTitle} description={t.modeDescription}>
      <div role="radiogroup" aria-label={t.modeTitle} className="grid gap-3 sm:grid-cols-2">
        {(["ventura", "own"] as const).map((m) => {
          const on = provider.mode === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pending}
              onClick={() => choose(m)}
              className={cn(
                "flex items-start gap-3 rounded-card border p-4 text-left transition-colors disabled:opacity-60",
                on ? "border-primary bg-primary-soft" : "border-border hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border [&_svg]:size-3",
                  on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {on ? <Check /> : null}
              </span>
              <span className="min-w-0">
                <span className="block text-body font-semibold text-foreground">{t.modes[m]}</span>
                <span className="mt-0.5 block text-body text-muted-foreground">{t.modeHints[m]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {provider.mode === "ventura" && !provider.relayReady ? (
        <Notice tone="warning">{t.venturaUnavailableText}</Notice>
      ) : null}
    </Section>
  );
}

function ConnectForm({
  email: initialEmail,
  onCancel,
  onDone,
}: {
  email: string;
  onCancel: (() => void) | null;
  onDone: () => void;
}) {
  const [email, setEmail] = React.useState(initialEmail);
  const [secret, setSecret] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = smsConnectInput.safeParse({ email, secret });
    if (!parsed.success) return setError(firstError(parsed.error));
    setError(null);
    startTransition(async () => {
      const res = await connectSmsAction(parsed.data);
      if (!res.ok) return setError(res.error);
      setSecret("");
      toast({ tone: "success", title: t.connected });
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <ol className="list-decimal space-y-1 pl-5 text-body text-muted-foreground">
        {t.connectSteps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="sms-email">{t.email}</Label>
          <Input
            id="sms-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="sms-secret">{t.secret}</Label>
          <Input
            id="sms-secret"
            type="password"
            autoComplete="new-password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
          />
          <FieldHint>{t.secretHint}</FieldHint>
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
            {t.cancel}
          </Button>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? t.connecting : t.connect}
        </Button>
      </div>
    </form>
  );
}

function HourSelect({ id, value, onChange }: { id: string; value: number; onChange: (h: number) => void }) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {HOURS.map((h) => (
          <SelectItem key={h} value={String(h)}>
            {hourLabel(h)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function PrefsForm({
  provider,
  nicks,
  defaultSender,
  showSender,
}: {
  provider: SmsProviderView;
  nicks: string[];
  defaultSender: string;
  showSender: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState({
    sender: provider.sender ?? "",
    quietFrom: provider.quietFrom,
    quietTo: provider.quietTo,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Saqlangan nom Eskiz ro'yxatida bo'lmasa ham tanlovda qoladi; standart nom alohida band
  const options = [...new Set([...nicks, ...(form.sender ? [form.sender] : [])])].filter((n) => n !== defaultSender);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = smsPrefsInput.safeParse(form);
    if (!parsed.success) return setError(firstError(parsed.error));
    setError(null);
    startTransition(async () => {
      const res = await saveSmsPrefsAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <Section title={t.prefsTitle} description={t.prefsDescription}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {showSender ? (
          <div>
            <Label htmlFor="sms-sender">{t.sender}</Label>
            <Select
              value={form.sender || DEFAULT}
              onValueChange={(v) => setForm((f) => ({ ...f, sender: v === DEFAULT ? "" : v }))}
            >
              <SelectTrigger id="sms-sender">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT}>{t.senderDefault(defaultSender)}</SelectItem>
                {options.map((n) => (
                  <SelectItem key={n} value={n}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldHint>{t.senderHint}</FieldHint>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="sms-quiet-from">{t.quietFrom}</Label>
            <HourSelect
              id="sms-quiet-from"
              value={form.quietFrom}
              onChange={(h) => setForm((f) => ({ ...f, quietFrom: h }))}
            />
          </div>
          <div>
            <Label htmlFor="sms-quiet-to">{t.quietTo}</Label>
            <HourSelect
              id="sms-quiet-to"
              value={form.quietTo}
              onChange={(h) => setForm((f) => ({ ...f, quietTo: h }))}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {t.save}
          </Button>
        </div>
      </Section>
    </form>
  );
}

function TestForm({ testMessage }: { testMessage: string }) {
  const [phone, setPhone] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = smsTestInput.safeParse({ phone });
    if (!parsed.success) return setError(firstError(parsed.error));
    setError(null);
    startTransition(async () => {
      const res = await sendTestSmsAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.testSent });
    });
  }

  return (
    <form onSubmit={submit}>
      <Section title={t.testTitle} description={t.testDescription(testMessage)}>
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Label htmlFor="sms-test-phone">{t.testPhone}</Label>
            <PhoneInput id="sms-test-phone" value={phone} onValueChange={setPhone} />
          </div>
          <Button type="submit" disabled={pending}>
            {t.testSend}
          </Button>
        </div>
      </Section>
    </form>
  );
}
