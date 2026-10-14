import type * as React from "react";
import { Card } from "@ventura/ui/card";
import { cn } from "@ventura/ui/lib/utils";
import { MetricCard } from "@ventura/ui/metric-card";
import type { ReportMetric } from "@/lib/reports";
import { uz } from "@/lib/uz";
import { formatCell } from "../report-table";

/*
 * Hisobot ko'rinishlarining umumiy bloklari (ADR 0034): hamma hisobotda bir xil sarlavha, karta va bo'sh holat —
 * bosh paneldagi bloklar bilan bir xil uslub.
 */

/** Blok sarlavhasi (karta ichida ham, tashqarisida ham bir xil) */
export const BLOCK_TITLE = "text-caption font-bold tracking-wide text-foreground uppercase";

export function BlockTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn(BLOCK_TITLE, className)}>{children}</h2>;
}

/** Hisobot bloki: sarlavha, ixtiyoriy izoh, o'ngda amal yoki izoh, tarkib */
export function Panel({
  title,
  sub,
  aside,
  className,
  flush = false,
  children,
}: {
  title: string;
  sub?: string;
  aside?: React.ReactNode;
  className?: string;
  /** Tarkib (jadval) kartaning chetigacha cho'ziladi */
  flush?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("relative flex min-w-0 flex-col gap-3 p-4", flush && "px-0 pb-0", className)}>
      <div className={cn("flex flex-wrap items-start justify-between gap-x-3 gap-y-1", flush && "px-4")}>
        <div className="min-w-0">
          <BlockTitle className="truncate">{title}</BlockTitle>
          {sub ? <p className="mt-0.5 text-caption text-muted-foreground">{sub}</p> : null}
        </div>
        {aside ? <div className="shrink-0 text-caption text-muted-foreground">{aside}</div> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </Card>
  );
}

/** Blok ichidagi bo'sh holat */
export function PanelEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="grid min-h-28 flex-1 place-items-center text-center text-caption text-muted-foreground">{children}</p>
  );
}

/** Butun hisobot o'rnida bo'sh holat (davrda ma'lumot yo'q) */
export function EmptyPanel({ text }: { text: string }) {
  return (
    <Card className="grid min-h-40 place-items-center p-6 text-center text-body text-muted-foreground">{text}</Card>
  );
}

/** Yuqori ko'rsatkichlar: yuklovchining `metrics` qatori (Excel bilan bir xil raqamlar) */
export function KpiRow({ metrics }: { metrics: ReportMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={formatCell(m.value, m.kind)}
          unit={m.kind === "money" && m.value !== null ? uz.common.som : undefined}
          tone={m.tone ?? "neutral"}
          colorValue={!!m.tone && m.tone !== "neutral"}
          foot={m.foot}
        />
      ))}
    </div>
  );
}
