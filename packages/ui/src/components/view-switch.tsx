"use client";

import { LayoutGrid, List } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/utils";

export interface ViewSwitchOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}

/**
 * Ko'rinish almashtirgich (masalan, ro'yxat / kadrlar): kulrang yo'lak ichida oq "tabletka" aktiv tanlov ostiga
 * sirpanadi (380ms, --ease-ios). Aktiv yozuv va ikonka brend rangida (`text-primary`) — brend almashsa o'zi moslashadi.
 */
export function ViewSwitch<T extends string>({
  value,
  onValueChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly ViewSwitchOption<T>[];
  className?: string;
  "aria-label"?: string;
}) {
  const listRef = React.useRef<HTMLDivElement>(null);
  const pillRef = React.useRef<HTMLSpanElement>(null);

  React.useLayoutEffect(() => {
    const list = listRef.current;
    const pill = pillRef.current;
    if (!list || !pill) return;
    const place = () => {
      const active = list.querySelector<HTMLElement>("[aria-checked='true']");
      if (!active) return void (pill.style.opacity = "0");
      pill.style.opacity = "1";
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(list);
    return () => ro.disconnect();
  }, [value]);

  const move = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length]!;
    onValueChange(next.value);
    listRef.current?.querySelectorAll<HTMLElement>("[role='radio']")[options.indexOf(next)]?.focus();
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex shrink-0 items-center gap-0.5 rounded-control border border-border-soft bg-[color-mix(in_oklab,var(--foreground)_6%,transparent)] p-1",
        className,
      )}
    >
      <span
        ref={pillRef}
        aria-hidden
        className="pointer-events-none absolute top-1 bottom-1 shadow-[0_1px_3px_rgb(0_0_0/0.08)] left-0 rounded-[calc(var(--radius-control)-4px)] bg-card transition-[transform,width] duration-[380ms] ease-ios motion-reduce:transition-none"
        style={{ opacity: 0 }}
      />
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            title={o.title}
            onClick={() => onValueChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              "relative z-10 inline-flex h-8 cursor-pointer items-center gap-2 rounded-[calc(var(--radius-control)-4px)] px-3 text-body font-semibold whitespace-nowrap outline-none",
              "transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary/30 [&_svg]:size-4 [&_svg]:shrink-0",
              on ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Ro'yxat / kadrlar uchun tayyor variant — sahifalar bir xil ikonka va tartibni ishlatadi. */
export function ListGridSwitch({
  value,
  onValueChange,
  listLabel,
  gridLabel,
  listTitle,
  gridTitle,
  className,
}: {
  value: "list" | "grid";
  onValueChange: (value: "list" | "grid") => void;
  listLabel: React.ReactNode;
  gridLabel: React.ReactNode;
  listTitle?: string;
  gridTitle?: string;
  className?: string;
}) {
  return (
    <ViewSwitch
      value={value}
      onValueChange={onValueChange}
      className={className}
      options={[
        { value: "list", label: listLabel, icon: <List />, title: listTitle },
        { value: "grid", label: gridLabel, icon: <LayoutGrid />, title: gridTitle },
      ]}
    />
  );
}
