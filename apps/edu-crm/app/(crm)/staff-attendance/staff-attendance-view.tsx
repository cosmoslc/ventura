"use client";

import { CheckCheck, CircleCheck, Clock, UserX, Users, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
import { Meter } from "@ventura/ui/meter";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { rankEmployees } from "@/lib/employee-ranking";
import { uz } from "@/lib/uz";
import { markEmployeeAction, markEmployeesPresentAction } from "./actions";
import type { Employee, EmployeeMark, EmployeeRecord } from "./data";

const t = uz.staffAttendance;
type Status = "present" | "late" | "absent";
const STATUSES: Status[] = ["present", "late", "absent"];
const TONE: Record<Status, string> = {
  present: "bg-(--success-bg) text-(--success-fg) border-(--success-border)",
  late: "bg-(--warning-bg) text-(--warning-fg) border-(--warning-border)",
  absent: "bg-(--danger-bg) text-(--danger-fg) border-(--danger-border)",
};

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

export function StaffAttendanceView({
  employees,
  day,
  history,
  date,
  today,
  canMark,
}: {
  employees: Employee[];
  day: EmployeeRecord[];
  history: EmployeeRecord[];
  date: string;
  today: string;
  canMark: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState<"day" | "ranking">("day");
  const [period, setPeriod] = React.useState("7");
  const [query, setQuery] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  const marks = new Map(day.map((r) => [r.key, r]));
  const count = (s: Status) => day.filter((r) => r.status === s).length;
  const unmarked = employees.filter((e) => !marks.has(e.key)).length;
  const q = query.trim().toLowerCase();
  const visible = employees.filter((e) => !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q));
  const byKey = new Map(employees.map((e) => [e.key, e]));
  const ranking = rankEmployees(
    employees.map((e) => e.key),
    history,
    addDays(today, -(Number(period) - 1)),
    today,
  ).filter((r) => {
    const e = byKey.get(r.key)!;
    return !q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q);
  });

  function save(e: Employee, next: { status: Status | null; checkIn?: string | null; note?: string }) {
    const cur = marks.get(e.key);
    startTransition(async () => {
      const res = await markEmployeeAction({
        key: e.key,
        date,
        status: next.status,
        checkIn: next.checkIn !== undefined ? next.checkIn : (cur?.checkIn ?? null),
        note: next.note ?? cur?.note ?? "",
      });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      router.refresh();
    });
  }

  function markRest() {
    startTransition(async () => {
      const res = await markEmployeesPresentAction({ date });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.markedRest(res.marked) });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as "day" | "ranking")}>
        <TabsList>
          <TabsTrigger value="day">{t.tabDay}</TabsTrigger>
          <TabsTrigger value="ranking">{t.tabRanking}</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "day" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={<CircleCheck />} tone={2} label={t.statPresent} value={String(count("present"))} />
            <StatCard icon={<Clock />} tone={1} label={t.statLate} value={String(count("late"))} />
            <StatCard icon={<UserX />} tone={3} label={t.statAbsent} value={String(count("absent"))} />
            <StatCard
              icon={<Users />}
              tone={4}
              label={t.statUnmarked}
              value={String(unmarked)}
              hint={t.total(employees.length)}
            />
          </div>

          {!canMark ? <Notice tone="info">{t.readOnly}</Notice> : null}

          <FilterBar standalone>
            <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            <Input
              type="date"
              aria-label={t.date}
              title={t.date}
              className="w-full sm:w-44"
              value={date}
              max={today}
              onChange={(e) => e.target.value && router.push(`${pathname}?date=${e.target.value}`, { scroll: false })}
            />
            {date !== today ? (
              <Button variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
                {t.today}
              </Button>
            ) : null}
            {canMark && unmarked > 0 ? (
              <FilterEnd>
                <Button onClick={markRest} disabled={pending}>
                  <CheckCheck /> {t.markRest}
                </Button>
              </FilterEnd>
            ) : null}
          </FilterBar>

          <Card className="overflow-hidden">
            {visible.length ? (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th className="w-12 text-center">{t.colRank}</Th>
                      <Th>{t.colEmployee}</Th>
                      <Th>{t.colStatus}</Th>
                      <Th className="w-36">{t.colCheckIn}</Th>
                      <Th>{t.colNote}</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {visible.map((e, i) => (
                      <EmployeeRow
                        key={`${e.key}|${date}`}
                        n={i + 1}
                        employee={e}
                        mark={marks.get(e.key) ?? null}
                        canMark={canMark}
                        pending={pending}
                        onSave={(next) => save(e, next)}
                      />
                    ))}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState icon={<Users />} title={t.empty} description={t.emptyHint} />
            )}
          </Card>
        </>
      ) : (
        <>
          <FilterBar standalone>
            <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
            <FilterSelect
              label={t.period}
              value={period}
              onValueChange={setPeriod}
              options={["7", "30"].map((p) => ({ value: p, label: t.periods[p] }))}
            />
          </FilterBar>

          <Card className="overflow-hidden">
            <p className="px-4 pt-3 text-caption text-muted-foreground">{t.rankingHint}</p>
            {ranking.length ? (
              <TableWrap className="rounded-none border-0">
                <Table>
                  <THead>
                    <Tr>
                      <Th className="w-12 text-center">{t.colRank}</Th>
                      <Th>{t.colEmployee}</Th>
                      <Th className="text-center">{t.colPresent}</Th>
                      <Th className="text-center">{t.colLate}</Th>
                      <Th className="text-center">{t.colAbsent}</Th>
                      <Th className="text-center">{t.colRecords}</Th>
                      <Th className="w-48">{t.colRate}</Th>
                    </Tr>
                  </THead>
                  <TBody>
                    {ranking.map((r, i) => {
                      const e = byKey.get(r.key)!;
                      return (
                        <Tr key={r.key}>
                          <Td className="text-center text-muted-foreground">{i + 1}</Td>
                          <Td>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-caption text-muted-foreground">{e.role}</div>
                          </Td>
                          <Td className="text-center">{r.present}</Td>
                          <Td className="text-center">{r.late}</Td>
                          <Td className="text-center">{r.absent}</Td>
                          <Td className="text-center">{r.records}</Td>
                          <Td>
                            {r.rate === null ? (
                              <span className="text-muted-foreground">{t.noRecords}</span>
                            ) : (
                              // Meter yuqori qiymatni "xavf" deb bo'yaydi — bu yerda teskari, shuning uchun chegaralar o'chirilgan
                              <Meter label="" value={r.rate / 100} warnAt={2} dangerAt={2} />
                            )}
                          </Td>
                        </Tr>
                      );
                    })}
                  </TBody>
                </Table>
              </TableWrap>
            ) : (
              <EmptyState icon={<Users />} title={t.empty} description={t.emptyHint} />
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function EmployeeRow({
  n,
  employee,
  mark,
  canMark,
  pending,
  onSave,
}: {
  n: number;
  employee: Employee;
  mark: EmployeeMark | null;
  canMark: boolean;
  pending: boolean;
  onSave: (next: { status: Status | null; checkIn?: string | null; note?: string }) => void;
}) {
  const [checkIn, setCheckIn] = React.useState(mark?.checkIn ?? "");
  const [note, setNote] = React.useState(mark?.note ?? "");
  const came = mark && mark.status !== "absent";

  return (
    <Tr>
      <Td className="text-center text-muted-foreground">{n}</Td>
      <Td>
        <div className="font-medium">{employee.name}</div>
        <div className="text-caption text-muted-foreground">{employee.role}</div>
      </Td>
      <Td>
        {canMark ? (
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={employee.name}>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={mark?.status === s}
                disabled={pending}
                onClick={() => mark?.status !== s && onSave({ status: s })}
                className={cn(
                  "rounded-badge border px-2.5 py-1 text-xs font-semibold transition-colors",
                  mark?.status === s ? TONE[s] : "border-border text-muted-foreground hover:bg-muted",
                )}
              >
                {t.statuses[s]}
              </button>
            ))}
            {mark ? (
              <Button
                variant="icon"
                size="icon"
                aria-label={t.clear}
                title={t.clear}
                onClick={() => onSave({ status: null })}
              >
                <X />
              </Button>
            ) : null}
          </div>
        ) : mark ? (
          <Badge tone={mark.status === "present" ? "success" : mark.status === "late" ? "warning" : "danger"}>
            {t.statuses[mark.status]}
          </Badge>
        ) : (
          <Badge tone="neutral">{t.unmarked}</Badge>
        )}
        {!mark && canMark ? <div className="mt-1 text-caption text-muted-foreground">{t.unmarked}</div> : null}
      </Td>
      <Td>
        {came && canMark ? (
          <Input
            type="time"
            value={checkIn}
            aria-label={t.colCheckIn}
            onChange={(e) => setCheckIn(e.target.value)}
            onBlur={() =>
              checkIn !== (mark?.checkIn ?? "") && onSave({ status: mark!.status, checkIn: checkIn || null })
            }
          />
        ) : (
          <span className="text-muted-foreground">{mark?.checkIn ?? "—"}</span>
        )}
      </Td>
      <Td>
        {mark && canMark ? (
          <Input
            value={note}
            maxLength={500}
            placeholder={t.notePlaceholder}
            aria-label={t.colNote}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => note.trim() !== (mark.note ?? "") && onSave({ status: mark.status, note: note.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        ) : (
          <span className="text-muted-foreground">{mark?.note ?? "—"}</span>
        )}
      </Td>
    </Tr>
  );
}
