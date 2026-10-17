"use client";

import {
  CalendarX,
  Check,
  CircleCheck,
  Clock,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  TriangleAlert,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { FilterBar, FilterDates, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { StatCard } from "@ventura/ui/stat-card";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { type ReportFilter, matchesFilter } from "@/lib/attendance-report";
import { displayPhone, formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { ReportRow } from "@/lib/server/attendance-report";
import { StudentsTable } from "../student-table";
import { markAttendanceAction } from "../groups/attendance-actions";
import { logContactAction } from "./actions";
import { JournalExport } from "./journal-export";

const t = uz.attendance.report;
const KPIS: { filter: Exclude<ReportFilter, "all">; label: string; icon: React.ReactNode; tone: 1 | 2 | 3 | 4 }[] = [
  { filter: "absent", label: t.kpiAbsent, icon: <UserX />, tone: 3 },
  { filter: "present", label: t.kpiPresent, icon: <CircleCheck />, tone: 2 },
  { filter: "unmarked", label: t.kpiUnmarked, icon: <Clock />, tone: 4 },
  { filter: "risk", label: t.kpiRisk, icon: <TriangleAlert />, tone: 3 },
  { filter: "uncontacted", label: t.kpiUncontacted, icon: <PhoneOff />, tone: 1 },
];
const FILTERS: ReportFilter[] = ["absent", "present", "unmarked", "risk", "uncontacted", "all"];
const MEMBER_STATUSES = ["trial", "active", "paused", "left"] as const;
const STATUS_TONE = { present: "success", late: "warning", excused: "info", absent: "danger" } as const;
const ALL = "all";

export function AttendanceReportView({
  rows,
  courses,
  from,
  to,
  today,
  rangeInvalid,
  canMarkToday,
  canEditPast,
  exportGroups,
}: {
  rows: ReportRow[];
  courses: { id: string; name: string }[];
  from: string;
  to: string;
  today: string;
  rangeInvalid: boolean;
  canMarkToday: boolean;
  canEditPast: boolean;
  /** Jurnalni Excelga yuklash mumkin bo'lgan guruhlar; null — ruxsat yo'q */
  exportGroups: { id: string; name: string }[] | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [groupId, setGroupId] = React.useState(ALL);
  const [courseId, setCourseId] = React.useState(ALL);
  const [memberStatus, setMemberStatus] = React.useState(ALL);
  const [filter, setFilter] = React.useState<ReportFilter>("absent");
  const [query, setQuery] = React.useState("");
  const [reasonFor, setReasonFor] = React.useState<ReportRow | null>(null);
  const [callFor, setCallFor] = React.useState<ReportRow | null>(null);

  const groupOptions = React.useMemo(() => {
    const map = new Map(rows.map((r) => [r.groupId, r.groupName]));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  // KPI kartalari holat filtridan tashqari barcha filtrlarni hisobga oladi
  const base = rows.filter((r) => {
    if (groupId !== ALL && r.groupId !== groupId) return false;
    if (courseId !== ALL && r.courseId !== courseId) return false;
    if (memberStatus !== ALL && r.memberStatus !== memberStatus) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const digits = q.replace(/\D/g, "");
    return (
      r.name.toLowerCase().includes(q) ||
      r.groupName.toLowerCase().includes(q) ||
      r.teacherName.toLowerCase().includes(q) ||
      (!!digits && r.phone.includes(digits))
    );
  });
  const visible = base.filter((r) => matchesFilter(r, filter));
  const kpi = (f: ReportFilter) => base.filter((r) => matchesFilter(r, f)).length;

  const editableDay = (d: string) => d <= today && (d === today ? canMarkToday || canEditPast : canEditPast);

  function setRange(next: { from?: string; to?: string }) {
    const f = next.from ?? from;
    const tt = next.to ?? to;
    if (!f || !tt) return;
    router.push(`${pathname}?from=${f}&to=${tt}`, { scroll: false });
  }

  function reset() {
    setGroupId(ALL);
    setCourseId(ALL);
    setMemberStatus(ALL);
    setFilter("absent");
    setQuery("");
    router.push(pathname, { scroll: false });
  }

  return (
    <div className="space-y-4">
      <PageHeader title={uz.attendance.title} description={t.description} />

      {rangeInvalid ? <Notice tone="warning">{t.rangeInvalid}</Notice> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {KPIS.map((k) => (
          <button
            key={k.filter}
            type="button"
            className="text-left"
            aria-pressed={filter === k.filter}
            onClick={() => setFilter((f) => (f === k.filter ? "all" : k.filter))}
          >
            <StatCard
              icon={k.icon}
              tone={k.tone}
              label={k.label}
              value={String(kpi(k.filter))}
              className={cn("h-full", filter === k.filter && "border-primary")}
            />
          </button>
        ))}
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterDates from={from} to={to} onChange={setRange} fromLabel={t.from} toLabel={t.to} />
        <FilterSelect
          label={t.group}
          value={groupId}
          onValueChange={setGroupId}
          options={[
            { value: ALL, label: t.allGroups },
            ...groupOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          label={t.course}
          value={courseId}
          onValueChange={setCourseId}
          options={[{ value: ALL, label: t.allCourses }, ...courses.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <FilterSelect
          label={t.memberStatus}
          value={memberStatus}
          onValueChange={setMemberStatus}
          options={[
            { value: ALL, label: t.allStatuses },
            ...MEMBER_STATUSES.map((s) => ({ value: s, label: t.memberStatuses[s] })),
          ]}
        />
        <FilterSelect
          label={t.filter}
          value={filter}
          onValueChange={(v) => setFilter(v as ReportFilter)}
          options={FILTERS.map((f) => ({ value: f, label: t.filters[f] }))}
        />
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> {t.reset}
        </Button>
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length, base.length)}</span>
          {exportGroups ? <JournalExport groups={exportGroups} month={today.slice(0, 7)} /> : null}
        </FilterEnd>
      </FilterBar>

      <StudentsTable
        rows={visible}
        rowKey={(r) => r.key}
        student={(r) => ({ name: r.name, href: `/students/${r.studentId}`, sub: displayPhone(r.phone) })}
        studentHeader={uz.attendance.colStudent}
        minWidth={960}
        columns={[
          {
            key: "group",
            header: t.colGroup,
            cell: (r) => (
              <>
                <Link
                  href={`/groups/${r.groupId}?tab=attendance&month=${(r.lastMissed?.date ?? to).slice(0, 7)}`}
                  className="font-medium text-foreground hover:text-primary"
                >
                  {r.groupName}
                </Link>
                <div className="text-caption text-muted-foreground">
                  {r.teacherName} · {r.startTime}
                  {r.memberStatus !== "active" ? ` · ${t.memberStatuses[r.memberStatus]}` : ""}
                </div>
              </>
            ),
          },
          {
            key: "previous",
            header: t.colPrevious,
            cell: (r) =>
              r.previous ? (
                <div className="space-y-1">
                  {r.previous.status ? (
                    <Badge tone={STATUS_TONE[r.previous.status]}>{uz.attendance.statuses[r.previous.status]}</Badge>
                  ) : (
                    <Badge tone="neutral">{t.unmarked}</Badge>
                  )}
                  <div className="text-caption text-muted-foreground">{formatDate(r.previous.date)}</div>
                </div>
              ) : (
                <span className="text-muted-foreground">{t.noLesson}</span>
              ),
          },
          {
            key: "range",
            header: t.colRange,
            cell: (r) => (
              <>
                <div className="font-medium">{t.missedOf(r.missed, r.lessons)}</div>
                <div className="text-caption text-muted-foreground">
                  {t.rateLine(r.rate)}
                  {r.unmarked ? ` · ${t.unmarked}: ${r.unmarked}` : ""}
                </div>
                {r.consecutive >= 3 ? (
                  <Badge tone="danger" className="mt-1">
                    {t.consecutive(r.consecutive)}
                  </Badge>
                ) : null}
              </>
            ),
          },
          {
            key: "month",
            header: t.colMonth,
            align: "center",
            cell: (r) => (
              <span className={cn("font-semibold", r.missedThisMonth ? "text-(--danger-fg)" : "text-muted-foreground")}>
                {t.monthMissed(r.missedThisMonth)}
              </span>
            ),
          },
          {
            key: "reason",
            header: t.colReason,
            className: "max-w-56",
            cell: (r) =>
              r.lastMissed ? (
                <button
                  type="button"
                  className="text-left hover:text-primary disabled:cursor-default disabled:hover:text-inherit"
                  onClick={() => setReasonFor(r)}
                  disabled={!editableDay(r.lastMissed.date)}
                  title={editableDay(r.lastMissed.date) ? t.editReason : t.reasonReadOnly}
                >
                  {r.lastMissed.reason ? (
                    <span className="line-clamp-2">{r.lastMissed.reason}</span>
                  ) : (
                    <span className="text-muted-foreground italic">{t.noReason}</span>
                  )}
                  <span className="block text-caption text-muted-foreground">{formatDate(r.lastMissed.date)}</span>
                </button>
              ) : (
                <span className="text-muted-foreground">{t.notNeeded}</span>
              ),
          },
          {
            key: "contact",
            header: t.colContact,
            cell: (r) =>
              r.lastMissed ? (
                <div className="flex items-center gap-2">
                  <Badge tone={r.contacted ? "success" : "warning"}>{r.contacted ? t.contacted : t.notContacted}</Badge>
                  {canMarkToday || canEditPast ? (
                    <Button
                      variant="icon"
                      size="icon"
                      aria-label={t.logCall}
                      title={t.logCall}
                      onClick={() => setCallFor(r)}
                    >
                      <PhoneCall />
                    </Button>
                  ) : null}
                </div>
              ) : (
                <span className="text-muted-foreground">{t.notNeeded}</span>
              ),
          },
        ]}
        empty={<EmptyState icon={<CalendarX />} title={t.empty} description={t.emptyHint} />}
      />

      {reasonFor?.lastMissed ? (
        <ReasonModal row={reasonFor} onClose={() => setReasonFor(null)} onSaved={() => router.refresh()} />
      ) : null}
      {callFor ? <CallModal row={callFor} onClose={() => setCallFor(null)} onSaved={() => router.refresh()} /> : null}
    </div>
  );
}

/** Sabab oxirgi qoldirilgan darsning belgisiga yoziladi (holati o'zgarmaydi) */
function ReasonModal({ row, onClose, onSaved }: { row: ReportRow; onClose: () => void; onSaved: () => void }) {
  const missed = row.lastMissed!;
  const [text, setText] = React.useState(missed.reason ?? "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await markAttendanceAction({
        groupId: row.groupId,
        studentId: row.studentId,
        date: missed.date,
        status: missed.status,
        reason: text,
      });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onClose();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.reasonSaved, description: row.name });
      onClose();
      onSaved();
    });
  }

  return (
    <Modal
      open
      position="center"
      onOpenChange={(o) => !o && onClose()}
      title={t.reasonTitle}
      description={`${row.name} · ${row.groupName}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="reason-form" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        </>
      }
    >
      <form id="reason-form" onSubmit={submit} className="space-y-3">
        <FieldHint>
          {t.reasonFor(formatDate(missed.date))} · {uz.attendance.statuses[missed.status]}
        </FieldHint>
        <div>
          <Label htmlFor="reason-text">{t.reasonLabel}</Label>
          <Textarea
            id="reason-text"
            autoFocus
            rows={3}
            maxLength={500}
            placeholder={t.reasonPlaceholder}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}

function CallModal({ row, onClose, onSaved }: { row: ReportRow; onClose: () => void; onSaved: () => void }) {
  const [answered, setAnswered] = React.useState(true);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await logContactAction({ studentId: row.studentId, groupId: row.groupId, answered, text });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onClose();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.callSaved, description: row.name });
      onClose();
      onSaved();
    });
  }

  return (
    <Modal
      open
      position="center"
      onOpenChange={(o) => !o && onClose()}
      title={t.callTitle}
      description={`${row.name} · ${displayPhone(row.phone) ?? ""}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="call-form" disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        </>
      }
    >
      <form id="call-form" onSubmit={submit} className="space-y-4">
        <div>
          <Label>{t.callResult}</Label>
          <RadioGroup
            value={answered ? "yes" : "no"}
            onValueChange={(v) => setAnswered(v === "yes")}
            className="grid-cols-2"
          >
            <RadioCard value="yes" title={t.callAnswered} description={t.callAnsweredHint} />
            <RadioCard value="no" title={t.callNoAnswer} description={t.callNoAnswerHint} />
          </RadioGroup>
        </div>
        <div>
          <Label htmlFor="call-text">{t.callNote}</Label>
          <Textarea
            id="call-text"
            rows={3}
            maxLength={1000}
            placeholder={t.callNotePlaceholder}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}
