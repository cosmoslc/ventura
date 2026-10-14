"use client";

import { X } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";
import { Button } from "./button";

/*
 * SelectionBar — jadvalda qatorlar tanlanganda pastda, o'rtada suzib chiqadigan amallar paneli (o'quvchilar ro'yxati:
 * guruhga qo'shish, guruhdan chiqarish, SMS). Tanlov bo'lmasa pastga tushib yo'qoladi.
 *
 * Animatsiya faqat translate va opacity (kompozitorda): chiqishda oxirgi son ko'rinib turadi, yashiringanda `inert`
 * (fokus va bosish yo'q, `visibility` emas — qatlam qayta chizilmasin). `prefers-reduced-motion` — animatsiyasiz.
 * Qatlami modaldan past: amal oynasi ochilganda panel uning orqasida qoladi.
 */

export interface SelectionBarProps {
  count: number;
  /** "3 ta tanlandi" */
  label: (count: number) => string;
  onClear: () => void;
  clearLabel: string;
  /** Amal tugmalari (`SelectionBarAction`) */
  children: React.ReactNode;
  className?: string;
}

export function SelectionBar({ count, label, onClear, clearLabel, children, className }: SelectionBarProps) {
  const open = count > 0;
  // Yopilish animatsiyasi paytida oxirgi son ko'rinib tursin
  const [shown, setShown] = React.useState(count);
  if (open && count !== shown) setShown(count);

  return (
    <div
      role="region"
      aria-label={label(shown)}
      aria-hidden={!open}
      inert={!open}
      className="pointer-events-none fixed inset-x-0 bottom-4 z-(--z-topbar) flex justify-center px-4 sm:bottom-6"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-modal border border-border bg-popover p-1.5 shadow-modal",
          "transition-[translate,opacity] duration-300 ease-ios motion-reduce:transition-none",
          open ? "translate-y-0 opacity-100" : "translate-y-[calc(100%+2rem)] opacity-0",
          className,
        )}
      >
        <span
          className="px-2.5 text-body font-semibold whitespace-nowrap text-foreground tabular-nums"
          aria-live="polite"
        >
          {label(shown)}
        </span>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {children}
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
        <Button variant="icon" size="icon" aria-label={clearLabel} title={clearLabel} onClick={onClear}>
          <X />
        </Button>
      </div>
    </div>
  );
}

/** Paneldagi amal tugmasi: ikonka va yozuv; `tone="danger"` — xavfli amal (masalan guruhdan chiqarish) */
export function SelectionBarAction({
  icon,
  tone = "default",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { icon?: React.ReactNode; tone?: "default" | "danger" }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(tone === "danger" && "text-destructive-text", className)}
      {...props}
    >
      {icon}
      {children}
    </Button>
  );
}
