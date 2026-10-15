"use client";

import { TrendChart, type TrendPoint } from "@ventura/ui/trend-chart";

const axis = (v: number) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));

/** 12 oylik guruhlangan ustunlar (formatlovchi funksiyalar mijozda turadi) */
export function SeasonChart({
  points,
  series,
  caption,
}: {
  points: TrendPoint[];
  series: { key: string; label: string; color: string }[];
  caption: string;
}) {
  // relative + overflow-hidden: ekran o'quvchilari jadvali (sr-only) sahifani kengaytirib yubormasin
  return (
    <div className="relative overflow-hidden">
      <TrendChart
        points={points}
        series={series}
        kind="bar"
        formatValue={(v) => String(Math.round(v))}
        formatAxis={axis}
        height={240}
        caption={caption}
      />
    </div>
  );
}
