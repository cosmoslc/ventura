"use client";

import {
  ArrowLeft,
  Building2,
  ChevronDown,
  MessageSquareText,
  Pencil,
  Plus,
  Scale,
  Trash2,
  Undo2,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { DropdownMenuItem, DropdownMenuSeparator } from "@ventura/ui/dropdown-menu";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { type FormField, fieldText } from "@/lib/form-fields";
import type { LedgerSummary } from "@/lib/ledger";
import type { StudentGradeGroup } from "@/lib/server/grades";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import type { StudentMembershipRow } from "../groups/data";
import type { GroupPerms } from "../groups/groups-view";
import type { PickOption } from "../groups/membership-dialogs";
import { StudentGroupsTab } from "../groups/student-groups-tab";
import type { DiscountRow, PaymentRow, StudentGroupOption } from "../payments/data";
import { CorrectionDialog, RefundDialog } from "../payments/finance-dialogs";
import { type MethodOption, PaymentDialog } from "../payments/payment-dialog";
import type { FinancePerms } from "../payments/perms";
import { StudentDiscountsTab } from "../payments/student-discounts-tab";
import { StudentFinanceTab, StudentMoneyCards } from "../payments/student-finance-tab";
import { addStudentNoteAction, deleteStudentNoteAction } from "./actions";
import type { GroupChoice, HistoryRow, StudentNoteRow, StudentRow } from "./data";
import { StatusBadge, StudentMenu, type StudentPerms, TransferDialog } from "./student-dialogs";
import { StudentForm } from "./student-form";
import { StudentGradesTab } from "./student-grades-tab";
import { StudentLoginCard } from "./student-login-card";

type Tab = "groups" | "grades" | "payments" | "discounts" | "notes" | "history";
const NOTE_KINDS = ["call", "message", "parent", "result", "note", "warning"] as const;

/** "2026-10-12T09:30:00Z" → "12.10.2026 • 14:30" (Toshkent vaqti) */
function dateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
  const time = d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
  return `${date} • ${time}`;
}

export interface StudentFinance {
  summary: LedgerSummary;
  groups: StudentGroupOption[];
  entries: PaymentRow[];
  discounts: DiscountRow[];
  methods: MethodOption[];
  perms: FinancePerms;
  maxDiscountPercent: number;
  /** Joriy oy (YYYY-MM, Toshkent) — "O'tgan oydan qarz" kartasi uchun */
  currentMonth: string;
}

/**
 * O'quvchi profili (ADR 0020). Chapda — asosiy ma'lumotlar; o'ngda — doimiy kartalar (balans, coin, o'tgan oydan
 * qarz) va tablar. To'lov, qaytarish, balansni tuzatish va boshqa filialga o'tkazish — uch nuqta menyusida.
 */
export function StudentProfile({
  student: s,
  notes,
  history,
  branches,
  selectedBranch,
  courses,
  fields,
  groupChoices,
  perms,
  memberships,
  groupOptions,
  groupPerms,
  finance,
  coins,
  grades,
}: {
  student: StudentRow;
  notes: StudentNoteRow[];
  history: HistoryRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  fields: FormField[];
  /** Guruh tanlash maydonlari: nomlar (arxivdagilar ham) va formadagi variantlar */
  groupChoices: GroupChoice[];
  perms: StudentPerms;
  memberships: StudentMembershipRow[];
  groupOptions: PickOption[];
  groupPerms: GroupPerms;
  /** null — moliya bo'limi o'chiq yoki ko'rish ruxsati yo'q */
  finance: StudentFinance | null;
  /** Coin balansi; null — coin bo'limi o'chiq (ADR 0061) */
  coins: number | null;
  /** Guruhlar bo'yicha baholar; null — Baholash bo'limi o'chiq */
  grades: StudentGradeGroup[] | null;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("groups");
  const [more, setMore] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [payFor, setPayFor] = React.useState<string | null | undefined>(undefined);
  const [dialog, setDialog] = React.useState<"refund" | "correction" | "transfer" | null>(null);
  const branch = branches.find((b) => b.id === s.branchId);
  const course = courses.find((c) => c.id === s.interestedCourseId);
  const school = s.school ? (/^\d+$/.test(s.school) ? `${s.school}${uz.students.schoolSuffix}` : s.school) : null;
  const fp = finance?.perms;
  const textLabels = {
    yes: uz.staff.yes,
    no: uz.staff.no,
    groupName: (id: string) => groupChoices.find((g) => g.value === id)?.label,
  };
  const legacyAll: [string, string | null][] = [
    [uz.students.birth, s.birthDate ? formatDate(s.birthDate) : null],
    [uz.students.parentName, s.parentName],
    [uz.students.school, school],
    [uz.students.grade, s.grade],
    [uz.students.address, s.address],
    [uz.students.source, s.source],
    [uz.students.interestedCourse, course?.name ?? null],
  ];
  const legacy = legacyAll.filter((x): x is [string, string] => !!x[1]);
  const canTransfer = perms.edit && branches.some((b) => b.id !== s.branchId);
  const openGroups = memberships.filter((m) => !m.leftAt).length;

  const menuExtra =
    fp?.create || fp?.correct || canTransfer ? (
      <>
        <DropdownMenuSeparator />
        {fp?.create ? (
          <DropdownMenuItem onSelect={() => setPayFor(null)}>
            <Wallet /> {uz.payments.add}
          </DropdownMenuItem>
        ) : null}
        {fp?.create ? (
          <DropdownMenuItem disabled={(finance?.summary.balance ?? 0) <= 0} onSelect={() => setDialog("refund")}>
            <Undo2 /> {uz.payments.refund}
          </DropdownMenuItem>
        ) : null}
        {fp?.correct ? (
          <DropdownMenuItem onSelect={() => setDialog("correction")}>
            <Scale /> {uz.payments.correction}
          </DropdownMenuItem>
        ) : null}
        {canTransfer ? (
          <DropdownMenuItem onSelect={() => setDialog("transfer")}>
            <Building2 /> {uz.students.transfer}
          </DropdownMenuItem>
        ) : null}
      </>
    ) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="space-y-4 self-start p-5">
        <div className="flex items-center justify-between gap-2">
          <Button variant="icon" size="icon-sm" asChild title={uz.students.back} aria-label={uz.students.back}>
            <Link href="/students">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex items-center gap-1.5">
            {perms.edit ? (
              <Button
                variant="icon"
                size="icon-sm"
                title={uz.students.edit}
                aria-label={uz.students.edit}
                onClick={() => setFormOpen(true)}
              >
                <Pencil />
              </Button>
            ) : null}
            <StudentMenu
              student={s}
              perms={perms}
              showProfile={false}
              onEdit={() => setFormOpen(true)}
              onArchived={() => router.push("/students")}
              extra={menuExtra}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Avatar name={s.name} size={64} />
          <div className="min-w-0 space-y-1">
            <h1 className="type-heading text-title break-words text-foreground">{s.name}</h1>
            <div className="font-mono text-body font-semibold text-foreground">
              {displayPhone(s.phone) ?? uz.students.noData}
            </div>
            {s.parentPhone ? (
              <div className="font-mono text-caption text-muted-foreground">
                {displayPhone(s.parentPhone)} {uz.students.secondPhone}
              </div>
            ) : null}
            <div className="pt-0.5">
              <StatusBadge status={s.status} />
            </div>
          </div>
        </div>
        {s.statusNote ? <p className="text-caption text-muted-foreground">{s.statusNote}</p> : null}

        <dl className="divide-y divide-border-soft border-y border-border-soft text-body">
          <Line label={uz.students.branch}>{branch?.name ?? uz.students.notSet}</Line>
          <Line label={uz.students.joined}>{formatDate(s.joinedAt)}</Line>
        </dl>

        <button
          type="button"
          onClick={() => setMore((v) => !v)}
          aria-expanded={more}
          className="flex w-full items-center justify-between text-body font-semibold text-foreground"
        >
          {uz.students.more}
          <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", more && "rotate-180")} />
        </button>
        {more ? (
          <dl className="divide-y divide-border-soft text-body">
            <Line label={uz.students.gender}>
              {s.gender === "male" ? uz.students.male : s.gender === "female" ? uz.students.female : uz.students.notSet}
            </Line>
            {fields.map((f) => (
              <Line key={f.id} label={f.label}>
                {fieldText(f, s.customData[f.id], textLabels) ?? uz.students.notSet}
              </Line>
            ))}
            {/* Eski ustunlar (Excel importi yoki avvalgi forma) — faqat to'ldirilgani */}
            {legacy.map(([label, value]) => (
              <Line key={label} label={label}>
                {value}
              </Line>
            ))}
            {s.note ? (
              <div className="py-2.5">
                <dt className="text-muted-foreground">{uz.students.note}</dt>
                <dd className="mt-1 text-foreground">{s.note}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}

        <div className="mt-4 pt-4 border-t border-border-soft">
          <StudentLoginCard studentId={s.id} hasLogin={s.hasLogin} perms={perms} />
        </div>
      </Card>

      <div className="min-w-0 space-y-4">
        <StudentMoneyCards
          summary={finance?.summary ?? null}
          currentMonth={finance?.currentMonth ?? ""}
          coins={coins}
        />

        <Card className="min-w-0 space-y-5 p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="groups">{uz.students.tabGroups}</TabsTrigger>
              {grades ? <TabsTrigger value="grades">{uz.grades.studentTitle}</TabsTrigger> : null}
              {finance ? <TabsTrigger value="payments">{uz.students.tabPayments}</TabsTrigger> : null}
              {finance ? (
                <TabsTrigger value="discounts">
                  {uz.students.tabDiscounts}{" "}
                  {finance.discounts.length ? <Badge tone="neutral">{finance.discounts.length}</Badge> : null}
                </TabsTrigger>
              ) : null}
              <TabsTrigger value="notes">
                {uz.students.tabNotes} {notes.length ? <Badge tone="neutral">{notes.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="history">{uz.students.tabHistory}</TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === "groups" ? (
            <StudentGroupsTab
              studentId={s.id}
              studentName={s.name}
              memberships={memberships}
              groupOptions={groupOptions}
              perms={groupPerms}
            />
          ) : null}

          {tab === "grades" && grades ? <StudentGradesTab groups={grades} /> : null}

          {tab === "payments" && finance ? (
            <StudentFinanceTab
              summary={finance.summary}
              groups={finance.groups}
              entries={finance.entries}
              methods={finance.methods}
              perms={finance.perms}
              onPay={(groupId) => setPayFor(groupId)}
            />
          ) : null}

          {tab === "discounts" && finance ? (
            <StudentDiscountsTab
              studentId={s.id}
              discounts={finance.discounts}
              groups={finance.groups}
              perms={finance.perms}
            />
          ) : null}

          {tab === "notes" ? <NotesTab studentId={s.id} notes={notes} canWrite={perms.edit} /> : null}

          {tab === "history" ? <HistoryTab history={history} /> : null}
        </Card>
      </div>

      {perms.edit ? (
        <StudentForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={s}
          branches={branches}
          selectedBranch={selectedBranch}
          fields={fields}
          groups={groupChoices.filter((g) => !g.archived)}
          onSaved={() => router.refresh()}
        />
      ) : null}
      {finance ? (
        <>
          <PaymentDialog
            open={payFor !== undefined}
            onOpenChange={(o) => !o && setPayFor(undefined)}
            studentId={s.id}
            groupId={payFor ?? undefined}
            methods={finance.methods}
            maxDiscountPercent={finance.maxDiscountPercent}
          />
          <RefundDialog
            open={dialog === "refund"}
            onOpenChange={(o) => !o && setDialog(null)}
            studentId={s.id}
            available={Math.max(0, finance.summary.balance)}
            groups={finance.groups}
            methods={finance.methods}
          />
          <CorrectionDialog
            open={dialog === "correction"}
            onOpenChange={(o) => !o && setDialog(null)}
            studentId={s.id}
            balance={finance.summary.balance}
          />
        </>
      ) : null}
      {canTransfer ? (
        <TransferDialog
          student={s}
          branches={branches}
          openGroups={openGroups}
          open={dialog === "transfer"}
          onOpenChange={(o) => !o && setDialog(null)}
        />
      ) : null}
    </div>
  );
}

function HistoryTab({ history }: { history: HistoryRow[] }) {
  if (!history.length) return <EmptyState icon={<MessageSquareText />} title={uz.students.historyEmpty} />;
  return (
    <ol className="space-y-3">
      {history.map((h) => (
        <li key={h.id} className="flex gap-3">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
          <div className="min-w-0">
            <div className="text-body font-semibold text-foreground">
              {uz.students.history[h.action] ?? h.action}
              {h.action === "student.status" && typeof h.metadata.to === "string" ? (
                <>
                  {": "}
                  {uz.students.status[String(h.metadata.from)] ?? "—"} →{" "}
                  {uz.students.status[h.metadata.to] ?? h.metadata.to}
                </>
              ) : null}
            </div>
            <div className="text-caption text-muted-foreground">
              {dateTime(h.at)}
              {h.actor ? ` • ${uz.students.by(h.actor)}` : ""}
              {typeof h.metadata.reason === "string" ? ` • ${h.metadata.reason}` : ""}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function NotesTab({ studentId, notes, canWrite }: { studentId: string; notes: StudentNoteRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<(typeof NOTE_KINDS)[number]>("call");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<StudentNoteRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  function openNew() {
    setKind("call");
    setText("");
    setError(null);
    setOpen(true);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError(uz.students.noteRequired);
    startTransition(async () => {
      const res = await addStudentNoteAction({ studentId, kind, text });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.students.noteSaved });
      setOpen(false);
      router.refresh();
    });
  }

  async function remove(n: StudentNoteRow) {
    const res = await deleteStudentNoteAction(n.id);
    if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
    toast({ tone: "success", title: uz.students.noteDeleted });
    router.refresh();
  }

  return (
    <div className="space-y-section">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-body font-bold text-foreground">{uz.students.notesTitle(notes.length)}</div>
        {canWrite ? (
          <Button size="sm" onClick={openNew}>
            <Plus /> {uz.students.noteAdd}
          </Button>
        ) : null}
      </div>

      {notes.length ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-card border border-border-soft bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={n.kind === "warning" ? "warning" : "info"}>{uz.students.noteKinds[n.kind]}</Badge>
                  <span className="text-body font-semibold text-foreground">{n.author}</span>
                  <span className="text-caption text-muted-foreground">{dateTime(n.at)}</span>
                </div>
                {canWrite ? (
                  <Button
                    variant="icon"
                    size="icon-sm"
                    className="text-destructive-text"
                    title={uz.students.noteDelete}
                    aria-label={uz.students.noteDelete}
                    onClick={() => setToDelete(n)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              <p className="mt-3 text-base leading-relaxed whitespace-pre-wrap text-foreground">{n.text}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<MessageSquareText />} title={uz.students.notesEmpty} />
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        position="center"
        title={uz.students.noteNew}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="note-form" disabled={pending}>
              {uz.students.noteSave}
            </Button>
          </>
        }
      >
        <form id="note-form" onSubmit={save} className="space-y-4">
          <div>
            <Label>{uz.students.noteKind}</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={uz.students.noteKind}>
              {NOTE_KINDS.map((k) => (
                <Button
                  key={k}
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
            <Label htmlFor="note-text">{uz.students.noteText} *</Label>
            <Textarea
              id="note-text"
              rows={5}
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
        </form>
      </Modal>

      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={uz.students.noteDelete}
        message={uz.students.noteDeleteMessage}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="max-w-52 truncate text-right font-semibold text-foreground">{children}</dd>
    </div>
  );
}
