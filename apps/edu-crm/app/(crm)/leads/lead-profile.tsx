"use client";

import { ArrowLeft, Check, MessageSquareText, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { EmptyState } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone, formatDate } from "@/lib/format";
import { type FormField, fieldText } from "@/lib/form-fields";
import { daysIn } from "@/lib/leads";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { addLeadNoteAction, deleteLeadNoteAction, moveLeadAction } from "./actions";
import type { LeadEventRow, LeadNoteRow, LeadRow, StageRow, StaffOption } from "./data";
import { ArchiveDialog, AssignDialog, LeadMenu, StageBadge } from "./lead-dialogs";
import { LeadForm } from "./lead-form";
import type { LeadPerms } from "./perms";

const t = uz.leads;
const NOTE_KINDS = ["call", "message", "meeting", "note"] as const;
type Tab = "notes" | "history";

function dateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ru-RU", { timeZone: "Asia/Tashkent" });
  const time = d.toLocaleTimeString("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });
  return `${date} • ${time}`;
}

/**
 * Lid profili (ADR 0022): chapda ma'lumotlar (qo'shimcha maydonlar bilan), o'ngda ish bosqichlari qatori — bosib
 * o'tkaziladi, tablar: izohlar (oynada yoziladi) va bosqichlar tarixi. Amallar — uch nuqta menyusida.
 */
export function LeadProfile({
  lead: l,
  stages,
  history,
  notes,
  courses,
  staff,
  fields,
  branches,
  selectedBranch,
  today,
  me,
  perms,
}: {
  lead: LeadRow;
  stages: StageRow[];
  history: LeadEventRow[];
  notes: LeadNoteRow[];
  courses: { id: string; name: string }[];
  staff: StaffOption[];
  fields: FormField[];
  branches: PickerBranch[];
  selectedBranch: string;
  today: string;
  me: string;
  perms: LeadPerms;
}) {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("notes");
  const [formOpen, setFormOpen] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);
  const [archiving, setArchiving] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const stage = stages.find((s) => s.id === l.stageId);
  const openStages = stages.filter((s) => s.kind === "open");
  const branch = branches.find((b) => b.id === l.branchId);
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "—";

  function move(stageId: string) {
    if (stageId === l.stageId || !perms.move || stage?.kind !== "open") return;
    startTransition(async () => {
      const res = await moveLeadAction({ id: l.id, stageId });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: t.moved(stageName(stageId)) });
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="space-y-4 self-start p-5">
        <div className="flex items-center justify-between gap-2">
          <Button variant="icon" size="icon-sm" asChild title={t.back} aria-label={t.back}>
            <Link href="/leads">
              <ArrowLeft />
            </Link>
          </Button>
          <div className="flex items-center gap-1.5">
            {perms.edit ? (
              <Button
                variant="icon"
                size="icon-sm"
                title={t.edit}
                aria-label={t.edit}
                onClick={() => setFormOpen(true)}
              >
                <Pencil />
              </Button>
            ) : null}
            <LeadMenu
              lead={l}
              perms={{ ...perms, move: false }}
              showOpen={false}
              onEdit={() => setFormOpen(true)}
              onMove={() => {}}
              onAssign={() => setAssigning(true)}
              onArchive={() => setArchiving(true)}
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Avatar name={l.name} size={56} />
          <div className="min-w-0 space-y-1">
            <h1 className="type-heading text-title break-words text-foreground">{l.name}</h1>
            <div className="font-mono text-body font-semibold text-foreground">{displayPhone(l.phone)}</div>
            {l.phone2 ? (
              <div className="font-mono text-caption text-muted-foreground">{displayPhone(l.phone2)}</div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <StageBadge stage={stage} />
              <span className="text-caption text-muted-foreground">
                {t.inStage(t.days(daysIn(l.stageChangedAt, today)))}
              </span>
            </div>
          </div>
        </div>

        <dl className="divide-y divide-border-soft border-y border-border-soft text-body">
          <Line label={t.source}>{l.source ?? "—"}</Line>
          <Line label={t.course}>{l.courseName ?? "—"}</Line>
          <Line label={t.assigned}>{l.assignedName ?? t.unassigned}</Line>
          <Line label={t.targetDate}>
            <span className={cn(l.targetDate && l.targetDate <= today && "text-(--warning-fg)")}>
              {l.targetDate ? formatDate(l.targetDate) : "—"}
            </span>
          </Line>
          <Line label={uz.common.branch}>{branch?.name ?? "—"}</Line>
          <Line label={t.createdAt}>{dateTime(l.createdAt)}</Line>
          {l.createdByName ? <Line label={t.createdBy}>{l.createdByName}</Line> : null}
          {fields.map((f) => (
            <Line key={f.id} label={f.label}>
              {fieldText(f, l.customData[f.id], { yes: uz.staff.yes, no: uz.staff.no, groupName: () => undefined }) ??
                "—"}
            </Line>
          ))}
        </dl>
        {l.note ? (
          <p className="rounded-control border border-border-soft bg-muted px-3 py-2.5 text-body whitespace-pre-wrap text-foreground">
            {l.note}
          </p>
        ) : null}
      </Card>

      <div className="min-w-0 space-y-4">
        {/* Ish bosqichlari: joriy bosqich ajratilgan, boshqasiga bosib o'tkaziladi */}
        <Card className="p-3">
          <ol className="flex flex-wrap gap-2" aria-label={t.stage}>
            {openStages.map((s) => {
              const current = s.id === l.stageId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={pending || current || !perms.move || stage?.kind !== "open"}
                    aria-current={current ? "step" : undefined}
                    onClick={() => move(s.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-control border px-3 py-2 text-body font-semibold transition-colors",
                      current
                        ? "text-foreground"
                        : "border-border-soft text-foreground enabled:hover:bg-accent disabled:opacity-70",
                    )}
                    style={
                      current
                        ? { borderColor: s.color, background: `color-mix(in oklab, ${s.color} 16%, transparent)` }
                        : undefined
                    }
                  >
                    {current ? (
                      <Check className="size-4" style={{ color: s.color }} />
                    ) : (
                      <span className="size-2 rounded-full" style={{ background: s.color }} />
                    )}
                    {s.name}
                  </button>
                </li>
              );
            })}
          </ol>
        </Card>

        <Card className="min-w-0 space-y-5 p-5">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <TabsList>
              <TabsTrigger value="notes">
                {t.tabNotes} {notes.length ? <Badge tone="neutral">{notes.length}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger value="history">{t.tabHistory}</TabsTrigger>
            </TabsList>
          </Tabs>
          {tab === "notes" ? <NotesTab leadId={l.id} notes={notes} canWrite={perms.notes} /> : null}
          {tab === "history" ? (
            history.length ? (
              <ol className="space-y-3">
                {history.map((h) => (
                  <li key={h.id} className="flex gap-3">
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full"
                      style={{ background: stages.find((s) => s.id === h.toStageId)?.color }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <div className="text-body font-semibold text-foreground">
                        {h.fromStageId
                          ? t.historyMoved(stageName(h.fromStageId), stageName(h.toStageId))
                          : t.historyCreated(stageName(h.toStageId))}
                      </div>
                      <div className="text-caption text-muted-foreground">
                        {dateTime(h.at)}
                        {h.actorName ? ` • ${t.by(h.actorName)}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <EmptyState icon={<MessageSquareText />} title={t.historyEmpty} />
            )
          ) : null}
        </Card>
      </div>

      {perms.edit ? (
        <LeadForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={l}
          branches={branches}
          selectedBranch={selectedBranch}
          courses={courses}
          staff={staff}
          fields={fields}
          me={me}
          canReassign={perms.reassign}
          onSaved={() => router.refresh()}
        />
      ) : null}
      <AssignDialog
        ids={assigning ? [l.id] : null}
        current={l.assignedTo}
        staff={staff}
        onClose={() => setAssigning(false)}
      />
      <ArchiveDialog
        lead={archiving ? l : null}
        onClose={() => setArchiving(false)}
        onArchived={() => router.push("/leads")}
      />
    </div>
  );
}

function NotesTab({ leadId, notes, canWrite }: { leadId: string; notes: LeadNoteRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<(typeof NOTE_KINDS)[number]>("call");
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [toDelete, setToDelete] = React.useState<LeadNoteRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError(t.noteRequired);
    startTransition(async () => {
      const res = await addLeadNoteAction({ leadId, kind, text });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.noteSaved });
      setOpen(false);
      router.refresh();
    });
  }

  async function remove(n: LeadNoteRow) {
    const res = await deleteLeadNoteAction(n.id);
    if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
    toast({ tone: "success", title: t.noteDeleted });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canWrite ? (
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => {
              setKind("call");
              setText("");
              setError(null);
              setOpen(true);
            }}
          >
            <Plus /> {t.noteAdd}
          </Button>
        </div>
      ) : null}
      {notes.length ? (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li key={n.id} className="rounded-card border border-border-soft bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <Badge tone={n.kind === "call" ? "success" : "info"}>{t.noteKinds[n.kind]}</Badge>
                  <span className="text-body font-semibold text-foreground">{n.author}</span>
                  <span className="text-caption text-muted-foreground">{dateTime(n.at)}</span>
                </div>
                {canWrite ? (
                  <Button
                    variant="icon"
                    size="icon-sm"
                    className="text-destructive-text"
                    title={t.noteDelete}
                    aria-label={t.noteDelete}
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
        <EmptyState icon={<MessageSquareText />} title={t.notesEmpty} />
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        position="center"
        title={t.noteTitle}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="lead-note-form" disabled={pending}>
              {t.noteSave}
            </Button>
          </>
        }
      >
        <form id="lead-note-form" onSubmit={save} className="space-y-4">
          <div>
            <Label>{t.noteKind}</Label>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.noteKind}>
              {NOTE_KINDS.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  role="radio"
                  aria-checked={kind === k}
                  variant={kind === k ? "primary" : "ghost"}
                  onClick={() => setKind(k)}
                >
                  {t.noteKinds[k]}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="lead-note-text">{t.noteText} *</Label>
            <Textarea
              id="lead-note-text"
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
        title={t.noteDelete}
        message={t.noteDeleteMessage}
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
