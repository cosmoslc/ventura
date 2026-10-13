"use client";

import { Check, MapPin, Plus, User } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { firstError, studentInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { saveStudentAction } from "./actions";
import type { StudentRow } from "./data";

const NONE = "__none";

interface Form {
  branchId: string;
  name: string;
  phone: string;
  birthDate: string;
  gender: string;
  school: string;
  grade: string;
  address: string;
  joinedAt: string;
  parentName: string;
  parentPhone: string;
  source: string;
  interestedCourseId: string;
  note: string;
}

/** Mahalliy sana (YYYY-MM-DD) — UTC emas, eski tizimdagi kun siljishi xatosi takrorlanmaydi */
export function todayLocal() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function StudentForm({
  open,
  onOpenChange,
  editing,
  branches,
  selectedBranch,
  courses,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StudentRow | null;
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  onSaved: (id: string) => void;
}) {
  const defaults = React.useCallback(
    (): Form => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      birthDate: editing?.birthDate ?? "",
      gender: editing?.gender ?? "",
      school: editing?.school ?? "",
      grade: editing?.grade ?? "",
      address: editing?.address ?? "",
      joinedAt: editing?.joinedAt ?? todayLocal(),
      parentName: editing?.parentName ?? "",
      parentPhone: editing?.parentPhone ?? "",
      source: editing?.source ?? "",
      interestedCourseId: editing?.interestedCourseId ?? "",
      note: editing?.note ?? "",
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

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const showBranch = branches.length > 1 && (selectedBranch === "all" || !!editing);
  const listId = React.useId();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = studentInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      phone: form.phone,
      parentName: form.parentName,
      parentPhone: form.parentPhone,
      birthDate: form.birthDate,
      gender: form.gender === "male" || form.gender === "female" ? form.gender : null,
      school: form.school,
      grade: form.grade,
      address: form.address,
      source: form.source,
      interestedCourseId: form.interestedCourseId || null,
      joinedAt: form.joinedAt || todayLocal(),
      note: form.note,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveStudentAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: editing ? uz.students.updated : uz.students.created,
        description: parsed.data.name,
      });
      onOpenChange(false);
      onSaved(res.id);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? uz.students.formEdit : uz.students.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="student-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.students.submitNew}
          </Button>
        </>
      }
    >
      <form id="student-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="student-name">{uz.students.name} *</Label>
          <Input
            id="student-name"
            autoFocus
            icon={<User />}
            placeholder={uz.students.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="student-phone">{uz.students.phone} *</Label>
          <PhoneInput id="student-phone" value={form.phone} onValueChange={(v) => set("phone", v)} />
        </div>
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
          <Label htmlFor="student-birth">{uz.students.birthDate}</Label>
          <Input
            id="student-birth"
            type="date"
            value={form.birthDate}
            onChange={(e) => set("birthDate", e.target.value)}
          />
        </div>
        <div>
          <Label>{uz.students.gender}</Label>
          <Select value={form.gender || NONE} onValueChange={(v) => set("gender", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{uz.students.choose}</SelectItem>
              <SelectItem value="male">{uz.students.male}</SelectItem>
              <SelectItem value="female">{uz.students.female}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="student-school">{uz.students.school}</Label>
          <div className="relative">
            <Input
              id="student-school"
              placeholder="45"
              value={form.school}
              maxLength={120}
              className="pr-24"
              onChange={(e) => set("school", e.target.value)}
            />
            {/^\d+$/.test(form.school) ? (
              <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                {uz.students.schoolSuffix}
              </span>
            ) : null}
          </div>
        </div>
        <div>
          <Label>{uz.students.grade}</Label>
          <Select value={form.grade || NONE} onValueChange={(v) => set("grade", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{uz.students.choose}</SelectItem>
              {uz.students.grades.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="student-address">{uz.students.address}</Label>
          <Input
            id="student-address"
            icon={<MapPin />}
            placeholder={uz.students.addressPlaceholder}
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="student-joined">{uz.students.joinedAt}</Label>
          <Input
            id="student-joined"
            type="date"
            value={form.joinedAt}
            onChange={(e) => set("joinedAt", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="student-parent">{uz.students.parentName}</Label>
          <Input
            id="student-parent"
            placeholder={uz.students.parentNamePlaceholder}
            value={form.parentName}
            onChange={(e) => set("parentName", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="student-parent-phone">{uz.students.parentPhone}</Label>
          <PhoneInput id="student-parent-phone" value={form.parentPhone} onValueChange={(v) => set("parentPhone", v)} />
        </div>
        <div>
          <Label htmlFor="student-source">{uz.students.source}</Label>
          <Input
            id="student-source"
            list={listId}
            value={form.source}
            maxLength={80}
            onChange={(e) => set("source", e.target.value)}
          />
          <datalist id={listId}>
            {uz.students.sources.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div>
          <Label>{uz.students.interestedCourse}</Label>
          <Select
            value={form.interestedCourseId || NONE}
            onValueChange={(v) => set("interestedCourseId", v === NONE ? "" : v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{uz.students.noCourse}</SelectItem>
              {courses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="student-note">{uz.students.note}</Label>
          <Textarea
            id="student-note"
            rows={2}
            maxLength={1000}
            placeholder={uz.students.notePlaceholder}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>
        {error ? (
          <FieldHint error className="sm:col-span-2">
            {error}
          </FieldHint>
        ) : null}
      </form>
    </Modal>
  );
}
