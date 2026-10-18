"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/utils";
import { Input, type InputProps } from "./input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

/*
 * Ro'yxat filtrlari — hamma sahifada bitta ko'rinish (STYLE.md 11.31): sarlavhasiz boshqaruvlar bir qatorda,
 * qidiruv birinchi, keyin tanlovlar ("Barcha ..." bandi bilan). Sahifalarda alohida karta (`standalone`) sifatida,
 * ro'yxatdan oldin; `standalone`siz — boshqa karta ichidagi qator (pastki chiziq bilan).
 */

export function FilterBar({
  standalone,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { standalone?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 p-3",
        standalone
          ? "rounded-card border border-border bg-card text-card-foreground shadow-card"
          : "border-b border-border-soft",
        className,
      )}
      {...props}
    />
  );
}

/** Qidiruv maydoni — qatorning qolgan kengligini oladi */
export function FilterSearch({ className, ...props }: Omit<InputProps, "icon">) {
  return (
    <div className={cn("min-w-0 flex-1 sm:max-w-sm sm:min-w-64", className)}>
      <Input icon={<Search />} {...props} />
    </div>
  );
}

export interface FilterOption {
  value: string;
  label: React.ReactNode;
}

/** Tanlov: yorliq ko'rinmaydi (ekran o'quvchisi uchun `label`), birinchi band odatda "Barcha ..." */
export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly FilterOption[];
  /** Kenglik (standart `sm:w-48`) */
  className?: string;
}) {
  // 12 tadan ko'p bandda qidiruv Select'ning o'zida chiqadi
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={cn("w-full sm:w-48", className)} aria-label={label} title={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Sana oralig'i: ikki maydon "—" bilan; yorliqlar faqat ekran o'quvchisi va maslahat uchun */
export function FilterDates({
  from,
  to,
  onChange,
  fromLabel,
  toLabel,
}: {
  from: string;
  to: string;
  onChange: (next: { from?: string; to?: string }) => void;
  fromLabel: string;
  toLabel: string;
}) {
  return (
    <div className="flex w-full items-center gap-1.5 sm:w-auto">
      <Input
        type="date"
        aria-label={fromLabel}
        title={fromLabel}
        className="min-w-0 sm:w-40"
        value={from}
        max={to || undefined}
        onChange={(e) => onChange({ from: e.target.value })}
      />
      <span className="text-muted-foreground" aria-hidden>
        —
      </span>
      <Input
        type="date"
        aria-label={toLabel}
        title={toLabel}
        className="min-w-0 sm:w-40"
        value={to}
        min={from || undefined}
        onChange={(e) => onChange({ to: e.target.value })}
      />
    </div>
  );
}

/** Qator oxiri (o'ngda): yozuvlar soni, jami yoki tugma */
export function FilterEnd({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ml-auto flex flex-wrap items-center gap-3", className)} {...props} />;
}
