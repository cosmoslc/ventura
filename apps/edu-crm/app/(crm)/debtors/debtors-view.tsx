"use client";

import { AlarmClock, CircleDollarSign, MessageSquarePlus, UserX, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterEnd, FilterSearch, FilterSelect } from "@ventura/ui/filter-bar";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatMonth, money } from "@/lib/format";
import { uz } from "@/lib/uz";
import { type MethodOption, PaymentDialog } from "../payments/payment-dialog";
import { GroupBoxHeader, MoreRows, StudentsTable } from "../student-table";
import { addDebtorNoteAction } from "./actions";
import type { DebtorNote, DebtorRow } from "./data";

const t = uz.debtors;
const ALL = "all";
const SORTS = ["high", "low", "oldest", "name"] as const;
/** Izoh yozishda tanlanadigan turlar (jadvalda ogohlantirish ham ko'rinadi) */
const NOTE_KINDS = ["call", "message", "parent"] as const;
/** Har bir guruh qutisida dastlab ko'rinadigan qatorlar */
const BOX_ROWS = 10;
const NO_GROUP = "none";

/** Bir guruh (yoki guruhsiz) bo'yicha qarzdorlar */
interface Entry {
  r: DebtorRow;
  /** Shu guruh bo'yicha qarz */
  due: number;
  months: string[];
}
interface Box {
  key: string;
  id: string | null;
  name: string;
  teacher: string | null;
  entries: Entry[];
  sum: number;
}

/** "12.10.2026" (Toshkent vaqti) */
function noteDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
}

function NoteCell({ note }: { note: DebtorNote | null }) {
  if (!note) return <span className="text-muted-foreground">{t.noteNone}</span>;
  return (
    <div className="max-w-64 min-w-40">
      <div className="line-clamp-2 text-body text-foreground" title={note.text}>
        {note.text}
      </div>
      <div className="text-caption text-muted-foreground">
        {t.noteMeta(uz.students.noteKinds[note.kind] ?? note.kind, note.authorName, noteDate(note.at))}
      </div>
    </div>
  );
}

/** Qarzdor bilan bog'lanish izohini yozish: tur + matn. Eng oxirgisi jadvalda ko'rinadi. */
function NoteDialog({
  debtor,
  open,
  onOpenChange,
}: {
  debtor: DebtorRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [kind, setKind] = React.useState<(typeof NOTE_KINDS)[number]>("call");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!debtor) return;
    if (!text.trim()) return setError(uz.students.noteRequired);
    startTransition(async () => {
      const res = await addDebtorNoteAction({ studentId: debtor.studentId, kind, text });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.students.noteSaved });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.noteTitle}
      description={debtor ? t.noteIntro(debtor.name) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="debtor-note-form" disabled={pending}>
            {t.noteSave}
          </Button>
        </>
      }
    >
      <form id="debtor-note-form" onSubmit={save} className="space-y-4">
        {debtor?.note ? (
          <div className="rounded-control border border-border-soft bg-muted px-3 py-2.5">
            <div className="text-caption font-semibold text-muted-foreground">{t.noteLast}</div>
            <div className="mt-0.5 text-body whitespace-pre-wrap text-foreground">{debtor.note.text}</div>
            <div className="mt-1 text-caption text-muted-foreground">
              {t.noteMeta(
                uz.students.noteKinds[debtor.note.kind] ?? debtor.note.kind,
                debtor.note.authorName,
                noteDate(debtor.note.at),
              )}
            </div>
          </div>
        ) : null}
        <div>
          <Label>{uz.students.noteKind}</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={uz.students.noteKind}>
            {NOTE_KINDS.map((k) => (
              <Button
                key={k}
                type="button"
                size="sm"
                role="radio"
                aria-checked={kind === k}
                variant={kind === k ? "primary" : "ghost"}
                onClick={() => setKind(k)}
              >
                {uz.students.noteKinds[k]}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="debtor-note-text">{uz.students.noteText} *</Label>
          <Textarea
            id="debtor-note-text"
            rows={4}
            maxLength={2000}
            autoFocus
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
        <p className="text-caption text-muted-foreground">{t.noteHistory}</p>
      </form>
    </Modal>
  );
}

export function DebtorsView({
  rows,
  dueDay,
  methods,
  canPay,
  canNote = false,
  maxDiscountPercent,
}: {
  rows: DebtorRow[];
  dueDay: number;
  methods: MethodOption[];
  canPay: boolean;
  canNote?: boolean;
  maxDiscountPercent: number;
}) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [teacher, setTeacher] = React.useState(ALL);
  const [sort, setSort] = React.useState<(typeof SORTS)[number]>("high");
  const [paying, setPaying] = React.useState<string | null>(null);
  const [limits, setLimits] = React.useState<Record<string, number>>({});
  const [noting, setNoting] = React.useState<DebtorRow | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteSeq, setNoteSeq] = React.useState(0);
  const groupOptions = [...new Map(rows.flatMap((r) => r.groups.map((g) => [g.id, g.name] as const))).entries()].sort(
    (a, b) => a[1].localeCompare(b[1]),
  );
  const teacherOptions = [
    ...new Map(
      rows.flatMap((r) => r.groups.flatMap((g) => (g.teacherId ? [[g.teacherId, g.teacherName ?? ""] as const] : []))),
    ).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const visible = rows
    .filter((r) => {
      if (group !== ALL && !r.groups.some((g) => g.id === group)) return false;
      if (teacher !== ALL && !r.groups.some((g) => g.teacherId === teacher)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.parentName ?? "").toLowerCase().includes(q) ||
        r.groups.some((g) => g.name.toLowerCase().includes(q)) ||
        (!!digits && (r.phone.includes(digits) || (r.parentPhone ?? "").includes(digits)))
      );
    })
    .sort((a, b) => {
      if (sort === "low") return a.debt - b.debt;
      if (sort === "oldest")
        return (a.oldestUnpaid ?? "9999").localeCompare(b.oldestUnpaid ?? "9999") || b.debt - a.debt;
      if (sort === "name") return a.name.localeCompare(b.name);
      return b.debt - a.debt;
    });

  const total = rows.reduce((s, r) => s + r.debt, 0);

  // Guruhlar bo'yicha qutilar: har bir guruhning o'z qarzdorlari; guruhsiz qarz — alohida quti
  const boxes: Box[] = [];
  {
    const byKey = new Map<string, Box>();
    const put = (key: string, id: string | null, name: string, teacherName: string | null, entry: Entry) => {
      let box = byKey.get(key);
      if (!box) {
        box = { key, id, name, teacher: teacherName, entries: [], sum: 0 };
        byKey.set(key, box);
      }
      box.entries.push(entry);
      box.sum += entry.due;
    };
    for (const r of visible) {
      for (const g of r.groups) {
        if (group !== ALL && g.id !== group) continue;
        if (teacher !== ALL && g.teacherId !== teacher) continue;
        put(g.id, g.id, g.name, g.teacherName, { r, due: g.due, months: g.months });
      }
      const loose = r.groups.length ? r.otherDebt : r.debt;
      if (loose > 0 && group === ALL && teacher === ALL)
        put(NO_GROUP, null, t.noGroupCard, null, { r, due: loose, months: [] });
    }
    for (const box of byKey.values()) {
      box.entries.sort((a, b) => {
        if (sort === "low") return a.due - b.due;
        if (sort === "oldest")
          return (a.r.oldestUnpaid ?? "9999").localeCompare(b.r.oldestUnpaid ?? "9999") || b.due - a.due;
        if (sort === "name") return a.r.name.localeCompare(b.r.name);
        return b.due - a.due;
      });
      boxes.push(box);
    }
    boxes.sort((a, b) => (a.id === null ? 1 : b.id === null ? -1 : b.sum - a.sum || a.name.localeCompare(b.name)));
  }

  function openNote(r: DebtorRow) {
    setNoting(r);
    setNoteSeq((n) => n + 1);
    setNoteOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t.title} description={t.description} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} tone={4} label={t.kpiCount} value={String(rows.length)} hint={t.kpiCountHint} />
        <StatCard
          icon={<CircleDollarSign />}
          tone={3}
          label={t.kpiSum}
          value={`${money(total)} ${uz.common.som}`}
          hint={t.kpiSumHint}
        />
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.kpiPartial}
          value={String(rows.filter((r) => r.partial).length)}
          hint={t.kpiPartialHint}
        />
        <StatCard
          icon={<AlarmClock />}
          tone={3}
          label={t.kpiOverdue}
          value={String(rows.filter((r) => r.overdueDays > 0).length)}
          hint={t.kpiOverdueHint(dueDay)}
        />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <FilterSelect
          label={t.group}
          value={group}
          onValueChange={setGroup}
          options={[
            { value: ALL, label: t.allGroups },
            ...groupOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          label={t.teacher}
          value={teacher}
          onValueChange={setTeacher}
          options={[
            { value: ALL, label: t.allTeachers },
            ...teacherOptions.map(([id, name]) => ({ value: id, label: name })),
          ]}
        />
        <FilterSelect
          label={t.sort}
          value={sort}
          onValueChange={(v) => setSort(v as (typeof SORTS)[number])}
          className="sm:w-52"
          options={SORTS.map((s) => ({ value: s, label: t.sorts[s] }))}
        />
        <FilterEnd>
          <span className="text-caption text-muted-foreground">{t.count(visible.length, rows.length)}</span>
        </FilterEnd>
      </FilterBar>

      {boxes.length ? (
        <div className="space-y-5">
          {boxes.map((box) => {
            const limit = limits[box.key] ?? BOX_ROWS;
            const shown = box.entries.slice(0, limit);
            return (
              <StudentsTable
                key={box.key}
                rows={shown}
                rowKey={(e) => e.r.studentId}
                student={(e) => ({
                  name: e.r.name,
                  href: `/students/${e.r.studentId}`,
                  sub: [
                    displayPhone(e.r.phone),
                    e.r.parentPhone ? `${e.r.parentName ?? ""} ${displayPhone(e.r.parentPhone)}`.trim() : null,
                    e.r.archived ? t.archived : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })}
                studentHeader={t.colStudent}
                minWidth={940}
                header={
                  <GroupBoxHeader
                    title={box.name}
                    href={box.id ? `/groups/${box.id}` : undefined}
                    sub={[box.id ? box.teacher : t.noGroupCardHint, t.groupStudents(box.entries.length)]
                      .filter(Boolean)
                      .join(" · ")}
                    aside={
                      <span className="text-(--danger-fg)">
                        {money(box.sum)} {uz.common.som}
                      </span>
                    }
                  />
                }
                columns={[
                  {
                    key: "months",
                    headClassName: "w-48",
                    header: t.colMonths,
                    cell: (e) => {
                      const text = [...e.months].sort().map(formatMonth).join(", ");
                      return text ? (
                        <span className="line-clamp-2 max-w-48" title={text}>
                          {text}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      );
                    },
                  },
                  {
                    key: "debt",
                    headClassName: "w-40",
                    header: t.colDebt,
                    align: "right",
                    className: "whitespace-nowrap",
                    cell: (e) => (
                      <>
                        <div className="font-semibold text-(--danger-fg)">
                          {money(e.due)} {uz.common.som}
                        </div>
                        {e.r.debt !== e.due ? (
                          <div className="text-caption text-muted-foreground">{t.totalDebt(money(e.r.debt))}</div>
                        ) : null}
                      </>
                    ),
                  },
                  {
                    key: "status",
                    headClassName: "w-44",
                    header: t.colStatus,
                    cell: (e) =>
                      e.r.overdueDays > 0 ? (
                        <Badge tone="danger">{t.overdue(e.r.overdueDays)}</Badge>
                      ) : (
                        <Badge tone="warning">{t.dueSoon}</Badge>
                      ),
                  },
                  { key: "note", headClassName: "w-64", header: t.colNote, cell: (e) => <NoteCell note={e.r.note} /> },
                  {
                    key: "actions",
                    headClassName: "w-36",
                    header: uz.common.actions,
                    align: "right",
                    cell: (e) =>
                      canPay || canNote ? (
                        <div className="flex items-center justify-end gap-1">
                          {canNote ? (
                            <Button
                              variant="icon"
                              size="icon"
                              title={t.noteAdd}
                              aria-label={t.noteAdd}
                              onClick={() => openNote(e.r)}
                            >
                              <MessageSquarePlus />
                            </Button>
                          ) : null}
                          {canPay ? (
                            <Button size="sm" onClick={() => setPaying(e.r.studentId)}>
                              {t.pay}
                            </Button>
                          ) : null}
                        </div>
                      ) : null,
                  },
                ]}
                footer={
                  box.entries.length > limit ? (
                    <MoreRows onClick={() => setLimits((l) => ({ ...l, [box.key]: limit + BOX_ROWS }))}>
                      {t.showMore(Math.min(BOX_ROWS, box.entries.length - limit))}
                    </MoreRows>
                  ) : null
                }
                empty={null}
              />
            );
          })}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <EmptyState icon={<UserX />} title={t.empty} description={t.emptyHint} />
        </Card>
      )}

      <PaymentDialog
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
        studentId={paying ?? undefined}
        studentName={rows.find((r) => r.studentId === paying)?.name}
        methods={methods}
        maxDiscountPercent={maxDiscountPercent}
      />
      <NoteDialog key={noteSeq} debtor={noting} open={noteOpen} onOpenChange={setNoteOpen} />
    </div>
  );
}
