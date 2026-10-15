"use client";

import { Archive, Building2, Eye, MoreHorizontal, Pencil, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { statusReasonCategory, studentArchiveCategory } from "@/lib/reasons";
import { uz } from "@/lib/uz";
import { ReasonField, useReasonState } from "../reason-field";
import type { PickerBranch } from "../branch-picker";
import { archiveStudentAction, setStudentStatusAction, transferStudentAction } from "./actions";
import type { StudentRow } from "./data";

export type StudentStatus = StudentRow["status"];
export const STATUSES: StudentStatus[] = ["trial", "active", "paused", "left", "returned", "graduated"];

const TONE: Record<StudentStatus, "success" | "warning" | "danger" | "info" | "neutral"> = {
  active: "success",
  trial: "info",
  paused: "warning",
  left: "danger",
  returned: "info",
  graduated: "neutral",
};

export function StatusBadge({ status }: { status: StudentStatus }) {
  return (
    <Badge tone={TONE[status]} dot>
      {uz.students.status[status]}
    </Badge>
  );
}

export interface StudentPerms {
  create: boolean;
  edit: boolean;
  freeze: boolean;
  delete: boolean;
}

/** Holatni o'zgartirish (eski tizimdagi SetStudentStatusModal) */
function StatusModal({
  student,
  perms,
  open,
  onOpenChange,
}: {
  student: StudentRow;
  perms: StudentPerms;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<StudentStatus>(student.status);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setStatus(student.status);
      setReason(student.statusNote ?? "");
      setError(null);
    }
  }

  // Muzlatish va qaytarishda sabab markaz ro'yxatidan tanlanadi (ADR 0035)
  const reasonCategory = status === student.status ? null : statusReasonCategory(status);
  const reasonState = useReasonState(reasonCategory);

  // Muzlatishga va undan chiqarishga students.freeze kerak
  const allowed = (s: StudentStatus) =>
    s === student.status || (s === "paused" || student.status === "paused" ? perms.freeze : perms.edit);

  function save() {
    if (reasonState.active && !reason.trim()) return setError(uz.reasons.required);
    startTransition(async () => {
      const res = await setStudentStatusAction({ id: student.id, status, reason });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.students.statusSaved, description: student.name });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={uz.students.statusTitle(student.name)}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            {uz.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{uz.students.statusLabel}</Label>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as StudentStatus);
              setReason(v === student.status ? (student.statusNote ?? "") : "");
              setError(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.filter(allowed).map((s) => (
                <SelectItem key={s} value={s}>
                  {uz.students.status[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ReasonField
          id="status-reason"
          category={reasonCategory}
          value={reason}
          onChange={(v) => {
            setReason(v);
            setError(null);
          }}
          label={uz.students.statusReason}
          placeholder={uz.students.statusReasonPlaceholder}
        />
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}

/** O'chirish — arxivga, sababi bilan */
function ArchiveModal({
  student,
  open,
  onOpenChange,
  onArchived,
}: {
  student: StudentRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  // Sinovdagi va faol o'quvchi uchun sabablar alohida (ADR 0035)
  const reasonState = useReasonState(studentArchiveCategory(student.status));

  function archive() {
    if (reasonState.active && !reason.trim()) return setError(uz.reasons.required);
    startTransition(async () => {
      const res = await archiveStudentAction({ id: student.id, reason });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: uz.students.archived, description: student.name });
      onOpenChange(false);
      setReason("");
      if (onArchived) onArchived();
      else router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={uz.students.archiveTitle}
      description={uz.students.archiveMessage(student.name)}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button variant="danger" onClick={archive} disabled={pending}>
            <Archive /> {uz.students.archive}
          </Button>
        </>
      }
    >
      <ReasonField
        id="archive-reason"
        category={studentArchiveCategory(student.status)}
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        label={uz.students.archiveReason}
        placeholder={uz.students.archiveReasonPlaceholder}
      />
      {error ? <FieldHint error>{error}</FieldHint> : null}
    </Modal>
  );
}

/** Qator va profil uchun bitta menyu; `extra` — profildagi qo'shimcha amallar (to'lov, qaytarish, filial...) */
export function StudentMenu({
  student,
  perms,
  onEdit,
  showProfile = true,
  onArchived,
  extra,
}: {
  student: StudentRow;
  perms: StudentPerms;
  onEdit?: () => void;
  showProfile?: boolean;
  onArchived?: () => void;
  extra?: React.ReactNode;
}) {
  const router = useRouter();
  const [dialog, setDialog] = React.useState<"status" | "archive" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="subtle"
            size="icon-sm"
            title={uz.students.moreActions}
            aria-label={`${student.name} — ${uz.common.actions}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {showProfile ? (
            <DropdownMenuItem onSelect={() => router.push(`/students/${student.id}`)}>
              <Eye /> {uz.students.profile}
            </DropdownMenuItem>
          ) : null}
          {perms.edit && onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {uz.students.edit}
            </DropdownMenuItem>
          ) : null}
          {perms.edit || perms.freeze ? (
            <DropdownMenuItem onSelect={() => setDialog("status")}>
              <RefreshCw /> {uz.students.setStatus}
            </DropdownMenuItem>
          ) : null}
          {extra}
          {perms.delete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={() => setDialog("archive")}>
                <Archive /> {uz.students.archive}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <StatusModal
        student={student}
        perms={perms}
        open={dialog === "status"}
        onOpenChange={(o) => !o && setDialog(null)}
      />
      <ArchiveModal
        student={student}
        open={dialog === "archive"}
        onOpenChange={(o) => !o && setDialog(null)}
        onArchived={onArchived}
      />
    </>
  );
}

/** Boshqa filialga o'tkazish (eski tizimdagi "Boshqa filialga o'tkazish" oynasi) — ochiq a'zoliklar yopiladi */
export function TransferDialog({
  student,
  branches,
  openGroups,
  open,
  onOpenChange,
}: {
  student: StudentRow;
  branches: PickerBranch[];
  /** Hozirgi filialdagi ochiq a'zoliklar soni */
  openGroups: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [branchId, setBranchId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setBranchId("");
      setReason("");
      setError(null);
    }
  }
  const current = branches.find((b) => b.id === student.branchId);
  const targets = branches.filter((b) => b.id !== student.branchId);

  function save() {
    if (!branchId) return setError(uz.students.transferChoose);
    startTransition(async () => {
      const res = await transferStudentAction({ studentId: student.id, branchId, reason });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: uz.students.transferred, description: student.name });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      title={uz.students.transfer}
      description={current ? uz.students.transferCurrent(current.name) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            <Building2 /> {uz.students.transfer}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>{uz.students.transferBranch} *</Label>
          <Select
            value={branchId}
            onValueChange={(v) => {
              setBranchId(v);
              setError(null);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={uz.common.chooseBranch} />
            </SelectTrigger>
            <SelectContent>
              {targets.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="transfer-reason">{uz.students.statusReason}</Label>
          <Textarea
            id="transfer-reason"
            rows={2}
            maxLength={500}
            placeholder={uz.students.transferReasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Notice tone={openGroups ? "warning" : "info"}>
          {openGroups ? `${uz.students.transferGroups(openGroups)} ` : ""}
          {uz.students.transferHint}
        </Notice>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </div>
    </Modal>
  );
}
