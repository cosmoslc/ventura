"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { ActionResult } from "@/lib/server/action";
import { uz } from "@/lib/uz";

const t = uz.expenses;

/** Pul yozuvini bekor qilish (xarajat yoki qo'shimcha daromad): sabab majburiy, yozuv o'chmaydi */
export function VoidRecordDialog({
  target,
  title,
  successTitle,
  onClose,
  onVoid,
}: {
  /** null — yopiq; aks holda oyna tavsifi */
  target: { id: string; summary: string } | null;
  title: string;
  successTitle: string;
  onClose: () => void;
  onVoid: (input: { id: string; reason: string }) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = target?.id ?? null;
  if (key !== openedFor) {
    setOpenedFor(key);
    setReason("");
    setError(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;
    if (!reason.trim()) return setError(t.voidReasonRequired);
    startTransition(async () => {
      const res = await onVoid({ id: target.id, reason });
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onClose();
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: successTitle });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={!!target}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={title}
      description={target?.summary}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="void-record-form" disabled={pending}>
            <Check /> {t.void}
          </Button>
        </>
      }
    >
      <form id="void-record-form" onSubmit={submit} className="space-y-4">
        <Notice tone="warning">{t.voidText}</Notice>
        <div>
          <Label htmlFor="void-record-reason">{t.voidReason} *</Label>
          <Textarea
            id="void-record-reason"
            rows={2}
            autoFocus
            maxLength={500}
            placeholder={t.voidReasonPlaceholder}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error ? <Notice tone="danger">{error}</Notice> : null}
      </form>
    </Modal>
  );
}
