"use client";

import { ChevronRight, History, ShieldCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Pagination } from "@ventura/ui/pagination";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { ACTIVITY_SECTIONS, SECTION_LABELS } from "@/lib/activity-log";
import { formatDate } from "@/lib/format";
import type { ActivityRow, ActorOption, StaffActivity } from "@/lib/server/activity";
import { uz } from "@/lib/uz";
import { type VerifyResult, verifyActivityAction } from "./actions";

const t = uz.activityLog;
const ALL = "all";

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  return `${formatDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }))} ${time}`;
};

/** Zanjir butunligi: tugma bosilganda butun zanjir qayta hisoblanadi (katta jurnalda og'ir, shuning uchun o'zi emas) */
function Integrity() {
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<VerifyResult | null>(null);

  async function check() {
    setBusy(true);
    setResult(await verifyActivityAction());
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <div className="text-body font-bold text-foreground">{t.integrityTitle}</div>
            <div className="text-caption text-muted-foreground">{t.integrityHint}</div>
          </div>
        </div>
        <Button variant="ghost" onClick={() => void check()} disabled={busy}>
          {busy ? t.checking : t.check}
        </Button>
      </Card>
      {result ? (
        !result.ok ? (
          <Notice tone="danger">{result.error}</Notice>
        ) : result.intact ? (
          <Notice tone="success">{t.intact(result.count)}</Notice>
        ) : (
          <Notice tone="danger">{t.broken(result.brokenAtSeq ?? 0, result.reason ?? "")}</Notice>
        )
      ) : null}
    </div>
  );
}

function Details({ row }: { row: ActivityRow }) {
  const items = [
    { key: t.entry, value: String(row.seq), mono: true },
    { key: t.actionKey, value: row.action, mono: true },
    ...(row.ip ? [{ key: t.ip, value: row.ip, mono: true }] : []),
    ...(row.device ? [{ key: t.device, value: row.device, mono: false }] : []),
    ...row.details.map((d) => ({ key: d.key, value: d.value, mono: false })),
  ];
  return (
    <dl className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
      {items.map((it, i) => (
        <div key={`${it.key}-${i}`} className="min-w-0">
          <dt className="text-caption font-semibold text-muted-foreground">{it.key}</dt>
          <dd className={`text-body break-words text-foreground ${it.mono ? "font-mono" : ""}`}>{it.value}</dd>
        </div>
      ))}
      {row.details.length === 0 ? <div className="text-caption text-muted-foreground">{t.noDetails}</div> : null}
    </dl>
  );
}

export function ActivityView({
  rows,
  total,
  page,
  pageSize,
  from,
  to,
  actorId,
  section,
  q,
  actors,
  staff,
  rangeInvalid,
}: {
  rows: ActivityRow[];
  total: number;
  page: number;
  pageSize: number;
  from: string;
  to: string;
  actorId: string;
  section: string;
  q: string;
  actors: ActorOption[];
  staff: StaffActivity[];
  rangeInvalid: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [tab, setTab] = React.useState<"log" | "staff">("log");
  const [query, setQuery] = React.useState(q);
  const [open, setOpen] = React.useState<string | null>(null);

  const go = React.useCallback(
    (patch: Partial<{ from: string; to: string; actor: string; section: string; q: string; page: number }>) => {
      const next = { from, to, actor: actorId, section, q, page: 1, ...patch };
      const sp = new URLSearchParams();
      sp.set("from", next.from);
      sp.set("to", next.to);
      if (next.actor) sp.set("actor", next.actor);
      if (next.section) sp.set("section", next.section);
      if (next.q.trim()) sp.set("q", next.q.trim());
      if (next.page > 1) sp.set("page", String(next.page));
      startTransition(() => router.push(`${pathname}?${sp.toString()}`, { scroll: false }));
      setOpen(null);
    },
    [from, to, actorId, section, q, pathname, router],
  );

  // Qidiruv: yozishdan 0,35 s keyin so'rov
  React.useEffect(() => {
    if (query.trim() === q.trim()) return;
    const id = window.setTimeout(() => go({ q: query }), 350);
    return () => window.clearTimeout(id);
  }, [query, q, go]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const toggle = (id: string) => setOpen((cur) => (cur === id ? null : id));

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />
      <Integrity />
      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "log" | "staff")}>
        <TabsList>
          <TabsTrigger value="log">{t.tabLog}</TabsTrigger>
          <TabsTrigger value="staff">{t.tabStaff}</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar standalone>
        {tab === "log" ? (
          <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        ) : null}
        <FilterDates
          from={from}
          to={to}
          onChange={(next) => {
            const f = next.from ?? from;
            const tt = next.to ?? to;
            if (f && tt) go({ from: f, to: tt });
          }}
          fromLabel={t.from}
          toLabel={t.to}
        />
        {tab === "log" ? (
          <>
            <FilterSelect
              label={t.actor}
              value={actorId || ALL}
              onValueChange={(v) => go({ actor: v === ALL ? "" : v })}
              options={[{ value: ALL, label: t.allActors }, ...actors.map((a) => ({ value: a.id, label: a.name }))]}
            />
            <FilterSelect
              label={t.section}
              value={section || ALL}
              onValueChange={(v) => go({ section: v === ALL ? "" : v })}
              options={[
                { value: ALL, label: t.allSections },
                ...ACTIVITY_SECTIONS.map((s) => ({ value: s, label: SECTION_LABELS[s] })),
              ]}
            />
            <FilterEnd>
              <span className="text-caption text-muted-foreground">{t.count(total)}</span>
            </FilterEnd>
          </>
        ) : null}
      </FilterBar>

      <Card className={`overflow-hidden transition-opacity duration-150 ${pending ? "opacity-60" : ""}`}>
        {tab === "log" ? (
          rows.length ? (
            <>
              <TableWrap className="rounded-none border-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th className="hidden w-40 sm:table-cell">{t.colTime}</Th>
                      <Th>{t.colAction}</Th>
                      <Th className="w-8" />
                    </Tr>
                  </THead>
                  <TBody>
                    {rows.map((r) => {
                      const isOpen = open === r.id;
                      return (
                        <React.Fragment key={r.id}>
                          <Tr
                            className="cursor-pointer"
                            tabIndex={0}
                            aria-expanded={isOpen}
                            aria-label={isOpen ? t.collapse : t.expand}
                            onClick={() => toggle(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggle(r.id);
                              }
                            }}
                          >
                            <Td className="hidden font-mono text-caption whitespace-nowrap sm:table-cell">
                              {when(r.at)}
                            </Td>
                            <Td>
                              <div className="text-body text-foreground">{r.sentence}</div>
                              <div className="text-caption text-muted-foreground">
                                <span className="font-mono sm:hidden">{when(r.at)} · </span>
                                {SECTION_LABELS[r.section]}
                              </div>
                            </Td>
                            <Td className="text-muted-foreground">
                              <ChevronRight
                                className={`size-4 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                                aria-hidden
                              />
                            </Td>
                          </Tr>
                          {isOpen ? (
                            <tr className="bg-muted/40">
                              <td colSpan={3} className="px-4 py-4">
                                <Details row={r} />
                              </td>
                            </tr>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </TBody>
                </Table>
              </TableWrap>
              {pageCount > 1 ? (
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  total={total}
                  pageSize={pageSize}
                  onPageChange={(p) => go({ page: p })}
                />
              ) : null}
            </>
          ) : (
            <EmptyState icon={<History />} title={t.empty} description={t.emptyHint} />
          )
        ) : staff.length ? (
          <>
            <TableWrap className="rounded-none border-0">
              <Table className="min-w-[560px]">
                <THead>
                  <Tr>
                    <Th>{t.colStaff}</Th>
                    <Th className="text-right">{t.colTotal}</Th>
                    <Th>{t.colKinds}</Th>
                  </Tr>
                </THead>
                <TBody>
                  {staff.map((s) => (
                    <Tr
                      key={s.actorId}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => {
                        setTab("log");
                        go({ actor: s.actorId });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setTab("log");
                          go({ actor: s.actorId });
                        }
                      }}
                    >
                      <Td className="font-bold text-foreground">{s.actorName}</Td>
                      <Td className="text-right font-mono font-semibold text-foreground">{s.total}</Td>
                      <Td className="text-caption text-muted-foreground">
                        {s.sections
                          .slice(0, 4)
                          .map((x) => `${SECTION_LABELS[x.section]} ${x.count}`)
                          .join(" · ")}
                      </Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
            <p className="border-t border-border-soft px-5 py-3 text-caption text-muted-foreground">{t.staffHint}</p>
          </>
        ) : (
          <EmptyState icon={<History />} title={t.staffEmpty} description={t.emptyHint} />
        )}
      </Card>
    </div>
  );
}
