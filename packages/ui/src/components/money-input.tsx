"use client";

import * as React from "react";
import { formatMoney } from "../lib/money";
import { cn } from "../lib/utils";
import { controlClass } from "./input";

export { formatMoney };

export interface MoneyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** null — bo'sh maydon */
  value: number | null;
  onValueChange: (value: number | null) => void;
  /** O'ngdagi birlik, masalan "so'm" */
  suffix?: string;
  invalid?: boolean;
}

/** Pul maydoni: faqat raqam, minglik bo'shliq bilan ko'rsatiladi, qiymat butun son. */
export function MoneyInput({ value, onValueChange, suffix, invalid, className, ...props }: MoneyInputProps) {
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        autoComplete="off"
        aria-invalid={invalid || undefined}
        value={value === null ? "" : formatMoney(value)}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 13);
          onValueChange(digits ? Number(digits) : null);
        }}
        className={cn(controlClass, "font-mono", suffix && "pr-14", className)}
        {...props}
      />
      {suffix ? (
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
