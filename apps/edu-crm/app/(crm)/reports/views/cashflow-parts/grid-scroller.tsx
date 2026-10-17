"use client";

import * as React from "react";
import { cn } from "@ventura/ui/lib/utils";

/**
 * Keng jadval uchun gorizontal aylantiriladigan quti: ochilganda joriy oy (`data-current`) chap ustun yonida ko'rinadi,
 * shunda 12 oylik jadvalda foydalanuvchi har safar yanvardan qidirib o'tirmaydi.
 */
export function GridScroller({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const box = ref.current;
    const current = box?.querySelector<HTMLElement>("[data-current]");
    if (!box || !current) return;
    const sticky = box.querySelector<HTMLElement>("[data-sticky]")?.offsetWidth ?? 0;
    box.scrollLeft = Math.max(0, current.offsetLeft - sticky - 8);
  }, []);
  return (
    <div ref={ref} className={cn("overflow-x-auto", className)}>
      {children}
    </div>
  );
}
