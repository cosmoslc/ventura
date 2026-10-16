import * as React from "react";
import { cn } from "../lib/utils";

/** Ventura belgisi: katta V ichida kichik V — "ikki chevron" (docs/design/brand, B varianti). */
export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M6.25 8.75 20 31.25 33.75 8.75"
        stroke="currentColor"
        strokeWidth={4.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 8.75 20 16.9 25 8.75"
        stroke="currentColor"
        strokeOpacity={0.55}
        strokeWidth={3.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface LogoProps {
  /** Tizim nomi — har mijozning o'z nomi bo'lishi mumkin (SPEC 8-bo'lim, brend). */
  name?: string;
  /** Logo belgisi (masalan <img>); berilmasa Ventura belgisi. */
  mark?: React.ReactNode;
  subtitle?: string;
  collapsed?: boolean;
  className?: string;
}

export function Logo({ name = "Ventura", mark, subtitle, collapsed, className }: LogoProps) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <span
        className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-btn border [&>img]:size-full [&>img]:object-cover"
        style={{
          background: "var(--logo-bg)",
          color: "var(--logo-fg)",
          borderColor: "var(--logo-border)",
          boxShadow: "var(--logo-shadow)",
        }}
      >
        {mark ?? <LogoMark className="size-7" />}
      </span>
      {!collapsed ? (
        <span className="min-w-0 leading-tight">
          <span className="type-brand block truncate text-foreground">{name}</span>
          {subtitle ? (
            <span className="type-eyebrow mt-0.5 block truncate text-muted-foreground">{subtitle}</span>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
