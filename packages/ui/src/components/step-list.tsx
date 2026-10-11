import { Check, LoaderCircle, Minus, X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

/*
 * Ketma-ket bajariladigan qadamlar ro'yxati (deploy qadamlari): har birining holati ikonka bilan,
 * o'ngida davomiyligi. Qadam bosilsa `onSelect` chaqiriladi (masalan logni shu qadamga filtrlash).
 */

export type StepState = "pending" | "running" | "ok" | "failed" | "skipped";

export interface StepItem {
  key: string;
  label: string;
  status: StepState;
  /** O'ngda ko'rsatiladigan qisqa matn, masalan "12 s" */
  meta?: string;
}

export interface StepListProps {
  steps: readonly StepItem[];
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  className?: string;
  "aria-label"?: string;
}

const ICON: Record<StepState, React.ReactNode> = {
  pending: <span className="size-1.5 rounded-full bg-current" />,
  running: <LoaderCircle className="size-3.5 animate-spin" strokeWidth={2.5} />,
  ok: <Check className="size-3.5" strokeWidth={3} />,
  failed: <X className="size-3.5" strokeWidth={3} />,
  skipped: <Minus className="size-3.5" strokeWidth={3} />,
};

const DOT: Record<StepState, string> = {
  pending: "border-border bg-card text-muted-foreground",
  running: "border-primary bg-primary-soft text-primary-text",
  ok: "border-(--success-border) bg-(--success-bg) text-(--success-fg)",
  failed: "border-(--danger-border) bg-(--danger-bg) text-(--danger-fg)",
  skipped: "border-border bg-secondary text-muted-foreground",
};

export function StepList({ steps, selected, onSelect, className, ...props }: StepListProps) {
  return (
    <ol className={cn("space-y-0.5", className)} {...props}>
      {steps.map((step) => {
        const active = selected === step.key;
        const muted = step.status === "pending" || step.status === "skipped";
        const row = (
          <>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full border transition-colors",
                DOT[step.status],
              )}
              aria-hidden
            >
              {ICON[step.status]}
            </span>
            <span className={cn("min-w-0 flex-1 truncate text-body font-semibold", muted && "text-muted-foreground")}>
              {step.label}
            </span>
            {step.meta ? <span className="font-mono text-caption text-muted-foreground">{step.meta}</span> : null}
          </>
        );
        return (
          <li key={step.key} data-status={step.status}>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(active ? null : step.key)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-btn px-2 py-1.5 text-left text-foreground transition-colors hover:bg-secondary",
                  active && "bg-secondary",
                )}
              >
                {row}
              </button>
            ) : (
              <div className="flex items-center gap-3 px-2 py-1.5 text-foreground">{row}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
