"use client";

import { Check, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { toast } from "@ventura/ui/toast";
import { displayPhone, money, signedMoney } from "@/lib/format";
import { uz } from "@/lib/uz";
import { type LeavePreview, leavePreviewAction } from "../payments/account-actions";
import { activateMembershipAction, enrollStudentAction, leaveMembershipAction, leaveStudentsAction } from "./actions";
import { LeaveReasonFields } from "./leave-reason-fields";

function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface MembershipTarget {
  id: string;
  studentName: string;
  groupName: string;
  enrolledAt: string;
}

/** Sinovdagi a'zolikni faollashtirish — sana bilan (to'lov shu kundan, E3) */
export function ActivateDialog({
  target,
  onOpenChange,
}: {
  target: MembershipTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [date, setDate] = React.useState(todayLocal());
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  if ((target?.id ?? null) !== openedFor) {
    setOpenedFor(target?.id ?? null);
    setDate(todayLocal());
    setError(null);
  }

  function save() {
    if (!target) return;
    startTransition(async () => {
      const res = await activateMembershipAction({ id: target.id, date });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: uz.groups.activated,
        description: `${target.studentName} · ${target.groupName}`,
      });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={target !== null}
      onOpenChange={onOpenChange}
      position="center"
      title={uz.groups.activateTitle}
      description={target ? `${target.studentName} · ${target.groupName}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending || !date}>
            <Check /> {uz.groups.activate}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Label htmlFor="activate-date">{uz.groups.activateDate}</Label>
        <Input
          id="activate-date"
          type="date"
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setError(null);
          }}
        />
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => setDate(`${todayLocal().slice(0, 7)}-01`)}>
            {uz.groups.monthStart}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDate(todayLocal())}>
            {uz.groups.today}
          </Button>
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

/** Guruhdan chiqarish — sana va sabab bilan; davr yopiladi, tarix saqlanadi */
export function LeaveDialog({
  target,
  onOpenChange,
}: {
  target: MembershipTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [date, setDate] = React.useState(todayLocal());
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [preview, setPreview] = React.useState<LeavePreview | null>(null);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  if ((target?.id ?? null) !== openedFor) {
    setOpenedFor(target?.id ?? null);
    setDate(todayLocal());
    setReason("");
    setNote("");
    setError(null);
    setPreview(null);
  }

  // Moliya: shu sana bilan chiqarilsa balans qanday bo'ladi (oy hisobi chiqqan kungacha qayta hisoblanadi)
  const targetId = target?.id ?? null;
  React.useEffect(() => {
    if (!targetId || !date) return;
    let alive = true;
    void leavePreviewAction({ id: targetId, date }).then((res) => {
      if (alive) setPreview(res.ok ? res.preview : null);
    });
    return () => {
      alive = false;
    };
  }, [targetId, date]);

  function save() {
    if (!target) return;
    if (!reason) return setError(uz.groups.removeReasonRequired);
    startTransition(async () => {
      const res = await leaveMembershipAction({ id: target.id, date, reason, note });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.groups.removed, description: `${target.studentName} · ${target.groupName}` });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={target !== null}
      onOpenChange={onOpenChange}
      position="center"
      title={uz.groups.removeTitle}
      description={target ? uz.groups.removeMessage(target.studentName, target.groupName) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button variant="danger" onClick={save} disabled={pending || !date}>
            {uz.groups.remove}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="leave-date">{uz.groups.removeDate}</Label>
          <Input
            id="leave-date"
            type="date"
            value={date}
            min={target?.enrolledAt}
            onChange={(e) => {
              setDate(e.target.value);
              setError(null);
            }}
          />
        </div>
        <LeaveReasonFields
          id="leave"
          reason={reason}
          onReason={(v) => {
            setReason(v);
            setError(null);
          }}
          note={note}
          onNote={setNote}
        />
        {preview ? (
          <Notice tone={preview.after < 0 ? "warning" : "info"}>
            <div className="font-semibold">
              {uz.groups.leaveBalance(signedMoney(preview.before), `${signedMoney(preview.after)} ${uz.common.som}`)}
            </div>
            {preview.after > 0 ? <div>{uz.groups.leaveCredit(`${money(preview.after)} ${uz.common.som}`)}</div> : null}
            {preview.after < 0 ? <div>{uz.groups.leaveDebt(`${money(-preview.after)} ${uz.common.som}`)}</div> : null}
          </Notice>
        ) : null}
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

export interface PickOption {
  id: string;
  title: string;
  subtitle: string;
}

/**
 * Qidiruvli tanlov oynasi: guruhga mavjud o'quvchini qo'shish (guruh profili) yoki o'quvchini guruhga qo'shish
 * (o'quvchi profili). Har ikkisida a'zolik sinovda boshlanadi.
 */
export function EnrollDialog({
  open,
  onOpenChange,
  title,
  searchPlaceholder,
  emptyText,
  options,
  pair,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  searchPlaceholder: string;
  emptyText: string;
  options: PickOption[];
  /** Tanlangan id dan {groupId, studentId} */
  pair: (id: string) => { groupId: string; studentId: string };
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [picked, setPicked] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setPicked(null);
      setError(null);
    }
  }

  const q = query.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  const list = options
    .filter(
      (o) => !q || o.title.toLowerCase().includes(q) || (!!digits && o.subtitle.replace(/\D/g, "").includes(digits)),
    )
    .slice(0, q ? 30 : 15);

  function save() {
    if (!picked) return;
    startTransition(async () => {
      const res = await enrollStudentAction(pair(picked));
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.groups.added, description: options.find((o) => o.id === picked)?.title });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending || !picked}>
            {uz.groups.addButton}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input
          icon={<Search />}
          autoFocus
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {list.length ? (
          <ul className="max-h-80 space-y-1 overflow-y-auto" role="listbox" aria-label={title}>
            {list.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={picked === o.id}
                  onClick={() => {
                    setPicked(o.id);
                    setError(null);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-control px-3 py-2 text-left transition-colors",
                    picked === o.id ? "bg-primary-soft" : "hover:bg-muted",
                  )}
                >
                  <Avatar name={o.title} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body font-semibold text-foreground">{o.title}</span>
                    <span className="block truncate text-caption text-muted-foreground">{o.subtitle}</span>
                  </span>
                  {picked === o.id ? <Check className="size-4 text-primary" /> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-body text-muted-foreground">{emptyText}</p>
        )}
        <Notice tone="info">{uz.groups.addInfo}</Notice>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

export const phoneLabel = (p: string) => displayPhone(p) ?? "—";

/** Tanlangan bir nechta o'quvchini shu guruhdan chiqarish — bir sana va sabab bilan, bitta tranzaksiya */
export function BulkLeaveDialog({
  open,
  onOpenChange,
  groupId,
  studentIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string;
  studentIds: string[];
  onDone: () => void;
}) {
  const router = useRouter();
  const t = uz.groupProfile;
  const [date, setDate] = React.useState(todayLocal());
  const [reason, setReason] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setDate(todayLocal());
      setReason("");
      setNote("");
      setError(null);
    }
  }
  const n = studentIds.length;

  function save() {
    if (!reason) return setError(uz.groups.removeReasonRequired);
    startTransition(async () => {
      const res = await leaveStudentsAction({
        groupId,
        studentIds,
        date,
        reason,
        note,
        title: uz.students.bulkTitle(n),
      });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        onDone();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: t.bulkRemoved(res.done),
        description: res.skipped ? t.bulkSkipped(res.skipped) : undefined,
      });
      onOpenChange(false);
      onDone();
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={t.bulkRemoveTitle(n)}
      description={t.bulkRemoveHint}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button variant="danger" onClick={save} disabled={pending || !date || !n}>
            {t.bulkRemoveButton(n)}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="bulk-leave-date">{uz.groups.removeDate}</Label>
          <Input id="bulk-leave-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <LeaveReasonFields
          id="group-bulk-leave"
          reason={reason}
          onReason={(v) => {
            setReason(v);
            setError(null);
          }}
          note={note}
          onNote={setNote}
        />
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}
