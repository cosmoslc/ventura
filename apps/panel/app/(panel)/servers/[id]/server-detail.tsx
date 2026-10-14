"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Cpu,
  HardDrive,
  MemoryStick,
  Pencil,
  Play,
  Power,
  PowerOff,
  RefreshCw,
  RotateCw,
  Square,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ServerActionKind, ServerProcess } from "@ventura/db/schema/panel";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ventura/ui/card";
import { LineChart } from "@ventura/ui/line-chart";
import { Meter } from "@ventura/ui/meter";
import { ConfirmModal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatDateTime, formatDuration, formatMb, timeAgo } from "@/lib/format";
import type { ServerDetail } from "@/lib/server/servers-query";
import { uz } from "@/lib/uz";
import { deleteServerAction, serverJobAction, setupCommandAction } from "../actions";
import { EditServerForm } from "../edit-server-form";
import { ServerStateBadge } from "../status";
import { useAutoRefresh } from "../use-auto-refresh";

const PROCESS_TONE: Record<string, "success" | "danger" | "warning" | "neutral"> = {
  online: "success",
  stopped: "neutral",
  errored: "danger",
  launching: "warning",
};
const ACTION_TONE = { queued: "info", running: "info", ok: "success", error: "danger" } as const;
const timeFmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Tashkent", hour: "2-digit", minute: "2-digit" });

export function ServerDetailView({
  server: s,
  canManage,
  canOperate,
}: {
  server: ServerDetail;
  canManage: boolean;
  canOperate: boolean;
}) {
  const router = useRouter();
  const busy = s.lastAction?.status === "queued" || s.lastAction?.status === "running";
  // Buyruq bajarilayotganda tez-tez, aks holda har 15 soniyada yangilanadi
  useAutoRefresh(busy ? 2_000 : 15_000);
  const [pending, startTransition] = React.useTransition();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [toStop, setToStop] = React.useState<string | null>(null);
  const [powerOff, setPowerOff] = React.useState(false);
  // Uydagi WSL server paneldan yoqiladi va o'chiriladi (ADR 0025)
  const canPower = canManage && s.kind === "home" && !!s.wslDistro;
  const m = s.metrics;
  const neverOnline = !s.metricsAt;

  function run(kind: ServerActionKind, app?: string) {
    startTransition(async () => {
      const res = await serverJobAction(s.id, app ? { kind, app } : { kind });
      if (res.ok) {
        toast({ tone: "info", title: uz.servers.queued, description: uz.servers.actionKind[kind] });
        router.refresh();
      } else toast({ tone: "danger", title: res.error });
    });
  }

  async function remove() {
    const res = await deleteServerAction(s.id);
    if (res.ok) {
      toast({ tone: "success", title: uz.servers.deleted, description: s.name });
      router.push("/servers");
    } else toast({ tone: "danger", title: res.error });
  }

  return (
    <div className="space-y-6">
      <Link
        href="/servers"
        className="inline-flex items-center gap-1.5 text-body text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {uz.servers.back}
      </Link>
      <PageHeader
        title={s.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <ServerStateBadge state={s.state} />
            <Badge tone={s.kind === "online" ? "info" : "neutral"}>{uz.servers.kind[s.kind]}</Badge>
            <span className="font-mono">
              {s.sshUser}@{s.host}:{s.sshPort}
            </span>
            <span>· {s.metricsAt ? uz.servers.seen(timeAgo(s.metricsAt)) : uz.servers.neverSeen}</span>
          </span>
        }
        actions={
          <>
            {canOperate ? (
              <Button
                variant="ghost"
                onClick={() => run("check")}
                disabled={pending || busy}
                title={uz.servers.checkHint}
              >
                <RefreshCw className={busy && s.lastAction?.kind === "check" ? "animate-spin" : undefined} />{" "}
                {uz.servers.check}
              </Button>
            ) : null}
            {canPower && s.state !== "online" ? (
              <Button onClick={() => run("power_on")} disabled={pending || busy} title={uz.servers.powerOnHint}>
                <Power className={busy && s.lastAction?.kind === "power_on" ? "animate-pulse" : undefined} />{" "}
                {uz.servers.powerOn}
              </Button>
            ) : null}
            {canPower && s.state === "online" ? (
              <Button variant="ghost" onClick={() => setPowerOff(true)} disabled={pending || busy}>
                <PowerOff /> {uz.servers.powerOff}
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="ghost" onClick={() => setEditOpen(true)}>
                <Pencil /> {uz.servers.edit}
              </Button>
            ) : null}
            {canManage ? (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> {uz.servers.delete}
              </Button>
            ) : null}
          </>
        }
      />

      {s.note ? <p className="-mt-3 text-body whitespace-pre-line text-muted-foreground">{s.note}</p> : null}

      {s.lastAction ? (
        <Notice tone={ACTION_TONE[s.lastAction.status]}>
          <b>{uz.servers.lastAction}:</b> {uz.servers.actionKind[s.lastAction.kind]}
          {s.lastAction.app ? ` (${s.lastAction.app})` : ""} — {uz.servers.actionStatus[s.lastAction.status]}
          {s.lastAction.message ? `: ${s.lastAction.message}` : ""}
          <span className="opacity-75">
            {" "}
            · {s.lastAction.by ? `${s.lastAction.by}, ` : ""}
            {formatDateTime(s.lastAction.at)}
          </span>
        </Notice>
      ) : null}
      {s.state === "offline" && s.probeError ? <Notice tone="danger">{s.probeError}</Notice> : null}
      {s.lastError && s.status === "error" && !s.probeError && s.lastAction?.status !== "error" ? (
        <Notice tone="warning">{s.lastError}</Notice>
      ) : null}

      {canManage && (neverOnline || s.status !== "ready") ? <SetupCard server={s} /> : null}

      {m ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile icon={<Cpu />} title={uz.servers.cpu}>
            <Meter
              label={uz.servers.cores(m.cpus)}
              value={m.cpuPercent / 100}
              detail={`${uz.servers.load} ${m.load[0]}`}
            />
          </MetricTile>
          <MetricTile icon={<MemoryStick />} title={uz.servers.memory}>
            <Meter
              label={formatMb(m.memTotalMb)}
              value={m.memTotalMb ? m.memUsedMb / m.memTotalMb : 0}
              detail={formatMb(m.memUsedMb)}
            />
          </MetricTile>
          <MetricTile icon={<HardDrive />} title={uz.servers.disk}>
            <Meter
              label={`${m.diskTotalGb} GB`}
              value={m.diskTotalGb ? m.diskUsedGb / m.diskTotalGb : 0}
              detail={`${m.diskUsedGb} GB`}
              warnAt={0.75}
              dangerAt={0.85}
            />
          </MetricTile>
          <MetricTile icon={<Timer />} title={uz.servers.uptime}>
            <div className="type-stat text-foreground">{formatDuration(m.uptimeSec)}</div>
          </MetricTile>
        </div>
      ) : null}

      {s.history.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle>{uz.servers.chart}</CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              caption={uz.servers.chartCaption(s.name)}
              times={s.history.map((h) => h.at)}
              max={100}
              series={[
                { key: "cpu", label: uz.servers.cpu, color: "var(--chart-1)", values: s.history.map((h) => h.cpu) },
                { key: "mem", label: uz.servers.memory, color: "var(--chart-2)", values: s.history.map((h) => h.mem) },
              ]}
              formatValue={(v) => `${Math.round(v)}%`}
              formatTime={(t) => timeFmt.format(t)}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{uz.servers.processes}</CardTitle>
        </CardHeader>
        {m?.processes.length ? (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>{uz.servers.colApp}</Th>
                  <Th>{uz.servers.colStatus}</Th>
                  <Th className="text-right">{uz.servers.cpu}</Th>
                  <Th className="text-right">{uz.servers.memory}</Th>
                  <Th className="text-right">{uz.servers.colRestarts}</Th>
                  <Th>{uz.servers.colUptime}</Th>
                  {canOperate ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </Tr>
              </THead>
              <TBody>
                {m.processes.map((p) => (
                  <ProcessRow
                    key={p.name}
                    process={p}
                    observedAt={s.metricsAt ? new Date(s.metricsAt).getTime() : null}
                    managed={s.apps.includes(p.name)}
                    canOperate={canOperate}
                    canManage={canManage}
                    disabled={pending || busy}
                    onRun={(kind) => (kind === "stop" ? setToStop(p.name) : run(kind, p.name))}
                  />
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Square />} title={uz.servers.processesEmpty} />
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>{uz.servers.projectsTitle}</CardTitle>
          </CardHeader>
          {s.projectRows.length ? (
            <ul className="divide-y divide-border-soft">
              {s.projectRows.map((p) => (
                <li key={p.id}>
                  <Link href={`/projects/${p.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-foreground">{p.name}</span>
                      <span className="block truncate font-mono text-caption text-muted-foreground">
                        {p.domain ?? p.slug}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <CardContent>
              <p className="text-body text-muted-foreground">{uz.servers.projectsEmpty}</p>
            </CardContent>
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{uz.servers.software}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body">
              {(Object.keys(uz.servers.softwareLabels) as (keyof typeof uz.servers.softwareLabels)[]).map((k) => {
                const v = s.info[k];
                return (
                  <React.Fragment key={k}>
                    <dt className="text-muted-foreground">{uz.servers.softwareLabels[k]}</dt>
                    <dd className="flex items-center gap-1.5 font-mono text-foreground">
                      {v ? (
                        <Check className="size-3.5 text-(--success-fg)" />
                      ) : (
                        <X className="size-3.5 text-(--danger-fg)" />
                      )}
                      {v ?? uz.servers.missing}
                    </dd>
                  </React.Fragment>
                );
              })}
              <dt className="text-muted-foreground">{uz.servers.deployRoot}</dt>
              <dd className="truncate font-mono text-foreground">{s.deployRoot}</dd>
              <dt className="text-muted-foreground">{uz.servers.hostKey}</dt>
              <dd className="truncate font-mono text-caption text-foreground">{s.hostKey ?? "—"}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {canManage ? <EditServerForm server={s} open={editOpen} onOpenChange={setEditOpen} /> : null}
      <ConfirmModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={uz.servers.delete}
        message={uz.servers.deleteMessage(s.name)}
        confirmLabel={uz.common.delete}
        cancelLabel={uz.common.cancel}
        requireText={s.name}
        onConfirm={() => void remove()}
      />
      <ConfirmModal
        open={toStop !== null}
        onOpenChange={(o) => !o && setToStop(null)}
        title={uz.servers.stopTitle}
        message={toStop ? uz.servers.stopMessage(toStop) : ""}
        confirmLabel={uz.servers.stop}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toStop && run("stop", toStop)}
      />
      <ConfirmModal
        open={powerOff}
        onOpenChange={setPowerOff}
        title={uz.servers.powerOffTitle}
        message={uz.servers.powerOffMessage(s.name, s.projects)}
        confirmLabel={uz.servers.powerOff}
        cancelLabel={uz.common.cancel}
        onConfirm={() => run("power_off")}
      />
    </div>
  );
}

function MetricTile({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2 text-body font-semibold text-foreground [&_svg]:size-4 [&_svg]:text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </Card>
  );
}

function ProcessRow({
  process: p,
  observedAt,
  managed,
  canOperate,
  canManage,
  disabled,
  onRun,
}: {
  process: ServerProcess;
  /** Metrika olingan vaqt (ms): ishlash vaqti shunga nisbatan */
  observedAt: number | null;
  managed: boolean;
  canOperate: boolean;
  canManage: boolean;
  disabled: boolean;
  onRun: (kind: "reload" | "stop" | "start") => void;
}) {
  const online = p.status === "online";
  return (
    <Tr>
      <Td className="font-mono font-semibold text-foreground">{p.name}</Td>
      <Td>
        <Badge tone={PROCESS_TONE[p.status] ?? "neutral"} dot>
          {uz.servers.processStatus[p.status] ?? p.status}
        </Badge>
      </Td>
      <Td className="text-right font-mono">{p.cpu}%</Td>
      <Td className="text-right font-mono">{formatMb(p.memoryMb)}</Td>
      <Td className="text-right font-mono">{p.restarts}</Td>
      <Td className="font-mono text-muted-foreground">
        {online && p.startedAt && observedAt ? formatDuration(Math.max(0, (observedAt - p.startedAt) / 1000)) : "—"}
      </Td>
      {canOperate ? (
        <Td>
          {managed ? (
            <div className="flex justify-end gap-1.5">
              {online ? (
                <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onRun("reload")}>
                  <RotateCw /> {uz.servers.reload}
                </Button>
              ) : null}
              {canManage ? (
                online ? (
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onRun("stop")}>
                    <Square /> {uz.servers.stop}
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" disabled={disabled} onClick={() => onRun("start")}>
                    <Play /> {uz.servers.start}
                  </Button>
                )
              ) : null}
            </div>
          ) : null}
        </Td>
      ) : null}
    </Tr>
  );
}

/** Yangi yoki sozlanmagan server: bir martalik o'rnatish ko'rsatmasi va nusxalanadigan buyruq */
function SetupCard({ server: s }: { server: ServerDetail }) {
  const [copied, setCopied] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function copy() {
    startTransition(async () => {
      const res = await setupCommandAction(s.id);
      if (!res.ok) return toast({ tone: "danger", title: res.error });
      await navigator.clipboard.writeText(res.command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{uz.servers.setupTitle}</CardTitle>
          <CardDescription>{uz.servers.setupHint}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-3 pl-5 text-body text-foreground">
          <li>
            {uz.servers.setupStep1}{" "}
            <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-caption">
              ssh root@{s.host}
              {s.sshPort !== 22 ? ` -p ${s.sshPort}` : ""}
            </code>
          </li>
          <li className="space-y-2">
            <p>{uz.servers.setupStep2}</p>
            <Button onClick={copy} disabled={pending}>
              {copied ? <Check /> : <Copy />} {copied ? uz.servers.copied : uz.servers.copyCommand}
            </Button>
          </li>
          <li>{uz.servers.setupStep3}</li>
        </ol>
        <div>
          <div className="mb-1 text-caption font-semibold text-muted-foreground">{uz.servers.publicKey}</div>
          <code className="block rounded-control border border-border-soft bg-muted px-3 py-2 font-mono text-caption break-all text-foreground">
            {s.publicKey}
          </code>
        </div>
        <p className="text-caption text-muted-foreground">{uz.servers.firewall}</p>
      </CardContent>
    </Card>
  );
}
