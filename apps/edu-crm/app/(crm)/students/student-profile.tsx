"use client";

import { ArrowLeft, ChevronDown, Layers, MessageSquareText, Pencil, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { addStudentNoteAction, deleteStudentNoteAction } from "./actions";
import type { HistoryRow, StudentNoteRow, StudentRow } from "./data";
import { StatusBadge, StudentMenu, type StudentPerms } from "./student-dialogs";
import { StudentForm } from "./student-form";

type Tab = "groups" | "payments" | "notes" | "history";
const NOTE_KINDS = ["call", "message", "parent", "result", "note", "warning"] as const;

/** "2026-10-12T09:30:00Z" → "12.10.2026 • 14:30" (Toshkent vaqti) */
function dateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
  const time = d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
  return `${date} • ${time}`;
}

export function StudentProfile({
  student: s,
  notes,
  history,
  branches,
  selectedBranch,
  courses,
  perms,
}: {
  student: StudentRow;
  notes: StudentNoteRow[];
  history: HistoryRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  perms: StudentPerms;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("groups");
  const [more, setMore] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const branch = branches.find((b) => b.id === s.branchId);
  const course = courses.find((c) => c.id === s.interestedCourseId);
  const school = s.school ? (/^\d+$/.test(s.school) ? `${s.school}${uz.students.schoolSuffix}` : s.school) : null;

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
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={s.name} size={72} />
          <h1 className="type-heading text-title text-foreground">{s.name}</h1>
          <StatusBadge status={s.status} />
          <div className="font-mono text-body font-semibold text-foreground">
            {displayPhone(s.phone) ?? uz.students.noData}
          </div>
          {s.parentPhone ? (
            <div className="font-mono text-caption text-muted-foreground">
              {displayPhone(s.parentPhone)} {uz.students.secondPhone}
            </div>
          ) : null}
          {s.statusNote ? <p className="text-caption text-muted-foreground">{s.statusNote}</p> : null}
        </div>

        <dl className="divide-y divide-border-soft border-y border-border-soft text-body">
          <Line label={uz.students.birth}>{s.birthDate ? formatDate(s.birthDate) : uz.students.notAvailable}</Line>
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
            <Line label={uz.students.branch}>{branch?.name ?? uz.students.notSet}</Line>
            <Line label={uz.students.source}>{s.source ?? uz.students.notSet}</Line>
            <Line label={uz.students.interestedCourse}>{course?.name ?? uz.students.noData}</Line>
            <Line label={uz.students.parentName}>{s.parentName ?? uz.students.notSet}</Line>
            <Line label={uz.students.school}>{school ?? uz.students.notSet}</Line>
            <Line label={uz.students.grade}>{s.grade ?? uz.students.notSet}</Line>
            <Line label={uz.students.gender}>
              {s.gender === "male" ? uz.students.male : s.gender === "female" ? uz.students.female : uz.students.notSet}
            </Line>
            <Line label={uz.students.address}>{s.address ?? uz.students.notSet}</Line>
            {s.note ? (
              <div className="py-2.5">
                <dt className="text-muted-foreground">{uz.students.note}</dt>
                <dd className="mt-1 text-foreground">{s.note}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Card>

      <Card className="min-w-0 space-y-5 p-5">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="groups">{uz.students.tabGroups}</TabsTrigger>
            <TabsTrigger value="payments">{uz.students.tabPayments}</TabsTrigger>
            <TabsTrigger value="notes">
              {uz.students.tabNotes} {notes.length ? <Badge tone="neutral">{notes.length}</Badge> : null}
            </TabsTrigger>
            <TabsTrigger value="history">{uz.students.tabHistory}</TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "groups" ? (
          <div className="space-y-4">
            <div>
              <div className="text-body font-bold text-foreground">{uz.students.groupsTitle(s.groups.length)}</div>
              <div className="text-caption text-muted-foreground">{uz.students.groupsSubtitle}</div>
            </div>
            <EmptyState icon={<Layers />} title={uz.students.groupsEmpty} description={uz.students.groupsLater} />
          </div>
        ) : null}

        {tab === "payments" ? (
          <div className="space-y-4">
            <EmptyState icon={<Wallet />} title={uz.students.tabPayments} />
            <Notice tone="info">{uz.students.paymentsLater}</Notice>
          </div>
        ) : null}

        {tab === "notes" ? <NotesTab studentId={s.id} notes={notes} canWrite={perms.edit} /> : null}

        {tab === "history" ? (
          history.length ? (
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
          ) : (
            <EmptyState icon={<MessageSquareText />} title={uz.students.historyEmpty} />
          )
        ) : null}
      </Card>

      {perms.edit ? (
        <StudentForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={s}
          branches={branches}
          selectedBranch={selectedBranch}
          courses={courses}
          onSaved={() => router.refresh()}
        />
      ) : null}
    </div>
  );
}

function NotesTab({ studentId, notes, canWrite }: { studentId: string; notes: StudentNoteRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [kind, setKind] = React.useState<(typeof NOTE_KINDS)[number]>("call");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<StudentNoteRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError(uz.students.noteRequired);
    startTransition(async () => {
      const res = await addStudentNoteAction({ studentId, kind, text });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.students.noteSaved });
      setText("");
      router.refresh();
    });
  }

  async function remove(n: StudentNoteRow) {
    const res = await deleteStudentNoteAction(n.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: uz.students.noteDeleted });
    router.refresh();
  }

  return (
    <div className="space-y-5">
      {canWrite ? (
        <form onSubmit={save} className="space-y-3 rounded-card border border-border-soft p-4">
          <div className="text-body font-bold text-foreground">{uz.students.noteNew}</div>
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
              rows={3}
              maxLength={2000}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
            />
          </div>
          {error ? <FieldHint error>{error}</FieldHint> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {uz.students.noteSave}
            </Button>
          </div>
        </form>
      ) : null}

      <div>
        <div className="mb-3 text-body font-bold text-foreground">{uz.students.notesTitle(notes.length)}</div>
        {notes.length ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-control border border-border-soft p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-bold text-foreground">{n.author}</span>
                      <Badge tone={n.kind === "warning" ? "warning" : "info"}>{uz.students.noteKinds[n.kind]}</Badge>
                    </div>
                    <div className="text-caption text-muted-foreground">{dateTime(n.at)}</div>
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
                <p className="mt-2 text-body whitespace-pre-wrap text-foreground">{n.text}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">{uz.students.notesEmpty}</p>
        )}
      </div>

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
