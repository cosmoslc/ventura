"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { money } from "@/lib/format";
import type { FunnelViewData } from "@/lib/server/lead-reports";
import { uz } from "@/lib/uz";

const k = uz.reports.funnel;
const ALL = "all";

/**
 * Voronka lidlari: bosqich tanlangan bo'lsa — aynan shu bosqichda to'xtagan lidlar (yo'qotilganlari — shu bosqichgacha
 * yetib yo'qotilgani), aks holda hammasi. Mas'ul va qidiruv — manzilda (`xodim`, `q`): server filtrlaydi, shuning uchun
 * jami son va Excel ham shunga mos. Sahifada eng yangi 100 tasi, to'liq ro'yxat — Excel'da.
 */
export function FunnelLeads({ data }: { data: FunnelViewData }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const urlQ = params.get("q") ?? "";
  const [q, setQ] = React.useState(urlQ);

  const go = React.useCallback(
    (next: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [key, v] of Object.entries(next)) {
        if (v === null || v === "") sp.delete(key);
        else sp.set(key, v);
      }
      router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Qidiruv: yozishdan 300 ms keyin manzilga yoziladi (har harfda server so'rovi bo'lmasin)
  React.useEffect(() => {
    if (q.trim() === urlQ) return;
    const id = setTimeout(() => go({ q: q.trim() }), 300);
    return () => clearTimeout(id);
  }, [q, urlQ, go]);

  const { rows, total } = data.leads;
  return (
    <div>
      <FilterBar>
        <FilterSearch
          placeholder={k.searchLead}
          aria-label={k.searchLead}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <FilterSelect
          label={k.filterStaff}
          value={params.get("xodim") ?? ALL}
          onValueChange={(v) => go({ xodim: v === ALL ? null : v })}
          options={[{ value: ALL, label: k.allStaff }, ...data.filters.staff]}
        />
        <FilterEnd>
          {data.selectedName ? (
            <span className="flex items-center gap-1 text-caption text-muted-foreground">
              {k.listStage(data.selectedName)}
              <Button variant="ghost" size="sm" onClick={() => go({ bosqich: null })}>
                {k.listClear}
              </Button>
            </span>
          ) : (
            <span className="text-caption text-muted-foreground">{k.listAllStages}</span>
          )}
          <span className="text-caption font-semibold text-foreground">
            {k.listCount(money(rows.length), money(total))}
          </span>
        </FilterEnd>
      </FilterBar>
      {rows.length ? (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th>{k.lead}</Th>
                <Th>{k.staff}</Th>
                <Th>{k.stage}</Th>
                <Th>{k.created}</Th>
                <Th>{k.entered}</Th>
                <Th>{k.lastNote}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((r) => (
                <Tr key={r.id}>
                  <Td className="min-w-48">
                    <Link href={`/leads/${r.id}`} className="font-semibold text-foreground hover:text-primary">
                      {r.name}
                    </Link>
                    {r.phoneText ? (
                      <a
                        href={`tel:+998${r.phone}`}
                        title={k.callLead}
                        className="block font-mono text-caption text-muted-foreground hover:text-primary-text"
                      >
                        {r.phoneText}
                      </a>
                    ) : null}
                  </Td>
                  <Td className="whitespace-nowrap">{r.staff}</Td>
                  <Td className="whitespace-nowrap">
                    <span className="font-medium text-foreground">{r.stage}</span>
                    {r.lostHere ? <span className="block text-caption text-(--danger-fg)">{k.lostHere}</span> : null}
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{r.created}</Td>
                  <Td className="whitespace-nowrap tabular-nums">{r.entered}</Td>
                  <Td className={cn("max-w-xs truncate", !r.note && "text-muted-foreground")} title={r.note}>
                    {r.note || "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <p className="py-16 text-center text-body text-muted-foreground">{k.listEmpty}</p>
      )}
    </div>
  );
}
