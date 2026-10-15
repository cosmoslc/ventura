"use client";

import { Archive } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { FieldHint } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { ReasonField, useReasonState } from "../reason-field";
import { archiveGroupAction } from "./actions";

/** Guruhni o'chirish (arxivga) — sabab markaz ro'yxatidan (ADR 0035); sabab a'zoliklarning chiqish sababi bo'ladi */
export function ArchiveGroupModal({
  group,
  onClose,
  onArchived,
}: {
  group: { id: string; name: string } | null;
  onClose: () => void;
  onArchived: () => void;
}) {
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const reasonState = useReasonState("group_archive");
  const [shownFor, setShownFor] = React.useState<string | null>(null);
  if ((group?.id ?? null) !== shownFor) {
    setShownFor(group?.id ?? null);
    setReason("");
    setError(null);
  }

  function archive() {
    if (!group) return;
    if (reasonState.active && !reason.trim()) return setError(uz.reasons.required);
    startTransition(async () => {
      const res = await archiveGroupAction({ id: group.id, reason });
      if (!res.ok) return void toast({ tone: res.pending ? "info" : "danger", title: res.error });
      toast({ tone: "success", title: uz.groups.archived, description: group.name });
      onClose();
      onArchived();
    });
  }

  return (
    <Modal
      open={group !== null}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={uz.groups.archiveTitle}
      description={group ? uz.groups.archiveMessage(group.name) : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button variant="danger" onClick={archive} disabled={pending}>
            <Archive /> {uz.common.confirmDelete}
          </Button>
        </>
      }
    >
      <ReasonField
        id="group-archive-reason"
        category="group_archive"
        value={reason}
        onChange={(v) => {
          setReason(v);
          setError(null);
        }}
        label={uz.groups.archiveReason}
        placeholder={uz.groups.archiveReasonPlaceholder}
      />
      {error ? <FieldHint error>{error}</FieldHint> : null}
    </Modal>
  );
}
