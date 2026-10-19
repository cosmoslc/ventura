"use client";

import { BookCheck, CalendarCheck, Check, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { toast } from "@ventura/ui/toast";
import { COIN_AMOUNT_MAX, type CoinRuleKey, type CoinSettings } from "@/lib/coins";
import { uz } from "@/lib/uz";
import { saveCoinSettingsAction } from "../../coins/actions";

const t = uz.coinSettings;

const RULES: { key: CoinRuleKey; icon: React.ReactNode; title: string; hint: string }[] = [
  { key: "prepay", icon: <Wallet />, title: t.prepayTitle, hint: t.prepayHint },
  { key: "attendance", icon: <CalendarCheck />, title: t.attendanceTitle, hint: t.attendanceHint },
  { key: "homework", icon: <BookCheck />, title: t.homeworkTitle, hint: t.homeworkHint },
];

export function CoinSettingsView({
  settings,
  homeworkAvailable,
  canEdit,
}: {
  settings: CoinSettings;
  /** (c) qoida baholash bo'limi bilan ishlaydi */
  homeworkAvailable: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(settings);
  const [pending, startTransition] = React.useTransition();
  const set = (key: CoinRuleKey, patch: Partial<CoinSettings[CoinRuleKey]>) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveCoinSettingsAction(form);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} />
      <form onSubmit={submit} className="space-y-4">
        {RULES.map((r) => {
          const available = r.key !== "homework" || homeworkAvailable;
          const rule = form[r.key];
          return (
            <Card key={r.key} className="flex flex-wrap items-start gap-4 p-5">
              <div className="grid size-10 shrink-0 place-items-center rounded-stat-icon bg-muted text-primary [&_svg]:size-5">
                {r.icon}
              </div>
              <div className="min-w-0 flex-1 basis-64 space-y-1">
                <div className="flex items-center gap-3">
                  <h2 className="type-heading text-base">{r.title}</h2>
                  <Switch
                    checked={rule.enabled && available}
                    disabled={!canEdit || !available}
                    onCheckedChange={(v) => set(r.key, { enabled: v })}
                    aria-label={r.title}
                  />
                </div>
                <p className="text-caption text-muted-foreground">{r.hint}</p>
                {!available ? <FieldHint>{t.homeworkSoon}</FieldHint> : null}
              </div>
              <div className="w-36">
                <Label htmlFor={`coin-${r.key}`}>{t.amount}</Label>
                <Input
                  id={`coin-${r.key}`}
                  inputMode="numeric"
                  disabled={!canEdit || !available}
                  value={String(rule.amount)}
                  onChange={(e) =>
                    set(r.key, {
                      amount: Math.min(COIN_AMOUNT_MAX, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)),
                    })
                  }
                />
              </div>
            </Card>
          );
        })}
        <Notice tone="info">
          <ul className="list-disc space-y-1 pl-4">
            {t.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Notice>
        {canEdit ? (
          <Button type="submit" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
