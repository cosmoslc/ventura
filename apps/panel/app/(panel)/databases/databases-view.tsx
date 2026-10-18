"use client";

import { AlertTriangle, Copy, Database, HardDrive, KeyRound, Plus, Server, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ServerLastAction } from "@ventura/db/schema/panel";
import { Badge, type BadgeProps } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatBytes, timeAgo } from "@/lib/format";
import { uz } from "@/lib/uz";
import { useAutoRefresh } from "../servers/use-auto-refresh";
import { type RevealResult, createDatabaseAction, dropDatabaseAction, revealDatabaseUrlAction } from "./actions";

const t = uz.databases;

export interface DbRow {
  name: string;
  /** shared — umumiy (bir nechta mijoz); project — loyihaning o'z bazasi; manual — paneldan yaratilgan; other — panel bilmaydi */
  kind: "shared" | "project" | "manual" | "other";
  projects: { id: string; name: string }[];
  sizeBytes: number;
  connections: number;
  /** Loyiha kutadi, serverda yo'q */
  missing: boolean;
  large: boolean;
}

export interface ServerBlock {
  id: string;
  name: string;
  host: string;
  online: boolean;
  metricsAt: string | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  /** `ventura-db list` ishlamadi (yordamchi eski) */
  listError: string | null;
  hasList: boolean;
  lastAction: ServerLastAction | null;
  rows: DbRow[];
}

const KIND_TONE: Record<DbRow["kind"], BadgeProps["tone"]> = {
  shared: "info",
  project: "success",
  manual: "neutral",
  other: "warning",
};

export function DatabasesView({
  servers,
  canCreate,
  canReveal,
  alertBytes,
}: {
  servers: ServerBlock[];
  canCreate: boolean;
  canReveal: boolean;
  alertBytes: number;
}) {
  useAutoRefresh(30_000);
  const [createOpen, setCreateOpen] = React.useState(false);
  const router = useRouter();
  const [reveal, setReveal] = React.useState<{ serverId: string; name: string } | null>(null);
  const [drop, setDrop] = React.useState<{ serverId: string; name: string } | null>(null);
  const all = servers.flatMap((s) => s.rows.filter((r) => !r.missing));
  const total = all.reduce((sum, r) => sum + r.sizeBytes, 0);
  const large = all.filter((r) => r.large).length;

  return (
    <div className="space-y-section">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          canCreate && servers.length ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus /> {t.create}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-grid sm:grid-cols-3">
        <StatCard icon={<Database />} tone={1} label={t.totalDbs} value={String(all.length)} />
        <StatCard icon={<HardDrive />} tone={2} label={t.totalSize} value={all.length ? formatBytes(total) : "—"} />
        <StatCard icon={<AlertTriangle />} tone={3} label={t.largeDbs(formatBytes(alertBytes))} value={String(large)} />
      </div>

      {servers.length ? (
        servers.map((s) => (
          <ServerSection
            key={s.id}
            server={s}
            canReveal={canReveal}
            onReveal={(name) => setReveal({ serverId: s.id, name })}
            onDrop={(name) => setDrop({ serverId: s.id, name })}
          />
        ))
      ) : (
        <Card>
          <EmptyState icon={<Server />} title={t.noServers} description={t.noServersHint} />
        </Card>
      )}

      {canCreate ? <CreateModal open={createOpen} onOpenChange={setCreateOpen} servers={servers} /> : null}
      <RevealModal target={reveal} onClose={() => setReveal(null)} />
      {canReveal ? (
        <ConfirmModal
          open={drop !== null}
          onOpenChange={(o) => !o && setDrop(null)}
          title={t.dropTitle}
          message={drop ? t.dropText(drop.name) : ""}
          confirmLabel={t.drop}
          requireText={drop?.name}
          onConfirm={async () => {
            if (!drop) return;
            const res = await dropDatabaseAction(drop, drop.name);
            if (!res.ok) return void toast({ tone: "danger", title: res.error });
            toast({ tone: "success", title: t.dropQueued, description: drop.name });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function ServerSection({
  server: s,
  canReveal,
  onReveal,
  onDrop,
}: {
  server: ServerBlock;
  canReveal: boolean;
  onReveal: (name: string) => void;
  onDrop: (name: string) => void;
}) {
  const disk =
    s.diskUsedGb != null && s.diskTotalGb
      ? t.disk(s.diskUsedGb, s.diskTotalGb, Math.round((s.diskUsedGb / s.diskTotalGb) * 100))
      : null;
  const action = s.lastAction;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-heading flex items-center gap-2 text-base">
            <Link href={`/servers/${s.id}`} className="hover:underline">
              {s.name}
            </Link>
            <Badge tone={s.online ? "success" : "neutral"} dot>
              {s.online ? t.online : t.offline}
            </Badge>
          </h2>
          <p className="mt-0.5 text-body text-muted-foreground">
            {[s.host, disk, s.metricsAt ? t.updated(timeAgo(s.metricsAt)) : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {action ? (
        <Notice tone={action.status === "error" ? "danger" : action.status === "ok" ? "success" : "info"}>
          {t.actionStatus(action.kind, action.database ?? "", action.status, action.message)}
        </Notice>
      ) : null}
      {!s.hasList ? (
        <Notice tone="warning">
          {t.noList}
          {s.listError ? <span className="mt-1 block font-mono text-caption">{s.listError}</span> : null}
        </Notice>
      ) : null}

      {s.rows.length ? (
        <TableWrap>
          <Table className="min-w-[760px]">
            <THead>
              <Tr>
                <Th>{t.colName}</Th>
                <Th>{t.colProjects}</Th>
                <Th className="text-right">{t.colSize}</Th>
                <Th className="text-right">{t.colConnections}</Th>
                {canReveal ? <Th className="text-right">{uz.common.actions}</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {s.rows.map((r) => (
                <Tr key={r.name}>
                  <Td>
                    {r.missing ? (
                      <div className="font-mono font-semibold text-foreground">{r.name}</div>
                    ) : (
                      <Link
                        href={`/databases/${s.id}/${r.name}`}
                        className="font-mono font-semibold text-foreground hover:underline"
                      >
                        {r.name}
                      </Link>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge tone={KIND_TONE[r.kind]}>{t.kinds[r.kind]}</Badge>
                      {r.missing ? <Badge tone="danger">{t.missing}</Badge> : null}
                    </div>
                  </Td>
                  <Td>
                    {r.projects.length ? (
                      <div className="flex max-w-80 flex-wrap gap-x-2 gap-y-1">
                        {r.projects.map((p) => (
                          <Link key={p.id} href={`/projects/${p.id}`} className="text-foreground hover:underline">
                            {p.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t.noProjects}</span>
                    )}
                    {r.projects.length > 1 ? (
                      <div className="text-caption text-muted-foreground">{t.projectsCount(r.projects.length)}</div>
                    ) : null}
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    {r.missing ? "—" : formatBytes(r.sizeBytes)}
                    {r.large ? (
                      <div>
                        <Badge tone="warning">{t.large}</Badge>
                      </div>
                    ) : null}
                  </Td>
                  <Td className="text-right">{r.missing ? "—" : r.connections}</Td>
                  {canReveal ? (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1.5">
                        {!r.missing && r.kind !== "other" ? (
                          <Button size="sm" variant="ghost" onClick={() => onReveal(r.name)}>
                            <KeyRound /> {t.reveal}
                          </Button>
                        ) : null}
                        {/* O'chirish (ADR 0058): mumkin bo'lmasa tugma o'chiq turadi va sababini aytadi */}
                        {r.missing ? (
                          <span className="text-caption text-muted-foreground" title={t.missingHint}>
                            {t.notDeployed}
                          </span>
                        ) : (
                          (() => {
                            const blocked = r.name.endsWith("_shared")
                              ? t.dropBlockedShared
                              : r.projects.length
                                ? t.dropBlockedUsed
                                : null;
                            return (
                              <span title={blocked ?? t.drop}>
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  disabled={!!blocked}
                                  aria-label={`${r.name} — ${blocked ?? t.drop}`}
                                  onClick={() => onDrop(r.name)}
                                >
                                  <Trash2 />
                                </Button>
                              </span>
                            );
                          })()
                        )}
                      </div>
                    </Td>
                  ) : null}
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableWrap>
      ) : s.hasList ? (
        <p className="text-body text-muted-foreground">{t.empty}</p>
      ) : null}
    </div>
  );
}

function CreateModal({
  open,
  onOpenChange,
  servers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servers: ServerBlock[];
}) {
  const router = useRouter();
  const [serverId, setServerId] = React.useState(servers[0]?.id ?? "");
  const [name, setName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createDatabaseAction({ serverId, name: name.trim() });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.createQueued, description: name.trim() });
      setName("");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.create}
      description={t.createDescription}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="db-create-form" disabled={pending || !serverId || !name.trim()}>
            {t.createSubmit}
          </Button>
        </>
      }
    >
      <form id="db-create-form" onSubmit={submit} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div>
          <Label htmlFor="db-server">{t.server}</Label>
          <Select value={serverId} onValueChange={setServerId}>
            <SelectTrigger id="db-server">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {servers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="db-name">{t.name}</Label>
          <Input
            id="db-name"
            className="font-mono"
            value={name}
            placeholder="analytics"
            maxLength={63}
            onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          />
          <FieldHint>{t.nameHint}</FieldHint>
        </div>
      </form>
    </Modal>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-caption" onFocus={(e) => e.currentTarget.select()} />
        <Button
          variant="ghost"
          size="icon"
          title={t.copy}
          aria-label={t.copy}
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => toast({ tone: "success", title: t.copied }));
          }}
        >
          <Copy />
        </Button>
      </div>
    </div>
  );
}

/**
 * Avval tasdiqlash (audit jurnaliga yoziladi), keyin manzil — yopilganda xotiradan o'chadi. ConfirmModal avval yopiladi,
 * keyin `onConfirm` ni chaqiradi — shuning uchun tasdiq oynasi holati alohida, `target` esa so'rov tugaguncha qoladi.
 */
function RevealModal({ target, onClose }: { target: { serverId: string; name: string } | null; onClose: () => void }) {
  const [result, setResult] = React.useState<Extract<RevealResult, { ok: true }> | null>(null);
  const [asking, setAsking] = React.useState(false);
  const [shownFor, setShownFor] = React.useState<typeof target>(null);
  const [, startTransition] = React.useTransition();
  if (target !== shownFor) {
    setShownFor(target);
    setResult(null);
    setAsking(target !== null);
  }

  function load() {
    if (!target) return;
    startTransition(async () => {
      const res = await revealDatabaseUrlAction(target);
      if (!res.ok) {
        toast({ tone: "danger", title: res.error });
        return onClose();
      }
      setResult(res);
    });
  }

  function close() {
    setResult(null);
    onClose();
  }

  return (
    <>
      <ConfirmModal
        open={asking}
        onOpenChange={setAsking}
        title={t.revealTitle}
        message={target ? t.revealText(target.name) : ""}
        confirmLabel={t.reveal}
        onConfirm={load}
      />
      <Modal
        open={result !== null}
        onOpenChange={(o) => !o && close()}
        title={target?.name ?? ""}
        description={t.revealDescription}
      >
        {result ? (
          <div className="space-y-4">
            <CopyRow label={t.urlServer} value={result.url} />
            <CopyRow label={t.tunnelCommand} value={result.tunnelCommand} />
            <CopyRow label={t.urlTunnel} value={result.tunnelUrl} />
            <FieldHint>{t.tunnelHint}</FieldHint>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
