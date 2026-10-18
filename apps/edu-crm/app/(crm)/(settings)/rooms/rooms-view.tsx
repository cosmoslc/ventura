"use client";

import { DoorOpen, Layers, LayoutGrid, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { FilterBar, FilterSearch } from "@ventura/ui/filter-bar";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { toast } from "@ventura/ui/toast";
import { ListGridSwitch } from "@ventura/ui/view-switch";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../../branch-picker";
import { deleteRoomAction } from "./actions";
import type { RoomRow } from "./data";
import { RoomForm } from "./room-form";

const BIG_ROOM = 25;

export function RoomsView({
  rows,
  branches,
  selectedBranch,
  canWrite,
}: {
  rows: RoomRow[];
  branches: PickerBranch[];
  selectedBranch: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [view, setView] = React.useState<"list" | "grid">("list");
  const [query, setQuery] = React.useState("");
  const [editing, setEditing] = React.useState<RoomRow | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<RoomRow | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const q = query.trim().toLowerCase();
  const visible = rows.filter((r) => !q || r.name.toLowerCase().includes(q));
  const bigRooms = rows.filter((r) => r.capacity >= BIG_ROOM).length;
  const totalCapacity = rows.reduce((s, r) => s + r.capacity, 0);

  function openForm(room: RoomRow | null) {
    setEditing(room);
    setFormOpen(true);
  }
  function askDelete(room: RoomRow) {
    setToDelete(room);
    setConfirmOpen(true);
  }

  async function remove(room: RoomRow) {
    const res = await deleteRoomAction(room.id);
    if (res.ok) {
      toast({ tone: "success", title: uz.rooms.deleted, description: room.name });
      router.refresh();
    } else toast({ tone: "danger", title: res.error });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={uz.rooms.title}
        actions={
          <>
            <ListGridSwitch
              value={view}
              onValueChange={setView}
              listLabel={uz.rooms.list}
              gridLabel={uz.rooms.grid}
              listTitle={uz.rooms.listHint}
              gridTitle={uz.rooms.gridHint}
            />
            {canWrite ? (
              <Button onClick={() => openForm(null)}>
                <Plus /> {uz.rooms.add}
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard tone={1} icon={<DoorOpen />} label={uz.rooms.total} value={uz.rooms.roomsUnit(rows.length)} />
        <StatCard tone={2} icon={<Users />} label={uz.rooms.big} value={uz.rooms.roomsUnit(bigRooms)} />
        <StatCard tone={3} icon={<LayoutGrid />} label={uz.rooms.capacity} value={uz.rooms.seatsUnit(totalCapacity)} />
      </div>

      <FilterBar standalone>
        <FilterSearch placeholder={uz.rooms.search} value={query} onChange={(e) => setQuery(e.target.value)} />
      </FilterBar>

      {!visible.length ? (
        <Card>
          <EmptyState
            icon={<DoorOpen />}
            title={uz.rooms.empty}
            description={q ? uz.rooms.emptySearch(query.trim()) : uz.rooms.emptyHint}
            action={
              canWrite && !q ? (
                <Button onClick={() => openForm(null)}>
                  <Plus /> {uz.rooms.addShort}
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : view === "list" ? (
        <Card className="overflow-hidden">
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>{uz.rooms.colName}</Th>
                  <Th>{uz.rooms.colCapacity}</Th>
                  <Th>{uz.rooms.colGroupsCount}</Th>
                  {canWrite ? <Th className="w-12" /> : null}
                </Tr>
              </THead>
              <TBody>
                {visible.map((r) => (
                  <Tr key={r.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="grid size-9 shrink-0 place-items-center rounded-stat-icon bg-muted text-muted-foreground [&_svg]:size-4">
                          <DoorOpen />
                        </div>
                        <span className="truncate font-bold text-foreground">{r.name}</span>
                      </div>
                    </Td>
                    <Td>
                      <b className="font-bold text-foreground">{r.capacity}</b>{" "}
                      <span className="text-muted-foreground">{uz.rooms.seatsWord}</span>
                    </Td>
                    <Td>
                      <b className="font-bold text-foreground">{r.groups.length}</b>{" "}
                      <span className="text-muted-foreground">{uz.rooms.groupsWord}</span>
                    </Td>
                    {canWrite ? (
                      <Td className="text-right">
                        <RoomMenu room={r} onEdit={() => openForm(r)} onDelete={() => askDelete(r)} />
                      </Td>
                    ) : null}
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((r) => (
            <Card key={r.id} className="flex flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-stat-icon bg-muted text-muted-foreground [&_svg]:size-5">
                  <DoorOpen />
                </div>
                <div
                  className="min-w-0 flex-1 truncate pt-2 text-body leading-snug font-bold text-foreground"
                  title={r.name}
                >
                  {r.name}
                </div>
                {canWrite ? <RoomMenu room={r} onEdit={() => openForm(r)} onDelete={() => askDelete(r)} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-body text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" aria-hidden />
                  <b className="font-bold text-foreground">{r.capacity}</b> {uz.rooms.seatsWord}
                </span>
                <span className="flex items-center gap-1.5">
                  <Layers className="size-4" aria-hidden />
                  <b className="font-bold text-foreground">{r.groups.length}</b> {uz.rooms.groupsWord}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {canWrite ? (
        <RoomForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          branches={branches}
          selectedBranch={selectedBranch}
          onSaved={() => router.refresh()}
        />
      ) : null}

      <ConfirmModal
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={uz.common.confirmTitle}
        message={toDelete ? uz.rooms.deleteMessage(toDelete.name) : ""}
        confirmLabel={uz.common.confirmDelete}
        cancelLabel={uz.common.cancel}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </div>
  );
}

function RoomMenu({ room, onEdit, onDelete }: { room: RoomRow; onEdit: () => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="subtle"
          size="icon-sm"
          className="-my-1 shrink-0"
          title={uz.common.actions}
          aria-label={`${room.name} — ${uz.common.actions}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> {uz.common.edit}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem danger onSelect={onDelete}>
          <Trash2 /> {uz.common.delete}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
