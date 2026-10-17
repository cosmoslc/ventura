"use client";

import { FileSpreadsheet } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type * as React from "react";
import { Button } from "@ventura/ui/button";
import { FilterBar, FilterEnd, FilterSelect } from "@ventura/ui/filter-bar";
import { uz } from "@/lib/uz";

const t = uz.reports;
const ALL = "all";

/**
 * Umumiy filtr qatori (ADR 0030): yil va (davrli va oylik hisobotda) oy. Tanlov manzilda saqlanadi (`?yil=&oy=`) — havolani
 * ulashsa o'sha davr ochiladi. Filial — tepadagi umumiy tanlov. O'ngda Excel.
 */
export function ReportFilters({
  mode,
  year,
  month,
  years,
  excelHref,
  actions,
  filters,
}: {
  mode: "year" | "period" | "month" | "none";
  year: number | null;
  month: number | null;
  years: number[];
  excelHref: string;
  /** Hisobotga xos tugma (masalan rejani kiritish) — Excel yonida */
  actions?: React.ReactNode;
  /** Hisobotga xos filtrlar (masalan voronkada kurs va manba) — yil va oydan keyin */
  filters?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(next: { yil?: string; oy?: string }) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) q.set(k, v);
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  }

  return (
    <FilterBar standalone>
      {mode === "none" ? null : (
        <FilterSelect
          label={t.year}
          value={year === null ? ALL : String(year)}
          onValueChange={(v) => set({ yil: v })}
          options={[
            ...(mode === "period" ? [{ value: ALL, label: t.allYears }] : []),
            ...years.map((y) => ({ value: String(y), label: t.yearLabel(y) })),
          ]}
        />
      )}
      {mode !== "year" && year !== null ? (
        <FilterSelect
          label={t.month}
          value={month === null ? ALL : String(month)}
          onValueChange={(v) => set({ oy: v })}
          options={[
            { value: ALL, label: t.allMonths },
            ...uz.months.map((m, i) => ({ value: String(i + 1), label: m })),
          ]}
        />
      ) : null}
      {filters}
      <FilterEnd>
        {actions}
        <Button variant="ghost" asChild>
          <a href={excelHref} download>
            <FileSpreadsheet /> {t.excel}
          </a>
        </Button>
      </FilterEnd>
    </FilterBar>
  );
}
