"use client";

import { Check, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { Switch } from "@ventura/ui/switch";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import type { FinanceSettings } from "@/lib/server/finance";
import { saveFinanceSettingsAction, savePaymentMethodAction } from "../../payments/actions";
import type { MethodOption } from "../../payments/payment-dialog";
import { ReceiptCard } from "./receipt-card";

const t = uz.financeSettings;

export function PaymentSettingsView({
  methods,
  settings,
  canMethods,
  canBilling,
  receipt,
}: {
  methods: MethodOption[];
  settings: FinanceSettings;
  canMethods: boolean;
  canBilling: boolean;
  /** Chek sozlamalari kartasi (E6b) uchun ma'lumot */
  receipt: React.ComponentProps<typeof ReceiptCard>;
}) {
  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} />
      <div className="grid gap-4 lg:grid-cols-2">
        <MethodsCard methods={methods} canEdit={canMethods} />
        <BillingCard settings={settings} canEdit={canBilling} />
      </div>
      <ReceiptCard {...receipt} />
    </div>
  );
}

function MethodsCard({ methods, canEdit }: { methods: MethodOption[]; canEdit: boolean }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(input: { id?: string; name: string; active: boolean }) {
    startTransition(async () => {
      const res = await savePaymentMethodAction(input);
      if (!res.ok) {
        setError(res.error);
        return void toast({ tone: "danger", title: res.error });
      }
      setError(null);
      if (!input.id) setName("");
      toast({ tone: "success", title: t.methodSaved });
      router.refresh();
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <h2 className="type-heading text-base">{t.methodsTitle}</h2>
      <ul className="divide-y divide-border rounded-card border border-border">
        {methods.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <span className={m.active ? "font-medium" : "text-muted-foreground line-through"}>{m.name}</span>
            <label className="flex items-center gap-2 text-caption text-muted-foreground">
              {t.methodActive}
              <Switch
                checked={m.active}
                disabled={!canEdit || pending}
                onCheckedChange={(v) => save({ id: m.id, name: m.name, active: v })}
                aria-label={`${m.name}: ${t.methodActive}`}
              />
            </label>
          </li>
        ))}
      </ul>
      {canEdit ? (
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return setError(t.methodNameRequired);
            save({ name, active: true });
          }}
        >
          <div className="flex-1">
            <Label htmlFor="method-name">{t.methodName}</Label>
            <Input
              id="method-name"
              maxLength={60}
              placeholder={t.methodPlaceholder}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            <Plus /> {t.methodAdd}
          </Button>
        </form>
      ) : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
    </Card>
  );
}

function BillingCard({ settings, canEdit }: { settings: FinanceSettings; canEdit: boolean }) {
  const router = useRouter();
  const [form, setForm] = React.useState(settings);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof FinanceSettings>(k: K, v: FinanceSettings[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveFinanceSettingsAction(form);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  return (
    <Card className="p-5">
      <form onSubmit={submit} className="space-y-5">
        <h2 className="type-heading text-base">{t.billingTitle}</h2>
        <div>
          <Label>{t.mode}</Label>
          <RadioGroup
            value={form.mode}
            onValueChange={(v) => set("mode", v as FinanceSettings["mode"])}
            disabled={!canEdit}
          >
            <RadioCard value="monthly" title={t.modeMonthly} description={t.modeMonthlyHint} />
            <RadioCard value="per_lesson" title={t.modePerLesson} description={t.modePerLessonHint} />
          </RadioGroup>
          {form.mode !== settings.mode ? (
            <Notice tone="warning" className="mt-2">
              {t.modeWarn}
            </Notice>
          ) : null}
        </div>
        <ChoiceField
          control={
            <Checkbox
              checked={form.excusedRefund}
              disabled={!canEdit}
              onCheckedChange={(v) => set("excusedRefund", v === true)}
            />
          }
          label={t.excused}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="due-day">{t.dueDay}</Label>
            <Input
              id="due-day"
              inputMode="numeric"
              disabled={!canEdit}
              value={String(form.dueDay)}
              onChange={(e) => set("dueDay", Math.min(28, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))}
            />
          </div>
          <div>
            <Label htmlFor="max-discount">{t.maxDiscount}</Label>
            <Input
              id="max-discount"
              inputMode="numeric"
              disabled={!canEdit}
              value={String(form.maxDiscountPercent)}
              onChange={(e) => set("maxDiscountPercent", Math.min(100, Number(e.target.value.replace(/\D/g, "")) || 0))}
            />
            <FieldHint>{t.maxDiscountHint}</FieldHint>
          </div>
        </div>
        {canEdit ? (
          <Button type="submit" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        ) : null}
      </form>
    </Card>
  );
}
