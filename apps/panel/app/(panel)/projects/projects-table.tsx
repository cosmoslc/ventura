"use client";

import { FolderKanban, MoreHorizontal, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card, CardDescription, CardHeader } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { ConfirmModal } from "@ventura/ui/modal";
import { Pagination } from "@ventura/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { EmptyState } from "@ventura/ui/page-header";
import { daysLeft, formatDate } from "@/lib/format";
import type { ProjectListRow } from "@/lib/server/projects-query";
import { uz } from "@/lib/uz";
import { purgeProjectAction, restoreProjectAction, trashProjectAction } from "./actions";

const STATUS_TONE = { draft: "neutral", active: "success", paused: "warning" } as const;
const PAGE = 10;

export function ProjectsTable({
  rows,
  canWrite,
  mode,
  canPurge = false,
}: {
  rows: ProjectListRow[];
  canWrite: boolean;
  mode: "active" | "trash";
  /** Savatdan butunlay o'chirish — faqat super admin (ADR 0058) */
  canPurge?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [toTrash, setToTrash] = React.useState<ProjectListRow | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [toPurge, setToPurge] = React.useState<ProjectListRow | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) =>
      (status === "all" || r.status === status) &&
      (!q || [r.name, r.slug, r.clientName, r.domain].some((v) => v?.toLowerCase().includes(q))),
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pageCount);
  const visible = filtered.slice((current - 1) * PAGE, current * PAGE);

  async function restore(r: ProjectListRow) {
    const res = await restoreProjectAction(r.id);
    if (res.ok) {
      toast({ tone: "success", title: uz.projects.restored, description: r.name });
      router.refresh();
    } else toast({ tone: "danger", title: res.error });
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader>
          <CardDescription>
            {filtered.length} / {rows.length}
          </CardDescription>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Input
                icon={<Search />}
                placeholder={uz.common.search}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                aria-label={uz.common.search}
              />
            </div>
            {mode === "active" ? (
              <Select
                value={status}
                onValueChange={(v) => {
                  setStatus(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-44" aria-label={uz.projects.status}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{uz.projects.allStatuses}</SelectItem>
                  {(["draft", "active", "paused"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {uz.projects.statusLabels[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        </CardHeader>

        {visible.length ? (
          <TableWrap>
            <Table className="min-w-[860px]">
              <THead>
                <tr>
                  <Th>{uz.projects.name}</Th>
                  <Th>{uz.projects.domain}</Th>
                  <Th>{uz.projects.template}</Th>
                  <Th>{uz.projects.target}</Th>
                  <Th>{uz.projects.status}</Th>
                  <Th>Obuna / Muddat</Th>
                  <Th>{mode === "trash" ? uz.projects.deleted : uz.projects.created}</Th>
                  {canWrite ? <Th className="text-right">{uz.common.actions}</Th> : null}
                </tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <span
                          className="size-8 shrink-0 rounded-avatar"
                          style={{ background: r.primary }}
                          aria-hidden
                        />
                        <div className="min-w-0">
                          {mode === "active" ? (
                            <Link
                              href={`/projects/${r.id}`}
                              className="block truncate text-body font-bold text-foreground hover:text-primary-text"
                            >
                              {r.name}
                            </Link>
                          ) : (
                            <span className="block truncate text-body font-bold text-foreground">{r.name}</span>
                          )}
                          <div className="truncate text-caption text-muted-foreground">{r.clientName}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="font-mono text-primary-text">{r.domain ?? "—"}</span>
                    </Td>
                    <Td>{r.templateName}</Td>
                    <Td>
                      <div className="text-foreground">{uz.projects.targetLabels[r.target]}</div>
                      <div className="font-mono text-caption text-muted-foreground">{r.mode}</div>
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[r.status]} dot>
                        {uz.projects.statusLabels[r.status]}
                      </Badge>
                    </Td>
                    <Td>
                      {r.billing.kind === "subscription" ? (
                        <div className="space-y-0.5">
                          <Badge
                            tone={
                              r.status === "paused" || r.billing.expired
                                ? "danger"
                                : (r.billing.daysLeft ?? 0) <= 2
                                  ? "warning"
                                  : "success"
                            }
                            dot
                          >
                            {r.status === "paused"
                              ? "Muzlatilgan"
                              : r.billing.expired
                                ? "Muddati tugagan"
                                : `${r.billing.daysLeft} kun qoldi`}
                          </Badge>
                          {r.billing.expiresAt ? (
                            <div className="font-mono text-caption text-muted-foreground">
                              {formatDate(r.billing.expiresAt)}
                            </div>
                          ) : null}
                        </div>
                      ) : r.billing.kind === "trial" ? (
                        <div className="space-y-0.5">
                          <Badge
                            tone={r.status === "paused" || r.billing.expired ? "danger" : "warning"}
                            dot
                          >
                            {r.status === "paused"
                              ? "Muzlatilgan"
                              : r.billing.expired
                                ? "Sinov tugagan"
                                : `Sinov: ${r.billing.daysLeft} kun`}
                          </Badge>
                          {r.billing.expiresAt ? (
                            <div className="font-mono text-caption text-muted-foreground">
                              {formatDate(r.billing.expiresAt)}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-caption text-muted-foreground">
                          {r.status === "paused" ? (
                            <Badge tone="danger" dot>Muzlatilgan</Badge>
                          ) : (
                            <Badge tone="neutral">Doimiy</Badge>
                          )}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {mode === "trash" && r.deletedAt ? formatDate(r.deletedAt) : formatDate(r.createdAt)}
                      </span>
                      {mode === "trash" && r.deletedAt ? (
                        <div className="text-caption text-muted-foreground">
                          {uz.projects.daysLeft(daysLeft(new Date(r.deletedAt)))}
                        </div>
                      ) : null}
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        {mode === "trash" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button variant="ghost" size="sm" onClick={() => void restore(r)}>
                              <RotateCcw /> {uz.projects.restore}
                            </Button>
                            {canPurge ? (
                              <Button variant="danger" size="sm" onClick={() => setToPurge(r)}>
                                <Trash2 /> {uz.projects.purge}
                              </Button>
                            ) : null}
                          </div>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="subtle" size="icon-sm" aria-label={`${r.name} — ${uz.common.actions}`}>
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => router.push(`/projects/${r.id}`)}>
                                <Pencil /> {uz.common.edit}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                danger
                                onSelect={() => {
                                  setToTrash(r);
                                  setConfirmOpen(true);
                                }}
                              >
                                <Trash2 /> {uz.projects.trash}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState
            icon={mode === "trash" ? <Trash2 /> : <FolderKanban />}
            title={
              q || status !== "all" ? uz.common.empty : mode === "trash" ? uz.projects.trashEmpty : uz.projects.empty
            }
            description={!q && mode === "active" ? uz.projects.emptyHint : undefined}
          />
        )}
        {filtered.length > PAGE ? (
          <Pagination
            page={current}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE}
            onPageChange={setPage}
          />
        ) : null}
      </Card>

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={uz.projects.trashConfirmTitle}
        message={toTrash ? `${toTrash.name} — ${uz.projects.trashConfirmText}` : ""}
        confirmLabel={uz.projects.trash}
        requireText={toTrash?.slug}
        onConfirm={async () => {
          if (!toTrash) return;
          const res = await trashProjectAction(toTrash.id);
          if (res.ok) {
            toast({ tone: "danger", title: uz.projects.trashed, description: toTrash.name });
            router.refresh();
          } else toast({ tone: "danger", title: res.error });
        }}
      />
      {canPurge ? (
        <ConfirmModal
          open={toPurge !== null}
          onOpenChange={(o) => !o && setToPurge(null)}
          title={uz.projects.purgeTitle}
          message={toPurge ? uz.projects.purgeText(toPurge.name) : ""}
          confirmLabel={uz.projects.purge}
          requireText={toPurge?.slug}
          onConfirm={async () => {
            if (!toPurge) return;
            const res = await purgeProjectAction(toPurge.id, toPurge.slug);
            if (res.ok) {
              toast({
                tone: "success",
                title: res.queued ? uz.projects.purgeQueued : uz.projects.purged,
                description: toPurge.name,
              });
              router.refresh();
            } else toast({ tone: "danger", title: res.error });
          }}
        />
      ) : null}
    </>
  );
}
