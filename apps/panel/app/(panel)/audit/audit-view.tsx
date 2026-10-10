"use client";

import { Activity, ShieldAlert, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Card } from "@ventura/ui/card";
import { Modal } from "@ventura/ui/modal";
import { Pagination } from "@ventura/ui/pagination";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { actionLabel, actionTone, actorLabel } from "@/components/audit-row";
import { EmptyState } from "@/components/page-header";
import { formatDateTime } from "@/lib/format";
import { uz } from "@/lib/uz";

export interface AuditItem {
  id: string;
  seq: number;
  at: string;
  actorType: string;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  hash: string;
}

type Verdict = { ok: true; count: number } | { ok: false; seq: number; reason: string };

export function AuditView({
  rows,
  page,
  total,
  pageSize,
  verdict,
}: {
  rows: AuditItem[];
  page: number;
  total: number;
  pageSize: number;
  verdict: Verdict;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState<AuditItem | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);

  return (
    <>
      <div
        className={
          verdict.ok
            ? "mb-4 flex items-center gap-2 rounded-card border border-(--success-border) bg-(--success-bg) px-4 py-3 text-body font-semibold text-(--success-fg)"
            : "mb-4 flex items-center gap-2 rounded-card border border-(--danger-border) bg-(--danger-bg) px-4 py-3 text-body font-semibold text-(--danger-fg)"
        }
        role="status"
      >
        {verdict.ok ? <ShieldCheck className="size-5" /> : <ShieldAlert className="size-5" />}
        {verdict.ok ? uz.audit.chainOk(verdict.count) : uz.audit.chainBroken(verdict.seq, verdict.reason)}
      </div>

      <Card className="overflow-hidden">
        {rows.length ? (
          <TableWrap>
            <Table className="min-w-[820px]">
              <THead>
                <tr>
                  <Th>#</Th>
                  <Th>{uz.audit.time}</Th>
                  <Th>{uz.audit.actor}</Th>
                  <Th>{uz.audit.action}</Th>
                  <Th>{uz.audit.target}</Th>
                  <Th>{uz.audit.ip}</Th>
                </tr>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <Tr
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setOpen(r);
                      setModalOpen(true);
                    }}
                  >
                    <Td>
                      <span className="font-mono text-muted-foreground">{r.seq}</span>
                    </Td>
                    <Td>
                      <span className="font-mono whitespace-nowrap">{formatDateTime(r.at)}</span>
                    </Td>
                    <Td>
                      <span className="text-body font-semibold text-foreground">{actorLabel(r)}</span>
                    </Td>
                    <Td>
                      <Badge tone={actionTone(r.action)} dot>
                        {actionLabel(r.action)}
                      </Badge>
                    </Td>
                    <Td>
                      <span className="font-mono">
                        {r.targetType ?? "—"}
                        {r.targetId ? ` · ${r.targetId.slice(0, 8)}` : ""}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono">{r.ip ?? "—"}</span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        ) : (
          <EmptyState icon={<Activity />} title={uz.audit.empty} />
        )}
        {total > pageSize ? (
          <Pagination
            page={page}
            pageCount={Math.ceil(total / pageSize)}
            total={total}
            pageSize={pageSize}
            onPageChange={(p) => router.push(`/audit?sahifa=${p}`)}
          />
        ) : null}
      </Card>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={open ? actionLabel(open.action) : uz.audit.details}
        description={open ? `#${open.seq} · ${formatDateTime(open.at)}` : undefined}
      >
        {open ? (
          <div className="space-y-4">
            <dl className="divide-y divide-border-soft rounded-card border border-border text-body">
              {[
                [uz.audit.actor, actorLabel(open)],
                [uz.audit.target, `${open.targetType ?? "—"}${open.targetId ? ` · ${open.targetId}` : ""}`],
                [uz.audit.ip, open.ip ?? "—"],
                ["User-Agent", open.userAgent ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[120px_1fr] gap-3 px-4 py-2.5">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-mono text-xs break-all text-foreground">{v}</dd>
                </div>
              ))}
            </dl>
            <div>
              <div className="type-label mb-1.5 text-(--label-fg)">{uz.audit.metadata}</div>
              <pre className="max-h-80 overflow-auto rounded-card border border-border bg-muted p-4 font-mono text-xs leading-relaxed text-foreground">
                {JSON.stringify(open.metadata, null, 2)}
              </pre>
            </div>
            <dl className="space-y-2 text-xs">
              <div>
                <dt className="text-muted-foreground">{uz.audit.prevHash}</dt>
                <dd className="font-mono break-all text-foreground">{open.prevHash ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{uz.audit.hash}</dt>
                <dd className="font-mono break-all text-foreground">{open.hash}</dd>
              </div>
            </dl>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
