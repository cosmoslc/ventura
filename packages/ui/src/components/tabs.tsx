"use client";

import * as React from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "../lib/utils";

export const Tabs = TabsPrimitive.Root;

/**
 * Tablar ro'yxati: aktiv tab ostida sirpanuvchi chiziq (sidebar indikatori bilan bir xil harakat,
 * 380ms, --ease-ios). Tab ko'p bo'lsa gorizontal aylantiriladi.
 */
export function TabsList({ className, children, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const barRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    if (!list || !bar) return;
    const place = () => {
      const active = list.querySelector<HTMLElement>("[role='tab'][data-state='active']");
      if (!active) {
        bar.style.opacity = "0";
        return;
      }
      bar.style.opacity = "1";
      bar.style.width = `${active.offsetWidth}px`;
      bar.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();
    const mo = new MutationObserver(place);
    mo.observe(list, { subtree: true, attributes: true, attributeFilter: ["data-state"] });
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => {
      mo.disconnect();
      ro.disconnect();
    };
  }, []);

  return (
    <TabsPrimitive.List
      ref={listRef}
      className={cn("relative flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]", className)}
      {...props}
    >
      {children}
      <span
        ref={barRef}
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 h-0.5 rounded-full bg-primary transition-[transform,width] duration-[380ms] ease-ios motion-reduce:transition-none"
        style={{ opacity: 0 }}
      />
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "relative -mb-px inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-btn px-3 text-body font-semibold whitespace-nowrap",
        "text-muted-foreground outline-none transition-colors duration-150 hover:text-foreground",
        // Fokus: halqa emas, yumshoq fon — aktiv tab ostidagi chiziq bilan qutiga aylanmasin
        "focus-visible:bg-secondary focus-visible:text-foreground",
        "data-[state=active]:text-foreground disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("pt-5 outline-none data-[state=active]:animate-[slide-down_180ms_ease-out]", className)}
      {...props}
    />
  );
}
