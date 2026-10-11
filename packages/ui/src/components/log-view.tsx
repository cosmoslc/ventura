"use client";

import * as React from "react";
import { cn } from "../lib/utils";

/*
 * Log oynasi (deploy loglari): mono shrift, to'q fon. Yangi qator kelganda pastga o'zi aylanadi,
 * lekin foydalanuvchi yuqoriga aylantirgan bo'lsa joyida qoladi.
 */

export interface LogLine {
  id: number | string;
  text: string;
  /** `cmd` — bajarilgan buyruq, `err` — xato, `info` — izoh, `out` — oddiy natija */
  kind?: "cmd" | "out" | "err" | "info";
}

export interface LogViewProps extends React.HTMLAttributes<HTMLDivElement> {
  lines: readonly LogLine[];
  /** Qator yo'q bo'lganda ko'rsatiladigan matn */
  empty?: string;
  /** Oxirida miltillovchi kursor (jarayon davom etyapti) */
  live?: boolean;
}

const KIND_CLASS = {
  cmd: "font-semibold text-(--log-cmd)",
  out: "text-(--log-fg)",
  err: "text-(--log-err)",
  info: "text-(--log-muted) italic",
} as const;

export function LogView({ lines, empty, live, className, ...props }: LogViewProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const pinned = React.useRef(true);

  React.useEffect(() => {
    const el = ref.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      ref={ref}
      role="log"
      aria-live="polite"
      tabIndex={0}
      onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}
      className={cn(
        "h-80 overflow-auto rounded-card border border-(--log-border) bg-(--log-bg) px-4 py-3",
        "font-mono text-xs leading-relaxed text-(--log-fg) [scrollbar-color:var(--log-border)_transparent]",
        className,
      )}
      {...props}
    >
      {lines.length === 0 && empty ? <div className="text-(--log-muted)">{empty}</div> : null}
      {lines.map((line) => (
        <div key={line.id} className={cn("break-words whitespace-pre-wrap", KIND_CLASS[line.kind ?? "out"])}>
          {line.kind === "cmd" ? <span className="mr-2 text-(--log-muted) select-none">$</span> : null}
          {line.text}
        </div>
      ))}
      {live ? <span className="inline-block h-3.5 w-1.5 animate-pulse bg-(--log-fg) align-middle" aria-hidden /> : null}
    </div>
  );
}
