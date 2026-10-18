"use client";

import { History } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { MONEY_GROUPS } from "@/lib/money-audit";
import type { MoneyAuditRow } from "@/lib/server/money-audit";
import { formatDate, money } from "@/lib/format";
import { uz } from "@/lib/uz";

const t = uz.moneyAudit;
const ALL = "all";
const PAGE_SIZE = 50;
const TONE = {
  payment: "success",
  expense: "danger",
  additional_income: "info",
  salary_entry: "warning",
  approval: "neutral",
} as const;

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  return `${formatDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }))} ${time}`;
};

export function MoneyAuditView({
  rows,
  from,
  to,
  rangeInvalid,
}: {
  rows: MoneyAuditRow[];
  from: string;
  to: string;
  rangeInvalid: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [actor, setActor] = React.useState(ALL);
  const [page, setPage] = React.useState(1);

  const actors = [...new Set(rows.map((r) => r.actorName).filter((n): n is string => !!n))].sort((a, b) =>
    a.localeCompare(b),
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (group === ALL || r.group === group) &&
      (actor === ALL || r.actorName === actor) &&
      (!q || (r.actorName ?? "").toLowerCase().includes(q) || r.details.toLowerCase().includes(q)),
  );
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = visible.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const filter =
    <T,>(set: (v: T) => void) =>
    (v: T) => {
      set(v);
      setPage(1);
    };
  const setRange = (next: { from?: string; to?: string }) => {
    const f = next.from ?? from;
    const tt = next.to ?? to;
    if (f && tt) router.push(`${pathname}?from=${f}&to=${tt}`, { scroll: false });
  };

  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} />
      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => filter(setQuery)(e.target.value)} />
        <FilterDates from={from} to={to} onChange={setRange} fromLabel={t.from} toLabel={t.to} />
        <FilterSelect
          label={t.kind}
          value={group}
          onValueChange={filter(setGroup)}
          options={[{ value: ALL, label: t.allKinds }, ...MONEY_GROUPS.map((g) => ({ value: g, label: t.groups[g] }))]}
        />
        <FilterSelect
          label={t.actor}
          value={actor}
          onValueChange={filter(setActor)}
          options={[{ value: ALL, label: t.allActors }, ...actors.map((a) => ({ value: a, label: a }))]}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length)}</span>
        </FilterEnd>
      </FilterBar>

      <Card className="overflow-hidden">
        {shown.length ? (
          <>
            <TableWrap className="rounded-none border-0">
              <Table>
                <THead>
                  <Tr>
                    <Th>{t.colTime}</Th>
                    <Th>{t.colActor}</Th>
                    <Th>{t.colAction}</Th>
                    <Th>{t.colDetails}</Th>
                    <Th className="text-right">{t.colAmount}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {shown.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-mono text-caption whitespace-nowrap">{when(r.at)}</Td>
                      <Td className="font-medium text-foreground">{r.actorName ?? "—"}</Td>
                      <Td className="whitespace-nowrap">
                        <Badge tone={TONE[r.group]}>{t.groups[r.group]}</Badge>
                        <span className="ml-2 text-caption text-muted-foreground">{t.verbs[r.verb] ?? r.verb}</span>
                      </Td>
                      <Td className="max-w-96 truncate text-caption text-muted-foreground" title={r.details}>
                        {r.details || "—"}
                      </Td>
                      <Td className="text-right font-semibold whitespace-nowrap">
                        {r.amount === null ? "—" : money(r.amount)}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            {pageCount > 1 ? (
              <Pagination
                page={current}
                pageCount={pageCount}
                total={visible.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            ) : null}
          </>
        ) : (
          <EmptyState icon={<History />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>
    </div>
  );
}
