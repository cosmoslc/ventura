"use client";

import Link from "next/link";
import * as React from "react";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { TrendChart } from "@ventura/ui/trend-chart";
import { uz } from "@/lib/uz";
import { MoreRows, StudentsTable } from "../../../student-table";
import type { LeavesViewData } from "@/lib/server/academic-reports";
import { BarList, type BarItem } from "./bar-list";
import { durationLabel, pct1 } from "./format";
import { BLOCK_TITLE, Panel, PanelEmpty } from "../blocks";

const k = uz.reports.leaves;
const PAGE = 40;

type Status = "all" | "active" | "trial";

/** Guruhdan chiqishlar: dinamika, muddat, sabablar va guruhlar; sabab bosilsa ro'yxat shu bo'yicha saralanadi */
export function LeavesBoard({ view }: { view: LeavesViewData }) {
  const [reason, setReason] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<Status>("all");
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);

  const maxReason = Math.max(1, ...view.reasons.map((r) => r.count));
  const maxGroup = Math.max(1, ...view.groups.map((g) => g.count));
  const reasonItems: BarItem[] = view.reasons.map((r) => ({
    key: r.reason,
    label: r.reason,
    sub: [r.avgDays === null ? null : k.avgFoot(r.avgDays), r.rate === null ? null : k.rateFoot(pct1(r.rate))]
      .filter(Boolean)
      .join(" · "),
    display: String(r.count),
    share: pct1(r.share),
    fraction: r.count / maxReason,
    tone: r.none ? "muted" : "primary",
  }));
  const groupItems: BarItem[] = view.groups.map((g) => ({
    key: g.groupId,
    label: g.name,
    href: `/groups/${g.groupId}`,
    sub: g.teacher,
    display: String(g.count),
    share: pct1(g.share),
    fraction: g.count / maxGroup,
  }));

  const needle = q.trim().toLowerCase();
  const rows = view.list.filter(
    (r) =>
      (reason === null || r.reason === reason) &&
      (status === "all" || (status === "trial") === r.trial) &&
      (!needle ||
        [r.student, r.group, r.teacher, r.reason, r.note ?? ""].some((v) => v.toLowerCase().includes(needle))),
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={k.trendTitle}>
          <TrendChart
            kind="bar"
            height={190}
            caption={k.trendTitle}
            series={[{ key: "count", label: k.trendCaption, color: "var(--chart-1)" }]}
            points={view.trend.map((p) => ({ label: p.label, tip: p.tip, values: [p.count] }))}
            formatValue={(v) => String(Math.round(v))}
          />
        </Panel>
        <Panel title={k.tenureTitle} sub={k.tenureCaption}>
          <TrendChart
            kind="bar"
            height={190}
            caption={k.tenureTitle}
            series={[
              { key: "active", label: k.statusActive, color: "var(--chart-1)" },
              { key: "trial", label: k.statusTrial, color: "var(--chart-2)" },
            ]}
            points={view.tenure.map((b) => ({
              label: k.tenureLabels[b.key]!,
              tip: k.tenureLabels[b.key]!,
              values: [b.active, b.trial],
            }))}
            formatValue={(v) => String(Math.round(v))}
          />
        </Panel>
        <Panel title={k.reasonsTitle}>
          <BarList
            items={reasonItems}
            selected={reason}
            onSelect={(key) => {
              setReason(key);
              setLimit(PAGE);
            }}
            pickTitle={k.reasonPick}
            limit={6}
            moreLabel={k.showAll(reasonItems.length)}
            lessLabel={k.showLess}
          />
        </Panel>
        <Panel title={k.byGroup}>
          <BarList items={groupItems} limit={6} moreLabel={k.showAll(groupItems.length)} lessLabel={k.showLess} />
        </Panel>
      </div>

      <StudentsTable
        rows={rows.slice(0, limit)}
        rowKey={(r) => r.id}
        student={(r) => ({ name: r.student, href: `/students/${r.studentId}` })}
        studentHeader={k.student}
        minWidth={860}
        header={
          <>
            <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
              <h2 className={BLOCK_TITLE}>{k.list}</h2>
            </div>
            <FilterBar className="mt-2">
              <FilterSearch
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder={k.searchPlaceholder}
                aria-label={k.searchPlaceholder}
              />
              <FilterSelect
                label={k.status}
                value={status}
                onValueChange={(v) => {
                  setStatus(v as Status);
                  setLimit(PAGE);
                }}
                options={[
                  { value: "all", label: k.statusAll },
                  { value: "active", label: k.statusActive },
                  { value: "trial", label: k.statusTrial },
                ]}
              />
              {reason !== null ? (
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  title={k.resetReason}
                  className="max-w-56 cursor-pointer truncate rounded-control border border-border px-3 py-2 text-caption font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {reason} ✕
                </button>
              ) : null}
              <FilterEnd>{k.listCount(rows.length)}</FilterEnd>
            </FilterBar>
          </>
        }
        columns={[
          {
            key: "group",
            header: k.group,
            className: "whitespace-nowrap",
            cell: (r) => (
              <>
                <Link href={`/groups/${r.groupId}`} className="text-foreground hover:text-primary-text">
                  {r.group}
                </Link>
                <div className="text-caption text-muted-foreground">
                  {r.teacher} · {r.course}
                </div>
              </>
            ),
          },
          { key: "left", header: k.left, className: "whitespace-nowrap tabular-nums", cell: (r) => r.left },
          {
            key: "tenure",
            header: k.tenureCol,
            className: "whitespace-nowrap tabular-nums",
            cell: (r) => durationLabel(r.days),
          },
          {
            key: "status",
            header: k.status,
            className: "whitespace-nowrap",
            cell: (r) => (
              <span className={cn(r.trial && "text-(--warning-fg)")}>{r.trial ? k.statusTrial : k.statusActive}</span>
            ),
          },
          {
            key: "reason",
            header: k.reason,
            className: "max-w-72",
            cell: (r) => (
              <>
                <div className={cn("truncate", r.none ? "text-muted-foreground" : "text-foreground")} title={r.reason}>
                  {r.reason}
                </div>
                {r.note ? (
                  <div className="line-clamp-2 text-caption text-muted-foreground" title={r.note}>
                    {r.note}
                  </div>
                ) : null}
              </>
            ),
          },
          {
            key: "rate",
            header: k.rate,
            align: "right",
            className: "whitespace-nowrap tabular-nums",
            cell: (r) => pct1(r.rate),
          },
        ]}
        footer={
          rows.length > limit ? (
            <MoreRows onClick={() => setLimit((l) => l + PAGE)}>{k.more(Math.min(PAGE, rows.length - limit))}</MoreRows>
          ) : null
        }
        empty={<PanelEmpty>{k.emptyList}</PanelEmpty>}
      />
    </>
  );
}
