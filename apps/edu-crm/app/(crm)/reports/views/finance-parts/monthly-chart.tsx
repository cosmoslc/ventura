"use client";

import { TrendChart } from "@ventura/ui/trend-chart";
import { compactStr } from "@/lib/dashboard";
import { formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";

/** Oylik ustunli grafik (mijoz): funksiyalar server komponentdan o'tmaydi, shuning uchun format shu yerda */

export interface MonthlyPoint {
  month: string;
  values: number[];
  /** Oynadagi qo'shimcha qator (masalan "Jami: 1 200 000") */
  note?: string;
}

export interface MonthlySeries {
  key: string;
  label: string;
  /** Grafik rangi raqami: 1–4 */
  color: 1 | 2 | 3 | 4;
}

// Iyun va iyul "Iyu" bo'lib qolmasligi uchun qo'lda qisqartirilgan nomlar
const short = (month: string) => uz.monthsShort[Number(month.slice(5, 7)) - 1]!;

export function MonthlyChart({
  points,
  series,
  caption,
  emptyText,
  height = 210,
}: {
  points: MonthlyPoint[];
  series: MonthlySeries[];
  caption: string;
  /** Hamma qiymat 0 bo'lsa chiziqlar o'rniga shu matn */
  emptyText: string;
  height?: number;
}) {
  if (!points.some((p) => p.values.some((v) => v > 0))) {
    return (
      <div
        className="grid flex-1 place-items-center text-center text-caption text-muted-foreground"
        style={{ minHeight: height }}
      >
        {emptyText}
      </div>
    );
  }
  return (
    <TrendChart
      kind="bar"
      points={points.map((p) => ({ label: short(p.month), tip: formatMonth(p.month), values: p.values, note: p.note }))}
      series={series.map((s) => ({ key: s.key, label: s.label, color: `var(--chart-${s.color})` }))}
      formatValue={(v) => `${money(v)} ${uz.common.som}`}
      formatAxis={compactStr}
      height={height}
      caption={caption}
    />
  );
}
