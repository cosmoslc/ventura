"use client";

import { Check } from "lucide-react";
import { cn } from "../lib/utils";

/*
 * Bosqichma-bosqich ustoz sarlavhasi ("Yangi loyiha"). O'tilgan qadamga bosib qaytish mumkin;
 * kichik ekranda faqat joriy qadam ko'rinadi.
 */

export interface StepperProps {
  steps: readonly string[];
  current: number;
  /** Qaysi qadamlarga o'tish mumkin (odatda o'tilganlari) */
  canGoTo?: (index: number) => boolean;
  onStepClick?: (index: number) => void;
  className?: string;
}

export function Stepper({ steps, current, canGoTo, onStepClick, className }: StepperProps) {
  return (
    <nav aria-label="Qadamlar" className={className}>
      <div className="flex items-center justify-between gap-3 text-body md:hidden">
        <span className="font-semibold text-foreground">{steps[current]}</span>
        <span className="font-mono text-xs text-muted-foreground">
          {current + 1} / {steps.length}
        </span>
      </div>
      <ol className="hidden items-center gap-1 md:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const active = i === current;
          const clickable = !active && (canGoTo?.(i) ?? done);
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1 last:flex-none">
              <button
                type="button"
                disabled={!clickable}
                onClick={() => onStepClick?.(i)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex min-w-0 items-center gap-2 rounded-btn px-1.5 py-1 text-left transition-colors",
                  clickable && "cursor-pointer hover:bg-secondary",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full border font-mono text-caption font-bold transition-colors",
                    done && "border-primary bg-primary text-primary-foreground",
                    active && "border-primary bg-primary-soft text-primary-text",
                    !done && !active && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-semibold",
                    active ? "text-foreground" : "text-muted-foreground",
                    "hidden lg:inline",
                  )}
                >
                  {label}
                </span>
              </button>
              {i < steps.length - 1 ? (
                <span className={cn("h-px min-w-3 flex-1", i < current ? "bg-primary" : "bg-border")} aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
