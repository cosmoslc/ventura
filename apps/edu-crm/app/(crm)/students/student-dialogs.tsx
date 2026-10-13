"use client";

import { Archive, Eye, MoreHorizontal, Pencil, RefreshCw } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { archiveStudentAction, setStudentStatusAction } from "./actions";
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

  // Muzlatishga va undan chiqarishga students.freeze kerak
  const allowed = (s: StudentStatus) =>
    s === student.status || (s === "paused" || student.status === "paused" ? perms.freeze : perms.edit);

  function save() {
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
          <Select value={status} onValueChange={(v) => setStatus(v as StudentStatus)}>
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
        <div>
          <Label htmlFor="status-reason">{uz.students.statusReason}</Label>
          <Textarea
            id="status-reason"
            rows={3}
            maxLength={500}
            placeholder={uz.students.statusReasonPlaceholder}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
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
  const [pending, startTransition] = React.useTransition();

  function archive() {
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
      <Label htmlFor="archive-reason">{uz.students.archiveReason}</Label>
      <Textarea
        id="archive-reason"
        rows={3}
        maxLength={500}
        placeholder={uz.students.archiveReasonPlaceholder}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </Modal>
  );
}

/** Qator va profil uchun bitta menyu */
export function StudentMenu({
  student,
  perms,
  onEdit,
  showProfile = true,
  onArchived,
}: {
  student: StudentRow;
  perms: StudentPerms;
  onEdit?: () => void;
  showProfile?: boolean;
  onArchived?: () => void;
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
