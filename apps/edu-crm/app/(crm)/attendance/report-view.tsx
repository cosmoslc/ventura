"use client";

import {
  CalendarX,
  Check,
  CircleCheck,
  Clock,
  PhoneCall,
  PhoneOff,
  RotateCcw,
  Search,
  TriangleAlert,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { type ReportFilter, matchesFilter } from "@/lib/attendance-report";
import { displayPhone, formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { ReportRow } from "@/lib/server/attendance-report";
import { markAttendanceAction } from "../groups/attendance-actions";
import { logContactAction } from "./actions";

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
}: {
  rows: ReportRow[];
  courses: { id: string; name: string }[];
  from: string;
  to: string;
  today: string;
  rangeInvalid: boolean;
  canMarkToday: boolean;
  canEditPast: boolean;
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
    <div className="space-y-6">
      <PageHeader title={uz.attendance.title} description={t.description} />

      {rangeInvalid ? <Notice tone="warning" title={t.rangeInvalid} /> : null}

      <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label htmlFor="att-from">{t.from}</Label>
          <Input id="att-from" type="date" value={from} max={to} onChange={(e) => setRange({ from: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="att-to">{t.to}</Label>
          <Input id="att-to" type="date" value={to} min={from} onChange={(e) => setRange({ to: e.target.value })} />
        </div>
        <FilterSelect label={t.group} value={groupId} onChange={setGroupId} all={t.allGroups}>
          {groupOptions.map(([id, name]) => (
            <SelectItem key={id} value={id}>
              {name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label={t.course} value={courseId} onChange={setCourseId} all={t.allCourses}>
          {courses.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </FilterSelect>
        <FilterSelect label={t.memberStatus} value={memberStatus} onChange={setMemberStatus} all={t.allStatuses}>
          {MEMBER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {t.memberStatuses[s]}
            </SelectItem>
          ))}
        </FilterSelect>
        <div>
          <Label>{t.filter}</Label>
          <Select value={filter} onValueChange={(v) => setFilter(v as ReportFilter)}>
            <SelectTrigger className="w-full" aria-label={t.filter}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((f) => (
                <SelectItem key={f} value={f}>
                  {t.filters[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

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
              hint={t.kpiHint[k.filter]}
              className={cn("h-full", filter === k.filter && "border-primary")}
            />
          </button>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="text-caption text-muted-foreground">{t.count(visible.length, base.length)}</span>
          <Button variant="ghost" onClick={reset}>
            <RotateCcw /> {t.reset}
          </Button>
        </div>

        {visible.length ? (
          <TableWrap className="rounded-none border-0">
            <Table>
              <THead>
                <Tr>
                  <Th className="w-12 text-center">{uz.attendance.colNo}</Th>
                  <Th>{uz.attendance.colStudent}</Th>
                  <Th>{t.colGroup}</Th>
                  <Th>{t.colPrevious}</Th>
                  <Th>{t.colRange}</Th>
                  <Th className="text-center">{t.colMonth}</Th>
                  <Th>{t.colReason}</Th>
                  <Th>{t.colContact}</Th>
                </Tr>
              </THead>
              <TBody>
                {visible.map((r, i) => (
                  <Tr key={r.key}>
                    <Td className="text-center text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <Link
                        href={`/students/${r.studentId}`}
                        className="font-medium text-foreground hover:text-primary"
                      >
                        {r.name}
                      </Link>
                      <div className="text-caption text-muted-foreground">{displayPhone(r.phone)}</div>
                    </Td>
                    <Td>
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
                    </Td>
                    <Td>
                      {r.previous ? (
                        <div className="space-y-1">
                          {r.previous.status ? (
                            <Badge tone={STATUS_TONE[r.previous.status]}>
                              {uz.attendance.statuses[r.previous.status]}
                            </Badge>
                          ) : (
                            <Badge tone="neutral">{t.unmarked}</Badge>
                          )}
                          <div className="text-caption text-muted-foreground">{formatDate(r.previous.date)}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{t.noLesson}</span>
                      )}
                    </Td>
                    <Td>
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
                    </Td>
                    <Td className="text-center">
                      <span
                        className={cn(
                          "font-semibold",
                          r.missedThisMonth ? "text-(--danger-fg)" : "text-muted-foreground",
                        )}
                      >
                        {t.monthMissed(r.missedThisMonth)}
                      </span>
                    </Td>
                    <Td className="max-w-56">
                      {r.lastMissed ? (
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
                          <span className="block text-caption text-muted-foreground">
                            {formatDate(r.lastMissed.date)}
                          </span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground">{t.notNeeded}</span>
                      )}
                    </Td>
                    <Td>
                      {r.lastMissed ? (
                        <div className="flex items-center gap-2">
                          <Badge tone={r.contacted ? "success" : "warning"}>
                            {r.contacted ? t.contacted : t.notContacted}
                          </Badge>
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
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<CalendarX />} title={t.empty} description={t.emptyHint} />
        )}
      </Card>

      {reasonFor?.lastMissed ? (
        <ReasonModal row={reasonFor} onClose={() => setReasonFor(null)} onSaved={() => router.refresh()} />
      ) : null}
      {callFor ? <CallModal row={callFor} onClose={() => setCallFor(null)} onSaved={() => router.refresh()} /> : null}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  all,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  all: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{all}</SelectItem>
          {children}
        </SelectContent>
      </Select>
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
        {error ? <Notice tone="danger" title={error} /> : null}
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
        {error ? <Notice tone="danger" title={error} /> : null}
      </form>
    </Modal>
  );
}
