"use client";

import { BookOpen, Check, Plus } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { ColorSwatches } from "@ventura/ui/color-swatches";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { COURSE_COLORS, DEFAULT_COLOR } from "@/lib/palette";
import { courseInput, firstError } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../../branch-picker";
import { saveCourseAction } from "./actions";
import type { CourseRow } from "./data";

interface FormState {
  branchId: string;
  name: string;
  price: number | null;
  duration: string;
  color: string;
}

export function CourseForm({
  open,
  onOpenChange,
  editing,
  branches,
  selectedBranch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CourseRow | null;
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: () => void;
}) {
  const defaults = React.useCallback(
    (): FormState => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      price: editing ? editing.price || null : null,
      duration: editing?.durationMonths ? String(editing.durationMonths) : "",
      color: editing?.color ?? DEFAULT_COLOR,
    }),
    [editing, selectedBranch, branches],
  );
  const [form, setForm] = React.useState<FormState>(defaults);
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

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };

  // Eski tizimdagidek: filial tanlovi faqat tepada "Barcha filiallar" tanlangan va filial bir nechta bo'lsa
  const showBranch = branches.length > 1 && selectedBranch === "all";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = courseInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      price: form.price ?? 0,
      durationMonths: Number(form.duration) || 0,
      color: form.color,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (showBranch && !form.branchId) return setError(uz.common.branchRequired);
    startTransition(async () => {
      const res = await saveCourseAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: editing ? uz.courses.updated : uz.courses.created,
        description: parsed.data.name,
      });
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? uz.courses.formEdit : uz.courses.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="course-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.common.add}
          </Button>
        </>
      }
    >
      <form id="course-form" onSubmit={submit} className="space-y-5">
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
          <Label htmlFor="course-name">{uz.courses.name}</Label>
          <Input
            id="course-name"
            autoFocus
            placeholder={uz.courses.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="course-price">{uz.courses.price}</Label>
            <MoneyInput
              id="course-price"
              placeholder="1 500 000"
              suffix={uz.common.som}
              value={form.price}
              onValueChange={(v) => set("price", v)}
            />
          </div>
          <div>
            <Label htmlFor="course-duration">{uz.courses.duration}</Label>
            <div className="relative">
              <Input
                id="course-duration"
                inputMode="numeric"
                placeholder="3"
                className="pr-12"
                value={form.duration}
                onChange={(e) => set("duration", e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 3))}
              />
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {uz.courses.durationUnit}
              </span>
            </div>
          </div>
        </div>
        <div>
          <Label>{uz.courses.color}</Label>
          <ColorSwatches
            value={form.color}
            onChange={(v) => set("color", v)}
            options={COURSE_COLORS}
            custom={{ label: uz.courses.customColor }}
          />
          <div
            className="mt-3 flex items-center gap-2.5 rounded-control border border-l-4 border-border-soft px-3 py-2.5"
            style={{ borderLeftColor: form.color }}
          >
            <BookOpen className="size-4" style={{ color: form.color }} />
            <span className="truncate text-body font-semibold text-foreground">
              {form.name.trim() || uz.courses.preview}
            </span>
          </div>
        </div>
        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
