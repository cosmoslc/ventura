"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Textarea } from "@ventura/ui/textarea";
import { type ReasonCategoryId, type ReasonsConfig, reasonOptions } from "@/lib/reasons";
import { uz } from "@/lib/uz";
import { reasonsConfigAction } from "./reasons/actions";

/*
 * Dialoglardagi sabab maydoni (ADR 0035). Shu tur uchun sabab so'rash yoqilgan va ro'yxat bo'sh bo'lmasa — ro'yxatdan
 * tanlash ("Boshqa" — o'z matni), aks holda — avvalgidek ixtiyoriy matn. Sozlama oyna birinchi ochilganda bir marta
 * o'qiladi; Sabablar sahifasida o'zgargach unutiladi.
 */

let cache: Promise<ReasonsConfig | null> | null = null;

export function forgetReasonsConfig() {
  cache = null;
}

function loadConfig(): Promise<ReasonsConfig | null> {
  cache ??= reasonsConfigAction().then(
    (r) => (r.ok ? r.config : null),
    () => {
      cache = null;
      return null;
    },
  );
  return cache;
}

export interface ReasonState {
  loading: boolean;
  /** Sabab ro'yxatdan tanlanadi va majburiy */
  active: boolean;
  options: string[];
}

/** Tur uchun holat; `category` null bo'lsa — sabab turi yo'q (oddiy matn) */
export function useReasonState(category: ReasonCategoryId | null): ReasonState {
  const [config, setConfig] = React.useState<ReasonsConfig | null | undefined>(undefined);
  React.useEffect(() => {
    let alive = true;
    void loadConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  if (!category) return { loading: false, active: false, options: [] };
  if (config === undefined) return { loading: true, active: false, options: [] };
  if (config === null) return { loading: false, active: false, options: [] };
  return { loading: false, ...reasonOptions(config, category) };
}

export function ReasonField({
  id,
  category,
  value,
  onChange,
  label,
  placeholder,
  rows = 3,
}: {
  id: string;
  category: ReasonCategoryId | null;
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
  rows?: number;
}) {
  const state = useReasonState(category);
  const { loading, active } = state;
  const options = state.options.filter((o) => o !== uz.reasons.other);
  const [other, setOther] = React.useState(false);

  if (!active && !loading) {
    return (
      <div>
        <Label htmlFor={id}>{label}</Label>
        <Textarea
          id={id}
          rows={rows}
          maxLength={500}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  // Ro'yxatda yo'q qiymat (masalan oldingi matn) — "Boshqa" sifatida ko'rsatiladi
  const isOther = other || (value !== "" && !options.includes(value));
  return (
    <div>
      <Label>{label} *</Label>
      <div className="flex min-h-8 flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {loading ? (
          [96, 128, 112, 88].map((w) => (
            <span key={w} className="h-8 animate-pulse rounded-btn bg-muted" style={{ width: w }} />
          ))
        ) : (
          <>
            {options.map((r) => (
              <Button
                key={r}
                size="sm"
                role="radio"
                aria-checked={!isOther && value === r}
                variant={!isOther && value === r ? "primary" : "ghost"}
                onClick={() => {
                  setOther(false);
                  onChange(r);
                }}
              >
                {r}
              </Button>
            ))}
            <Button
              size="sm"
              role="radio"
              aria-checked={isOther}
              variant={isOther ? "primary" : "ghost"}
              onClick={() => {
                setOther(true);
                if (options.includes(value)) onChange("");
              }}
            >
              {uz.reasons.other}
            </Button>
          </>
        )}
      </div>
      {isOther ? (
        <Input
          className="mt-2"
          aria-label={uz.reasons.otherLabel}
          placeholder={uz.reasons.otherPlaceholder}
          maxLength={200}
          autoFocus
          value={options.includes(value) ? "" : value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </div>
  );
}
