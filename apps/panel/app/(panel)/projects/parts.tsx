"use client";

import { Lock, TriangleAlert } from "lucide-react";
import * as React from "react";
import type { ProjectBrand } from "@ventura/db/schema/panel";
import { FEATURE_TYPE_LABELS, type Feature, dependentsOf, withRequirements } from "@ventura/tenants";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Label } from "@ventura/ui/label";
import { Switch } from "@ventura/ui/switch";
import { cn } from "@ventura/ui/lib/utils";
import { BRAND_PRESETS, contrastWithWhite } from "@/lib/project-rules";
import { uz } from "@/lib/uz";

/* ---------- Variant kartochkalari (rejim, manzil, baza) ---------- */

export function ChoiceCards<T extends string>({
  value,
  onChange,
  options,
  labels,
  hints,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  labels: Record<T, string>;
  hints: Record<T, string>;
  label: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <RadioGroup value={value} onValueChange={(v) => onChange(v as T)} aria-label={label}>
        {options.map((o) => (
          <RadioCard key={o} value={o} title={<span className="font-mono">{labels[o]}</span>} description={hints[o]} />
        ))}
      </RadioGroup>
    </div>
  );
}

/* ---------- Brend ---------- */

export function BrandPicker({ value, onChange }: { value: ProjectBrand; onChange: (b: ProjectBrand) => void }) {
  const lowContrast = contrastWithWhite(value.primary) < 3;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <div>
          <Label>{uz.wizard.color}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {BRAND_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                aria-pressed={value.primary.toLowerCase() === c}
                onClick={() => onChange({ ...value, primary: c })}
                className={cn(
                  "size-9 cursor-pointer rounded-btn border-2 transition-transform hover:scale-105",
                  value.primary.toLowerCase() === c ? "border-foreground" : "border-transparent",
                )}
                style={{ background: c }}
              />
            ))}
            <label className="flex h-9 cursor-pointer items-center gap-2 rounded-btn border border-border px-2.5 text-xs font-semibold text-secondary-foreground">
              <input
                type="color"
                value={value.primary}
                onChange={(e) => onChange({ ...value, primary: e.target.value })}
                className="size-5 cursor-pointer border-0 bg-transparent p-0"
                aria-label={uz.wizard.customColor}
              />
              <span className="font-mono">{value.primary}</span>
            </label>
          </div>
          {lowContrast ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-(--warning-fg)">
              <TriangleAlert className="size-3.5" /> {uz.wizard.contrastWarn}
            </p>
          ) : null}
        </div>
        <div>
          <Label>{uz.wizard.appearance}</Label>
          <RadioGroup
            value={value.appearance}
            onValueChange={(v) => onChange({ ...value, appearance: v as ProjectBrand["appearance"] })}
            className="grid-cols-3"
            aria-label={uz.wizard.appearance}
          >
            {(["light", "dark", "system"] as const).map((a) => (
              <RadioCard key={a} value={a} title={uz.wizard.appearanceLabels[a]} />
            ))}
          </RadioGroup>
        </div>
      </div>
      <BrandPreview brand={value} />
    </div>
  );
}

/** Jonli ko'rinish: tokenlar shu blok ichida tanlangan rang bilan qayta hisoblanadi. */
function BrandPreview({ brand }: { brand: ProjectBrand }) {
  const dark = brand.appearance === "dark";
  return (
    <div>
      <Label>{uz.wizard.preview}</Label>
      <div
        data-brand="ventura"
        className={dark ? "dark" : undefined}
        style={{ "--primary": brand.primary, colorScheme: dark ? "dark" : "light" } as React.CSSProperties}
      >
        <div className="space-y-3 rounded-card border border-border bg-background p-4 text-foreground">
          <div className="flex items-center justify-between">
            <span className="type-heading text-title">Bilim akademiyasi</span>
            <Badge tone="success" dot>
              Faol
            </Badge>
          </div>
          <div className="nav-active-surface flex h-9 items-center rounded-nav px-3 text-body font-semibold text-(--nav-active-fg)">
            Davomat
          </div>
          <div className="rounded-control border border-input bg-input-bg px-3 py-2 text-body text-placeholder">
            O&apos;quvchi ismi…
          </div>
          <div className="flex gap-2">
            <Button size="sm">Saqlash</Button>
            <Button size="sm" variant="ghost">
              Bekor qilish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Bo'limlar ---------- */

export function FeaturePicker({
  features,
  value,
  onChange,
  disabled,
}: {
  features: Feature[];
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const [notice, setNotice] = React.useState<string | null>(null);
  const names = React.useMemo(() => new Map(features.map((f) => [f.key, f.name])), [features]);
  const groups = React.useMemo(() => {
    const m = new Map<string, Feature[]>();
    for (const f of features) m.set(f.group, [...(m.get(f.group) ?? []), f]);
    return [...m.entries()];
  }, [features]);

  function toggle(f: Feature, on: boolean) {
    if (on) {
      const next = withRequirements(features, [...value, f.key]);
      const added = [...next].filter((k) => !value.has(k) && k !== f.key);
      setNotice(added.length ? uz.projects.alsoEnabled(added.map((k) => names.get(k)).join(", ")) : null);
      onChange(next);
    } else {
      const deps = dependentsOf(features, f.key).filter((k) => value.has(k));
      const next = new Set(value);
      next.delete(f.key);
      for (const d of deps) next.delete(d);
      setNotice(deps.length ? uz.projects.alsoDisabled(deps.map((k) => names.get(k)).join(", ")) : null);
      onChange(next);
    }
  }

  return (
    <div className="space-y-5">
      {notice ? (
        <div className="rounded-control border border-(--info-border) bg-(--info-bg) px-3 py-2 text-body text-(--info-fg)">
          {notice}
        </div>
      ) : null}
      {groups.map(([group, list]) => (
        <div key={group}>
          <div className="type-eyebrow mb-2 text-muted-foreground">{group}</div>
          {/* Ikki ustun: har bo'lim — o'z kartochkasi (nomi, tavsifi, ochadigan sahifalari, kaliti) */}
          <ul className="grid gap-2 md:grid-cols-2">
            {list.map((f) => {
              const locked = f.type === "permanent";
              const isMode = f.type === "mode";
              const on = value.has(f.key);
              const pages = f.nav.map((n) => n.label).filter((l) => l !== f.name);
              return (
                <li
                  key={f.key}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-card border px-4 py-3",
                    on || locked ? "border-border bg-card" : "border-border-soft bg-muted/30",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-body font-semibold text-foreground">
                      {f.name}
                      {f.type !== "regular" ? (
                        <Badge tone={f.type === "core" ? "warning" : f.type === "permanent" ? "info" : "neutral"}>
                          {FEATURE_TYPE_LABELS[f.type]}
                        </Badge>
                      ) : null}
                      {f.status === "soon" ? <Badge tone="neutral">{uz.projects.featureSoon}</Badge> : null}
                    </div>
                    <div className="mt-0.5 text-caption text-muted-foreground">
                      {locked
                        ? uz.projects.featureLockedHint
                        : isMode
                          ? uz.projects.featureModeHint
                          : (f.description ?? "")}
                    </div>
                    {pages.length ? (
                      <div className="mt-1 text-caption text-muted-foreground">
                        {uz.projects.featurePages}: {pages.join(", ")}
                      </div>
                    ) : null}
                    {f.requires.length && !locked ? (
                      <div className="mt-1 text-caption text-muted-foreground">
                        {uz.templates.requires}: {f.requires.map((r) => names.get(r) ?? r).join(", ")}
                      </div>
                    ) : null}
                  </div>
                  {isMode ? null : locked ? (
                    <Lock
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                      aria-label={uz.projects.featureLockedHint}
                    />
                  ) : (
                    <Switch
                      aria-label={f.name}
                      checked={on}
                      disabled={disabled}
                      onCheckedChange={(next) => toggle(f, next)}
                      className="mt-0.5 shrink-0"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
