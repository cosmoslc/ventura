import * as React from "react";
import { cn } from "../lib/utils";

export interface SparklineProps {
  values: readonly number[];
  /** `area` — trend (chiziq + och to'ldirish), `bar` — taqqoslash ustunlari */
  kind?: "area" | "bar";
  /** Token, masalan `var(--chart-1)` */
  color?: string;
  className?: string;
}

const W = 100;
const H = 26;

/**
 * KPI kartasidagi kichik grafik (STYLE.md 11.32). Faqat bezak emas, lekin qiymati kartaning o'zida matn bilan
 * yozilgani uchun ekran o'quvchisidan yashiriladi. O'q, to'r va yorliq yo'q.
 */
export function Sparkline({ values, kind = "area", color = "var(--chart-1)", className }: SparklineProps) {
  const v = values.length ? values : [0];
  if (kind === "area") {
    const mn = Math.min(...v);
    const mx = Math.max(...v);
    const norm = (x: number) => (mx === mn ? 0.5 : (x - mn) / (mx - mn));
    const step = v.length > 1 ? W / (v.length - 1) : W;
    const pts = v.map((x, i) => `${(i * step).toFixed(1)} ${(H - 2 - norm(x) * (H - 6)).toFixed(1)}`);
    const line = `M${pts.join(" L")}`;
    return (
      <svg
        className={cn("block h-6.5 w-full", className)}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill={color} fillOpacity={0.16} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </svg>
    );
  }
  const mx = Math.max(0, ...v);
  const slot = W / v.length;
  const bw = slot * 0.62;
  const d = v
    .map((x, i) => {
      const bh = Math.max(2, mx > 0 ? (Math.max(0, x) / mx) * (H - 2) : 2);
      const xx = i * slot + (slot - bw) / 2;
      return `M${xx.toFixed(1)} ${(H - bh).toFixed(1)}h${bw.toFixed(1)}v${bh.toFixed(1)}h-${bw.toFixed(1)}Z`;
    })
    .join("");
  return (
    <svg
      className={cn("block h-6.5 w-full", className)}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path fill={color} d={d} />
    </svg>
  );
}
