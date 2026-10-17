"use client";

import { CalendarX, Check, CheckCheck, ChevronLeft, ChevronRight, UserPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
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
/** Tanlovdagi uchta holat (eski "Kech" belgilari ko'rinadi, lekin yangi belgi — shu uchtasidan) */
const PICK: { status: Status; symbol: React.ReactNode }[] = [
  { status: "present", symbol: <Check /> },
  { status: "absent", symbol: <X /> },
  { status: "excused", symbol: "S" },
];
const SYMBOL: Record<Status, React.ReactNode> = { present: <Check />, late: "K", excused: "S", absent: <X /> };
/** Bor — yashil, yo'q — qizil, sababli — sariq, kech — ko'k */
const TONE: Record<Status, string> = {
  present: "bg-(--success-bg) text-(--success-fg) border-(--success-border)",
  absent: "bg-(--danger-bg) text-(--danger-fg) border-(--danger-border)",
  excused: "bg-(--warning-bg) text-(--warning-fg) border-(--warning-border)",
  late: "bg-(--info-bg) text-(--info-fg) border-(--info-border)",
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

/**
 * Guruh davomati — bitta jadval (oylik jurnal + belgilash): satrlarda o'quvchilar, ustunlarda dars kunlari. Katak
 * ustiga sichqoncha borganda yoki bosilganda kengayadi: ✓ bor (yashil), ✕ yo'q (qizil), S sababli (sariq). Bosib
 * ochilgan katak ochiq qoladi — "yo'q"/"sababli" uchun sabab yoziladi.
 */
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
  const [pending, startTransition] = React.useTransition();
  /** Ochiq katak: hover — sichqoncha ustida, pinned — bosib ochilgan (sabab yozish uchun) */
  const [open, setOpen] = React.useState<{ key: string; pinned: boolean } | null>(null);
  // Bosilgan belgi darhol ko'rinadi (server javobini kutmasdan); yangi ma'lumot kelganda tozalanadi
  const [local, setLocal] = React.useState<Record<string, { status: Status; reason: string | null } | null>>({});
  const [syncedMarks, setSyncedMarks] = React.useState(data.marks);
  if (syncedMarks !== data.marks) {
    setSyncedMarks(data.marks);
    setLocal({});
  }

  const mark = (studentId: string, d: string) => {
    const key = `${studentId}|${d}`;
    return key in local ? (local[key] ?? undefined) : data.marks[key];
  };
  const editableOn = (d: string) => d <= today && (d === today ? canMarkToday || canEditPast : canEditPast);

  // Ochiq katakdan tashqariga bosilsa yoki Escape — yopiladi
  React.useEffect(() => {
    if (!open?.pinned) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-cell="${open.key}"]`)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function go(month: string) {
    router.push(`${pathname}?tab=attendance&month=${month}`, { scroll: false });
  }

  function save(studentId: string, date: string, status: Status | null, reason = "") {
    const key = `${studentId}|${date}`;
    setLocal((l) => ({ ...l, [key]: status ? { status, reason: reason || null } : null }));
    startTransition(async () => {
      const res = await markAttendanceAction({ groupId, studentId, date, status, reason });
      if (!res.ok) {
        // Saqlanmadi — optimistik belgi qaytariladi
        setLocal((l) => {
          const next = { ...l };
          delete next[key];
          return next;
        });
        return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      }
      router.refresh();
    });
  }

  // Birinchi darsga kelgan lidlar (E4b) — o'quvchi emas; bosilgan holatni qayta bosish — bekor
  function markGuest(leadId: string, status: "came" | "absent", current: string) {
    startTransition(async () => {
      const res = await markFirstLessonAction({ leadId, status: current === status ? "scheduled" : status });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      router.refresh();
    });
  }

  const todayLesson = data.dates.includes(today);
  const todayUnmarked = todayLesson
    ? data.members.filter((m) => stateOn(m, today) === "ok" && !mark(m.studentId, today)).length
    : 0;
  function markRest() {
    startTransition(async () => {
      const res = await markRestPresentAction({ groupId, date: today });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: uz.attendance.markedRest(res.marked) });
      router.refresh();
    });
  }

  const rows = data.members.map((m) => {
    const cells = data.dates.map((d) => ({ d, state: stateOn(m, d), mark: mark(m.studentId, d) }));
    const marked = cells.filter((c) => c.mark);
    const came = marked.filter((c) => c.mark!.status === "present" || c.mark!.status === "late").length;
    return { m, cells, rate: marked.length ? Math.round((came / marked.length) * 100) : null };
  });
  const guests = data.guests;
  const monthLabel = `${uz.months[Number(data.month.slice(5, 7)) - 1]} ${data.month.slice(0, 4)}`;

  return (
    <div className="space-y-4">
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
        <div className="flex flex-wrap items-center gap-3">
          <Legend />
          {todayLesson && editableOn(today) && todayUnmarked > 0 ? (
            <Button size="sm" onClick={markRest} disabled={pending}>
              <CheckCheck /> {uz.attendance.markRestToday}
            </Button>
          ) : null}
        </div>
      </div>
      {data.holidays.length ? (
        <div className="text-caption text-muted-foreground">
          {uz.attendance.holidaysTitle}{" "}
          {data.holidays
            .map((h) => uz.attendance.holidayOn(h.name, formatDate(h.startDate), formatDate(h.endDate)))
            .join(", ")}
        </div>
      ) : null}

      {!data.dates.length ? (
        <EmptyState icon={<CalendarX />} title={uz.attendance.noLessons} />
      ) : !data.members.length ? (
        <EmptyState icon={<CalendarX />} title={uz.attendance.noStudents} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th className="sticky left-0 z-(--z-raised) min-w-44 bg-card">{uz.attendance.colStudent}</Th>
                {data.dates.map((d) => (
                  <Th
                    key={d}
                    className={cn(
                      "w-11 px-1 text-center",
                      d === today && "text-(--primary-text)",
                      d > today && "text-muted-foreground/60",
                    )}
                  >
                    <div className="text-2xs font-semibold">
                      {uz.weekdays.short[weekdayOf(d) as keyof typeof uz.weekdays.short]}
                    </div>
                    <div className="font-mono text-body">{d.slice(8, 10)}</div>
                  </Th>
                ))}
                <Th className="w-16 text-right">{uz.attendance.journalRate}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map(({ m, cells, rate }) => (
                <Tr key={m.studentId}>
                  <Td className="sticky left-0 z-(--z-raised) max-w-52 bg-card">
                    <Link
                      href={`/students/${m.studentId}`}
                      className="block truncate font-semibold text-foreground hover:text-primary"
                    >
                      {m.name}
                    </Link>
                  </Td>
                  {cells.map((c) => {
                    const key = `${m.studentId}|${c.d}`;
                    return (
                      <Td key={c.d} className={cn("h-12 w-11 px-1 text-center", c.d === today && "bg-primary-soft/40")}>
                        {c.state === "out" ? (
                          <span className="text-muted-foreground/40" aria-label={uz.attendance.notInGroup}>
                            ·
                          </span>
                        ) : c.state === "paused" ? (
                          <span className="text-caption text-muted-foreground" title={uz.attendance.paused}>
                            M
                          </span>
                        ) : (
                          <MarkCell
                            cellKey={key}
                            name={m.name}
                            date={c.d}
                            current={c.mark ?? null}
                            editable={editableOn(c.d)}
                            busy={pending}
                            open={open?.key === key ? open : null}
                            onOpen={(pinned) =>
                              setOpen((o) => (pinned ? { key, pinned: true } : o?.pinned ? o : { key, pinned: false }))
                            }
                            onClose={() => setOpen((o) => (o?.key === key && !o.pinned ? null : o))}
                            onPick={(status, reason) => {
                              save(m.studentId, c.d, status, reason);
                              if (status === "present" || status === null) setOpen(null);
                            }}
                          />
                        )}
                      </Td>
                    );
                  })}
                  <Td className="w-16 text-right font-mono font-semibold tabular-nums">
                    {rate === null ? "—" : uz.attendance.rate(rate)}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
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
                  <div className="font-mono text-caption text-muted-foreground">
                    {formatDate(g.date)} · {displayPhone(g.phone)}
                  </div>
                </div>
                <div className="flex items-center gap-1" role="radiogroup" aria-label={g.name}>
                  {(["came", "absent"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      role="radio"
                      aria-checked={g.status === st}
                      disabled={!editableOn(g.date) || pending}
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
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-caption text-muted-foreground">
      {PICK.map((p) => (
        <span key={p.status} className="flex items-center gap-1">
          <span
            className={cn(
              "inline-grid size-4 place-items-center rounded-[5px] border text-[9px] font-bold [&_svg]:size-2.5",
              TONE[p.status],
            )}
          >
            {p.symbol}
          </span>
          {uz.attendance.statuses[p.status]}
        </span>
      ))}
    </div>
  );
}

/**
 * Bitta katak: belgi (yoki bo'sh "checkbox"); ustiga borganda yoki bosilganda yonida uchta tugma chiqadi. Bosib ochilsa
 * ochiq qoladi va "yo'q"/"sababli" uchun sabab maydoni ko'rinadi.
 */
function MarkCell({
  cellKey,
  name,
  date,
  current,
  editable,
  busy,
  open,
  onOpen,
  onClose,
  onPick,
}: {
  cellKey: string;
  name: string;
  date: string;
  current: { status: Status; reason: string | null } | null;
  editable: boolean;
  /** Saqlanmoqda: tugmalar vaqtincha bosilmaydi, ko'rinish o'zgarmaydi */
  busy: boolean;
  open: { pinned: boolean } | null;
  onOpen: (pinned: boolean) => void;
  onClose: () => void;
  onPick: (status: Status | null, reason?: string) => void;
}) {
  const label = `${name} — ${formatDate(date)}`;
  const face = current ? (
    <span
      className={cn(
        "inline-grid size-7 place-items-center rounded-control border font-mono text-caption font-bold [&_svg]:size-3.5",
        TONE[current.status],
      )}
    >
      {SYMBOL[current.status]}
    </span>
  ) : (
    <span className="inline-block size-7 rounded-control border-2 border-dashed border-border bg-card" />
  );

  if (!editable) {
    return (
      <span title={current ? (current.reason ?? uz.attendance.statuses[current.status]) : undefined}>
        {current ? face : <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  const showReason = open?.pinned && current && current.status !== "present";
  return (
    <div
      data-cell={cellKey}
      className="relative inline-block"
      onMouseEnter={() => onOpen(false)}
      onMouseLeave={onClose}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={!!open}
        title={current?.reason ?? (current ? uz.attendance.statuses[current.status] : uz.attendance.markHint)}
        onClick={() => onOpen(true)}
        className="grid place-items-center rounded-control"
      >
        {face}
      </button>
      {open ? (
        <div
          className="absolute top-1/2 left-1/2 z-(--z-popover) -translate-x-1/2 -translate-y-1/2 animate-[page-in_160ms_var(--ease-ios)] rounded-card border border-border bg-popover p-1 shadow-popover"
          role="group"
          aria-label={label}
        >
          <div className="flex items-center gap-1">
            {PICK.map((p) => {
              const on = current?.status === p.status;
              return (
                <button
                  key={p.status}
                  type="button"
                  title={uz.attendance.statuses[p.status]}
                  aria-label={`${label} — ${uz.attendance.statuses[p.status]}`}
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => onPick(p.status, on ? (current?.reason ?? "") : "")}
                  className={cn(
                    "grid size-8 place-items-center rounded-control border font-mono text-caption font-bold transition-[transform,background-color] hover:scale-105 [&_svg]:size-4",
                    TONE[p.status],
                    on && "ring-2 ring-current/30",
                  )}
                >
                  {p.symbol}
                </button>
              );
            })}
            {current ? (
              <button
                type="button"
                title={uz.attendance.clear}
                aria-label={`${label} — ${uz.attendance.clear}`}
                disabled={busy}
                onClick={() => onPick(null)}
                className="grid size-8 place-items-center rounded-control text-muted-foreground hover:bg-muted [&_svg]:size-4"
              >
                <X />
              </button>
            ) : null}
          </div>
          {showReason ? (
            <ReasonInput
              key={`${cellKey}|${current.status}`}
              initial={current.reason ?? ""}
              placeholder={uz.attendance.reasonPlaceholder[current.status] ?? ""}
              onCommit={(reason) => {
                if (reason !== (current.reason ?? "")) onPick(current.status, reason);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Sabab: yozish paytida emas, maydondan chiqqanda yoki Enter bosilganda saqlanadi */
function ReasonInput({
  initial,
  placeholder,
  onCommit,
}: {
  initial: string;
  placeholder: string;
  onCommit: (reason: string) => void;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <Input
      autoFocus
      value={value}
      placeholder={placeholder}
      maxLength={500}
      className="mt-1 h-(--control-h-sm) w-56 text-caption"
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
