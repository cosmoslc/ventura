"use client";

import Link from "next/link";
import * as React from "react";
import { DonutChart } from "@ventura/ui/donut-chart";
import { FilterBar, FilterEnd, FilterSearch } from "@ventura/ui/filter-bar";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { uz } from "@/lib/uz";
import { MoreRows, StudentsTable } from "../../../student-table";
import type { RiskViewData } from "@/lib/server/academic-reports";
import { BarList, type BarItem } from "./bar-list";
import { pct1 } from "./format";
import { BLOCK_TITLE, Panel, PanelEmpty } from "../blocks";

const k = uz.reports.risk;
const PAGE = 40;

type Level = RiskViewData["levels"][number]["level"];
type Factor = RiskViewData["factors"][number]["factor"];

/** Daraja rangi — holat tokenlari; yorliq har doim yoziladi */
const LEVEL_TEXT: Record<Level, string> = {
  critical: "text-(--danger-fg)",
  high: "text-(--warning-fg)",
  medium: "text-muted-foreground",
};
const LEVEL_COLOR: Record<Level, string> = {
  critical: "var(--danger-fg)",
  high: "var(--warning-fg)",
  medium: "var(--muted-foreground)",
};

/** Xavfli o'quvchilar: daraja va omillar bo'yicha taqsimot, guruhlar, darajalar bo'yicha ro'yxat */
export function RiskBoard({ view }: { view: RiskViewData }) {
  const [tab, setTab] = React.useState<"all" | Level>("all");
  const [factor, setFactor] = React.useState<Factor | null>(null);
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);

  const maxFactor = Math.max(1, ...view.factors.map((f) => f.count));
  const maxGroup = Math.max(1, ...view.groups.map((g) => g.count));
  const factorItems: BarItem[] = view.factors.map((f) => ({
    key: f.factor,
    label: k.factorLabels[f.factor]!,
    display: String(f.count),
    share: pct1(view.students ? (f.count / view.students) * 100 : null),
    fraction: f.count / maxFactor,
    tone: f.factor === "debt" ? "primary" : f.factor === "uncontacted" ? "warning" : "danger",
  }));
  const groupItems: BarItem[] = view.groups.map((g) => ({
    key: g.groupId,
    label: g.name,
    href: `/groups/${g.groupId}`,
    sub: g.teacher,
    display: k.studentsUnit(g.count),
    fraction: g.count / maxGroup,
  }));

  const needle = q.trim().toLowerCase();
  const rows = view.list.filter(
    (r) =>
      (tab === "all" || r.level === tab) &&
      (factor === null || r.factors.includes(factor)) &&
      (!needle || [r.student, r.group, r.teacher].some((v) => v.toLowerCase().includes(needle))),
  );

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title={k.levelsTitle}>
          <DonutChart
            size={132}
            center={String(view.students)}
            unit={k.levelsUnit}
            emptyText={k.emptyTitle}
            segments={view.levels
              .filter((l) => l.count > 0)
              .map((l) => ({
                label: k.levels[l.level]!,
                value: l.count,
                color: LEVEL_COLOR[l.level],
                display: String(l.count),
              }))}
          />
        </Panel>
        <Panel title={k.factorsTitle}>
          <BarList
            items={factorItems}
            selected={factor}
            onSelect={(key) => {
              setFactor(key as Factor | null);
              setLimit(PAGE);
            }}
            pickTitle={k.factorPick}
          />
        </Panel>
        <Panel title={k.groupsTitle}>
          <BarList
            items={groupItems}
            limit={4}
            moreLabel={uz.reports.leaves.showAll(groupItems.length)}
            lessLabel={uz.reports.leaves.showLess}
          />
        </Panel>
      </div>

      <StudentsTable
        rows={rows.slice(0, limit)}
        rowKey={(r) => r.key}
        student={(r) => ({
          name: r.student,
          href: `/students/${r.studentId}`,
          sub: r.phone ? <span className="tabular-nums">{r.phone}</span> : undefined,
        })}
        studentHeader={k.student}
        minWidth={1000}
        header={
          <>
            <div className="px-4 pt-4">
              <h2 className={BLOCK_TITLE}>{k.listTitle}</h2>
            </div>
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as "all" | Level);
                setLimit(PAGE);
              }}
              className="mt-1 px-2"
            >
              <TabsList>
                <TabsTrigger value="all">{k.tabAll}</TabsTrigger>
                {view.levels.map((l) => (
                  <TabsTrigger key={l.level} value={l.level}>
                    {k.levels[l.level]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <FilterBar>
              <FilterSearch
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder={k.searchPlaceholder}
                aria-label={k.searchPlaceholder}
              />
              {factor !== null ? (
                <button
                  type="button"
                  onClick={() => setFactor(null)}
                  title={k.resetFactor}
                  className="max-w-56 cursor-pointer truncate rounded-control border border-border px-3 py-2 text-caption font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {k.factorLabels[factor]} ✕
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
                <div className="text-caption text-muted-foreground">{r.teacher}</div>
              </>
            ),
          },
          {
            key: "level",
            header: k.level,
            className: "font-semibold whitespace-nowrap",
            cell: (r) => <span className={LEVEL_TEXT[r.level]}>{k.levels[r.level]}</span>,
          },
          { key: "score", header: k.score, align: "right", className: "tabular-nums", cell: (r) => r.score },
          {
            key: "consecutive",
            header: k.consecutive,
            align: "right",
            className: "tabular-nums",
            cell: (r) => r.consecutive,
          },
          {
            key: "monthMissed",
            header: k.monthMissed,
            align: "right",
            className: "tabular-nums",
            cell: (r) => r.monthMissed,
          },
          {
            key: "rate",
            header: k.rate,
            align: "right",
            className: "whitespace-nowrap tabular-nums",
            cell: (r) => pct1(r.rate),
          },
          {
            key: "lastMissed",
            header: k.lastMissed,
            className: "whitespace-nowrap tabular-nums",
            cell: (r) => r.lastMissed ?? "—",
          },
          {
            key: "factors",
            header: k.factors,
            className: "min-w-56",
            cell: (r) => r.factors.map((f) => k.factorLabels[f]).join(", "),
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
