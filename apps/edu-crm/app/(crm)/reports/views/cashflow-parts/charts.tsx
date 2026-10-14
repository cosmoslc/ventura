"use client";

import * as React from "react";
import { TrendChart, type TrendPoint } from "@ventura/ui/trend-chart";
import { type MonthFlow, type PlanPoint, shortMonth } from "@/lib/cashflow-views";
import { compactStr } from "@/lib/dashboard";
import { money } from "@/lib/format";
import { uz } from "@/lib/uz";

const t = uz.reports.cashflow;
const p = uz.reports.plan;

const monthName = (month: string) => uz.months[Number(month.slice(5, 7)) - 1]!;
const monthShort = (month: string) => shortMonth(monthName(month));
const som = (n: number) => `${money(Math.round(n))} ${uz.common.som}`;
const signed = (n: number) => `${n < 0 ? "−" : ""}${som(Math.abs(n))}`;

/** Oyma-oy kirim va chiqim: guruhlangan ustunlar, kursorda ikkala qiymat */
export function FlowChart({ months }: { months: readonly MonthFlow[] }) {
  const points: TrendPoint[] = months.map((m) => ({
    label: monthShort(m.month),
    tip: monthName(m.month),
    values: [m.income ?? 0, m.outflow ?? 0],
  }));
  return (
    <TrendChart
      points={points}
      series={[
        { key: "income", label: t.income, color: "var(--chart-1)" },
        { key: "outflow", label: t.outflow, color: "var(--chart-2)" },
      ]}
      kind="bar"
      formatValue={som}
      formatAxis={compactStr}
      height={220}
      caption={t.flowCaption}
    />
  );
}

/** Oyma-oy reja, fakt va prognoz (kirim yoki chiqim); reja yoki prognoz bo'lmasa, o'sha qator ko'rsatilmaydi */
export function PlanTrend({ points, caption }: { points: readonly PlanPoint[]; caption: string }) {
  const hasForecast = points.some((x) => x.forecast > 0);
  const hasPlan = points.some((x) => x.plan > 0);
  const series = [
    { key: "fact", label: p.fact, color: "var(--chart-1)", pick: (x: PlanPoint) => x.fact },
    ...(hasPlan ? [{ key: "plan", label: p.plan, color: "var(--chart-2)", pick: (x: PlanPoint) => x.plan }] : []),
    ...(hasForecast
      ? [{ key: "forecast", label: p.forecast, color: "var(--chart-3)", pick: (x: PlanPoint) => x.forecast }]
      : []),
  ];
  const pts: TrendPoint[] = points.map((x) => ({
    label: monthShort(x.month),
    tip: monthName(x.month),
    values: series.map((s) => s.pick(x)),
  }));
  return (
    <TrendChart
      points={pts}
      series={series.map(({ key, label, color }) => ({ key, label, color }))}
      kind="bar"
      formatValue={som}
      formatAxis={compactStr}
      height={200}
      caption={caption}
    />
  );
}

const PAD = { top: 10, right: 8, bottom: 22 };

/**
 * Oyma-oy sof oqim: nol chizig'idan yuqoriga (musbat) va pastga (manfiy) ustunlar, bitta Y o'qi. Kursorda sof
 * oqim va yig'ma qoldiq. TrendChart manfiy qiymatni ko'rsatmaydi, shuning uchun alohida.
 */
export function NetChart({ months, height = 200 }: { months: readonly MonthFlow[]; height?: number }) {
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

  const n = months.length;
  const nets = months.map((m) => m.net ?? 0);
  const hi = Math.max(1, ...nets) * 1.1;
  const lo = Math.min(0, ...nets) * 1.1;
  const ticks = lo < 0 ? [lo, 0, hi] : [0, hi / 2, hi];
  const labels = ticks.map(compactStr);
  const left = Math.max(28, Math.max(...labels.map((l) => l.length)) * 6.5 + 10);
  const innerW = Math.max(0, width - left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const y = (v: number) => PAD.top + ((hi - v) / (hi - lo)) * innerH;
  const slot = innerW / Math.max(1, n);
  const x = (i: number) => left + slot * (i + 0.5);
  const barW = Math.min(20, slot * 0.6);

  const indexAt = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || !n) return null;
    const rel = (clientX - rect.left - left) / Math.max(1, innerW);
    return Math.min(n - 1, Math.max(0, Math.floor(rel * n)));
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      setHover((h) => Math.min(n - 1, Math.max(0, (h ?? n - 1) + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") setHover(null);
  };

  const hm = hover !== null ? months[hover] : undefined;
  const tipX = hover !== null ? x(hover) : 0;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
        {[
          [t.positive, "var(--success-fg)"],
          [t.negative, "var(--danger-fg)"],
        ].map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-full" style={{ background: color }} aria-hidden />
            {label}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        role="img"
        aria-label={t.netCaption}
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
            {ticks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={left}
                  x2={width - PAD.right}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? "var(--border)" : "var(--border-soft)"}
                  strokeWidth={1}
                />
                <text
                  x={left - 6}
                  y={y(tick)}
                  dy="0.32em"
                  textAnchor="end"
                  className="fill-muted-foreground font-mono text-2xs"
                >
                  {labels[i]}
                </text>
              </g>
            ))}
            {months.map((m, i) => (
              <text
                key={m.month}
                x={x(i)}
                y={height - 6}
                textAnchor="middle"
                className="fill-muted-foreground font-mono text-2xs"
              >
                {monthShort(m.month)}
              </text>
            ))}
            {months.map((m, i) => {
              const v = m.net ?? 0;
              if (!v) return null;
              const top = Math.min(y(v), y(0));
              const h = Math.max(1, Math.abs(y(v) - y(0)));
              return (
                <rect
                  key={m.month}
                  x={x(i) - barW / 2}
                  y={top}
                  width={barW}
                  height={h}
                  rx={Math.min(3, barW / 2, h / 2)}
                  fill={v > 0 ? "var(--success-fg)" : "var(--danger-fg)"}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              );
            })}
          </svg>
        ) : null}
        {hm ? (
          <div
            className="pointer-events-none absolute top-1 z-(--z-popover) min-w-40 rounded-menu border border-border bg-popover px-3 py-2 text-xs shadow-popover"
            style={tipX > width / 2 ? { right: width - tipX + 10 } : { left: tipX + 10 }}
          >
            <div className="mb-1 font-semibold text-foreground">{monthName(hm.month)}</div>
            {hm.net === null ? (
              <div className="text-muted-foreground">—</div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t.net}:</span>
                  <span className="font-mono font-bold text-foreground">{signed(hm.net)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">{t.cumulative}:</span>
                  <span className="font-mono font-bold text-foreground">{signed(hm.cumulative ?? 0)}</span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
      <table className="sr-only">
        <caption>{t.netCaption}</caption>
        <thead>
          <tr>
            <th scope="col">{t.netCaption}</th>
            <th scope="col">{t.net}</th>
            <th scope="col">{t.cumulative}</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{monthName(m.month)}</th>
              <td>{m.net === null ? "—" : signed(m.net)}</td>
              <td>{m.cumulative === null ? "—" : signed(m.cumulative)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
