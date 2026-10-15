"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Notice } from "@ventura/ui/notice";
import { PageHeader } from "@ventura/ui/page-header";
import { PhoneInput } from "@ventura/ui/phone-input";
import { toast } from "@ventura/ui/toast";
import { type CenterSettings, WEEKDAYS, centerInput } from "@/lib/center-settings";
import { firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { saveCenterSettingsAction } from "./actions";

const t = uz.settingsCenter;

export function CenterSettingsView({ settings, centerName }: { settings: CenterSettings; centerName: string }) {
  const router = useRouter();
  const [form, setForm] = React.useState(settings);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof CenterSettings>(k: K, v: CenterSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const toggleDay = (d: (typeof WEEKDAYS)[number]) =>
    set("workDays", form.workDays.includes(d) ? form.workDays.filter((x) => x !== d) : [...form.workDays, d]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = centerInput.safeParse(form);
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveCenterSettingsAction(parsed.data);
      if (!res.ok) return setError(res.error);
      setForm(parsed.data);
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  const phoneBad = (v: string) => v.length > 0 && v.length < 9;
  return (
    <form onSubmit={submit} className="space-y-6">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button type="submit" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        }
      />
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="type-heading text-base">{t.contactTitle}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-phone">{t.phone}</Label>
                <PhoneInput
                  id="c-phone"
                  value={form.phone}
                  onValueChange={(v) => set("phone", v)}
                  invalid={phoneBad(form.phone)}
                />
              </div>
              <div>
                <Label htmlFor="c-phone2">{t.phone2}</Label>
                <PhoneInput
                  id="c-phone2"
                  value={form.phone2}
                  onValueChange={(v) => set("phone2", v)}
                  invalid={phoneBad(form.phone2)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="c-address">{t.address}</Label>
              <Input
                id="c-address"
                maxLength={200}
                placeholder={t.addressPlaceholder}
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-map">{t.mapUrl}</Label>
              <Input
                id="c-map"
                inputMode="url"
                maxLength={200}
                placeholder="maps.app.goo.gl/..."
                value={form.mapUrl}
                onChange={(e) => set("mapUrl", e.target.value)}
              />
              <FieldHint>{t.mapUrlHint}</FieldHint>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <h2 className="type-heading text-base">{t.hoursTitle}</h2>
            <div>
              <Label>{t.workDays}</Label>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = form.workDays.includes(d);
                  return (
                    <Button
                      key={d}
                      type="button"
                      size="sm"
                      variant={on ? "primary" : "ghost"}
                      aria-pressed={on}
                      title={uz.weekdays.full[d]}
                      onClick={() => toggleDay(d)}
                    >
                      {uz.weekdays.short[d]}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="c-start">{t.workStart}</Label>
                <Input
                  id="c-start"
                  type="time"
                  value={form.workStart}
                  onChange={(e) => set("workStart", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="c-end">{t.workEnd}</Label>
                <Input id="c-end" type="time" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <h2 className="type-heading text-base">{t.socialTitle}</h2>
            <div>
              <Label htmlFor="c-telegram">{t.telegram}</Label>
              <Input
                id="c-telegram"
                maxLength={200}
                placeholder="@markaz yoki t.me/markaz"
                value={form.telegram}
                onChange={(e) => set("telegram", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-instagram">{t.instagram}</Label>
              <Input
                id="c-instagram"
                maxLength={200}
                placeholder="@markaz"
                value={form.instagram}
                onChange={(e) => set("instagram", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="c-website">{t.website}</Label>
              <Input
                id="c-website"
                inputMode="url"
                maxLength={200}
                placeholder="markaz.uz"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
              />
              <FieldHint>{t.websiteHint}</FieldHint>
            </div>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="type-heading text-base">{t.centerTitle}</h2>
            <p className="type-heading text-lg">{centerName}</p>
            <p className="text-body text-muted-foreground">{t.centerHint}</p>
            <p className="text-body text-muted-foreground">
              {t.billingLead}{" "}
              <Link href="/payment-settings" className="font-semibold text-(--primary-text) hover:underline">
                {t.billingLink}
              </Link>
            </p>
          </Card>
        </div>
      </div>
    </form>
  );
}
