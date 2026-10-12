"use client";

import { Check, Plus } from "lucide-react";
import * as React from "react";
import { Avatar } from "@ventura/ui/avatar";
import { Button } from "@ventura/ui/button";
import { Checkbox } from "@ventura/ui/checkbox";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { PhoneInput } from "@ventura/ui/phone-input";
import { toast } from "@ventura/ui/toast";
import { displayPhone } from "@/lib/format";
import { BRANCH_COLORS, DEFAULT_COLOR } from "@/lib/palette";
import { branchInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import { saveBranchAction } from "./actions";
import type { BranchRow, BranchStaff } from "./data";

interface FormState {
  name: string;
  phone: string;
  address: string;
  color: string;
  managerIds: string[];
}

function initial(editing: BranchRow | null, staff: BranchStaff[]): FormState {
  if (!editing) return { name: "", phone: "", address: "", color: DEFAULT_COLOR, managerIds: [] };
  return {
    name: editing.name,
    phone: (editing.phone ?? "").replace(/\D/g, "").slice(-9),
    address: editing.address ?? "",
    color: editing.color,
    // Kartochkada faqat menejerlar ko'rinadi, formada esa filialga biriktirilgan barcha xodimlar
    managerIds: staff.filter((s) => s.branchIds.includes(editing.id)).map((s) => s.id),
  };
}

export function BranchForm({
  open,
  onOpenChange,
  editing,
  staffOptions,
  canAssign,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: BranchRow | null;
  staffOptions: BranchStaff[];
  /** Xodim biriktirish ruxsati ("Lavozim va ruxsatlarni biriktirish") */
  canAssign: boolean;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<FormState>(() => initial(editing, staffOptions));
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  // Har ochilishda forma tanlangan filialdan qayta to'ldiriladi
  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setForm(initial(editing, staffOptions));
      setError(null);
    }
  }

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = branchInput.safeParse({ ...form, id: editing?.id });
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveBranchAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.branches.updated : uz.branches.created, description: form.name });
      onOpenChange(false);
      onSaved();
    });
  }

  const phoneInvalid = form.phone.length > 0 && form.phone.length < 9;
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? uz.branches.formEdit : uz.branches.formNew}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="branch-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.branches.submitNew}
          </Button>
        </>
      }
    >
      <form id="branch-form" onSubmit={submit} className="space-y-5">
        <div>
          <Label htmlFor="branch-name">{uz.branches.name} *</Label>
          <Input
            id="branch-name"
            autoFocus
            placeholder={uz.branches.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="branch-phone">{uz.branches.phone}</Label>
          <PhoneInput
            id="branch-phone"
            value={form.phone}
            onValueChange={(v) => set("phone", v)}
            invalid={phoneInvalid}
          />
        </div>
        <div>
          <Label htmlFor="branch-address">{uz.branches.address}</Label>
          <Input
            id="branch-address"
            placeholder={uz.branches.addressPlaceholder}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div>
          <Label>{uz.branches.color}</Label>
          <ColorSwatches value={form.color} onChange={(v) => set("color", v)} options={BRANCH_COLORS} />
        </div>
        {canAssign ? (
          <div>
            <Label>{uz.branches.managers}</Label>
            <FieldHint className="mt-0 mb-2">{uz.branches.managersHint}</FieldHint>
            {staffOptions.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {staffOptions.map((s) => {
                  const checked = form.managerIds.includes(s.id);
                  return (
                    <label
                      key={s.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-control border px-3 py-2.5 transition-colors hover:bg-muted",
                        checked ? "border-(--ring-border)" : "border-border-soft",
                      )}
                    >
                      <Avatar name={s.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-body font-semibold text-foreground">{s.name}</div>
                        <div className="truncate text-caption text-muted-foreground">
                          {s.positions.join(", ") || uz.staff.noPosition} ·{" "}
                          {displayPhone(s.phone) ?? uz.branches.noPhone}
                        </div>
                      </div>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          set(
                            "managerIds",
                            v ? [...form.managerIds, s.id] : form.managerIds.filter((id) => id !== s.id),
                          )
                        }
                      />
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-control border border-dashed border-border px-4 py-3 text-body text-muted-foreground">
                {uz.branches.noStaff}
              </p>
            )}
          </div>
        ) : null}
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
