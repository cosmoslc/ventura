"use client";

import { TrendChart } from "@ventura/ui/trend-chart";
import { uz } from "@/lib/uz";
import type { RetentionViewData } from "@/lib/server/academic-reports";

const k = uz.reports.retention;

/** Oylik ushlab turish chizig'i (formatlovchi funksiyalar uchun mijoz komponenti) */
export function RetentionTrend({ trend }: { trend: RetentionViewData["trend"] }) {
  return (
    <TrendChart
      kind="area"
      height={200}
      caption={k.trendTitle}
      series={[{ key: "churn", label: k.trendCaption, color: "var(--chart-1)" }]}
      points={trend.map((p) => ({
        label: p.label,
        tip: p.tip,
        values: [100 - p.rate],
        note: k.trendNote(p.churned, p.base),
      }))}
      formatValue={(v) => `${v.toFixed(1)}%`}
      formatAxis={(v) => `${Math.round(v)}%`}
    />
  );
}
