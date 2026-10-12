"use client";

import { cn } from "@ventura/ui/lib/utils";
import { uz } from "@/lib/uz";

/** Ruxsat holati: Taqiq / Ruxsat (eski tizimdagi uch holatdan "Tasdiq" — keyingi bosqichda) */
export function PermToggle({
  allowed,
  disabled,
  onChange,
  label,
}: {
  allowed: boolean;
  disabled?: boolean;
  onChange: (allowed: boolean) => void;
  label: string;
}) {
  const option = (value: boolean, text: string) => {
    const active = allowed === value;
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        disabled={disabled}
        onClick={() => !active && onChange(value)}
        className={cn(
          "h-(--control-h-sm) rounded-control px-2.5 text-caption font-semibold transition-colors disabled:cursor-not-allowed",
          active
            ? value
              ? "bg-(--success-bg) text-(--success-fg) shadow-card"
              : "bg-(--danger-bg) text-(--danger-fg) shadow-card"
            : "text-muted-foreground hover:text-foreground",
          disabled && !active && "opacity-50",
        )}
      >
        {text}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-control bg-muted p-0.5">
      {option(false, uz.positions.deny)}
      {option(true, uz.positions.allow)}
    </div>
  );
}
