"use client";

import { ArrowRight, Server, ServerCrash, ServerOff, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Meter } from "@ventura/ui/meter";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { formatDuration, formatMb, timeAgo } from "@/lib/format";
import type { ServerCard } from "@/lib/server/servers-query";
import { uz } from "@/lib/uz";
import { AddServerForm } from "./add-server-form";
import { ServerStateBadge } from "./status";
import { useAutoRefresh } from "./use-auto-refresh";

export function ServersView({ rows, canManage }: { rows: ServerCard[]; canManage: boolean }) {
  const [formOpen, setFormOpen] = React.useState(false);
  useAutoRefresh(30_000);

  const online = rows.filter((r) => r.state === "online").length;
  const offline = rows.filter((r) => r.state === "offline").length;
  const projects = rows.reduce((s, r) => s + r.projects, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={uz.servers.title}
        description={uz.servers.description}
        actions={
          canManage ? (
            <Button onClick={() => setFormOpen(true)}>
              <Plus /> {uz.servers.add}
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard tone={1} icon={<Server />} label={uz.servers.total} value={String(rows.length)} />
        <StatCard tone={2} icon={<Server />} label={uz.servers.online} value={String(online)} />
        <StatCard tone={3} icon={<ServerOff />} label={uz.servers.offline} value={String(offline)} />
        <StatCard tone={4} icon={<FolderKanban />} label={uz.servers.projects} value={String(projects)} />
      </div>

      {rows.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => (
            <ServerTile key={s.id} server={s} />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<ServerCrash />}
            title={uz.servers.empty}
            description={uz.servers.emptyHint}
            action={
              canManage ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> {uz.servers.add}
                </Button>
              ) : undefined
            }
          />
        </Card>
      )}

      {canManage ? <AddServerForm open={formOpen} onOpenChange={setFormOpen} /> : null}
    </div>
  );
}

function ServerTile({ server: s }: { server: ServerCard }) {
  const m = s.metrics;
  const running = m?.processes.filter((p) => p.status === "online").length ?? 0;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-stat-icon bg-muted text-muted-foreground [&_svg]:size-5">
          <Server />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-body font-bold text-foreground">{s.name}</span>
            <ServerStateBadge state={s.state} />
          </div>
          <div className="truncate font-mono text-caption text-muted-foreground">
            {s.sshUser}@{s.host}:{s.sshPort}
          </div>
        </div>
        <Badge tone={s.kind === "online" ? "info" : "neutral"}>{uz.servers.kind[s.kind]}</Badge>
      </div>

      {m ? (
        <div className="space-y-3">
          <Meter label={uz.servers.cpu} value={m.cpuPercent / 100} detail={uz.servers.cores(m.cpus)} />
          <Meter
            label={uz.servers.memory}
            value={m.memTotalMb ? m.memUsedMb / m.memTotalMb : 0}
            detail={`${formatMb(m.memUsedMb)} / ${formatMb(m.memTotalMb)}`}
          />
          <Meter
            label={uz.servers.disk}
            value={m.diskTotalGb ? m.diskUsedGb / m.diskTotalGb : 0}
            detail={`${m.diskUsedGb} / ${m.diskTotalGb} GB`}
            warnAt={0.75}
            dangerAt={0.85}
          />
        </div>
      ) : (
        <p className="rounded-control border border-dashed border-border px-4 py-3 text-body text-muted-foreground">
          {uz.servers.noMetrics}
        </p>
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <span>{s.capacity ? uz.servers.capacityOf(s.projects, s.capacity) : uz.servers.projectCount(s.projects)}</span>
        {m ? <span>{uz.servers.appsRunning(running, m.processes.length)}</span> : null}
        {m ? (
          <span>
            {uz.servers.uptime}: {formatDuration(m.uptimeSec)}
          </span>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-soft pt-3">
        <span className="min-w-0 truncate text-caption text-muted-foreground">
          {s.state === "offline" && s.probeError
            ? s.probeError
            : s.metricsAt
              ? uz.servers.seen(timeAgo(s.metricsAt))
              : uz.servers.neverSeen}
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/servers/${s.id}`}>
            {uz.servers.details} <ArrowRight />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
