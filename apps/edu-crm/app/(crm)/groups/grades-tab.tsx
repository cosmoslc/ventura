"use client";

import { BookCheck, BookX, CalendarX, ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
import { EmptyState } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatDate } from "@/lib/format";
import { type GradeMark, gradePercent, scoreBlocked, scoreLabel, summarizeGrades } from "@/lib/grades";
import { memberOn, weekdayOf } from "@/lib/lessons";
import type { AttendanceMember, GroupAttendance } from "@/lib/server/attendance";
import { uz } from "@/lib/uz";
import { saveGradeAction } from "./grade-actions";

const t = uz.grades;

export interface GroupGrades {
  lessons: GroupAttendance;
  /** `${studentId}|${date}` → baho */
  marks: Record<string, GradeMark>;
  /** Joriy shkala (sozlamadan) */
  scale: number;
}

const shiftMonth = (m: string, by: number) => {
  const [y, mm] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y!, mm! - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Shu kuni guruhda bo'lgan va muzlatilmagan */
function activeOn(m: AttendanceMember, date: string) {
  const p = m.periods.find((x) => memberOn(x, date));
  return !!p && !(p.status === "paused" && p.pausedAt !== null && date >= p.pausedAt);
}

/** Foiz bo'yicha rang: 80% dan — yashil, 50% dan — sariq, past — qizil */
function scoreTone(score: number, scale: number) {
  const pct = gradePercent(score, scale);
  if (pct >= 80) return "bg-(--success-bg) text-(--success-fg) border-(--success-border)";
  if (pct >= 50) return "bg-(--warning-bg) text-(--warning-fg) border-(--warning-border)";
  return "bg-(--danger-bg) text-(--danger-fg) border-(--danger-border)";
}

/**
 * Guruh baholari — davomat jadvali uslubida: satrlarda o'quvchilar, ustunlarda dars kunlari. Katak bosilganda kichik
 * oyna: baho (shkala bo'yicha) va uy vazifasi "bajardi / bajarmadi". Oxirgi ustunlarda o'rtacha (%) va uy vazifasi.
 */
export function GradesTab({
  groupId,
  data,
  today,
  canMarkToday,
  canEditPast,
  studentLinks = true,
}: {
  groupId: string;
  data: GroupGrades;
  today: string;
  canMarkToday: boolean;
  canEditPast: boolean;
  /** O'quvchi nomi profilga havola (o'qituvchi kabinetida — yo'q, ADR 0062) */
  studentLinks?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState<string | null>(null);
  // Bosilgan baho darhol ko'rinadi; yangi ma'lumot kelganda tozalanadi
  const [local, setLocal] = React.useState<Record<string, GradeMark | null>>({});
  const [synced, setSynced] = React.useState(data.marks);
  if (synced !== data.marks) {
    setSynced(data.marks);
    setLocal({});
  }
  const lessons = data.lessons;
  const grade = (studentId: string, d: string): GradeMark | undefined => {
    const key = `${studentId}|${d}`;
    return key in local ? (local[key] ?? undefined) : data.marks[key];
  };
  const editableOn = (d: string) => d <= today && (d === today ? canMarkToday || canEditPast : canEditPast);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target as HTMLElement).closest(`[data-cell="${open}"]`)) setOpen(null);
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
    router.push(`${pathname}?tab=grades&month=${month}`, { scroll: false });
  }

  function save(studentId: string, date: string, next: { score: number | null; homework: boolean | null }) {
    const key = `${studentId}|${date}`;
    const prev = grade(studentId, date);
    const scale = prev && prev.score === next.score ? prev.scale : data.scale;
    setLocal((l) => ({
      ...l,
      [key]: next.score === null && next.homework === null ? null : { ...next, scale },
    }));
    startTransition(async () => {
      const res = await saveGradeAction({ groupId, studentId, date, ...next });
      if (!res.ok) {
        setLocal((l) => {
          const copy = { ...l };
          delete copy[key];
          return copy;
        });
        return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      }
      router.refresh();
    });
  }

  const rows = lessons.members.map((m) => {
    const cells = lessons.dates.map((d) => ({ d, active: activeOn(m, d), grade: grade(m.studentId, d) }));
    return { m, cells, summary: summarizeGrades(cells.flatMap((c) => (c.grade ? [c.grade] : []))) };
  });
  const monthLabel = `${uz.months[Number(lessons.month.slice(5, 7)) - 1]} ${lessons.month.slice(0, 4)}`;

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Button
            variant="icon"
            size="icon-sm"
            title={uz.attendance.prevMonth}
            aria-label={uz.attendance.prevMonth}
            onClick={() => go(shiftMonth(lessons.month, -1))}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-36 text-center text-body font-bold text-foreground">{monthLabel}</span>
          <Button
            variant="icon"
            size="icon-sm"
            title={uz.attendance.nextMonth}
            aria-label={uz.attendance.nextMonth}
            onClick={() => go(shiftMonth(lessons.month, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
          <span>{t.scaleHint(data.scale)}</span>
          <span className="flex items-center gap-1">
            <HomeworkDot done /> {t.legendDone}
          </span>
          <span className="flex items-center gap-1">
            <HomeworkDot done={false} /> {t.legendNotDone}
          </span>
        </div>
      </div>

      {!lessons.dates.length ? (
        <EmptyState icon={<CalendarX />} title={t.noLessons} />
      ) : !lessons.members.length ? (
        <EmptyState icon={<CalendarX />} title={t.noStudents} />
      ) : (
        <TableWrap>
          <Table>
            <THead>
              <tr>
                <Th className="sticky left-0 z-(--z-raised) min-w-44 bg-card">{t.colStudent}</Th>
                {lessons.dates.map((d) => (
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
                <Th className="w-20 text-right">{t.colAverage}</Th>
                <Th className="w-24 text-right">{t.colHomework}</Th>
              </tr>
            </THead>
            <TBody>
              {rows.map(({ m, cells, summary }) => (
                <Tr key={m.studentId}>
                  <Td className="sticky left-0 z-(--z-raised) max-w-52 bg-card">
                    {studentLinks ? (
                      <Link
                        href={`/students/${m.studentId}`}
                        className="block truncate font-semibold text-foreground hover:text-primary"
                      >
                        {m.name}
                      </Link>
                    ) : (
                      <span className="block truncate font-semibold text-foreground">{m.name}</span>
                    )}
                  </Td>
                  {cells.map((c) => {
                    const key = `${m.studentId}|${c.d}`;
                    return (
                      <Td key={c.d} className={cn("h-12 w-11 px-1 text-center", c.d === today && "bg-primary-soft/40")}>
                        {c.active ? (
                          <GradeCell
                            cellKey={key}
                            label={`${m.name} — ${formatDate(c.d)}`}
                            current={c.grade ?? null}
                            scale={data.scale}
                            blocked={scoreBlocked(lessons.marks[key]?.status)}
                            editable={editableOn(c.d)}
                            busy={pending}
                            open={open === key}
                            onOpen={() => setOpen(key)}
                            onSave={(next) => save(m.studentId, c.d, next)}
                          />
                        ) : (
                          <span className="text-muted-foreground/40">·</span>
                        )}
                      </Td>
                    );
                  })}
                  <Td className="w-20 text-right font-mono font-semibold tabular-nums">
                    {summary.average === null ? "—" : uz.attendance.rate(summary.average)}
                  </Td>
                  <Td className="w-24 text-right font-mono tabular-nums">
                    {summary.homeworkMarked ? t.homeworkRate(summary.homeworkDone, summary.homeworkMarked) : "—"}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      )}
    </div>
  );
}

function HomeworkDot({ done }: { done: boolean }) {
  return (
    <span
      className={cn("inline-block size-2 rounded-full", done ? "bg-(--success-fg)" : "bg-(--danger-fg)")}
      aria-hidden
    />
  );
}

function GradeCell({
  cellKey,
  label,
  current,
  scale,
  blocked,
  editable,
  busy,
  open,
  onOpen,
  onSave,
}: {
  cellKey: string;
  label: string;
  current: GradeMark | null;
  scale: number;
  /** Davomatda kelmagan/sababli — baho qo'yilmaydi */
  blocked: boolean;
  editable: boolean;
  busy: boolean;
  open: boolean;
  onOpen: () => void;
  onSave: (next: { score: number | null; homework: boolean | null }) => void;
}) {
  const score = current?.score ?? null;
  const homework = current?.homework ?? null;
  const face = (
    <span className="relative inline-block">
      {score !== null ? (
        <span
          className={cn(
            "inline-grid h-7 min-w-7 place-items-center rounded-control border px-1 font-mono text-caption font-bold",
            scoreTone(score, current!.scale),
          )}
        >
          {scoreLabel(score, current!.scale, scale)}
        </span>
      ) : (
        <span
          className={cn(
            "inline-block size-7 rounded-control border-2 border-dashed bg-card",
            blocked ? "border-border-soft" : "border-border",
          )}
        />
      )}
      {homework !== null ? (
        <span className="absolute -top-1 -right-1">
          <HomeworkDot done={homework} />
        </span>
      ) : null}
    </span>
  );
  const title = [
    score !== null ? `${t.score}: ${score}/${current!.scale}` : null,
    homework !== null ? `${t.homework}: ${homework ? t.homeworkDone : t.homeworkNotDone}` : null,
    blocked ? t.absent : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!editable)
    return <span title={title || undefined}>{current ? face : <span className="text-muted-foreground">—</span>}</span>;

  return (
    <div data-cell={cellKey} className="relative inline-block">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={title || t.markHint}
        onClick={onOpen}
        className="grid place-items-center rounded-control"
      >
        {face}
      </button>
      {open ? (
        <div
          className="absolute top-1/2 left-1/2 z-(--z-popover) w-max -translate-x-1/2 -translate-y-1/2 animate-[page-in_160ms_var(--ease-ios)] space-y-2 rounded-card border border-border bg-popover p-2 text-left shadow-popover"
          role="group"
          aria-label={label}
        >
          <div className="text-caption font-semibold text-muted-foreground">{t.score}</div>
          {blocked ? (
            <div className="max-w-48 text-caption text-muted-foreground">{t.absent}</div>
          ) : scale <= 10 ? (
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: scale }, (_, i) => i + 1).map((n) => {
                const on = score === n && current?.scale === scale;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => onSave({ score: on ? null : n, homework })}
                    className={cn(
                      "grid size-8 place-items-center rounded-control border font-mono text-caption font-bold transition-transform hover:scale-105",
                      on ? scoreTone(n, scale) : "border-border-soft text-foreground hover:bg-muted",
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          ) : (
            <ScoreInput
              key={`${cellKey}|${score}`}
              initial={score}
              scale={scale}
              onCommit={(n) => {
                if (n !== score) onSave({ score: n, homework });
              }}
            />
          )}
          <div className="text-caption font-semibold text-muted-foreground">{t.homework}</div>
          <div className="flex items-center gap-1">
            {([true, false] as const).map((done) => {
              const on = homework === done;
              return (
                <button
                  key={String(done)}
                  type="button"
                  aria-pressed={on}
                  disabled={busy}
                  onClick={() => onSave({ score, homework: on ? null : done })}
                  className={cn(
                    "flex h-(--control-h-sm) items-center gap-1 rounded-control border px-2.5 text-caption font-semibold transition-colors [&_svg]:size-3.5",
                    on
                      ? done
                        ? "border-(--success-border) bg-(--success-bg) text-(--success-fg)"
                        : "border-(--danger-border) bg-(--danger-bg) text-(--danger-fg)"
                      : "border-border-soft text-muted-foreground hover:bg-muted",
                  )}
                >
                  {done ? <BookCheck /> : <BookX />} {done ? t.homeworkDone : t.homeworkNotDone}
                </button>
              );
            })}
            {current ? (
              <button
                type="button"
                title={t.clear}
                aria-label={`${label} — ${t.clear}`}
                disabled={busy}
                onClick={() => onSave({ score: null, homework: null })}
                className="grid size-8 place-items-center rounded-control text-muted-foreground hover:bg-muted [&_svg]:size-4"
              >
                <Eraser />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** 100 ballik: raqam yoziladi, Enter yoki maydondan chiqqanda saqlanadi; bo'sh — baho olib tashlanadi */
function ScoreInput({
  initial,
  scale,
  onCommit,
}: {
  initial: number | null;
  scale: number;
  onCommit: (score: number | null) => void;
}) {
  const [value, setValue] = React.useState(initial === null ? "" : String(initial));
  function commit() {
    const n = value === "" ? null : Number(value);
    if (n !== null && !(Number.isInteger(n) && n >= 1 && n <= scale))
      return void toast({ tone: "danger", title: t.scoreInvalid(scale) });
    onCommit(n);
  }
  return (
    <Input
      autoFocus
      inputMode="numeric"
      value={value}
      placeholder={t.scorePlaceholder(scale)}
      className="h-(--control-h-sm) w-24 text-caption"
      aria-label={t.score}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 3))}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}
