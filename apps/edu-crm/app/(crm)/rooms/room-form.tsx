"use client";

import { Check, DoorOpen, Plus, Users } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { firstError, roomInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { saveRoomAction } from "./actions";
import type { RoomRow } from "./data";

const QUICK_CAPACITY = [12, 15, 20, 25, 30, 40];

export function RoomForm({
  open,
  onOpenChange,
  editing,
  branches,
  selectedBranch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: RoomRow | null;
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: () => void;
}) {
  const defaults = React.useCallback(
    () => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      capacity: String(editing?.capacity ?? 20),
    }),
    [editing, selectedBranch, branches],
  );
  const [form, setForm] = React.useState(defaults);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setForm(defaults());
      setError(null);
    }
  }

  const set = (k: "branchId" | "name" | "capacity", v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const showBranch = branches.length > 1 && selectedBranch === "all";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = roomInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      capacity: form.capacity ? Number(form.capacity) : Number.NaN,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (showBranch && !form.branchId) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveRoomAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.rooms.updated : uz.rooms.created, description: parsed.data.name });
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? uz.rooms.formEdit : uz.rooms.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="room-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.rooms.submitNew}
          </Button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="space-y-5">
        {showBranch ? (
          <div>
            <Label>{uz.common.branch}</Label>
            <Select value={form.branchId} onValueChange={(v) => set("branchId", v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={uz.common.chooseBranch} />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div>
          <Label htmlFor="room-name">{uz.rooms.name} *</Label>
          <Input
            id="room-name"
            autoFocus
            icon={<DoorOpen />}
            placeholder={uz.rooms.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="room-capacity" className="flex items-center justify-between">
            <span>{uz.rooms.capacityField} *</span>
            <span className="text-caption font-medium text-muted-foreground">{uz.rooms.capacityHint}</span>
          </Label>
          <Input
            id="room-capacity"
            inputMode="numeric"
            icon={<Users />}
            placeholder={uz.rooms.capacityPlaceholder}
            value={form.capacity}
            onChange={(e) => set("capacity", e.target.value.replace(/\D/g, "").slice(0, 3))}
          />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-caption font-semibold text-muted-foreground">{uz.rooms.quick}</span>
            {QUICK_CAPACITY.map((n) => (
              <Button
                key={n}
                size="sm"
                variant={form.capacity === String(n) ? "primary" : "ghost"}
                onClick={() => set("capacity", String(n))}
              >
                {uz.rooms.seatsUnit(n)}
              </Button>
            ))}
          </div>
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
