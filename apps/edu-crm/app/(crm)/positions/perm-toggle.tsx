"use client";

import { cn } from "@ventura/ui/lib/utils";
import { uz } from "@/lib/uz";

export type PermState = "deny" | "approval" | "allow";

/**
 * Ruxsat holati eski tizimdagidek uchta: Taqiq / Tasdiq bilan / Ruxsat (ADR 0019). "Tasdiq bilan" — amal
 * bajarilmaydi, direktor tasdiqlagach bajariladi; ko'rish, eksport va shunga o'xshash ruxsatlarda bo'lmaydi.
 */
export function PermToggle({
  state,
  approvable,
  disabled,
  canRaise,
  onChange,
  label,
}: {
  state: PermState;
  approvable: boolean;
  disabled?: boolean;
  /** Ruxsat oshirish mumkinmi (aks holda faqat pasaytirish) */
  canRaise?: boolean;
  onChange: (state: PermState) => void;
  label: string;
}) {
  const rank = { deny: 0, approval: 1, allow: 2 } as const;
  const option = (value: PermState, text: string, title?: string) => {
    const active = state === value;
    const blocked = disabled || (!canRaise && rank[value] > rank[state]);
    return (
      <button
        type="button"
        role="radio"
        aria-checked={active}
        title={title}
        disabled={blocked}
        onClick={() => !active && onChange(value)}
        className={cn(
          "h-(--control-h-sm) rounded-control px-2.5 text-caption font-semibold transition-colors disabled:cursor-not-allowed",
          active
            ? value === "allow"
              ? "bg-(--success-bg) text-(--success-fg) shadow-card"
              : value === "approval"
                ? "bg-(--warning-bg) text-(--warning-fg) shadow-card"
                : "bg-(--danger-bg) text-(--danger-fg) shadow-card"
            : "text-muted-foreground hover:text-foreground",
          blocked && !active && "opacity-50",
        )}
      >
        {text}
      </button>
    );
  };
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-control bg-muted p-0.5">
      {option("deny", uz.positions.deny)}
      {approvable ? option("approval", uz.positions.approval, uz.positions.approvalHint) : null}
      {option("allow", uz.positions.allow)}
    </div>
  );
}
