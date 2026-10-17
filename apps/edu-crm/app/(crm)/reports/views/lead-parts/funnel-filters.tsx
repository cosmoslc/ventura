"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterSelect } from "@ventura/ui/filter-bar";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { uz } from "@/lib/uz";

const k = uz.reports.funnel;
const ALL = "all";

/**
 * Voronka filtrlari (kurs, manba) — umumiy filtr qatorida yil va oydan keyin. Tanlov manzilda (`?kurs=&manba=`):
 * havola ulashilsa va Excel yuklansa shu filtr bilan. Voronkaning hamma raqami (ko'rsatkichlar, jadvallar) shunga qarab
 * qayta hisoblanadi.
 */
export function FunnelFilters({ filters }: { filters: FunnelViewData["filters"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function set(key: "kurs" | "manba", value: string) {
    const q = new URLSearchParams(params.toString());
    if (value === ALL) q.delete(key);
    else q.set(key, value);
    router.push(`${pathname}?${q.toString()}`, { scroll: false });
  }

  return (
    <>
      <FilterSelect
        label={k.filterCourse}
        value={params.get("kurs") ?? ALL}
        onValueChange={(v) => set("kurs", v)}
        options={[{ value: ALL, label: k.allCourses }, ...filters.courses]}
      />
      <FilterSelect
        label={k.filterSource}
        value={params.get("manba") ?? ALL}
        onValueChange={(v) => set("manba", v)}
        options={[{ value: ALL, label: k.allSources }, ...filters.sources.map((s) => ({ value: s, label: s }))]}
      />
    </>
  );
}
