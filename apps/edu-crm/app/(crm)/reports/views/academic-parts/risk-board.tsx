"use client";

import Link from "next/link";
import * as React from "react";
import { Card } from "@ventura/ui/card";
import { DonutChart } from "@ventura/ui/donut-chart";
import { FilterBar, FilterEnd, FilterSearch } from "@ventura/ui/filter-bar";
import { cn } from "@ventura/ui/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { uz } from "@/lib/uz";
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

      <Card className="overflow-hidden">
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
        {rows.length ? (
          <TableWrap>
            <Table className="min-w-[1000px]">
              <THead>
                <tr>
                  <Th>{k.student}</Th>
                  <Th>{k.group}</Th>
                  <Th>{k.level}</Th>
                  <Th className="text-right">{k.score}</Th>
                  <Th className="text-right">{k.consecutive}</Th>
                  <Th className="text-right">{k.monthMissed}</Th>
                  <Th className="text-right">{k.rate}</Th>
                  <Th>{k.lastMissed}</Th>
                  <Th>{k.factors}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.slice(0, limit).map((r) => (
                  <Tr key={r.key}>
                    <Td className="whitespace-nowrap">
                      <Link
                        href={`/students/${r.studentId}`}
                        className="font-semibold text-foreground hover:text-primary-text"
                      >
                        {r.student}
                      </Link>
                      {r.phone ? (
                        <div className="text-caption text-muted-foreground tabular-nums">{r.phone}</div>
                      ) : null}
                    </Td>
                    <Td className="whitespace-nowrap">
                      <Link href={`/groups/${r.groupId}`} className="text-foreground hover:text-primary-text">
                        {r.group}
                      </Link>
                      <div className="text-caption text-muted-foreground">{r.teacher}</div>
                    </Td>
                    <Td className={cn("font-semibold whitespace-nowrap", LEVEL_TEXT[r.level])}>{k.levels[r.level]}</Td>
                    <Td className="text-right tabular-nums">{r.score}</Td>
                    <Td className="text-right tabular-nums">{r.consecutive}</Td>
                    <Td className="text-right tabular-nums">{r.monthMissed}</Td>
                    <Td className="text-right whitespace-nowrap tabular-nums">{pct1(r.rate)}</Td>
                    <Td className="whitespace-nowrap tabular-nums">{r.lastMissed ?? "—"}</Td>
                    <Td className="min-w-56">{r.factors.map((f) => k.factorLabels[f]).join(", ")}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <PanelEmpty>{k.emptyList}</PanelEmpty>
        )}
        {rows.length > limit ? (
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="w-full cursor-pointer border-t border-border-soft py-3 text-center text-caption font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {k.more(Math.min(PAGE, rows.length - limit))}
          </button>
        ) : null}
      </Card>
    </>
  );
}
