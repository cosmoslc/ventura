"use client";

import { Copy, Pencil, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { PERMISSION_CATEGORIES, normalizePermissions } from "@ventura/auth/staff/policy";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { cn } from "@ventura/ui/lib/utils";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import { clonePositionAction, deletePositionAction, savePositionAction } from "./actions";
import type { PositionRow } from "./data";
import { PermToggle } from "./perm-toggle";
import { PositionModal } from "./position-modal";

type Filter = "all" | "allowed" | "denied";
const TOTAL = PERMISSION_CATEGORIES.reduce((n, c) => n + c.permissions.length, 0);

export function PositionsView({
  rows,
  canWrite,
  grantable,
}: {
  rows: PositionRow[];
  canWrite: boolean;
  /** null — hamma ruxsatni bera oladi (direktor) */
  grantable: string[] | null;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = React.useState<string | null>(rows[0]?.id ?? null);
  const [roleQuery, setRoleQuery] = React.useState("");
  const [permQuery, setPermQuery] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");
  const [draft, setDraft] = React.useState<string[] | null>(null);
  const [modal, setModal] = React.useState<{ open: boolean; editing: PositionRow | null }>({
    open: false,
    editing: null,
  });
  const [toDelete, setToDelete] = React.useState<PositionRow | null>(null);
  const [pending, startTransition] = React.useTransition();

  const selected = rows.find((r) => r.id === selectedId) ?? rows[0] ?? null;
  const current = draft ?? selected?.permissions ?? [];
  const dirty = draft !== null;
  const locked = !canWrite || !selected || selected.system;
  const canGrant = (p: string) => grantable === null || grantable.includes(p);

  const rq = roleQuery.trim().toLowerCase();
  const visibleRoles = rows.filter((r) => !rq || r.name.toLowerCase().includes(rq));

  function select(id: string) {
    if (dirty && id !== selected?.id) setDraft(null);
    setSelectedId(id);
  }

  function toggle(perm: string, allowed: boolean) {
    if (!selected) return;
    if (selected.system) return toast({ tone: "warning", title: uz.positions.systemLocked });
    const base = draft ?? selected.permissions;
    const next = allowed ? [...base, perm] : base.filter((p) => p !== perm);
    const normalized = normalizePermissions(next);
    // Asl holatga qaytsa — o'zgarish yo'q
    const same =
      normalized.length === selected.permissions.length && normalized.every((p) => selected.permissions.includes(p));
    setDraft(same ? null : normalized);
  }

  function saveDraft() {
    if (!selected || !draft) return;
    startTransition(async () => {
      const res = await savePositionAction({
        id: selected.id,
        name: selected.name,
        color: selected.color,
        permissions: draft,
      });
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: uz.positions.saved(selected.name) });
      setDraft(null);
      router.refresh();
    });
  }

  function clone(r: PositionRow) {
    startTransition(async () => {
      const res = await clonePositionAction(r.id);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: uz.positions.cloned(res.name) });
      setSelectedId(res.id);
      setDraft(null);
      router.refresh();
    });
  }

  async function remove(r: PositionRow) {
    const res = await deletePositionAction(r.id);
    if (!res.ok) return void toast({ tone: "danger", title: res.error });
    toast({ tone: "success", title: uz.positions.deleted(r.name) });
    if (selectedId === r.id) setSelectedId(null);
    router.refresh();
  }

  const pq = permQuery.trim().toLowerCase();
  const allowedCount = current.length;

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title={uz.positions.title}
        actions={
          canWrite ? (
            <Button onClick={() => setModal({ open: true, editing: null })}>
              <Plus /> {uz.positions.add}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="flex flex-col gap-3 self-start p-4">
          <div className="flex items-center justify-between">
            <span className="text-body font-bold text-foreground">{uz.positions.list(rows.length)}</span>
            {canWrite ? (
              <Button
                variant="icon"
                size="icon-sm"
                title={uz.positions.addHint}
                aria-label={uz.positions.addHint}
                onClick={() => setModal({ open: true, editing: null })}
              >
                <Plus />
              </Button>
            ) : null}
          </div>
          <Input
            icon={<Search />}
            placeholder={uz.positions.search}
            value={roleQuery}
            onChange={(e) => setRoleQuery(e.target.value)}
          />
          <ul className="space-y-1">
            {visibleRoles.map((r) => {
              const active = r.id === selected?.id;
              return (
                <li key={r.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => select(r.id)}
                    aria-current={active || undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-control px-3 py-2.5 text-left transition-colors",
                      active ? "bg-primary-soft" : "hover:bg-muted",
                    )}
                  >
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: r.color }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body font-semibold text-foreground">{r.name}</span>
                      <span className="block text-caption text-muted-foreground">
                        {uz.positions.permCount(r.permissions.length)} · {uz.positions.users(r.users)}
                      </span>
                    </span>
                  </button>
                  {canWrite ? (
                    <span className="absolute top-1/2 right-2 flex -translate-y-1/2 gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <Button
                        variant="icon"
                        size="icon-sm"
                        title={uz.positions.copy}
                        aria-label={uz.positions.copy}
                        disabled={pending}
                        onClick={() => clone(r)}
                      >
                        <Copy />
                      </Button>
                      {!r.system ? (
                        <>
                          <Button
                            variant="icon"
                            size="icon-sm"
                            title={uz.positions.edit}
                            aria-label={uz.positions.edit}
                            onClick={() => setModal({ open: true, editing: r })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon-sm"
                            title={uz.positions.delete}
                            aria-label={uz.positions.delete}
                            className="text-destructive-text"
                            onClick={() => setToDelete(r)}
                          >
                            <Trash2 />
                          </Button>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>

        {selected ? (
          <div className="min-w-0 space-y-4">
            <Card className="flex flex-wrap items-center gap-3 p-4">
              <span className="size-3 shrink-0 rounded-full" style={{ background: selected.color }} aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="type-heading text-title text-foreground">{selected.name}</span>
                  {selected.system ? <Badge tone="info">{uz.positions.system}</Badge> : null}
                </div>
                <div className="text-caption text-muted-foreground">
                  {uz.positions.permCount(current.length)} · {uz.positions.users(selected.users)}
                </div>
              </div>
              {canWrite && !selected.system ? (
                <Button variant="ghost" onClick={() => setModal({ open: true, editing: selected })}>
                  <Pencil /> {uz.positions.edit}
                </Button>
              ) : null}
            </Card>

            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 sm:max-w-sm">
                <Input
                  icon={<Search />}
                  placeholder={uz.positions.permSearch}
                  value={permQuery}
                  onChange={(e) => setPermQuery(e.target.value)}
                />
              </div>
              <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <TabsList>
                  <TabsTrigger value="all">{uz.positions.filterAll(TOTAL)}</TabsTrigger>
                  <TabsTrigger value="allowed">{uz.positions.filterAllowed(allowedCount)}</TabsTrigger>
                  <TabsTrigger value="denied">{uz.positions.filterDenied(TOTAL - allowedCount)}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {PERMISSION_CATEGORIES.map((cat) => {
                const items = cat.permissions.filter((p) => {
                  const on = current.includes(p.id);
                  if (filter === "allowed" && !on) return false;
                  if (filter === "denied" && on) return false;
                  return !pq || p.name.toLowerCase().includes(pq) || p.id.includes(pq);
                });
                if (!items.length) return null;
                const on = cat.permissions.filter((p) => current.includes(p.id)).length;
                return (
                  <Card key={cat.id} className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <span className="text-body font-bold text-foreground">{cat.title}</span>
                      <span className="font-mono text-caption text-muted-foreground">
                        {on}/{cat.permissions.length}
                      </span>
                    </div>
                    <ul className="divide-y divide-border-soft">
                      {items.map((p) => {
                        const allowed = current.includes(p.id);
                        return (
                          <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                            <span className="min-w-0 text-body text-foreground">{p.name}</span>
                            <PermToggle
                              label={p.name}
                              allowed={allowed}
                              disabled={locked || (!allowed && !canGrant(p.id))}
                              onChange={(v) => toggle(p.id, v)}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </div>
        ) : (
          <Card>
            <EmptyState icon={<ShieldCheck />} title={uz.positions.choose} />
          </Card>
        )}
      </div>

      {dirty ? (
        <div className="fixed inset-x-0 bottom-4 z-(--z-popover) flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-card border border-border bg-popover px-4 py-3 shadow-popover">
            <span className="text-body font-semibold text-foreground">{uz.positions.unsaved}</span>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={pending}>
              {uz.positions.discard}
            </Button>
            <Button size="sm" onClick={saveDraft} disabled={pending}>
              {uz.positions.save}
            </Button>
          </div>
        </div>
      ) : null}

      {canWrite ? (
        <PositionModal
          open={modal.open}
          editing={modal.editing}
          grantable={grantable}
          onOpenChange={(open) => setModal((m) => ({ ...m, open }))}
          onSaved={(id) => {
            setSelectedId(id);
            setDraft(null);
            router.refresh();
          }}
        />
      ) : null}

      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={uz.positions.deleteTitle}
        message={toDelete ? uz.positions.deleteMessage(toDelete.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}
