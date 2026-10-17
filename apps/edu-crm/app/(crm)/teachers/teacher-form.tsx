"use client";

import { Check, Plus, User } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { cn } from "@ventura/ui/lib/utils";
import { firstError, teacherInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { saveTeacherAction } from "./actions";
import type { TeacherRow } from "./data";

type Kind = TeacherRow["kind"];
type SalaryType = TeacherRow["salaryType"];
type Weekday = TeacherRow["workingDays"][number];
const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const PRESETS: Record<"odd" | "even" | "all", Weekday[]> = {
  odd: ["mon", "wed", "fri"],
  even: ["tue", "thu", "sat"],
  all: ["mon", "tue", "wed", "thu", "fri", "sat"],
};

interface Form {
  branchId: string;
  name: string;
  phone: string;
  gender: "male" | "female";
  birthDate: string;
  assignedTeacherId: string;
  salaryType: SalaryType;
  revenueSharePercent: string;
  perStudentSalary: number | null;
  fixedSalary: number | null;
  salaryStartDate: string;
  workingDays: Weekday[];
  startTime: string;
  endTime: string;
  note: string;
}

export function TeacherForm({
  open,
  onOpenChange,
  kind,
  editing,
  mentors,
  branches,
  selectedBranch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  editing: TeacherRow | null;
  /** Support o'qituvchi uchun: biriktirsa bo'ladigan ustozlar */
  mentors: { id: string; name: string }[];
  branches: PickerBranch[];
  selectedBranch: string;
  onSaved: (id: string) => void;
}) {
  const support = kind === "support";
  const defaults = React.useCallback(
    (): Form => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      gender: editing?.gender ?? "male",
      birthDate: editing?.birthDate ?? "",
      assignedTeacherId: editing?.assignedTeacherId ?? "",
      salaryType: editing?.salaryType ?? (support ? "fixed" : "percent"),
      revenueSharePercent: String(editing?.revenueSharePercent ?? 40),
      perStudentSalary: editing ? editing.perStudentSalary : 100_000,
      fixedSalary: editing ? editing.fixedSalary : null,
      salaryStartDate: editing?.salaryStartDate ?? "",
      workingDays: editing?.workingDays ?? PRESETS.odd,
      startTime: editing?.startTime ?? "09:00",
      endTime: editing?.endTime ?? "18:00",
      note: editing?.note ?? "",
    }),
    [editing, selectedBranch, branches, support],
  );
  const [form, setForm] = React.useState(defaults);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? `${kind}:${editing?.id ?? "new"}` : null;
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
  // Headerda filial tanlangan bo'lsa o'qituvchi shu filialga qo'shiladi; tanlov faqat "Barchasi" holatida
  const showBranch = branches.length > 1 && (selectedBranch === "all" || !!editing);

  function pickMentor(id: string) {
    set("assignedTeacherId", id);
    const m = mentors.find((t) => t.id === id);
    if (m && !form.name.trim()) set("name", `${m.name} ${uz.teachers.assistantSuffix}`);
  }

  function toggleDay(d: Weekday) {
    set(
      "workingDays",
      form.workingDays.includes(d) ? form.workingDays.filter((x) => x !== d) : [...form.workingDays, d],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = teacherInput.safeParse({
      id: editing?.id,
      kind,
      branchId: form.branchId || null,
      name: form.name,
      phone: form.phone,
      gender: support ? null : form.gender,
      birthDate: support ? "" : form.birthDate,
      assignedTeacherId: support && form.assignedTeacherId ? form.assignedTeacherId : null,
      salaryType: support ? "fixed" : form.salaryType,
      revenueSharePercent: form.revenueSharePercent ? Number(form.revenueSharePercent) : 0,
      perStudentSalary: form.perStudentSalary ?? 0,
      fixedSalary: form.fixedSalary ?? 0,
      salaryStartDate: support || form.salaryType === "fixed" ? form.salaryStartDate : "",
      workingDays: support ? WEEKDAYS.filter((d) => form.workingDays.includes(d)) : [],
      startTime: support ? form.startTime : "",
      endTime: support ? form.endTime : "",
      note: form.note,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (support && form.startTime && form.endTime && form.endTime <= form.startTime) {
      return setError(uz.teachers.timeOrder);
    }
    startTransition(async () => {
      const res = await saveTeacherAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: editing ? uz.teachers.updated : uz.teachers.created,
        description: parsed.data.name,
      });
      onOpenChange(false);
      onSaved(res.id);
    });
  }

  const title = support
    ? editing
      ? uz.teachers.supportEdit
      : uz.teachers.supportNew
    : editing
      ? uz.teachers.formEdit
      : uz.teachers.formNew;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide={!support}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="teacher-form" disabled={pending}>
            {editing ? <Check /> : <Plus />}{" "}
            {editing ? uz.common.save : support ? uz.teachers.submitSupport : uz.teachers.submitNew}
          </Button>
        </>
      }
    >
      <form id="teacher-form" onSubmit={submit} className={cn("grid gap-4", !support && "sm:grid-cols-2")}>
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

        {support ? (
          <div>
            <Label>{uz.teachers.assignedTeacher}</Label>
            <Select value={form.assignedTeacherId} onValueChange={pickMentor}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={uz.teachers.choose} />
              </SelectTrigger>
              <SelectContent>
                {mentors.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div>
          <Label htmlFor="teacher-name">{uz.teachers.name} *</Label>
          <Input
            id="teacher-name"
            autoFocus
            icon={<User />}
            placeholder={support ? uz.teachers.supportNamePlaceholder : uz.teachers.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="teacher-phone">{uz.teachers.phone} *</Label>
          <PhoneInput id="teacher-phone" value={form.phone} onValueChange={(v) => set("phone", v)} />
        </div>

        {!support ? (
          <>
            <div>
              <Label>{uz.teachers.gender}</Label>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={uz.teachers.gender}>
                {(["male", "female"] as const).map((g) => (
                  <Button
                    key={g}
                    role="radio"
                    aria-checked={form.gender === g}
                    variant={form.gender === g ? "primary" : "ghost"}
                    onClick={() => set("gender", g)}
                  >
                    {g === "male" ? uz.teachers.male : uz.teachers.female}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="teacher-birth">{uz.teachers.birthDate}</Label>
              <Input
                id="teacher-birth"
                type="date"
                value={form.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
            <div>
              <Label>{uz.teachers.salaryType}</Label>
              <Select value={form.salaryType} onValueChange={(v) => set("salaryType", v as SalaryType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["percent", "per_student", "fixed"] as const).map((t) => (
                    <SelectItem key={t} value={t}>
                      {uz.teachers.salaryOptions[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              {form.salaryType === "percent" ? (
                <>
                  <Label htmlFor="teacher-percent">{uz.teachers.sharePercent}</Label>
                  <Input
                    id="teacher-percent"
                    inputMode="numeric"
                    placeholder="40"
                    value={form.revenueSharePercent}
                    onChange={(e) => set("revenueSharePercent", e.target.value.replace(/\D/g, "").slice(0, 3))}
                  />
                </>
              ) : form.salaryType === "per_student" ? (
                <>
                  <Label htmlFor="teacher-per-student">{uz.teachers.perStudent}</Label>
                  <MoneyInput
                    id="teacher-per-student"
                    value={form.perStudentSalary}
                    onValueChange={(v) => set("perStudentSalary", v)}
                    suffix={uz.common.som}
                    placeholder="100 000"
                  />
                </>
              ) : (
                <>
                  <Label htmlFor="teacher-fixed">{uz.teachers.fixedSalary}</Label>
                  <MoneyInput
                    id="teacher-fixed"
                    value={form.fixedSalary}
                    onValueChange={(v) => set("fixedSalary", v)}
                    suffix={uz.common.som}
                    placeholder="3 000 000"
                  />
                </>
              )}
            </div>
            {form.salaryType === "fixed" ? (
              <div>
                <Label htmlFor="teacher-salary-start">{uz.teachers.salaryStart}</Label>
                <Input
                  id="teacher-salary-start"
                  type="date"
                  value={form.salaryStartDate}
                  onChange={(e) => set("salaryStartDate", e.target.value)}
                />
                <FieldHint>{uz.teachers.salaryStartHint}</FieldHint>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <Label className="mb-0">{uz.teachers.weekDays}</Label>
                <div className="flex gap-1">
                  {(["odd", "even", "all"] as const).map((p) => (
                    <Button key={p} size="sm" variant="ghost" onClick={() => set("workingDays", PRESETS[p])}>
                      {p === "odd"
                        ? uz.teachers.presetOdd
                        : p === "even"
                          ? uz.teachers.presetEven
                          : uz.teachers.presetAll}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {WEEKDAYS.map((d) => {
                  const on = form.workingDays.includes(d);
                  return (
                    <Button
                      key={d}
                      size="sm"
                      variant={on ? "primary" : "ghost"}
                      aria-pressed={on}
                      title={uz.weekdays.full[d]}
                      onClick={() => toggleDay(d)}
                    >
                      {uz.weekdays.short[d]}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>{uz.teachers.workHours}</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="time"
                  aria-label={uz.teachers.start}
                  value={form.startTime}
                  onChange={(e) => set("startTime", e.target.value)}
                />
                <Input
                  type="time"
                  aria-label={uz.teachers.end}
                  value={form.endTime}
                  onChange={(e) => set("endTime", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="teacher-fixed">{uz.teachers.fixedSalary}</Label>
              <MoneyInput
                id="teacher-fixed"
                value={form.fixedSalary}
                onValueChange={(v) => set("fixedSalary", v)}
                suffix={uz.common.som}
                placeholder="1 500 000"
              />
            </div>
            <div>
              <Label htmlFor="teacher-salary-start">{uz.teachers.salaryStart}</Label>
              <Input
                id="teacher-salary-start"
                type="date"
                value={form.salaryStartDate}
                onChange={(e) => set("salaryStartDate", e.target.value)}
              />
              <FieldHint>{uz.teachers.salaryStartHint}</FieldHint>
            </div>
          </>
        )}

        <div className={cn(!support && "sm:col-span-2")}>
          <Label htmlFor="teacher-note">{uz.teachers.note}</Label>
          <Textarea
            id="teacher-note"
            rows={2}
            maxLength={1000}
            placeholder={support ? uz.teachers.supportNotePlaceholder : uz.teachers.notePlaceholder}
            value={form.note}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        {error ? (
          <FieldHint error className={cn(!support && "sm:col-span-2")}>
            {error}
          </FieldHint>
        ) : null}
      </form>
    </Modal>
  );
}
