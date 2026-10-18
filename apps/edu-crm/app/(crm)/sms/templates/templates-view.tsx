"use client";

import { MessageSquareText, MoreHorizontal, Pencil, Plus, RefreshCw, Send, Sparkles, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge, type BadgeProps } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import type { SmsModeration } from "@/lib/sms-text";
import type { SmsTemplateRow } from "@/lib/server/sms/templates";
import { uz } from "@/lib/uz";
import { SmsNav } from "../sms-nav";
import {
  addSmsPresetsAction,
  archiveSmsTemplateAction,
  submitSmsTemplateAction,
  syncSmsTemplatesAction,
} from "./actions";
import { TemplateForm } from "./template-form";

const t = uz.smsTemplates;

const TONE: Record<SmsModeration, BadgeProps["tone"]> = {
  draft: "neutral",
  moderation: "info",
  approved: "success",
  advert: "warning",
  rejected: "danger",
};

export function TemplatesView({
  rows,
  centerName,
  connected,
  canWrite,
}: {
  rows: SmsTemplateRow[];
  centerName: string;
  connected: boolean;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<SmsTemplateRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toArchive, setToArchive] = React.useState<SmsTemplateRow | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function openForm(row: SmsTemplateRow | null) {
    setEditing(row);
    setFormOpen(true);
  }

  function run<T extends object>(
    action: () => Promise<({ ok: true } & T) | { ok: false; error: string }>,
    done: (res: T) => string,
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: done(res) });
      router.refresh();
    });
  }

  const actions = canWrite ? (
    <>
      {connected && rows.some((r) => r.moderation !== "draft") ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => run(syncSmsTemplatesAction, (r) => t.synced(r.changed))}
        >
          <RefreshCw /> {t.sync}
        </Button>
      ) : null}
      <Button onClick={() => openForm(null)}>
        <Plus /> {t.add}
      </Button>
    </>
  ) : null;

  return (
    <div className="space-y-section">
      <PageHeader title={uz.sms.title} description={t.description} actions={actions} />
      <SmsNav />
      {!connected ? <p className="text-body text-muted-foreground">{uz.sms.notConnected}</p> : null}

      {rows.length ? (
        <div className="grid gap-grid md:grid-cols-2 xl:grid-cols-3">
          {rows.map((r) => (
            <TemplateCard
              key={r.id}
              row={r}
              canWrite={canWrite}
              canSubmit={connected && !pending}
              onEdit={() => openForm(r)}
              onSubmit={() =>
                run(
                  () => submitSmsTemplateAction(r.id),
                  () => t.submitted,
                )
              }
              onArchive={() => {
                setToArchive(r);
                setConfirmOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<MessageSquareText />}
            title={t.empty}
            description={t.emptyHint}
            action={
              canWrite ? (
                <Button disabled={pending} onClick={() => run(addSmsPresetsAction, (r) => t.presetsAdded(r.added))}>
                  <Sparkles /> {t.usePresets}
                </Button>
              ) : null
            }
          />
        </Card>
      )}

      {canWrite ? (
        <TemplateForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          centerName={centerName}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t.archiveTitle}
        message={toArchive ? t.archiveText(toArchive.name) : ""}
        confirmLabel={t.archive}
        onConfirm={() =>
          toArchive &&
          run(
            () => archiveSmsTemplateAction(toArchive.id),
            () => t.archived,
          )
        }
      />
    </div>
  );
}

function TemplateCard({
  row,
  canWrite,
  canSubmit,
  onEdit,
  onSubmit,
  onArchive,
}: {
  row: SmsTemplateRow;
  canWrite: boolean;
  canSubmit: boolean;
  onEdit: () => void;
  onSubmit: () => void;
  onArchive: () => void;
}) {
  const submittable = row.moderation === "draft" || row.moderation === "rejected";
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-body leading-snug font-bold text-foreground" title={row.name}>
            {row.name}
          </div>
          <div className="mt-0.5 truncate text-caption text-muted-foreground">
            {t.kinds[row.kind]} · {t.parts(row.parts)}
          </div>
        </div>
        {canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="subtle"
                size="icon-sm"
                className="-mt-1 -mr-1 shrink-0"
                title={uz.common.actions}
                aria-label={`${row.name} — ${uz.common.actions}`}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> {uz.common.edit}
              </DropdownMenuItem>
              {submittable ? (
                <DropdownMenuItem disabled={!canSubmit} onSelect={onSubmit}>
                  <Send /> {t.submit}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem danger onSelect={onArchive}>
                <Trash2 /> {t.archive}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <p className="mt-3 line-clamp-4 flex-1 text-body whitespace-pre-line text-foreground">{row.body}</p>
      <div className="mt-4 flex items-center gap-2 border-t border-border-soft pt-4">
        <Badge tone={TONE[row.moderation]} dot>
          {t.moderation[row.moderation]}
        </Badge>
        <span className="min-w-0 truncate text-caption text-muted-foreground">{t.moderationHint[row.moderation]}</span>
      </div>
    </Card>
  );
}
