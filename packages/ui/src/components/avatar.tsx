import * as React from "react";
import { cn } from "../lib/utils";

const HUES = [
  ["#6366f1", "#8b5cf6"],
  ["#0ea5e9", "#2563eb"],
  ["#10b981", "#059669"],
  ["#f59e0b", "#ea580c"],
  ["#ec4899", "#db2777"],
  ["#14b8a6", "#0d9488"],
] as const;

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export interface AvatarProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: string;
  size?: number;
  /** "brand" — tokenlardagi --avatar-bg; "auto" — ismga qarab rang. */
  variant?: "brand" | "auto";
}

export function Avatar({ name, size = 32, variant = "auto", className, style, ...props }: AvatarProps) {
  let bg = "var(--avatar-bg)";
  let fg = "var(--avatar-fg)";
  if (variant === "auto") {
    const sum = [...name].reduce((a, c) => a + c.charCodeAt(0), 0);
    const pair = HUES[sum % HUES.length] ?? HUES[0];
    bg = `linear-gradient(135deg, ${pair[0]}, ${pair[1]})`;
    fg = "#ffffff";
  }
  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center rounded-avatar font-bold select-none", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), background: bg, color: fg, ...style }}
      aria-hidden
      {...props}
    >
      {initials(name)}
    </span>
  );
}
