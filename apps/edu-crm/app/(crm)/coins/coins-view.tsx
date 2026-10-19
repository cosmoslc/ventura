"use client";

import { CalendarDays, Coins, History, Settings, Users } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { formatDate, money } from "@/lib/format";
import type { CoinHistoryRow, CoinLeader } from "@/lib/server/coins";
import { uz } from "@/lib/uz";
import { GroupChip, MoreRows, StudentsTable } from "../student-table";
import { coinHistoryAction } from "./actions";

const t = uz.coins;
const ALL = "all";
const PAGE_ROWS = 50;

export type CoinRow = CoinLeader & { groups: { id: string; name: string }[] };

function HistoryModal({ row, onClose }: { row: CoinRow | null; onClose: () => void }) {
  // Natija o'quvchi id si bilan saqlanadi: boshqa o'quvchi ochilsa eski ro'yxat ko'rinmaydi
  const [loaded, setLoaded] = React.useState<{ id: string; rows: CoinHistoryRow[] } | null>(null);
  const list = row && loaded?.id === row.studentId ? loaded.rows : null;

  React.useEffect(() => {
    if (!row) return;
    let live = true;
    void coinHistoryAction(row.studentId).then((res) => {
      if (!live) return;
      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return onClose();
      }
      setLoaded({ id: row.studentId, rows: res.rows });
    });
    return () => {
      live = false;
    };
  }, [row, onClose]);

  return (
    <Modal
      open={!!row}
      onOpenChange={(open) => (open ? null : onClose())}
      title={row ? t.historyTitle(row.name) : ""}
      description={row ? `${t.colBalance}: ${money(row.balance)}` : undefined}
    >
      {list === null ? (
        <div className="py-10 text-center text-caption text-muted-foreground">{t.loading}</div>
      ) : list.length ? (
        <ul className="divide-y divide-border">
          {list.map((h) => (
            <li key={h.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className={cn("font-medium text-foreground", h.revoked && "text-muted-foreground line-through")}>
                  {t.rules[h.rule] ?? h.rule}
                </div>
                <div className="text-caption text-muted-foreground">
                  {formatDate(h.refDate)} · {h.groupName ?? t.noGroup}
                </div>
              </div>
              {h.revoked ? (
                <Badge tone="neutral">{t.revoked}</Badge>
              ) : (
                <span className="font-semibold text-(--success-fg) tabular-nums">+{money(h.amount)}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<History />} title={t.historyEmpty} />
      )}
    </Modal>
  );
}

export function CoinsView({ rows, anyRule, canSettings }: { rows: CoinRow[]; anyRule: boolean; canSettings: boolean }) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [limit, setLimit] = React.useState(PAGE_ROWS);
  const [open, setOpen] = React.useState<CoinRow | null>(null);
  const close = React.useCallback(() => setOpen(null), []);

  const groupOptions = [...new Map(rows.flatMap((r) => r.groups.map((g) => [g.id, g.name] as const))).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => {
    if (group !== ALL && !r.groups.some((g) => g.id === group)) return false;
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || r.groups.some((g) => g.name.toLowerCase().includes(q));
  });

  const settingsLink = canSettings ? (
    <Button asChild variant="ghost">
      <Link href="/coin-settings">
        <Settings /> {t.settingsLink}
      </Link>
    </Button>
  ) : null;

  return (
    <div className="space-y-section">
      <PageHeader title={t.title} description={t.description} actions={settingsLink} />

      <div className="grid gap-grid sm:grid-cols-3">
        <StatCard icon={<Users />} tone={4} label={t.kpiStudents} value={String(rows.length)} />
        <StatCard icon={<Coins />} tone={1} label={t.kpiTotal} value={money(rows.reduce((s, r) => s + r.balance, 0))} />
        <StatCard
          icon={<CalendarDays />}
          tone={2}
          label={t.kpiMonth}
          value={money(rows.reduce((s, r) => s + r.month, 0))}
        />
      </div>

      <StudentsTable
        rows={visible.slice(0, limit)}
        rowKey={(r) => r.studentId}
        numbered
        student={(r) => ({
          name: r.name,
          href: `/students/${r.studentId}`,
          sub: r.archived ? t.archived : null,
        })}
        studentHeader={t.colStudent}
        header={
          <FilterBar>
            <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            <FilterSelect
              label={t.group}
              value={group}
              onValueChange={setGroup}
              options={[
                { value: ALL, label: t.allGroups },
                ...groupOptions.map(([id, name]) => ({ value: id, label: name })),
              ]}
            />
            <FilterEnd>
              <span className="text-caption text-muted-foreground">{t.count(visible.length, rows.length)}</span>
            </FilterEnd>
          </FilterBar>
        }
        columns={[
          {
            key: "groups",
            header: t.colGroups,
            cell: (r) =>
              r.groups.length ? (
                <div className="flex max-w-72 flex-wrap gap-1">
                  {r.groups.map((g) => (
                    <GroupChip key={g.id} id={g.id} name={g.name} muted={group !== ALL && g.id !== group} />
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "month",
            header: t.colMonth,
            align: "right",
            headClassName: "w-28",
            cell: (r) => <span className="tabular-nums">{r.month ? `+${money(r.month)}` : "—"}</span>,
          },
          {
            key: "balance",
            header: t.colBalance,
            align: "right",
            headClassName: "w-28",
            cell: (r) => <span className="font-semibold text-foreground tabular-nums">{money(r.balance)}</span>,
          },
          {
            key: "history",
            header: "",
            align: "right",
            headClassName: "w-28",
            cell: (r) => (
              <Button variant="ghost" size="sm" onClick={() => setOpen(r)}>
                <History /> {t.history}
              </Button>
            ),
          },
        ]}
        footer={
          visible.length > limit ? (
            <MoreRows onClick={() => setLimit((n) => n + PAGE_ROWS)}>
              {t.showMore(Math.min(PAGE_ROWS, visible.length - limit))}
            </MoreRows>
          ) : null
        }
        empty={
          <EmptyState
            icon={<Coins />}
            title={anyRule ? t.empty : t.emptyOff}
            description={t.emptyHint}
            action={settingsLink ?? undefined}
          />
        }
      />

      <HistoryModal row={open} onClose={close} />
    </div>
  );
}
