"use client";

import { Check, KeyRound, Plus, User } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PhoneInput } from "@ventura/ui/phone-input";
import type { SearchSelectOption } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { type FormField, missingRequired } from "@/lib/form-fields";
import { firstError, studentInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { CustomFieldInput } from "../custom-field-input";
import { saveStudentAction } from "./actions";
import type { StudentRow } from "./data";

const NONE = "__none";

interface Form {
  branchId: string;
  name: string;
  phone: string;
  gender: string;
  note: string;
  customData: Record<string, string>;
  password: string;
}

/**
 * O'quvchi formasi (ADR 0020): asosiy maydonlar — ism, telefon, jins va izoh. Qolgan hamma maydonni markaz "O'quvchi
 * formasi" sozlamasida o'zi qo'shadi (matn, raqam, sana, soat, tanlov, ko'p tanlov, belgilash, guruh...).
 */
export function StudentForm({
  open,
  onOpenChange,
  editing,
  branches,
  selectedBranch,
  fields,
  groups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StudentRow | null;
  branches: PickerBranch[];
  selectedBranch: string;
  /** "O'quvchi formasi"dagi qo'shimcha maydonlar */
  fields: FormField[];
  /** "Guruh tanlash" maydonlari uchun guruhlar */
  groups: readonly SearchSelectOption[];
  onSaved: (id: string) => void;
}) {
  const defaults = React.useCallback(
    (): Form => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      gender: editing?.gender ?? "",
      note: editing?.note ?? "",
      customData: editing?.customData ?? {},
      password: "",
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
  const setCustom = (id: string, v: string) => set("customData", { ...form.customData, [id]: v });
  // Filial faqat yangi o'quvchida tanlanadi; keyin — profildagi "Boshqa filialga o'tkazish" orqali
  const showBranch = branches.length > 1 && selectedBranch === "all" && !editing;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = studentInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      phone: form.phone,
      gender: form.gender === "male" || form.gender === "female" ? form.gender : null,
      note: form.note,
      customData: form.customData,
      password: !editing ? form.password : "",
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    const missing = missingRequired(form.customData, fields);
    if (missing) return setError(uz.staff.fieldMissing(missing.label));
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
        {fields.map((f) => (
          <CustomFieldInput
            key={f.id}
            field={f}
            idPrefix="student-f"
            value={form.customData[f.id] ?? ""}
            onChange={(v) => setCustom(f.id, v)}
            groups={groups}
          />
        ))}
        {!editing ? (
          <div className="sm:col-span-2">
            <Label htmlFor="student-password">{uz.studentLogin.password}</Label>
            <Input
              id="student-password"
              type="password"
              autoComplete="new-password"
              icon={<KeyRound />}
              maxLength={128}
              placeholder={uz.studentLogin.passwordPlaceholder}
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
            />
            <FieldHint>{uz.studentLogin.hint}</FieldHint>
          </div>
        ) : null}

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
