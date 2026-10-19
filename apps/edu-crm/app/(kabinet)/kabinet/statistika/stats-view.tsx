"use client";

import { CalendarCheck, CalendarX, Clock, TrendingUp, UserCheck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@ventura/ui/card";
import { DistributionBar } from "@ventura/ui/distribution-bar";
import { FilterSelect } from "@ventura/ui/filter-bar";
import { MetricCard } from "@ventura/ui/metric-card";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { formatMonth, money } from "@/lib/format";
import type { KabinetStats } from "@/lib/server/kabinet";
import { uz } from "@/lib/uz";
import { TeacherTransactions } from "../../../(crm)/teachers/teacher-salary";

const t = uz.kabinet;
const NO_PERMS = { salary: false, advance: false, adjust: false };

export function StatsView({ stats, month, months }: { stats: KabinetStats; month: string; months: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const planned = stats.lessons.reduce((s, l) => s + l.planned, 0);
  const conducted = stats.lessons.reduce((s, l) => s + l.conducted, 0);
  const hours = Math.round(stats.lessons.reduce((s, l) => s + l.minutes, 0) / 60);
  const pct = (v: number | null) => (v === null ? t.none : `${v}%`);

  return (
    <div className="space-y-section">
      <PageHeader
        title={t.statsTitle}
        description={t.statsDescription}
        actions={
          <FilterSelect
            label={t.month}
            value={month}
            onValueChange={(m) => router.push(`${pathname}?oy=${m}`, { scroll: false })}
            className="sm:w-44"
            options={months.map((m) => ({ value: m, label: formatMonth(m) }))}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <MetricCard
          label={t.lessonsConducted}
          value={String(conducted)}
          icon={<CalendarCheck />}
          tone="success"
          colorValue
          foot={t.lessonsConductedFoot(planned)}
        />
        <MetricCard
          label={t.lessonsMissed}
          value={String(planned - conducted)}
          icon={<CalendarX />}
          tone={planned - conducted > 0 ? "danger" : "neutral"}
          colorValue={planned - conducted > 0}
          foot={t.lessonsMissedFoot}
        />
        <MetricCard label={t.hours} value={String(hours)} icon={<Clock />} tone="primary" foot={t.hoursFoot} />
        <MetricCard
          label={t.retention}
          value={pct(stats.retention)}
          icon={<TrendingUp />}
          tone="primary"
          colorValue={stats.retention !== null}
          foot={t.retentionFoot}
        />
        <MetricCard
          label={t.attendanceRate}
          value={pct(stats.attendance)}
          icon={<UserCheck />}
          tone="info"
          colorValue={stats.attendance !== null}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="type-heading text-base">{t.lessonsTitle}</h2>
          {stats.lessons.length ? (
            <TableWrap>
              <Table>
                <THead>
                  <tr>
                    <Th>{t.colGroup}</Th>
                    <Th className="text-right">{t.colPlanned}</Th>
                    <Th className="text-right">{t.colConducted}</Th>
                    <Th className="text-right">{t.colMissed}</Th>
                    <Th className="text-right">{t.colHours}</Th>
                  </tr>
                </THead>
                <TBody>
                  {stats.lessons.map((l) => (
                    <Tr key={l.groupId}>
                      <Td className="font-semibold text-foreground">{l.name}</Td>
                      <Td className="text-right font-mono tabular-nums">{l.planned}</Td>
                      <Td className="text-right font-mono tabular-nums">{l.conducted}</Td>
                      <Td
                        className={
                          l.planned - l.conducted > 0
                            ? "text-right font-mono text-(--danger-fg) tabular-nums"
                            : "text-right font-mono tabular-nums"
                        }
                      >
                        {l.planned - l.conducted}
                      </Td>
                      <Td className="text-right font-mono tabular-nums">{Math.round(l.minutes / 60)}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={<CalendarX />} title={t.groupsEmpty} />
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <div>
            <h2 className="type-heading text-base">{t.levelsTitle}</h2>
            <p className="text-caption text-muted-foreground">{t.levelsHint}</p>
          </div>
          <DistributionBar
            segments={[
              { key: "excellent", label: t.levels.excellent!, value: stats.levels.excellent, tone: "success" },
              { key: "good", label: t.levels.good!, value: stats.levels.good, tone: "info" },
              { key: "fair", label: t.levels.fair!, value: stats.levels.fair, tone: "warning" },
              { key: "low", label: t.levels.low!, value: stats.levels.low, tone: "danger" },
              { key: "none", label: t.levelNone, value: stats.levels.none, tone: "neutral" },
            ]}
            emptyLabel={t.levelsEmpty}
          />
        </Card>
      </div>

      <Card className="space-y-4 p-5">
        <h2 className="type-heading text-base">{t.moneyTitle}</h2>
        {stats.money ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <MetricCard label={t.advance} value={money(stats.money.advance)} unit={uz.common.som} tone="info" />
              <MetricCard
                label={t.penalty}
                value={money(stats.money.penalty)}
                unit={uz.common.som}
                tone={stats.money.penalty ? "danger" : "neutral"}
                colorValue={stats.money.penalty > 0}
              />
              <MetricCard
                label={t.bonus}
                value={money(stats.money.bonus)}
                unit={uz.common.som}
                tone={stats.money.bonus ? "success" : "neutral"}
                colorValue={stats.money.bonus > 0}
              />
            </div>
            <div className="text-body font-bold text-foreground">{t.entriesTitle}</div>
            <TeacherTransactions entries={stats.money.entries} perms={NO_PERMS} onEdit={() => {}} />
          </>
        ) : (
          <div className="text-caption text-muted-foreground">{t.salariesOff}</div>
        )}
      </Card>
    </div>
  );
}
