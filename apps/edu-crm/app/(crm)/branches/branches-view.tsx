"use client";

import { Building2, Pencil, Plus, Search, Trash2, UsersRound, GraduationCap } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { toast } from "@ventura/ui/toast";
import { displayPhone } from "@/lib/format";
import { uz } from "@/lib/uz";
import { deleteBranchAction } from "./actions";
import { BranchForm } from "./branch-form";
import type { BranchRow, BranchStaff } from "./data";

export function BranchesView({
  rows,
  staffOptions,
  canWrite,
}: {
  rows: BranchRow[];
  staffOptions: BranchStaff[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<BranchRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<BranchRow | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((b) => !q || [b.name, b.address].some((v) => v?.toLowerCase().includes(q)));

  function openForm(branch: BranchRow | null) {
    setEditing(branch);
    setFormOpen(true);
  }

  async function remove(branch: BranchRow) {
    const res = await deleteBranchAction(branch.id);
    if (res.ok) {
      toast({ tone: "success", title: uz.branches.deleted, description: branch.name });
      router.refresh();
    } else toast({ tone: "danger", title: res.error });
  }

  return (
    <div>
      <PageHeader
        title={uz.branches.title}
        actions={
          <>
            <div className="w-full sm:w-64">
              <Input
                icon={<Search />}
                placeholder={uz.branches.search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {canWrite ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {uz.branches.add}
              </Button>
            ) : null}
          </>
        }
      />

      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              canWrite={canWrite}
              onEdit={() => openForm(b)}
              onDelete={() => {
                setToDelete(b);
                setConfirmOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon={<Building2 />} title={uz.branches.empty} description={uz.branches.emptyHint} />
        </Card>
      )}

      {canWrite ? (
        <BranchForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          staffOptions={staffOptions}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={uz.branches.deleteTitle}
        message={toDelete ? uz.branches.deleteMessage(toDelete.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}

function BranchCard({
  branch,
  canWrite,
  onEdit,
  onDelete,
}: {
  branch: BranchRow;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [first, ...rest] = branch.managers;
  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div
          className="grid size-11 shrink-0 place-items-center rounded-stat-icon text-primary-foreground [&_svg]:size-5"
          style={{ background: branch.color }}
        >
          <Building2 />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-body font-bold text-foreground">{branch.name}</div>
          <div className="truncate text-caption text-muted-foreground">{branch.address || uz.branches.noAddress}</div>
        </div>
        {canWrite ? (
          <div className="flex shrink-0 gap-1.5">
            <Button
              variant="icon"
              size="icon-sm"
              title={uz.branches.editHint}
              aria-label={uz.branches.editHint}
              onClick={onEdit}
            >
              <Pencil />
            </Button>
            <Button
              variant="icon"
              size="icon-sm"
              title={uz.branches.deleteHint}
              aria-label={uz.branches.deleteHint}
              onClick={onDelete}
              className="text-destructive-text"
            >
              <Trash2 />
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3 rounded-control border border-border-soft bg-muted px-3 py-2.5">
        {first ? (
          <>
            <Avatar name={first.name} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-body font-semibold text-foreground">{first.name}</span>
                {rest.length ? <Badge tone="info">+{rest.length}</Badge> : null}
              </div>
              <div className="truncate font-mono text-caption text-muted-foreground">
                {displayPhone(first.phone) ?? uz.branches.managerRole}
              </div>
            </div>
          </>
        ) : (
          <span className="text-body font-semibold text-(--warning-fg)">{uz.branches.noManager}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<GraduationCap />}
          label={uz.branches.activeStudents}
          value={uz.common.people(branch.activeStudents)}
        />
        <Metric
          icon={<UsersRound />}
          label={uz.branches.groupsStaff}
          value={`${uz.common.count(branch.groups)} / ${uz.common.count(branch.staffCount)}`}
        />
      </div>
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-control border border-border-soft px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-caption text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-body font-bold text-foreground">{value}</div>
    </div>
  );
}
