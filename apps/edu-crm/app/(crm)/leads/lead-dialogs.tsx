"use client";

import {
  Archive,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  UserCheck,
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { STAGE_COLORS, type StageDraft, stagesError } from "@/lib/leads";
import { uz } from "@/lib/uz";
import {
  archiveLeadAction,
  assignLeadsAction,
  deleteLeadStageAction,
  moveLeadAction,
  saveLeadStagesAction,
} from "./actions";
import type { LeadRow, StageRow, StaffOption } from "./data";
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
            onClick={() =>
              lead &&
              run(
                () => archiveLeadAction({ id: lead.id, reason }),
                t.archived,
                () => {
                  setReason("");
                  onClose();
                  onArchived?.();
                },
              )
            }
          >
            <Archive /> {t.archive}
          </Button>
        </>
      }
    >
      <Label htmlFor="lead-archive-reason">{t.archiveReason}</Label>
      <Textarea
        id="lead-archive-reason"
        rows={3}
        maxLength={500}
        placeholder={t.archiveReasonPlaceholder}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}

/** Kartadagi, qatordagi va profildagi uch nuqta menyusi */
export function LeadMenu({
  lead,
  perms,
  showOpen = true,
  onEdit,
  onMove,
  onAssign,
  onArchive,
}: {
  lead: LeadRow;
  perms: LeadPerms;
  showOpen?: boolean;
  onEdit: () => void;
  onMove: () => void;
  onAssign: () => void;
  onArchive: () => void;
}) {
  const router = useRouter();
  if (!showOpen && !perms.edit && !perms.move && !perms.reassign && !perms.delete) return null;
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
      <DropdownMenuContent align="end" className="w-56">
        {showOpen ? (
          <DropdownMenuItem onSelect={() => router.push(`/leads/${lead.id}`)}>
            <Eye /> {t.open}
          </DropdownMenuItem>
        ) : null}
        {perms.move ? (
          <DropdownMenuItem onSelect={onMove}>
            <ArrowRightLeft /> {t.move}
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
        {perms.delete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem danger onSelect={onArchive}>
              <Archive /> {t.archive}
            </DropdownMenuItem>
          </>
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
