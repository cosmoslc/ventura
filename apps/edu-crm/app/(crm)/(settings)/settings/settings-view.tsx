"use client";

import { Building2, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { LogoMark } from "@ventura/ui/logo";
import { Notice } from "@ventura/ui/notice";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { type CenterSettings, REGIONS, WEEKDAYS, type Weekday, centerInput } from "@/lib/center-settings";
import { firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { saveCenterSettingsAction } from "./actions";

const t = uz.settingsCenter;
const NO_CITY = "_";

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

/**
 * Markaz ma'lumotlari (E6a, ADR 0036): brending (ko'rish uchun — nom, logo va manzil Ventura panelida), aloqa va ish
 * vaqti. Dam olish kunlari ish kunlarining teskarisi sifatida saqlanadi (`workDays`).
 */
export function CenterSettingsView({
  settings,
  centerName,
  platformUrl,
  logoUrl,
}: {
  settings: CenterSettings;
  centerName: string;
  platformUrl: string | null;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(settings);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof CenterSettings>(k: K, v: CenterSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  // Ish kunlari kiritilmagan bo'lsa dam olish kuni ham belgilanmagan; bosilganda qolgan kunlar ish kuni bo'ladi
  const rest = form.workDays.length ? WEEKDAYS.filter((d) => !form.workDays.includes(d)) : [];
  const toggleRest = (d: Weekday) => {
    const work = form.workDays.length ? form.workDays : [...WEEKDAYS];
    set(
      "workDays",
      work.includes(d) ? work.filter((x) => x !== d) : WEEKDAYS.filter((w) => w === d || work.includes(w)),
    );
  };

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
    <form onSubmit={submit} className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-stat-icon border border-border bg-card text-muted-foreground [&_svg]:size-5">
          <Building2 />
        </div>
        <div className="min-w-0">
          <h1 className="type-heading text-(length:--page-title-size) leading-tight text-foreground">{t.title}</h1>
          <p className="mt-1 text-body text-muted-foreground">{t.description}</p>
        </div>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Section title={t.brandTitle} description={t.brandDescription}>
        <div className="flex items-center gap-4 rounded-card border border-dashed border-border p-4">
          <div
            className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl"
            style={{ background: "var(--logo-bg)", color: "var(--logo-fg)" }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil (panel brendi)
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <LogoMark className="size-10" />
            )}
          </div>
          <div className="min-w-0">
            <div className="text-body font-semibold text-foreground">{t.logo}</div>
            <p className="text-body text-muted-foreground">{t.logoHint}</p>
          </div>
        </div>
        {platformUrl ? (
          <div>
            <Label htmlFor="c-platform">{t.platformUrl}</Label>
            <Input id="c-platform" value={platformUrl} readOnly disabled />
            <FieldHint>{t.platformHint}</FieldHint>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-name">{t.centerName}</Label>
            <Input id="c-name" value={centerName} readOnly disabled />
          </div>
          <div>
            <Label htmlFor="c-city">{t.city}</Label>
            <Select
              value={form.city || NO_CITY}
              onValueChange={(v) => set("city", v === NO_CITY ? "" : (v as CenterSettings["city"]))}
            >
              <SelectTrigger id="c-city">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CITY}>{t.cityNone}</SelectItem>
                {REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
      </Section>

      <Section title={t.contactTitle} description={t.contactDescription}>
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
          <div>
            <Label htmlFor="c-email">{t.email}</Label>
            <Input
              id="c-email"
              type="email"
              inputMode="email"
              maxLength={120}
              placeholder="markaz@gmail.com"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
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
          </div>
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
        </div>
        <FieldHint>{t.websiteHint}</FieldHint>
      </Section>

      <Section title={t.hoursTitle} description={t.hoursDescription}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="c-start">{t.workStart}</Label>
            <Input id="c-start" type="time" value={form.workStart} onChange={(e) => set("workStart", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="c-end">{t.workEnd}</Label>
            <Input id="c-end" type="time" value={form.workEnd} onChange={(e) => set("workEnd", e.target.value)} />
          </div>
        </div>
        <div>
          <Label>{t.restDays}</Label>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const on = rest.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  title={uz.weekdays.full[d]}
                  onClick={() => toggleRest(d)}
                  className={cn(
                    "grid h-11 min-w-12 place-items-center rounded-control border px-3 text-body font-medium transition-colors",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {uz.weekdays.short[d]}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          <Check /> {uz.common.save}
        </Button>
      </div>
    </form>
  );
}
