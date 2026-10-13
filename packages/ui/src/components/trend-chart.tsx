"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface TrendPoint {
  /** O'q ostidagi qisqa yorliq ("12", "Du", "Okt") */
  label: string;
  /** Oynadagi to'liq nom ("12 oktabr, Du") */
  tip: string;
  /** Har qator uchun qiymat (series tartibida) */
  values: number[];
  /** Oynadagi qo'shimcha qator, masalan "To'lovlar: 4 ta" */
  note?: string;
}

export interface TrendSeries {
  key: string;
  label: string;
  /** Token, masalan `var(--chart-1)` */
  color: string;
}

export interface TrendChartProps {
  points: readonly TrendPoint[];
  series: readonly TrendSeries[];
  /** Mo'ljal chizig'i (masalan reja) — uzuq chiziq */
  limit?: { label: string; value: number } | null;
  kind?: "area" | "bar";
  formatValue: (v: number) => string;
  /** Y o'qidagi qisqa yozuv (standart — formatValue) */
  formatAxis?: (v: number) => string;
  height?: number;
  /** Ekran o'quvchilari uchun jadval sarlavhasi */
  caption: string;
  className?: string;
}

const PAD = { top: 10, right: 8, bottom: 22 };
/** Y o'qi yozuvi uchun joy: eng uzun yozuvga qarab (mono shrift, ~6.5px belgi) */
const axisWidth = (labels: readonly string[]) => Math.max(28, Math.max(...labels.map((l) => l.length)) * 6.5 + 10);

/**
 * Vaqt bo'yicha bir nechta qator: chiziq (birinchi qator och to'ldirish bilan) yoki guruhlangan ustunlar
 * (STYLE.md 11.32). Bitta Y o'qi, yengil to'r, ixtiyoriy uzuq "reja" chizig'i. Kursor eng yaqin nuqtaga yopishadi
 * va hamma qatorlarni bitta oynada ko'rsatadi; ← → bilan yuriladi. Ekran o'quvchilari uchun yashirin jadval.
 */
export function TrendChart({
  points,
  series,
  limit,
  kind = "area",
  formatValue,
  formatAxis = formatValue,
  height = 200,
  caption,
  className,
}: TrendChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(0);
  const [hover, setHover] = React.useState<number | null>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = points.length;
  const max = Math.max(1, limit?.value ?? 0, ...points.flatMap((p) => p.values)) * 1.1;
  const ticks = [0, max / 2, max];
  const left = axisWidth(ticks.map(formatAxis));
  const innerW = Math.max(0, width - left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + innerH - (Math.max(0, v) / max) * innerH;
  const slot = innerW / Math.max(1, n);
  /** Nuqta markazi: chiziqda — chetdan chetga, ustunda — slot o'rtasi */
  const x = (i: number) =>
    kind === "area" ? left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW) : left + slot * (i + 0.5);

  function indexAt(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const rel = (clientX - rect.left - left) / Math.max(1, innerW);
    if (kind === "area") return Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1))));
    return Math.min(n - 1, Math.max(0, Math.floor(rel * n)));
  }

  function onKey(e: React.KeyboardEvent) {
    if (!n) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") setHover(null);
  }

  const every = n <= 12 ? 1 : Math.ceil(n / 7);
  const base = PAD.top + innerH;

  let body: React.ReactNode = null;
  if (width > 0 && n) {
    if (kind === "area") {
      body = series.map((s, si) => {
        const d = points
          .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.values[si] ?? 0).toFixed(1)}`)
          .join("");
        return (
          <g key={s.key}>
            {si === 0 ? (
              <path
                d={`${d}L${x(n - 1).toFixed(1)},${base}L${x(0).toFixed(1)},${base}Z`}
                fill={s.color}
                fillOpacity={0.12}
              />
            ) : null}
            <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </g>
        );
      });
    } else {
      const gap = 2;
      const groupW = Math.min(28, slot * 0.7);
      const bw = Math.max(1, (groupW - gap * (series.length - 1)) / series.length);
      body = points.map((p, i) => (
        <g key={i}>
          {series.map((s, si) => {
            const v = p.values[si] ?? 0;
            const h = Math.max(0, base - y(v));
            const bx = x(i) - groupW / 2 + si * (bw + gap);
            const r = Math.min(4, bw / 2, h);
            // Faqat yuqori burchaklar yumaloq — ustun asosga yopishadi
            const d = h
              ? `M${bx},${base}V${base - h + r}Q${bx},${base - h} ${bx + r},${base - h}H${bx + bw - r}Q${bx + bw},${base - h} ${bx + bw},${base - h + r}V${base}Z`
              : "";
            return d ? (
              <path key={s.key} d={d} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />
            ) : null;
          })}
        </g>
      ));
    }
  }

  const hp = hover !== null ? points[hover] : undefined;
  const tipLeft = hover !== null ? x(hover) : 0;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
        ))}
        {limit ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-3 border-t-2 border-dashed border-muted-foreground" aria-hidden />
            {limit.label}
          </span>
        ) : null}
      </div>
      <div
        ref={ref}
        role="img"
        aria-label={caption}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerMove={(e) => setHover(indexAt(e.clientX))}
        onPointerLeave={() => setHover(null)}
        onBlur={() => setHover(null)}
        className="relative w-full touch-none outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--focus-outline)"
        style={{ height }}
      >
        {width > 0 ? (
          <svg width={width} height={height} className="block" aria-hidden>
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border-soft)"
                  strokeWidth={1}
                />
                <text
                  x={left - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-2xs"
                >
                  {formatAxis(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) =>
              i % every === 0 || i === n - 1 ? (
                <text
                  key={i}
                  x={x(i)}
                  y={height - 6}
                  textAnchor={kind === "area" && i === 0 ? "start" : kind === "area" && i === n - 1 ? "end" : "middle"}
                  className="fill-muted-foreground font-mono text-2xs"
                >
                  {p.label}
                </text>
              ) : null,
            )}
            {body}
            {limit && limit.value > 0 ? (
              <line
                x1={left}
                x2={width - PAD.right}
                y1={y(limit.value)}
                y2={y(limit.value)}
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
            ) : null}
            {hp && kind === "area" ? (
              <g>
                <line
                  x1={tipLeft}
                  x2={tipLeft}
                  y1={PAD.top}
                  y2={base}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                />
                {series.map((s, si) => (
                  <circle
                    key={s.key}
                    cx={tipLeft}
                    cy={y(hp.values[si] ?? 0)}
                    r={4}
                    fill={s.color}
                    stroke="var(--card)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            ) : null}
          </svg>
        ) : null}
        {hp ? (
          <div
            className="pointer-events-none absolute top-1 z-(--z-popover) min-w-40 rounded-menu border border-border bg-popover px-3 py-2 text-xs shadow-popover"
            style={tipLeft > width / 2 ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
          >
            <div className="mb-1 font-semibold text-foreground">{hp.tip}</div>
            {series.map((s, si) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: s.color }} aria-hidden />
                <span className="text-muted-foreground">{s.label}:</span>
                <span className="font-mono font-bold text-foreground">{formatValue(hp.values[si] ?? 0)}</span>
              </div>
            ))}
            {hp.note ? <div className="mt-1 text-muted-foreground">{hp.note}</div> : null}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{caption}</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <th scope="row">{p.tip}</th>
              {series.map((s, si) => (
                <td key={s.key}>{formatValue(p.values[si] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
