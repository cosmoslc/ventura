"use client";

import { CalendarX, CheckCheck, ChevronLeft, ChevronRight, UserPlus, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
import { Notice } from "@ventura/ui/notice";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { memberOn, weekdayOf } from "@/lib/lessons";
import { uz } from "@/lib/uz";
import type { AttendanceMember, GroupAttendance } from "@/lib/server/attendance";
import { markFirstLessonAction } from "../leads/actions";
import { markAttendanceAction, markRestPresentAction } from "./attendance-actions";

type Status = "present" | "late" | "excused" | "absent";
const STATUSES: Status[] = ["present", "late", "excused", "absent"];
const SYMBOL: Record<Status, string> = { present: "✓", late: "K", excused: "S", absent: "✕" };
const TONE: Record<Status, string> = {
  present: "bg-(--success-bg) text-(--success-fg) border-(--success-border)",
  late: "bg-(--warning-bg) text-(--warning-fg) border-(--warning-border)",
  excused: "bg-(--info-bg) text-(--info-fg) border-(--info-border)",
  absent: "bg-(--danger-bg) text-(--danger-fg) border-(--danger-border)",
};

const shiftMonth = (m: string, by: number) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, mm! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Shu kuni guruhda bo'lgan va muzlatilmagan */
function stateOn(m: AttendanceMember, date: string): "ok" | "paused" | "out" {
  const p = m.periods.find((x) => memberOn(x, date));
  if (!p) return "out";
  return p.status === "paused" && p.pausedAt !== null && date >= p.pausedAt ? "paused" : "ok";
}

export function AttendanceTab({
  groupId,
  data,
  today,
  canMarkToday,
  canEditPast,
}: {
  groupId: string;
  data: GroupAttendance;
  today: string;
  canMarkToday: boolean;
  canEditPast: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const past = data.dates.filter((d) => d <= today);
  const initial = data.dates.includes(today) ? today : (past.at(-1) ?? data.dates[0] ?? null);
  const [date, setDate] = React.useState<string | null>(initial);
  const [syncedMonth, setSyncedMonth] = React.useState(data.month);
  if (syncedMonth !== data.month) {
    setSyncedMonth(data.month);
    setDate(initial);
  }
  const [pending, startTransition] = React.useTransition();

  const editable = !!date && date <= today && (date === today ? canMarkToday || canEditPast : canEditPast);
  const rows = date ? data.members.filter((m) => stateOn(m, date) !== "out") : [];
  const mark = (studentId: string, d: string) => data.marks[`${studentId}|${d}`];
  const count = (s: Status) => (date ? rows.filter((m) => mark(m.studentId, date)?.status === s).length : 0);
  const active = date ? rows.filter((m) => stateOn(m, date) === "ok") : [];
  const unmarked = date ? active.filter((m) => !mark(m.studentId, date)).length : 0;

  function go(month: string) {
    router.push(`${pathname}?tab=attendance&month=${month}`, { scroll: false });
  }

  function save(studentId: string, status: Status | null, reason = "") {
    if (!date) return;
    startTransition(async () => {
      const res = await markAttendanceAction({ groupId, studentId, date, status, reason });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      router.refresh();
    });
  }

  // Birinchi darsga kelgan lidlar (E4b) — o'quvchi emas, alohida qatorlarda; bosilgan holatni qayta bosish — bekor
  function markGuest(leadId: string, status: "came" | "absent", current: string) {
    startTransition(async () => {
      const res = await markFirstLessonAction({ leadId, status: current === status ? "scheduled" : status });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      router.refresh();
    });
  }
  const guests = date ? data.guests.filter((g) => g.date === date) : [];

  function markRest() {
    if (!date) return;
    startTransition(async () => {
      const res = await markRestPresentAction({ groupId, date });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: uz.attendance.markedRest(res.marked) });
      router.refresh();
    });
  }

  // Oylik jurnal: har o'quvchi bo'yicha foiz — faqat belgilangan darslardan
  const journal = data.members.map((m) => {
    const cells = data.dates.map((d) => ({ d, state: stateOn(m, d), mark: mark(m.studentId, d) }));
    const marked = cells.filter((c) => c.mark);
    const came = marked.filter((c) => c.mark!.status === "present" || c.mark!.status === "late").length;
    return { m, cells, rate: marked.length ? Math.round((came / marked.length) * 100) : null };
  });

  const monthLabel = `${uz.months[Number(data.month.slice(5, 7)) - 1]} ${data.month.slice(0, 4)}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="icon"
            size="icon-sm"
            title={uz.attendance.prevMonth}
            aria-label={uz.attendance.prevMonth}
            onClick={() => go(shiftMonth(data.month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center text-body font-bold text-foreground">{monthLabel}</span>
          <Button
            variant="icon"
            size="icon-sm"
            title={uz.attendance.nextMonth}
            aria-label={uz.attendance.nextMonth}
            onClick={() => go(shiftMonth(data.month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        {data.holidays.length ? (
          <div className="text-caption text-muted-foreground">
            {uz.attendance.holidaysTitle}{" "}
            {data.holidays
              .map((h) => uz.attendance.holidayOn(h.name, formatDate(h.startDate), formatDate(h.endDate)))
              .join(", ")}
          </div>
        ) : null}
      </div>

      {data.dates.length ? (
        <div>
          <div className="mb-2 text-caption font-semibold text-muted-foreground">{uz.attendance.lessonDays}</div>
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label={uz.attendance.lessonDays}>
            {data.dates.map((d) => {
              const hasMarks = data.members.some((m) => mark(m.studentId, d));
              const future = d > today;
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={d === date}
                  onClick={() => setDate(d)}
                  className={cn(
                    "relative flex min-w-12 flex-col items-center rounded-control border px-2 py-1.5 text-caption transition-colors",
                    d === date
                      ? "border-(--ring-border) bg-primary-soft text-foreground"
                      : "border-border-soft text-muted-foreground hover:bg-muted",
                    future && "opacity-60",
                  )}
                >
                  <span className="font-semibold">
                    {uz.weekdays.short[weekdayOf(d) as keyof typeof uz.weekdays.short]}
                  </span>
                  <span className="font-mono text-body text-foreground">{d.slice(8, 10)}</span>
                  {hasMarks ? (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-(--success-fg)" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState icon={<CalendarX />} title={uz.attendance.noLessons} />
      )}

      {date ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-body text-foreground">
              {formatDate(date)} ·{" "}
              {uz.attendance.summary(count("present"), count("late"), count("excused"), count("absent"), unmarked)}
            </span>
            {editable && unmarked > 0 ? (
              <Button size="sm" onClick={markRest} disabled={pending}>
                <CheckCheck /> {uz.attendance.markRest}
              </Button>
            ) : null}
          </div>
          {date > today ? <Notice tone="info">{uz.attendance.futureDay}</Notice> : null}
          {date < today && !canEditPast ? <Notice tone="info">{uz.attendance.readOnly}</Notice> : null}

          {rows.length ? (
            <TableWrap>
              <Table className="min-w-[760px]">
                <THead>
                  <tr>
                    <Th className="w-10">{uz.attendance.colNo}</Th>
                    <Th>{uz.attendance.colStudent}</Th>
                    <Th>{uz.attendance.colPhone}</Th>
                    <Th>{uz.attendance.colStatus}</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((m, i) => {
                    const st = stateOn(m, date);
                    const cur = mark(m.studentId, date);
                    return (
                      <Tr key={m.studentId}>
                        <Td className="font-mono text-caption text-muted-foreground">{i + 1}</Td>
                        <Td>
                          <Link
                            href={`/students/${m.studentId}`}
                            className="font-bold text-foreground hover:text-primary"
                          >
                            {m.name}
                          </Link>
                        </Td>
                        <Td className="font-mono">{displayPhone(m.phone) ?? "—"}</Td>
                        <Td>
                          {st === "paused" ? (
                            <Badge tone="warning">{uz.attendance.paused}</Badge>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-1" role="radiogroup" aria-label={m.name}>
                                {STATUSES.map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    role="radio"
                                    aria-checked={cur?.status === s}
                                    disabled={!editable || pending}
                                    onClick={() => save(m.studentId, s, cur?.reason ?? "")}
                                    className={cn(
                                      "h-(--control-h-sm) rounded-control border px-3 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                                      cur?.status === s
                                        ? TONE[s]
                                        : "border-border-soft text-muted-foreground hover:bg-muted",
                                    )}
                                  >
                                    {uz.attendance.statuses[s]}
                                  </button>
                                ))}
                                {cur && editable ? (
                                  <Button
                                    variant="icon"
                                    size="icon-sm"
                                    title={uz.attendance.clear}
                                    aria-label={`${m.name} — ${uz.attendance.clear}`}
                                    disabled={pending}
                                    onClick={() => save(m.studentId, null)}
                                  >
                                    <X />
                                  </Button>
                                ) : null}
                              </div>
                              {cur && cur.status !== "present" ? (
                                <ReasonInput
                                  key={`${m.studentId}|${date}|${cur.status}`}
                                  initial={cur.reason ?? ""}
                                  placeholder={uz.attendance.reasonPlaceholder[cur.status] ?? ""}
                                  disabled={!editable}
                                  onCommit={(reason) => {
                                    if (reason !== (cur.reason ?? "")) save(m.studentId, cur.status, reason);
                                  }}
                                />
                              ) : null}
                            </div>
                          )}
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </TableWrap>
          ) : (
            <EmptyState icon={<Users />} title={uz.attendance.noStudents} />
          )}

          {guests.length ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-body font-bold text-foreground">
                <UserPlus className="size-4 text-primary" /> {uz.attendance.guestsTitle(guests.length)}
              </div>
              <ul className="divide-y divide-border-soft rounded-card border border-border-soft">
                {guests.map((g) => (
                  <li key={g.leadId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <Link href={`/leads/${g.leadId}`} className="font-bold text-foreground hover:text-primary">
                        {g.name}
                      </Link>
                      <div className="font-mono text-caption text-muted-foreground">{displayPhone(g.phone)}</div>
                    </div>
                    <div className="flex items-center gap-1" role="radiogroup" aria-label={g.name}>
                      {(["came", "absent"] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={g.status === st}
                          disabled={!editable || pending}
                          onClick={() => markGuest(g.leadId, st, g.status)}
                          className={cn(
                            "h-(--control-h-sm) rounded-control border px-3 text-caption font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            g.status === st
                              ? TONE[st === "came" ? "present" : "absent"]
                              : "border-border-soft text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {uz.leads.firstLessonStatus[st]}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {data.dates.length && data.members.length ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-body font-bold text-foreground">{uz.attendance.journal}</h3>
            <span className="text-caption text-muted-foreground">{uz.attendance.legend}</span>
          </div>
          <TableWrap>
            <Table>
              <THead>
                <tr>
                  <Th className="sticky left-0 z-(--z-raised) bg-card">{uz.attendance.colStudent}</Th>
                  {data.dates.map((d) => (
                    <Th key={d} className="px-1 text-center font-mono">
                      {d.slice(8, 10)}
                    </Th>
                  ))}
                  <Th className="text-right">{uz.attendance.journalRate}</Th>
                </tr>
              </THead>
              <TBody>
                {journal.map(({ m, cells, rate }) => (
                  <Tr key={m.studentId}>
                    <Td className="sticky left-0 z-(--z-raised) max-w-48 truncate bg-card font-semibold text-foreground">
                      {m.name}
                    </Td>
                    {cells.map((c) => (
                      <Td key={c.d} className="px-1 text-center">
                        {c.state === "out" ? (
                          <span className="text-muted-foreground/40" aria-label={uz.attendance.notInGroup}>
                            ·
                          </span>
                        ) : c.mark ? (
                          <span
                            className={cn(
                              "inline-grid size-6 place-items-center rounded-badge border font-mono text-caption",
                              TONE[c.mark.status],
                            )}
                            title={c.mark.reason ?? uz.attendance.statuses[c.mark.status]}
                          >
                            {SYMBOL[c.mark.status]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                    ))}
                    <Td className="text-right font-mono font-semibold">
                      {rate === null ? "—" : uz.attendance.rate(rate)}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </div>
      ) : null}
    </div>
  );
}

/** Sabab: yozish paytida emas, maydondan chiqqanda yoki Enter bosilganda saqlanadi (eski tizim har harfda saqlar edi) */
function ReasonInput({
  initial,
  placeholder,
  disabled,
  onCommit,
}: {
  initial: string;
  placeholder: string;
  disabled: boolean;
  onCommit: (reason: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <Input
      value={value}
      placeholder={placeholder}
      maxLength={500}
      disabled={disabled}
      className="h-(--control-h-sm) max-w-sm text-caption"
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value.trim())}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
