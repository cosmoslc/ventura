"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { FilterBar, FilterSearch } from "@ventura/ui/filter-bar";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import type { ApprovalRow } from "@/lib/server/approvals";
import { formatDate } from "@/lib/format";
import { uz } from "@/lib/uz";
import { approveRequestAction, cancelRequestAction, rejectRequestAction } from "./actions";

const t = uz.approvals;
const TONE = { pending: "warning", approved: "success", rejected: "danger", cancelled: "neutral" } as const;

type Row = ApprovalRow & { permissionName: string };

const when = (iso: string) => {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tashkent" });
  return `${formatDate(d.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" }))} ${time}`;
};

export function ApprovalsView({ rows, director }: { rows: Row[]; director: boolean }) {
  const router = useRouter();
  const [tab, setTab] = React.useState<"pending" | "history">("pending");
  const [query, setQuery] = React.useState("");
  const [rejecting, setRejecting] = React.useState<Row | null>(null);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [, startTransition] = React.useTransition();

  const pending = rows.filter((r) => r.status === "pending");
  const q = query.trim().toLowerCase();
  const list = (tab === "pending" ? pending : rows.filter((r) => r.status !== "pending")).filter(
    (r) =>
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.requestedByName.toLowerCase().includes(q) ||
      (r.summary ?? "").toLowerCase().includes(q),
  );

  function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    startTransition(async () => {
      await fn();
      setBusy(null);
      router.refresh();
    });
  }

  const approve = (r: Row) =>
    run(r.id, async () => {
      const res = await approveRequestAction(r.id);
      if (!res.ok) toast({ tone: "danger", title: res.error });
      else toast({ tone: "success", title: t.approvedOk(res.title) });
    });
  const cancel = (r: Row) =>
    run(r.id, async () => {
      const res = await cancelRequestAction(r.id);
      toast(res.ok ? { tone: "success", title: t.cancelledOk } : { tone: "danger", title: res.error });
    });
  function reject() {
    const r = rejecting;
    if (!r) return;
    setRejecting(null);
    run(r.id, async () => {
      const res = await rejectRequestAction({ id: r.id, note });
      toast(res.ok ? { tone: "success", title: t.rejectedOk } : { tone: "danger", title: res.error });
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={director ? t.titleDirector : t.titleStaff}
        description={director ? t.descriptionDirector : t.descriptionStaff}
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "history")}>
        <TabsList>
          <TabsTrigger value="pending">{t.tabPending(pending.length)}</TabsTrigger>
          <TabsTrigger value="history">{t.tabHistory}</TabsTrigger>
        </TabsList>
      </Tabs>

      <FilterBar standalone>
        <FilterSearch placeholder={t.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </FilterBar>

      {list.length ? (
        <div className="space-y-3">
          {list.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-start justify-between gap-4 p-4">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-bold text-foreground">{r.title}</span>
                  <Badge tone={TONE[r.status]}>{t.statuses[r.status]}</Badge>
                </div>
                {r.summary ? <div className="text-caption text-foreground">{r.summary}</div> : null}
                <div className="text-caption text-muted-foreground">
                  {t.requestedBy(r.requestedByName, when(r.createdAt))} · {t.permission}: {r.permissionName}
                </div>
                {r.decidedByName && r.decidedAt ? (
                  <div className="text-caption text-muted-foreground">
                    {t.statuses[r.status]}: {t.decidedBy(r.decidedByName, when(r.decidedAt))}
                    {r.decisionNote ? ` — ${r.decisionNote}` : ""}
                  </div>
                ) : null}
                {r.lastError && r.status === "pending" ? (
                  <Notice tone="warning" className="mt-2">
                    {t.lastError(r.lastError)}
                  </Notice>
                ) : null}
              </div>
              {r.status === "pending" ? (
                <div className="flex shrink-0 gap-2">
                  {director ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy === r.id}
                        onClick={() => {
                          setNote("");
                          setRejecting(r);
                        }}
                      >
                        <X /> {t.reject}
                      </Button>
                      <Button size="sm" disabled={busy === r.id} onClick={() => approve(r)}>
                        <Check /> {t.approve}
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => cancel(r)}>
                      <X /> {t.cancel}
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<ClipboardCheck />} title={tab === "pending" ? t.emptyPending : t.emptyHistory} />
        </Card>
      )}

      <Modal
        open={rejecting !== null}
        onOpenChange={(o) => !o && setRejecting(null)}
        position="center"
        title={t.reject}
        description={rejecting?.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              {uz.common.cancel}
            </Button>
            <Button onClick={reject}>
              <X /> {t.reject}
            </Button>
          </>
        }
      >
        <div>
          <Label htmlFor="reject-note">{t.rejectNote}</Label>
          <Textarea
            id="reject-note"
            rows={3}
            maxLength={500}
            placeholder={t.rejectNotePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
