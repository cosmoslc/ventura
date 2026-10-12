"use client";

import { Archive, Copy, Eye, KeyRound, Lock, MoreHorizontal, Pencil, Send, Unlock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { archiveStaffAction, resetStaffPasswordAction, resetStaffTelegramAction, setStaffLockAction } from "./actions";
import type { StaffRow } from "./data";

export interface StaffPerms {
  create: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
}

/** Vaqtinchalik parol — faqat bir marta ko'rsatiladi */
export function TempPasswordModal({ password, onClose }: { password: string | null; onClose: () => void }) {
  return (
    <Modal
      open={!!password}
      onOpenChange={(o) => !o && onClose()}
      position="center"
      title={uz.staff.tempPasswordTitle}
      description={uz.staff.tempPasswordHint}
      footer={<Button onClick={onClose}>{uz.staff.done}</Button>}
    >
      <div className="flex gap-2">
        <Input
          value={password ?? ""}
          readOnly
          className="font-mono text-lg tracking-wider"
          aria-label={uz.staff.tempPasswordTitle}
        />
        <Button
          variant="icon"
          size="icon"
          title={uz.staff.copy}
          aria-label={uz.staff.copy}
          onClick={() => {
            void navigator.clipboard.writeText(password ?? "");
            toast({ tone: "info", title: uz.staff.copied });
          }}
        >
          <Copy />
        </Button>
      </div>
    </Modal>
  );
}

type Confirm = "archive" | "lock" | "password" | "telegram";

/** Xodim amallari menyusi (ro'yxat qatori va batafsil sahifa uchun bitta) */
export function StaffMenu({
  row,
  perms,
  onEdit,
  showDetails = true,
  onArchived,
}: {
  row: StaffRow;
  perms: StaffPerms;
  onEdit?: () => void;
  showDetails?: boolean;
  onArchived?: () => void;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<Confirm | null>(null);
  const [password, setPassword] = React.useState<string | null>(null);
  const others = !row.self && row.manageable;

  const done = (res: { ok: true } | { ok: false; error: string }, title: string) => {
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title, description: row.name });
    router.refresh();
  };

  async function run(kind: Confirm) {
    if (kind === "archive") {
      const res = await archiveStaffAction(row.id);
      done(res, uz.staff.archived);
      if (res.ok) onArchived?.();
    } else if (kind === "lock") {
      done(await setStaffLockAction(row.id, true), uz.staff.lockedOk);
    } else if (kind === "telegram") {
      done(await resetStaffTelegramAction(row.id), uz.staff.telegramReset);
    } else {
      const res = await resetStaffPasswordAction(row.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      setPassword(res.password);
      router.refresh();
    }
  }

  const confirmText: Record<Confirm, { title: string; message: string; label: string }> = {
    archive: { title: uz.staff.archiveTitle, message: uz.staff.archiveMessage(row.name), label: uz.staff.archive },
    lock: { title: uz.staff.lock, message: uz.staff.lockMessage(row.name), label: uz.staff.lock },
    password: {
      title: uz.staff.resetPassword,
      message: uz.staff.resetPasswordMessage(row.name),
      label: uz.staff.resetPassword,
    },
    telegram: {
      title: uz.staff.resetTelegram,
      message: uz.staff.resetTelegramMessage(row.name),
      label: uz.staff.resetTelegram,
    },
  };

  const canEdit = perms.edit && row.manageable;
  const hasItems = showDetails || canEdit || (others && (perms.edit || perms.delete));
  if (!hasItems) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="subtle" size="icon-sm" aria-label={`${row.name} — ${uz.common.actions}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {showDetails ? (
            <DropdownMenuItem onSelect={() => router.push(`/staff/${row.id}`)}>
              <Eye /> {uz.staff.details}
            </DropdownMenuItem>
          ) : null}
          {canEdit && onEdit ? (
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> {uz.staff.edit}
            </DropdownMenuItem>
          ) : null}
          {others && perms.edit ? (
            <>
              <DropdownMenuSeparator />
              {row.locked ? (
                <DropdownMenuItem
                  onSelect={async () => done(await setStaffLockAction(row.id, false), uz.staff.unlockedOk)}
                >
                  <Unlock /> {uz.staff.unlock}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => setConfirm("lock")}>
                  <Lock /> {uz.staff.lock}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => setConfirm("password")}>
                <KeyRound /> {uz.staff.resetPassword}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setConfirm("telegram")}>
                <Send /> {uz.staff.resetTelegram}
              </DropdownMenuItem>
            </>
          ) : null}
          {others && perms.delete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={() => setConfirm("archive")}>
                <Archive /> {uz.staff.archive}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmModal
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? confirmText[confirm].title : ""}
        message={confirm ? confirmText[confirm].message : ""}
        confirmLabel={confirm ? confirmText[confirm].label : ""}
        cancelLabel={uz.common.cancel}
        onConfirm={() => confirm && void run(confirm)}
      />
      <TempPasswordModal password={password} onClose={() => setPassword(null)} />
    </>
  );
}

/** Ism ustiga bosilganda batafsil sahifa */
export function StaffLink({ row }: { row: StaffRow }) {
  return (
    <Link
      href={`/staff/${row.id}`}
      className="block truncate text-body font-bold text-foreground transition-colors hover:text-primary"
    >
      {row.name}
    </Link>
  );
}
