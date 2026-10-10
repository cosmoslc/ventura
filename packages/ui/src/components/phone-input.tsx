"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/** "901234567" → "90 123 45 67" */
export function formatUzPhone(digits: string) {
  const d = digits.replace(/\D/g, "").slice(0, 9);
  return [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(" ");
}

export interface PhoneInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: string;
  onValueChange: (digits: string) => void;
  invalid?: boolean;
}

export function PhoneInput({ value, onValueChange, invalid, className, disabled, ...props }: PhoneInputProps) {
  return (
    <div
      className={cn(
        "flex h-(--control-h) w-full overflow-hidden rounded-control border border-input bg-input-bg",
        "transition-[border-color,box-shadow] duration-150 hover:border-(--input-hover)",
        "focus-within:border-(--ring-border) focus-within:shadow-(--ring-shadow)",
        invalid && "border-(--danger-fg) shadow-(--error-ring) hover:border-(--danger-fg)",
        disabled && "opacity-60",
        className,
      )}
    >
      <span className="flex items-center border-r border-input bg-secondary px-4 font-mono text-sm font-semibold text-secondary-foreground">
        +998
      </span>
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="90 123 45 67"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        value={formatUzPhone(value)}
        onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 9))}
        className="min-w-0 flex-1 bg-transparent px-4 font-mono text-sm text-foreground outline-none placeholder:text-placeholder"
        {...props}
      />
    </div>
  );
}
