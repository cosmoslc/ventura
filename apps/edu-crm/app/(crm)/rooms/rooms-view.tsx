"use client";

import { Calendar, Clock, DoorOpen, LayoutGrid, List, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Input } from "@ventura/ui/input";
import { ConfirmModal } from "@ventura/ui/modal";
import { EmptyState, PageHeader } from "@ventura/ui/page-header";
import { StatCard } from "@ventura/ui/stat-card";
import { TBody, THead, Table, TableWrap, Td, Th, Tr } from "@ventura/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@ventura/ui/tabs";
import { toast } from "@ventura/ui/toast";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
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
    <div className="space-y-6">
      <PageHeader
        title={uz.rooms.title}
        actions={
          <>
            <Tabs value={view} onValueChange={(v) => setView(v as "list" | "grid")}>
              <TabsList>
                <TabsTrigger value="list" title={uz.rooms.listHint}>
                  <List className="size-4" /> {uz.rooms.list}
                </TabsTrigger>
                <TabsTrigger value="grid" title={uz.rooms.gridHint}>
                  <LayoutGrid className="size-4" /> {uz.rooms.grid}
                </TabsTrigger>
              </TabsList>
            </Tabs>
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

      <div className="max-w-md">
        <Input
          icon={<Search />}
          placeholder={uz.rooms.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

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
                  <Th>{uz.rooms.colGroups}</Th>
                  <Th>{uz.rooms.colSchedule}</Th>
                  <Th className="text-center">{uz.rooms.colLoad}</Th>
                  {canWrite ? <Th className="text-right">{uz.common.actions}</Th> : null}
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
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">{r.name}</div>
                          <div className="text-caption text-muted-foreground">{uz.rooms.seats(r.capacity)}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      {r.groups.length ? (
                        <div className="flex flex-wrap gap-1">
                          {r.groups.map((g) => (
                            <Badge key={g.id} tone="info">
                              {g.name}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">{uz.rooms.noGroups}</span>
                      )}
                    </Td>
                    <Td>
                      {r.groups.length ? (
                        <div className="space-y-1">
                          {r.groups.map((g) => (
                            <div
                              key={g.id}
                              className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground"
                            >
                              <span className="flex items-center gap-1">
                                <Calendar className="size-3" />{" "}
                                {g.days
                                  .map((d) => uz.weekdays.short[d as keyof typeof uz.weekdays.short] ?? d)
                                  .join(", ")}
                              </span>
                              {g.time ? (
                                <span className="flex items-center gap-1">
                                  <Clock className="size-3" /> {g.time}
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </Td>
                    <Td className="text-center">
                      <LoadBadge groups={r.groups.length} />
                    </Td>
                    {canWrite ? (
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="icon"
                            size="icon-sm"
                            title={uz.common.edit}
                            aria-label={uz.common.edit}
                            onClick={() => openForm(r)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="icon"
                            size="icon-sm"
                            title={uz.common.delete}
                            aria-label={uz.common.delete}
                            onClick={() => askDelete(r)}
                            className="text-destructive-text"
                          >
                            <Trash2 />
                          </Button>
                        </div>
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
            <Card key={r.id} className="flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-stat-icon bg-muted text-muted-foreground [&_svg]:size-5">
                  <DoorOpen />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-body font-bold text-foreground">{r.name}</div>
                  <div className="text-caption text-muted-foreground">{uz.rooms.roomKind}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge tone="success">{uz.rooms.seatsShort(r.capacity)}</Badge>
                <LoadBadge groups={r.groups.length} />
              </div>
              {r.groups.length ? (
                <ul className="space-y-1 text-caption text-muted-foreground">
                  {r.groups.slice(0, 3).map((g) => (
                    <li key={g.id} className="flex justify-between gap-2">
                      <span className="truncate">{g.name}</span>
                      {g.time ? <span className="font-mono">{g.time}</span> : null}
                    </li>
                  ))}
                  {r.groups.length > 3 ? <li>+{r.groups.length - 3}</li> : null}
                </ul>
              ) : null}
              {canWrite ? (
                <div className="mt-auto flex gap-2 border-t border-border-soft pt-3">
                  <Button variant="ghost" size="sm" className="flex-1" onClick={() => openForm(r)}>
                    <Pencil /> {uz.common.edit}
                  </Button>
                  <Button
                    variant="icon"
                    size="icon-sm"
                    title={uz.common.delete}
                    aria-label={uz.common.delete}
                    onClick={() => askDelete(r)}
                    className="text-destructive-text"
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
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

function LoadBadge({ groups }: { groups: number }) {
  return groups ? <Badge tone="warning">{uz.rooms.busy(groups)}</Badge> : <Badge tone="success">{uz.rooms.free}</Badge>;
}
