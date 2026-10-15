"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export interface LineSeries {
  key: string;
  label: string;
  /** Token, masalan `var(--chart-1)` */
  color: string;
  values: (number | null)[];
}

export interface LineChartProps {
  /** Har nuqta vaqti (ms) — barcha qatorlar uchun umumiy */
  times: number[];
  series: LineSeries[];
  /** Y o'qi: 0 dan shu qiymatgacha (masalan 100 — foiz) */
  max: number;
  formatValue: (v: number) => string;
  formatTime: (t: number) => string;
  height?: number;
  /** Ekran o'quvchilari uchun jadval sarlavhasi */
  caption: string;
  className?: string;
}

const PAD = { top: 8, right: 8, bottom: 22, left: 36 };

/**
 * Vaqt bo'yicha chiziqli grafik (bitta o'q). Ingichka 2px chiziqlar, yengil to'r, ustida legenda va oxirgi
 * qiymatlar; kursor eng yaqin nuqtaga yopishadi va hamma qatorlar qiymatini bitta oynada ko'rsatadi.
 * Klaviatura: ← → bilan nuqtalar bo'ylab yuriladi. Ekran o'quvchilari uchun yashirin jadval bor.
 */
export function LineChart({
  times,
  series,
  max,
  formatValue,
  formatTime,
  height = 180,
  caption,
  className,
}: LineChartProps) {
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

  const n = times.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (n <= 1 ? innerW : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (Math.min(max, Math.max(0, v)) / max) * innerH;

  const pathFor = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  function indexAt(clientX: number) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const rel = (clientX - rect.left - PAD.left) / Math.max(1, innerW);
    return Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1))));
  }

  function onKey(e: React.KeyboardEvent) {
    if (!n) return;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => {
        const cur = h ?? n - 1;
        return Math.min(n - 1, Math.max(0, cur + (e.key === "ArrowLeft" ? -1 : 1)));
      });
    } else if (e.key === "Escape") setHover(null);
  }

  const last = (values: (number | null)[]) => {
    for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null) return values[i]!;
    return null;
  };
  const ticks = [0, max / 2, max];
  const xTicks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 1 ? [0] : [];
  const tipLeft = hover !== null ? x(hover) : 0;

  return (
    <div className={cn("min-w-0", className)}>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {series.map((s) => {
          const v = last(s.values);
          return (
            <span key={s.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
              {s.label}
              {v !== null ? <span className="font-mono font-semibold text-foreground">{formatValue(v)}</span> : null}
            </span>
          );
        })}
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
                  x1={PAD.left}
                  x2={width - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--border-soft)"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 6}
                  y={y(t)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-2xs"
                >
                  {formatValue(t)}
                </text>
              </g>
            ))}
            {xTicks.map((i, k) => (
              <text
                key={i}
                x={x(i)}
                y={height - 6}
                textAnchor={k === 0 ? "start" : k === xTicks.length - 1 ? "end" : "middle"}
                className="fill-muted-foreground font-mono text-2xs"
              >
                {formatTime(times[i]!)}
              </text>
            ))}
            {series.map((s) => (
              <path
                key={s.key}
                d={pathFor(s.values)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {hover !== null ? (
              <g>
                <line
                  x1={tipLeft}
                  x2={tipLeft}
                  y1={PAD.top}
                  y2={PAD.top + innerH}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                />
                {series.map((s) => {
                  const v = s.values[hover];
                  return v === null || v === undefined ? null : (
                    <circle
                      key={s.key}
                      cx={tipLeft}
                      cy={y(v)}
                      r={4}
                      fill={s.color}
                      stroke="var(--card)"
                      strokeWidth={2}
                    />
                  );
                })}
              </g>
            ) : null}
          </svg>
        ) : null}
        {hover !== null && times[hover] !== undefined ? (
          <div
            className="pointer-events-none absolute top-1 z-(--z-popover) min-w-32 rounded-menu border border-border bg-popover px-3 py-2 text-xs shadow-popover"
            style={tipLeft > width / 2 ? { right: width - tipLeft + 10 } : { left: tipLeft + 10 }}
          >
            <div className="mb-1 font-mono text-muted-foreground">{formatTime(times[hover])}</div>
            {series.map((s) => {
              const v = s.values[hover];
              return (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="font-mono font-bold text-foreground">
                    {v === null || v === undefined ? "—" : formatValue(v)}
                  </span>
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      <div className="sr-only">
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Vaqt</th>
              {series.map((s) => (
                <th key={s.key} scope="col">
                  {s.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {times.map((t, i) =>
              i % Math.max(1, Math.round(n / 24)) === 0 || i === n - 1 ? (
                <tr key={t}>
                  <th scope="row">{formatTime(t)}</th>
                  {series.map((s) => (
                    <td key={s.key}>
                      {s.values[i] === null || s.values[i] === undefined ? "—" : formatValue(s.values[i]!)}
                    </td>
                  ))}
                </tr>
              ) : null,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
