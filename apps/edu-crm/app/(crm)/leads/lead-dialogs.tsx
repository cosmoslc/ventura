"use client";

import {
  Archive,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  CalendarPlus,
  Eye,
  GraduationCap,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { SearchSelect } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { STAGE_COLORS, type StageDraft, stagesError } from "@/lib/leads";
import { uz } from "@/lib/uz";
import { ReasonField, useReasonState } from "../reason-field";
import { ReasonsModal } from "../reasons-modal";
import {
  archiveLeadAction,
  assignLeadsAction,
  cancelFirstLessonAction,
  convertLeadAction,
  deleteLeadStageAction,
  loseLeadAction,
  moveLeadAction,
  restoreLeadAction,
  saveLeadStagesAction,
  saveLostReasonsAction,
  scheduleFirstLessonAction,
} from "./actions";
import type { LeadGroupOption, LeadRow, StageRow, StaffOption } from "./data";
import type { LeadPerms } from "./perms";

const t = uz.leads;
const NONE = "__none";

/** Bosqich belgisi: rangli nuqta va nom */
export function StageBadge({ stage }: { stage: Pick<StageRow, "name" | "color"> | undefined }) {
  if (!stage) return <Badge tone="neutral">—</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-badge border border-border-soft px-2 py-0.5 text-caption font-semibold text-foreground">
      <span className="size-2 shrink-0 rounded-full" style={{ background: stage.color }} aria-hidden />
      {stage.name}
    </span>
  );
}

function useRun() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const run = (
    fn: () => Promise<{ ok: boolean; error?: string; pending?: true }>,
    okTitle: string,
    after?: () => void,
  ) =>
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error ?? uz.common.error });
      toast({ tone: "success", title: okTitle });
      after?.();
      router.refresh();
    });
  return { run, pending };
}

/** Bosqichni o'zgartirish — faqat ish bosqichlari (o'quvchiga aylantirish va yo'qotish — E4b) */
export function MoveDialog({
  lead,
  stages,
  onClose,
}: {
  lead: LeadRow | null;
  stages: StageRow[];
  onClose: () => void;
}) {
  const { run, pending } = useRun();
  const [stageId, setStageId] = React.useState("");
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((lead?.id ?? null) !== shownFor) {
    setShownFor(lead?.id ?? null);
    if (lead) setStageId(lead.stageId);
  }
  const open = stages.filter((s) => s.kind === "open");
  const target = open.find((s) => s.id === stageId);
  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={lead ? t.moveTitle(lead.name) : t.move}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button
            disabled={pending || !lead || stageId === lead.stageId}
            onClick={() =>
              lead && run(() => moveLeadAction({ id: lead.id, stageId }), t.moved(target?.name ?? ""), onClose)
            }
          >
            <ArrowRightLeft /> {t.move}
          </Button>
        </>
      }
    >
      <div className="grid gap-2">
        {open.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStageId(s.id)}
            aria-pressed={stageId === s.id}
            className="flex items-center gap-2.5 rounded-control border border-border-soft px-3 py-2.5 text-left text-body font-semibold text-foreground transition-colors hover:bg-accent aria-pressed:border-(--ring-border) aria-pressed:bg-primary-soft"
          >
            <span className="size-2.5 rounded-full" style={{ background: s.color }} aria-hidden />
            {s.name}
          </button>
        ))}
      </div>
    </Modal>
  );
}

/** Mas'ul xodim (bitta yoki tanlangan bir nechta lid) */
export function AssignDialog({
  ids,
  current,
  staff,
  onClose,
  onDone,
}: {
  ids: string[] | null;
  current: string | null;
  staff: StaffOption[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const { run, pending } = useRun();
  const [userId, setUserId] = React.useState(NONE);
  const key = ids?.join(",") ?? null;
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if (key !== shownFor) {
    setShownFor(key);
    if (key) setUserId(current ?? NONE);
  }
  return (
    <Modal
      open={ids !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={t.assignTitle}
      description={ids && ids.length > 1 ? t.selected(ids.length) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              ids &&
              run(
                () => assignLeadsAction({ ids, userId: userId === NONE ? null : userId }),
                t.assigned_ok,
                () => {
                  onClose();
                  onDone?.();
                },
              )
            }
          >
            <UserCheck /> {uz.common.save}
          </Button>
        </>
      }
    >
      <Label>{t.assigned}</Label>
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t.noStaff}</SelectItem>
          {staff.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Modal>
  );
}

/** O'chirish — arxivga, sababi bilan */
export function ArchiveDialog({
  lead,
  onClose,
  onArchived,
}: {
  lead: LeadRow | null;
  onClose: () => void;
  onArchived?: () => void;
}) {
  const { run, pending } = useRun();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  // Sabab markaz ro'yxatidan tanlanadi (ADR 0035); yoqgich o'chiq bo'lsa — ixtiyoriy matn
  const reasonState = useReasonState("lead_archive");
  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={t.archiveTitle}
      description={lead ? t.archiveMessage(lead.name) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!lead) return;
              if (reasonState.active && !reason.trim()) return setError(uz.reasons.required);
              run(
                () => archiveLeadAction({ id: lead.id, reason }),
                t.archived,
                () => {
                  setReason("");
                  setError(null);
                  onClose();
                  onArchived?.();
                },
              );
            }}
          >
            <Archive /> {t.archive}
          </Button>
        </>
      }
    >
      <ReasonField
        id="lead-archive-reason"
        category="lead_archive"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        label={t.archiveReason}
        placeholder={t.archiveReasonPlaceholder}
      />
      {error ? <FieldHint error>{error}</FieldHint> : null}
    </Modal>
  );
}

/**
 * Kartadagi, qatordagi va profildagi uch nuqta menyusi. Ish bosqichidagi lid uchun — bosqich, birinchi dars,
 * o'quvchiga aylantirish, yo'qotish; yo'qotilgan lid uchun — tiklash; qolganlari hammasi uchun.
 */
export function LeadMenu({
  lead,
  stageKind,
  perms,
  showOpen = true,
  onEdit,
  onMove,
  onAssign,
  onArchive,
  onConvert,
  onFirstLesson,
  onLose,
  onWaitlist,
}: {
  lead: LeadRow;
  stageKind: StageRow["kind"];
  perms: LeadPerms;
  showOpen?: boolean;
  onEdit: () => void;
  onMove?: () => void;
  onAssign: () => void;
  onArchive: () => void;
  onConvert?: () => void;
  onFirstLesson?: () => void;
  onLose?: () => void;
  onWaitlist?: () => void;
}) {
  const router = useRouter();
  const { run } = useRun();
  const open = stageKind === "open";
  const items = {
    move: open && perms.move && !!onMove,
    firstLesson: open && perms.edit && !!onFirstLesson,
    waitlist: open && perms.edit && !!onWaitlist,
    convert: open && perms.convert && !!onConvert,
    lose: open && perms.move && !!onLose,
    restore: stageKind === "lost" && perms.move,
  };
  const any = showOpen || Object.values(items).some(Boolean) || perms.edit || perms.reassign || perms.delete;
  if (!any) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          title={uz.common.actions}
          aria-label={`${lead.name} — ${uz.common.actions}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {showOpen ? (
          <DropdownMenuItem onSelect={() => router.push(`/leads/${lead.id}`)}>
            <Eye /> {t.open}
          </DropdownMenuItem>
        ) : null}
        {items.convert ? (
          <DropdownMenuItem onSelect={onConvert}>
            <GraduationCap /> {t.convert}
          </DropdownMenuItem>
        ) : null}
        {items.firstLesson ? (
          <DropdownMenuItem onSelect={onFirstLesson}>
            <CalendarPlus /> {t.firstLesson}
          </DropdownMenuItem>
        ) : null}
        {items.waitlist ? (
          <DropdownMenuItem onSelect={onWaitlist}>
            <ListPlus /> {t.waitlistAssign}
          </DropdownMenuItem>
        ) : null}
        {items.move ? (
          <DropdownMenuItem onSelect={onMove}>
            <ArrowRightLeft /> {t.move}
          </DropdownMenuItem>
        ) : null}
        {items.restore ? (
          <DropdownMenuItem onSelect={() => run(() => restoreLeadAction(lead.id), t.restored)}>
            <RotateCcw /> {t.restore}
          </DropdownMenuItem>
        ) : null}
        {perms.reassign ? (
          <DropdownMenuItem onSelect={onAssign}>
            <UserCheck /> {t.assign}
          </DropdownMenuItem>
        ) : null}
        {perms.edit ? (
          <DropdownMenuItem onSelect={onEdit}>
            <Pencil /> {t.edit}
          </DropdownMenuItem>
        ) : null}
        {items.lose || perms.delete ? <DropdownMenuSeparator /> : null}
        {items.lose ? (
          <DropdownMenuItem danger onSelect={onLose}>
            <UserX /> {t.lose}
          </DropdownMenuItem>
        ) : null}
        {perms.delete ? (
          <DropdownMenuItem danger onSelect={onArchive}>
            <Archive /> {t.archive}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Doska ustunlari: nom, rang, tartib; yangi ustun. Tizim bosqichlari ("O'quvchi bo'ldi", "Yo'qotildi") nomi va rangi
 * o'zgaradi, lekin o'chirilmaydi va tartibda oxirida turadi. Ustun o'chirilganda lidlari tanlangan ustunga o'tadi.
 */
export function StagesModal({
  open,
  onOpenChange,
  stages,
  counts,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: StageRow[];
  /** Ustundagi (arxivda bo'lmagan) lidlar soni */
  counts: Record<string, number>;
}) {
  const router = useRouter();
  const [list, setList] = React.useState<StageDraft[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<StageRow | null>(null);
  const [moveTo, setMoveTo] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setList(stages.map((s) => ({ id: s.id, name: s.name, color: s.color, kind: s.kind })));
      setError(null);
    }
  }
  const openStages = list.filter((s) => s.kind === "open");
  const system = list.filter((s) => s.kind !== "open");
  const update = (i: number, patch: Partial<StageDraft>) => {
    setList((l) => {
      const opens = l.filter((s) => s.kind === "open");
      opens[i] = { ...opens[i]!, ...patch };
      return [...opens, ...l.filter((s) => s.kind !== "open")];
    });
    setError(null);
  };
  const updateSystem = (id: string | undefined, patch: Partial<StageDraft>) =>
    setList((l) => l.map((s) => (s.id === id && s.kind !== "open" ? { ...s, ...patch } : s)));
  const moveRow = (i: number, d: -1 | 1) =>
    setList((l) => {
      const opens = l.filter((s) => s.kind === "open");
      const j = i + d;
      if (j < 0 || j >= opens.length) return l;
      [opens[i], opens[j]] = [opens[j]!, opens[i]!];
      return [...opens, ...l.filter((s) => s.kind !== "open")];
    });

  function save() {
    const err = stagesError(list);
    if (err) return setError(uz.leads.stagesErrors[err] ?? uz.common.invalid);
    startTransition(async () => {
      const res = await saveLeadStagesAction(list);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.stagesSaved });
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    const s = deleting;
    if (!s) return;
    startTransition(async () => {
      const res = await deleteLeadStageAction({ id: s.id, moveTo });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.stageDeleted });
      setDeleting(null);
      setList((l) => l.filter((x) => x.id !== s.id));
      router.refresh();
    });
  }

  const row = (s: StageDraft, i: number | null) => (
    <li
      key={s.id ?? `new-${i}`}
      className="flex flex-wrap items-center gap-2 rounded-control border border-border-soft px-3 py-2.5"
    >
      <span className="size-3 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden />
      <Input
        aria-label={t.stageName}
        className="h-9 min-w-40 flex-1"
        value={s.name}
        maxLength={60}
        onChange={(e) =>
          i === null ? updateSystem(s.id, { name: e.target.value }) : update(i, { name: e.target.value })
        }
      />
      <ColorSwatches
        value={s.color}
        onChange={(c) => (i === null ? updateSystem(s.id, { color: c }) : update(i, { color: c }))}
        options={STAGE_COLORS.map((c) => ({ value: c, label: c }))}
      />
      {i === null ? (
        <Badge tone="neutral">{t.stageSystem}</Badge>
      ) : (
        <div className="flex gap-1">
          <Button variant="icon" size="icon-sm" title={t.stageUp} aria-label={t.stageUp} onClick={() => moveRow(i, -1)}>
            <ArrowUp />
          </Button>
          <Button
            variant="icon"
            size="icon-sm"
            title={t.stageDown}
            aria-label={t.stageDown}
            onClick={() => moveRow(i, 1)}
          >
            <ArrowDown />
          </Button>
          <Button
            variant="icon"
            size="icon-sm"
            className="text-destructive-text"
            title={t.stageDelete}
            aria-label={t.stageDelete}
            disabled={openStages.length < 2}
            onClick={() => {
              if (!s.id) return setList((l) => l.filter((x) => x !== s));
              const st = stages.find((x) => x.id === s.id);
              if (!st) return;
              setMoveTo(stages.find((x) => x.kind === "open" && x.id !== st.id)?.id ?? "");
              setDeleting(st);
            }}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </li>
  );

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        position="center"
        wide
        title={t.stagesTitle}
        description={t.stagesIntro}
        footer={
          <>
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() =>
                setList((l) => [
                  ...l.filter((s) => s.kind === "open"),
                  {
                    name: t.stageNew,
                    color: STAGE_COLORS[openStages.length % STAGE_COLORS.length]!,
                    kind: "open",
                  },
                  ...l.filter((s) => s.kind !== "open"),
                ])
              }
            >
              <Plus /> {t.stageAdd}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {uz.common.cancel}
            </Button>
            <Button onClick={save} disabled={pending}>
              {uz.common.save}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <ul className="space-y-2">{openStages.map((s, i) => row(s, i))}</ul>
          <ul className="space-y-2">{system.map((s) => row(s, null))}</ul>
          {error ? <FieldHint error>{error}</FieldHint> : null}
        </div>
      </Modal>

      <Modal
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        position="center"
        title={deleting ? t.stageDeleteTitle(deleting.name) : t.stageDelete}
        description={
          deleting ? (counts[deleting.id] ? t.stageDeleteMove(counts[deleting.id]!) : t.stageDeleteEmpty) : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {uz.common.cancel}
            </Button>
            <Button variant="danger" disabled={pending || !moveTo} onClick={remove}>
              <Trash2 /> {t.stageDelete}
            </Button>
          </>
        }
      >
        <Label>{t.stage}</Label>
        <Select value={moveTo} onValueChange={setMoveTo}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={t.choose} />
          </SelectTrigger>
          <SelectContent>
            {stages
              .filter((s) => s.kind === "open" && s.id !== deleting?.id)
              .map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </Modal>
    </>
  );
}

/* ---------- E4b ---------- */

/** O'quvchiga aylantirish: faqat guruh (ixtiyoriy, lid filialidagi); shu telefonli o'quvchi bo'lsa — bog'lanadi */
export function ConvertDialog({
  lead,
  groups,
  existingStudent,
  onClose,
}: {
  lead: LeadRow | null;
  groups: LeadGroupOption[];
  /** Shu telefonli o'quvchi (sahifa bilmasa — null) */
  existingStudent?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [groupId, setGroupId] = React.useState<string[]>([]);
  const [pending, startTransition] = React.useTransition();
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((lead?.id ?? null) !== shownFor) {
    setShownFor(lead?.id ?? null);
    if (lead) {
      setGroupId(lead.firstLesson ? [lead.firstLesson.groupId] : []);
    }
  }
  const options = lead ? groups.filter((g) => g.branchId === lead.branchId) : [];

  function submit() {
    if (!lead) return;
    startTransition(async () => {
      const res = await convertLeadAction({ leadId: lead.id, groupId: groupId[0] ?? null });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: res.existing ? t.convertedLinked : t.converted, description: lead.name });
      onClose();
      router.push(`/students/${res.studentId}`);
    });
  }

  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={lead ? t.convertTitle(lead.name) : t.convert}
      description={t.convertIntro}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button onClick={submit} disabled={pending}>
            <GraduationCap /> {t.convert}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {existingStudent ? <Notice tone="info">{t.convertExisting(existingStudent)}</Notice> : null}
        <div>
          <Label>{t.convertGroup}</Label>
          <SearchSelect
            options={options}
            value={groupId}
            onChange={setGroupId}
            placeholder={uz.staff.chooseGroup}
            searchPlaceholder={uz.staff.searchGroup}
            emptyText={uz.common.nothingFound}
          />
        </div>
      </div>
    </Modal>
  );
}

/** Birinchi (sinov) darsga yozish, ko'chirish yoki bekor qilish */
export function FirstLessonDialog({
  lead,
  groups,
  today,
  onClose,
}: {
  lead: LeadRow | null;
  groups: LeadGroupOption[];
  today: string;
  onClose: () => void;
}) {
  const { run, pending } = useRun();
  const [groupId, setGroupId] = React.useState<string[]>([]);
  const [date, setDate] = React.useState(today);
  const [error, setError] = React.useState<string | null>(null);
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((lead?.id ?? null) !== shownFor) {
    setShownFor(lead?.id ?? null);
    if (lead) {
      setGroupId(lead.firstLesson ? [lead.firstLesson.groupId] : []);
      setDate(lead.firstLesson?.date ?? today);
      setError(null);
    }
  }
  const options = lead ? groups.filter((g) => g.branchId === lead.branchId) : [];

  function save() {
    if (!lead) return;
    if (!groupId[0]) return setError(t.firstLessonGroupRequired);
    if (!date) return setError(t.firstLessonDateRequired);
    run(() => scheduleFirstLessonAction({ leadId: lead.id, groupId: groupId[0], date }), t.firstLessonSaved, onClose);
  }

  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={lead ? t.firstLessonTitle(lead.name) : t.firstLesson}
      description={t.firstLessonIntro}
      footer={
        <>
          {lead?.firstLesson ? (
            <Button
              variant="ghost"
              className="mr-auto text-destructive-text"
              disabled={pending}
              onClick={() => lead && run(() => cancelFirstLessonAction(lead.id), t.firstLessonCanceled, onClose)}
            >
              <Trash2 /> {t.firstLessonCancel}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            <CalendarPlus /> {t.firstLessonSave}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{t.firstLessonGroup} *</Label>
          <SearchSelect
            options={options}
            value={groupId}
            onChange={(v) => {
              setGroupId(v);
              setError(null);
            }}
            placeholder={uz.staff.chooseGroup}
            searchPlaceholder={uz.staff.searchGroup}
            emptyText={uz.common.nothingFound}
          />
        </div>
        <div>
          <Label htmlFor="first-lesson-date">{t.firstLessonDate} *</Label>
          <Input
            id="first-lesson-date"
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

/** Yo'qotildi — sababi (sozlamadagi ro'yxatdan) va izoh */
export function LoseDialog({
  lead,
  reasons,
  onClose,
}: {
  lead: LeadRow | null;
  reasons: string[];
  onClose: () => void;
}) {
  const { run, pending } = useRun();
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((lead?.id ?? null) !== shownFor) {
    setShownFor(lead?.id ?? null);
    setReason("");
    setNote("");
    setError(null);
  }
  return (
    <Modal
      open={lead !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={lead ? t.loseTitle(lead.name) : t.lose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              if (!lead) return;
              if (!reason) return setError(t.loseReasonRequired);
              run(() => loseLeadAction({ id: lead.id, reason, note }), t.lost_ok, onClose);
            }}
          >
            <UserX /> {t.lose}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{t.loseReason} *</Label>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t.loseReason}>
            {reasons.map((r) => (
              <Button
                key={r}
                size="sm"
                role="radio"
                aria-checked={reason === r}
                variant={reason === r ? "primary" : "ghost"}
                onClick={() => {
                  setReason(r);
                  setError(null);
                }}
              >
                {r}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="lose-note">{t.loseNote}</Label>
          <Textarea
            id="lose-note"
            rows={2}
            maxLength={500}
            placeholder={t.loseNotePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

/** Yo'qotish sabablari ro'yxati: qo'shish va o'chirish */
export function LostReasonsModal({
  open,
  onOpenChange,
  reasons,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: string[];
}) {
  return (
    <ReasonsModal
      open={open}
      onOpenChange={onOpenChange}
      reasons={reasons}
      save={saveLostReasonsAction}
      text={{
        title: t.lostReasonsTitle,
        intro: t.lostReasonsIntro,
        add: t.lostReasonAdd,
        placeholder: t.lostReasonPlaceholder,
        saved: t.lostReasonsSaved,
      }}
    />
  );
}
