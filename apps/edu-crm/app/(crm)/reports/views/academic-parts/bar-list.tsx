"use client";

import Link from "next/link";
import * as React from "react";
import { cn } from "@ventura/ui/lib/utils";

export interface BarItem {
  key: string;
  label: string;
  /** Havola (guruh, o'quvchi) */
  href?: string;
  /** Ikkinchi qator */
  sub?: string;
  /** O'ngdagi qiymat matni va uning yonidagi kichik ulush */
  display: string;
  share?: string;
  /** Chiziq to'lishi, 0–1 */
  fraction: number;
  tone?: "primary" | "danger" | "warning" | "muted";
}

const FILL = {
  primary: "var(--chart-1)",
  danger: "var(--danger-fg)",
  warning: "var(--warning-fg)",
  muted: "var(--muted-foreground)",
} as const;

/**
 * Ingichka chiziqli ro'yxat: nom, qiymat, ulush. `onSelect` berilsa qator tugma bo'ladi (tanlangani ajralib turadi,
 * qayta bosilsa tozalanadi). `limit` dan ko'p band bo'lsa — "Barchasi" tugmasi.
 */
export function BarList({
  items,
  selected,
  onSelect,
  pickTitle,
  limit = 6,
  moreLabel,
  lessLabel,
  className,
}: {
  items: readonly BarItem[];
  selected?: string | null;
  onSelect?: (key: string | null) => void;
  pickTitle?: string;
  limit?: number;
  moreLabel?: string;
  lessLabel?: string;
  className?: string;
}) {
  const [all, setAll] = React.useState(false);
  const shown = all ? items : items.slice(0, limit);
  return (
    <div className={className}>
      <ul className="flex flex-col gap-1">
        {shown.map((it) => {
          const body = (
            <>
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-body font-semibold text-foreground">{it.label}</span>
                <span className="shrink-0 text-body font-semibold text-foreground tabular-nums">
                  {it.display}
                  {it.share ? <small className="ml-1.5 font-medium text-muted-foreground">{it.share}</small> : null}
                </span>
              </span>
              {it.sub ? <span className="block truncate text-caption text-muted-foreground">{it.sub}</span> : null}
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.min(100, Math.max(it.fraction > 0 ? 1.5 : 0, it.fraction * 100))}%`,
                    background: FILL[it.tone ?? "primary"],
                  }}
                />
              </span>
            </>
          );
          const row = "block w-full rounded-control px-2 py-1.5 text-left";
          return (
            <li key={it.key}>
              {onSelect ? (
                <button
                  type="button"
                  title={pickTitle}
                  aria-pressed={selected === it.key}
                  onClick={() => onSelect(selected === it.key ? null : it.key)}
                  className={cn(
                    row,
                    "cursor-pointer transition-colors hover:bg-muted",
                    selected === it.key && "bg-muted",
                  )}
                >
                  {body}
                </button>
              ) : it.href ? (
                <Link href={it.href} className={cn(row, "transition-colors hover:bg-muted")}>
                  {body}
                </Link>
              ) : (
                <div className={row}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
      {items.length > limit && moreLabel && lessLabel ? (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 w-full cursor-pointer rounded-control px-2 py-1.5 text-center text-caption font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {all ? lessLabel : moreLabel}
        </button>
      ) : null}
    </div>
  );
}
