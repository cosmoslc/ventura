"use client";

import { Copy, Eye, EyeOff, KeyRound, Pencil, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { toast } from "@ventura/ui/toast";
import { PROJECT_SECRETS, type ProjectSecretKind, randomSecret } from "@/lib/project-secrets";
import { uz } from "@/lib/uz";
import { revealProjectSecretAction, saveProjectSecretAction } from "./secrets-actions";

const t = uz.projectSecrets;

/**
 * Loyiha sirlari (ADR 0059) — faqat super adminga ko'rinadi. Qiymat bosilganda ochiladi (audit), tahrir va tasodifiy
 * qiymat yaratish mumkin. Umumiy baza paroli loyihaga emas, serverga tegishli — Bazalar sahifasida.
 */
export function SecretsTab({
  projectId,
  present,
  sharedDb,
}: {
  projectId: string;
  /** Saqlangan sirlar nomlari (qiymatsiz) */
  present: string[];
  sharedDb: boolean;
}) {
  const [editing, setEditing] = React.useState<ProjectSecretKind | null>(null);
  const kinds = PROJECT_SECRETS.filter((k) => !(sharedDb && k.name === "db_password"));
  return (
    <div className="space-y-4">
      <Notice tone="info">{t.intro}</Notice>
      {sharedDb ? <p className="text-body text-muted-foreground">{t.sharedDbHint}</p> : null}
      <ul className="grid gap-2 md:grid-cols-2">
        {kinds.map((k) => (
          <SecretRow
            key={k.name}
            projectId={projectId}
            kind={k}
            saved={present.includes(k.name)}
            onEdit={() => setEditing(k)}
          />
        ))}
      </ul>
      <EditModal projectId={projectId} kind={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function SecretRow({
  projectId,
  kind,
  saved,
  onEdit,
}: {
  projectId: string;
  kind: ProjectSecretKind;
  saved: boolean;
  onEdit: () => void;
}) {
  const [value, setValue] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function reveal() {
    if (value !== null) return setValue(null);
    startTransition(async () => {
      const res = await revealProjectSecretAction(projectId, kind.name);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      setValue(res.value ?? "");
    });
  }

  return (
    <li className="rounded-card border border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-body font-semibold text-foreground">
            <KeyRound className="size-4 text-muted-foreground" aria-hidden />
            {t.labels[kind.name]}
            {kind.danger ? <Badge tone="warning">{t.danger}</Badge> : null}
            {!saved ? <Badge tone="neutral">{t.missing}</Badge> : null}
          </div>
          <div className="mt-0.5 text-caption text-muted-foreground">{t.hints[kind.name]}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          {saved ? (
            <Button
              size="icon-sm"
              variant="ghost"
              title={value === null ? t.show : t.hide}
              aria-label={value === null ? t.show : t.hide}
              disabled={pending}
              onClick={reveal}
            >
              {value === null ? <Eye /> : <EyeOff />}
            </Button>
          ) : null}
          <Button size="icon-sm" variant="ghost" title={uz.common.edit} aria-label={uz.common.edit} onClick={onEdit}>
            <Pencil />
          </Button>
        </div>
      </div>
      {value !== null ? (
        <div className="mt-2 flex gap-2">
          <Input readOnly value={value} className="font-mono text-caption" onFocus={(e) => e.currentTarget.select()} />
          <Button
            size="icon"
            variant="ghost"
            title={t.copy}
            aria-label={t.copy}
            onClick={() =>
              void navigator.clipboard.writeText(value).then(() => toast({ tone: "success", title: t.copied }))
            }
          >
            <Copy />
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function EditModal({
  projectId,
  kind,
  onClose,
}: {
  projectId: string;
  kind: ProjectSecretKind | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [confirm, setConfirm] = React.useState(false);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  if ((kind?.name ?? null) !== openedFor) {
    setOpenedFor(kind?.name ?? null);
    setValue("");
    setError(null);
  }

  function save() {
    if (!kind) return;
    startTransition(async () => {
      const res = await saveProjectSecretAction(projectId, kind.name, value);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.saved, description: t.deployHint });
      onClose();
      router.refresh();
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    if (!kind.pattern.test(value.trim())) return setError(t.invalid[kind.name] ?? t.invalidDefault);
    // Xavfli sir — avval ogohlantirish
    if (kind.danger) setConfirm(true);
    else save();
  }

  return (
    <>
      <Modal
        open={kind !== null}
        onOpenChange={(o) => !o && onClose()}
        title={kind ? t.editTitle(t.labels[kind.name] ?? kind.name) : ""}
        description={kind ? t.hints[kind.name] : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={onClose} disabled={pending}>
              {uz.common.cancel}
            </Button>
            <Button type="submit" form="secret-form" disabled={pending || !value.trim()}>
              {uz.common.save}
            </Button>
          </>
        }
      >
        <form id="secret-form" onSubmit={submit} className="space-y-4">
          {error ? <Notice tone="danger">{error}</Notice> : null}
          {kind?.danger ? <Notice tone="warning">{t.effects[kind.name]}</Notice> : null}
          <div>
            <div className="flex items-end justify-between gap-3">
              <Label htmlFor="secret-value">{t.newValue}</Label>
              {kind?.generate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-1.5"
                  onClick={() => setValue(randomSecret())}
                >
                  <RefreshCw /> {t.generate}
                </Button>
              ) : null}
            </div>
            <Input
              id="secret-value"
              className="font-mono"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
            />
            <FieldHint>{t.deployHint}</FieldHint>
          </div>
        </form>
      </Modal>
      <ConfirmModal
        open={confirm}
        onOpenChange={setConfirm}
        title={t.dangerTitle}
        message={kind ? t.effects[kind.name] : ""}
        confirmLabel={uz.common.save}
        onConfirm={save}
      />
    </>
  );
}
