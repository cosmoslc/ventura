"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "radix-ui";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../lib/utils";
import { MORPH_LAYER_ATTR } from "./dropdown-menu";

/*
 * Qisqa xabarlar: istalgan joydan toast({ title, description, tone }) chaqiriladi,
 * <Toaster /> esa layout'da bir marta turadi. O'ng yuqoridan siljib chiqadi (320ms, --ease-ios),
 * 4 soniyadan keyin yoki o'ngga surib yopiladi.
 */

export type ToastTone = "success" | "info" | "warning" | "danger";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  open: boolean;
}

let items: ToastItem[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(input: { title: string; description?: string; tone?: ToastTone }) {
  const item: ToastItem = { id: ++seq, title: input.title, description: input.description, tone: input.tone ?? "info", open: true };
  items = [...items, item].slice(-4);
  emit();
}

function setOpen(id: number, open: boolean) {
  items = items.map((t) => (t.id === id ? { ...t, open } : t));
  emit();
  // Yopilish animatsiyasidan keyin ro'yxatdan olib tashlanadi
  if (!open)
    setTimeout(() => {
      items = items.filter((t) => t.id !== id);
      emit();
    }, 400);
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: ToastItem[] = [];

const TONE: Record<ToastTone, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  success: { icon: CircleCheck, cls: "text-(--success-fg)" },
  info: { icon: Info, cls: "text-primary-text" },
  warning: { icon: TriangleAlert, cls: "text-(--warning-fg)" },
  danger: { icon: CircleAlert, cls: "text-(--danger-fg)" },
};

export function Toaster() {
  const list = React.useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
      {list.map((t) => {
        const { icon: Icon, cls } = TONE[t.tone];
        return (
          <ToastPrimitive.Root
            key={t.id}
            open={t.open}
            onOpenChange={(o) => setOpen(t.id, o)}
            className={cn(
              "pointer-events-auto relative flex items-start gap-3 rounded-card border border-border bg-popover p-4 pr-10 text-popover-foreground shadow-popover",
              "data-[state=open]:animate-[toast-in_320ms_var(--ease-ios)] data-[state=closed]:animate-[toast-out_200ms_ease-in_forwards]",
              "data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x) data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform",
              "data-[swipe=end]:animate-[toast-out_200ms_ease-in_forwards]",
            )}
          >
            <Icon className={cn("mt-px size-5 shrink-0", cls)} />
            <div className="min-w-0">
              <ToastPrimitive.Title className="text-body font-bold text-foreground">{t.title}</ToastPrimitive.Title>
              {t.description ? (
                <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Yopish"
              className="absolute top-3 right-3 grid size-6 cursor-pointer place-items-center rounded-btn text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport
        {...{ [MORPH_LAYER_ATTR]: "toast" }}
        className="pointer-events-none fixed top-4 right-4 left-4 z-(--z-toast) flex flex-col gap-2 outline-none sm:left-auto sm:w-96"
      />
    </ToastPrimitive.Provider>
  );
}
