"use client";

import { AlarmClock, CircleDollarSign, MessageSquarePlus, MessageSquareText, UserX, Users, Wallet } from "lucide-react";
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
import { SendSmsModal } from "../sms/send-sms-modal";
import { GroupChip, MoreRows, StudentsTable } from "../student-table";
import { addDebtorNoteAction } from "./actions";
import type { DebtorNote, DebtorRow } from "./data";

const t = uz.debtors;
const ALL = "all";
const SORTS = ["high", "low", "oldest", "name"] as const;
/** Izoh yozishda tanlanadigan turlar (jadvalda ogohlantirish ham ko'rinadi) */
const NOTE_KINDS = ["call", "message", "parent"] as const;
/** Jadvalda dastlab (va har "yana" bosilganda) ko'rinadigan qatorlar */
const PAGE_ROWS = 30;

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
  methods,
  canPay,
  canNote = false,
  maxDiscountPercent,
  sms = null,
}: {
  rows: DebtorRow[];
  methods: MethodOption[];
  canPay: boolean;
  canNote?: boolean;
  maxDiscountPercent: number;
  /** SMS eslatma (bo'lim yoqilgan va ruxsat bor) */
  sms?: { centerName: string } | null;
}) {
  const [query, setQuery] = React.useState("");
  const [group, setGroup] = React.useState(ALL);
  const [teacher, setTeacher] = React.useState(ALL);
  const [sort, setSort] = React.useState<(typeof SORTS)[number]>("high");
  const [paying, setPaying] = React.useState<string | null>(null);
  const [limit, setLimit] = React.useState(PAGE_ROWS);
  const [noting, setNoting] = React.useState<DebtorRow | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteSeq, setNoteSeq] = React.useState(0);
  // SMS eslatma: bitta qarzdorga (qatordan) yoki filtrdagi hammasiga (sarlavhadan)
  const [smsTo, setSmsTo] = React.useState<DebtorRow[] | null>(null);
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
  // Guruh tanlangan bo'lsa qarz va oylar — shu guruh bo'yicha, aks holda o'quvchining jami qarzi
  const dueOf = (r: DebtorRow) => (group === ALL ? r.debt : (r.groups.find((g) => g.id === group)?.due ?? 0));
  const monthsOf = (r: DebtorRow) => [
    ...new Set(r.groups.filter((g) => group === ALL || g.id === group).flatMap((g) => g.months)),
  ];
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
      if (sort === "low") return dueOf(a) - dueOf(b);
      if (sort === "oldest")
        return (a.oldestUnpaid ?? "9999").localeCompare(b.oldestUnpaid ?? "9999") || dueOf(b) - dueOf(a);
      if (sort === "name") return a.name.localeCompare(b.name);
      return dueOf(b) - dueOf(a);
    });

  const total = rows.reduce((s, r) => s + r.debt, 0);

  function openNote(r: DebtorRow) {
    setNoting(r);
    setNoteSeq((n) => n + 1);
    setNoteOpen(true);
  }

  return (
    <div className="space-y-section">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          sms && visible.length ? (
            <Button variant="ghost" onClick={() => setSmsTo(visible)}>
              <MessageSquareText /> {t.smsRemindAll(visible.length)}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-grid sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users />} tone={4} label={t.kpiCount} value={String(rows.length)} />
        <StatCard icon={<CircleDollarSign />} tone={3} label={t.kpiSum} value={`${money(total)} ${uz.common.som}`} />
        <StatCard
          icon={<Wallet />}
          tone={1}
          label={t.kpiPartial}
          value={String(rows.filter((r) => r.partial).length)}
        />
        <StatCard
          icon={<AlarmClock />}
          tone={3}
          label={t.kpiOverdue}
          value={String(rows.filter((r) => r.overdueDays > 0).length)}
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

      {visible.length ? (
        <StudentsTable
          rows={visible.slice(0, limit)}
          rowKey={(r) => r.studentId}
          numbered
          student={(r) => ({
            name: r.name,
            href: `/students/${r.studentId}`,
            sub: [displayPhone(r.phone) ?? displayPhone(r.parentPhone), r.archived ? t.archived : null]
              .filter(Boolean)
              .join(" · "),
          })}
          studentHeader={t.colStudent}
          minWidth={1080}
          columns={[
            {
              key: "groups",
              headClassName: "w-44",
              header: t.colGroups,
              cell: (r) =>
                r.groups.length ? (
                  <div className="flex max-w-60 flex-wrap gap-1">
                    {r.groups.map((g) => (
                      <GroupChip key={g.id} id={g.id} name={g.name} muted={group !== ALL && g.id !== group} />
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">{t.noGroupCard}</span>
                ),
            },
            {
              key: "months",
              headClassName: "w-48",
              header: t.colMonths,
              cell: (r) => {
                const text = monthsOf(r).sort().map(formatMonth).join(", ");
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
              cell: (r) => (
                <>
                  <div className="font-semibold text-(--danger-fg)">
                    {money(dueOf(r))} {uz.common.som}
                  </div>
                  {r.debt !== dueOf(r) ? (
                    <div className="text-caption text-muted-foreground">{t.totalDebt(money(r.debt))}</div>
                  ) : null}
                </>
              ),
            },
            {
              key: "status",
              headClassName: "w-44",
              header: t.colStatus,
              cell: (r) =>
                r.overdueDays > 0 ? (
                  <Badge tone="danger">{t.overdue(r.overdueDays)}</Badge>
                ) : (
                  <Badge tone="warning">{t.dueSoon}</Badge>
                ),
            },
            { key: "note", headClassName: "w-64", header: t.colNote, cell: (r) => <NoteCell note={r.note} /> },
            {
              key: "actions",
              headClassName: "w-36",
              header: uz.common.actions,
              align: "right",
              cell: (r) =>
                canPay || canNote || sms ? (
                  <div className="flex items-center justify-end gap-1">
                    {sms ? (
                      <Button
                        variant="icon"
                        size="icon"
                        title={t.smsRemind}
                        aria-label={t.smsRemind}
                        onClick={() => setSmsTo([r])}
                      >
                        <MessageSquareText />
                      </Button>
                    ) : null}
                    {canNote ? (
                      <Button
                        variant="icon"
                        size="icon"
                        title={t.noteAdd}
                        aria-label={t.noteAdd}
                        onClick={() => openNote(r)}
                      >
                        <MessageSquarePlus />
                      </Button>
                    ) : null}
                    {canPay ? (
                      <Button size="sm" onClick={() => setPaying(r.studentId)}>
                        {t.pay}
                      </Button>
                    ) : null}
                  </div>
                ) : null,
            },
          ]}
          footer={
            visible.length > limit ? (
              <MoreRows onClick={() => setLimit((l) => l + PAGE_ROWS)}>
                {t.showMore(Math.min(PAGE_ROWS, visible.length - limit))}
              </MoreRows>
            ) : null
          }
          empty={null}
        />
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
      {sms ? (
        <SendSmsModal
          open={smsTo !== null}
          onOpenChange={(o) => !o && setSmsTo(null)}
          source="debtors"
          studentIds={(smsTo ?? []).map((r) => r.studentId)}
          title={uz.smsSend.titleDebtors(smsTo?.length ?? 0)}
          centerName={sms.centerName}
        />
      ) : null}
    </div>
  );
}
