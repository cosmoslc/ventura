"use client";

import { ArrowRightLeft, ChevronLeft, Cloud, Database, FolderKanban, HardDrive, Pencil, Plug } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal, Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { formatBytes, timeAgo } from "@/lib/format";
import { uz } from "@/lib/uz";
import type { ServerLastAction } from "@ventura/db/schema/panel";
import { moveProjectDbAction, setProjectQuotaAction } from "../../actions";

const t = uz.databases;

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  dbStrategy: string;
  status: string;
  usage: number | null;
  quotaBytes: number | null;
}

/** Ishlatilgan / limit: 80% dan — sariq, oshgan — qizil */
function UsageBar({ usage, quota }: { usage: number | null; quota: number | null }) {
  if (usage == null) return <span className="text-muted-foreground">{t.usageUnknown}</span>;
  const pct = quota ? Math.min(100, Math.round((usage / quota) * 100)) : null;
  return (
    <div className="min-w-44">
      <div className="flex items-baseline justify-between gap-2 text-body">
        <span className="font-semibold text-foreground">{formatBytes(usage)}</span>
        <span className="text-caption text-muted-foreground">
          {quota ? `${pct}% · ${formatBytes(quota)}` : t.noQuota}
        </span>
      </div>
      {quota ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              pct! >= 100 ? "bg-(--danger-fg)" : pct! >= 80 ? "bg-(--warning-fg)" : "bg-primary",
            )}
            style={{ width: `${Math.max(2, pct!)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function DatabaseProfile({
  server,
  database: d,
  projects,
  canEdit,
  canMove,
  moveAction,
}: {
  server: { id: string; name: string };
  database: {
    name: string;
    shared: boolean;
    sizeBytes: number | null;
    connections: number | null;
    usageAt: string | null;
  };
  projects: ProjectRow[];
  canEdit: boolean;
  /** Ko'chirish — faqat super admin (ADR 0059) */
  canMove: boolean;
  moveAction: ServerLastAction | null;
}) {
  const router = useRouter();
  const [quotaFor, setQuotaFor] = React.useState<ProjectRow | null>(null);
  const [moving, setMoving] = React.useState<ProjectRow | null>(null);
  const showActions = canEdit || canMove;
  const over = projects.filter((p) => p.quotaBytes && p.usage != null && p.usage >= p.quotaBytes).length;
  return (
    <div className="space-y-section">
      <PageHeader
        title={d.name}
        description={`${server.name} · ${d.shared ? t.kinds.shared : t.kinds.project}`}
        actions={
          <Button asChild variant="ghost">
            <Link href="/databases">
              <ChevronLeft /> {t.title}
            </Link>
          </Button>
        }
      />
      <div className="grid gap-grid sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<HardDrive />}
          tone={1}
          label={t.colSize}
          value={d.sizeBytes == null ? "—" : formatBytes(d.sizeBytes)}
        />
        <StatCard icon={<FolderKanban />} tone={2} label={t.colProjects} value={String(projects.length)} />
        <StatCard
          icon={<Plug />}
          tone={4}
          label={t.colConnections}
          value={d.connections == null ? "—" : String(d.connections)}
        />
        <StatCard icon={<Database />} tone={3} label={t.overQuota} value={String(over)} />
      </div>
      {d.shared ? (
        <p className="text-body text-muted-foreground">
          {t.sharedUsageHint}
          {d.usageAt ? ` ${t.updated(timeAgo(d.usageAt))}.` : ` ${t.usagePending}`}
        </p>
      ) : null}

      {moveAction ? (
        <Notice tone={moveAction.status === "error" ? "danger" : moveAction.status === "ok" ? "success" : "warning"}>
          {t.moveStatus(moveAction.project ?? "", moveAction.status, moveAction.message)}
        </Notice>
      ) : null}

      {projects.length ? (
        <TableWrap>
          <Table className="min-w-[720px]">
            <THead>
              <Tr>
                <Th>{t.colProject}</Th>
                <Th>{t.colUsage}</Th>
                <Th>{t.colState}</Th>
                {showActions ? <Th className="text-right">{uz.common.actions}</Th> : null}
              </Tr>
            </THead>
            <TBody>
              {projects.map((p) => {
                const isOver = !!p.quotaBytes && p.usage != null && p.usage >= p.quotaBytes;
                const near = !!p.quotaBytes && p.usage != null && !isOver && p.usage >= p.quotaBytes * 0.8;
                return (
                  <Tr key={p.id}>
                    <Td>
                      <Link href={`/projects/${p.id}`} className="font-semibold text-foreground hover:underline">
                        {p.name}
                      </Link>
                      <div className="font-mono text-caption text-muted-foreground">{p.slug}</div>
                    </Td>
                    <Td>
                      <UsageBar usage={p.usage} quota={p.quotaBytes} />
                    </Td>
                    <Td>
                      {isOver ? (
                        <Badge tone="danger">{t.stateOver}</Badge>
                      ) : near ? (
                        <Badge tone="warning">{t.stateNear}</Badge>
                      ) : (
                        <Badge tone="success">{t.stateOk}</Badge>
                      )}
                    </Td>
                    {showActions ? (
                      <Td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {canEdit ? (
                            <Button size="sm" variant="ghost" onClick={() => setQuotaFor(p)}>
                              <Pencil /> {t.quota}
                            </Button>
                          ) : null}
                          {canMove ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => setMoving(p)}>
                                <ArrowRightLeft /> {p.dbStrategy === "shared_db" ? t.moveToOwn : t.moveToShared}
                              </Button>
                              <Button size="sm" variant="ghost" asChild className="text-emerald-600 hover:text-emerald-700">
                                <Link href="/databases">
                                  <Cloud className="size-4" /> {t.moveToSupabase}
                                </Link>
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </Td>
                    ) : null}
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        </TableWrap>
      ) : (
        <Card>
          <EmptyState icon={<FolderKanban />} title={t.noProjects} description={t.noProjectsHint} />
        </Card>
      )}

      {canEdit ? <QuotaModal project={quotaFor} onClose={() => setQuotaFor(null)} /> : null}
      {canMove ? (
        <ConfirmModal
          open={moving !== null}
          onOpenChange={(o) => !o && setMoving(null)}
          title={moving?.dbStrategy === "shared_db" ? t.moveTitleOwn : t.moveTitleShared}
          message={moving ? t.moveText(moving.name) : ""}
          confirmLabel={moving?.dbStrategy === "shared_db" ? t.moveToOwn : t.moveToShared}
          requireText={moving?.slug}
          onConfirm={async () => {
            if (!moving) return;
            const target = moving.dbStrategy === "shared_db" ? "own" : "shared";
            const res = await moveProjectDbAction({ projectId: moving.id, target }, moving.slug);
            if (!res.ok) return void toast({ tone: "danger", title: res.error });
            toast({ tone: "success", title: t.moveQueued, description: moving.name });
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function QuotaModal({ project, onClose }: { project: ProjectRow | null; onClose: () => void }) {
  const router = useRouter();
  const [gb, setGb] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  if ((project?.id ?? null) !== openedFor) {
    setOpenedFor(project?.id ?? null);
    setGb(project?.quotaBytes ? String(Math.round((project.quotaBytes / 1024 ** 3) * 10) / 10) : "");
    setError(null);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    const value = gb.trim() ? Number(gb.replace(",", ".")) : null;
    startTransition(async () => {
      const res = await setProjectQuotaAction({ projectId: project.id, gb: value });
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.quotaSaved, description: project.name });
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal
      open={project !== null}
      onOpenChange={(o) => !o && onClose()}
      title={t.quotaTitle}
      description={project?.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="quota-form" disabled={pending}>
            {uz.common.save}
          </Button>
        </>
      }
    >
      <form id="quota-form" onSubmit={save} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div>
          <Label htmlFor="quota-gb">{t.quotaGb}</Label>
          <Input
            id="quota-gb"
            inputMode="decimal"
            placeholder="2"
            value={gb}
            onChange={(e) => setGb(e.target.value.replace(/[^\d.,]/g, ""))}
          />
          <FieldHint>{t.quotaHint}</FieldHint>
        </div>
      </form>
    </Modal>
  );
}
