import * as React from "react";
import { cn } from "../lib/utils";

/** Ventura belgisi: ikki qavatli pastga qaragan strelka. */
export function LogoMark({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 40 40" fill="none" aria-hidden className={className} {...props}>
      <path
        d="M11 12l9 9 9-9M11 20l9 9 9-9"
        stroke="currentColor"
        strokeWidth={3}
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
