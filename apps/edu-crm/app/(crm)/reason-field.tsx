"use client";

import * as React from "react";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { type ReasonCategoryId, type ReasonsConfig, reasonOptions } from "@/lib/reasons";
import { uz } from "@/lib/uz";
import { reasonsConfigAction } from "./(settings)/reasons/actions";

/*
 * Dialoglardagi sabab maydoni (ADR 0035). Shu tur uchun sabab so'rash yoqilgan va ro'yxat bo'sh bo'lmasa — ro'yxatdan
 * tanlash ("Boshqa" — o'z matni), aks holda — avvalgidek ixtiyoriy matn. Sozlama oyna birinchi ochilganda bir marta
 * o'qiladi; Sabablar sahifasida o'zgargach unutiladi.
 */

const OTHER = "__other__";
/** Sozlama shuncha vaqt eski hisoblanmaydi: boshqa oynada/xodim tahrirlasa ham tez orada yangilanadi */
const CACHE_MS = 15_000;

let cache: { at: number; promise: Promise<ReasonsConfig | null> } | null = null;

export function forgetReasonsConfig() {
  cache = null;
}

/** Xato (ruxsat, tarmoq) keshga tushmaydi — keyingi ochishda qayta uriniladi, aks holda sahifa yangilanguncha matn maydoni qolardi */
function loadConfig(): Promise<ReasonsConfig | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.promise;
  const at = Date.now();
  const drop = () => {
    if (cache?.at === at) cache = null;
  };
  const promise = reasonsConfigAction().then(
    (r) => {
      if (!r.ok) drop();
      return r.ok ? r.config : null;
    },
    () => {
      drop();
      return null;
    },
  );
  cache = { at, promise };
  return promise;
}

export interface ReasonState {
  loading: boolean;
  /** Sabab ro'yxatdan tanlanadi va majburiy */
  active: boolean;
  options: string[];
}

/** Tur uchun holat; `category` null bo'lsa — sabab turi yo'q (oddiy matn) */
export function useReasonState(category: ReasonCategoryId | null, open = true): ReasonState {
  const [config, setConfig] = React.useState<ReasonsConfig | null | undefined>(undefined);
  // Oyna ochilganda qayta o'qiladi (kesh 15 soniya), yopiq oyna so'rov yubormaydi
  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    void loadConfig().then((c) => {
      if (alive) setConfig(c);
    });
    return () => {
      alive = false;
    };
  }, [open]);
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
  const selected = loading ? undefined : isOther ? OTHER : value || undefined;
  return (
    <div>
      <Label htmlFor={id}>{label} *</Label>
      {loading ? (
        <span className="block h-9 animate-pulse rounded-btn bg-muted" aria-hidden />
      ) : (
        <Select
          value={selected}
          onValueChange={(v) => {
            if (v === OTHER) {
              setOther(true);
              if (options.includes(value)) onChange("");
              return;
            }
            setOther(false);
            onChange(v);
          }}
        >
          <SelectTrigger id={id} aria-label={label}>
            <SelectValue placeholder={uz.reasons.choose} />
          </SelectTrigger>
          <SelectContent>
            {options.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
            <SelectItem value={OTHER}>{uz.reasons.other}</SelectItem>
          </SelectContent>
        </Select>
      )}
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
