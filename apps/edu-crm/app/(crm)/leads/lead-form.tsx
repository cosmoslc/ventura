"use client";

import { Check, Plus, User } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { PhoneInput } from "@ventura/ui/phone-input";
import { SearchSelect } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { type FormField, missingRequired } from "@/lib/form-fields";
import { LEAD_SOURCES } from "@/lib/leads";
import { firstError, leadInput } from "@/lib/rules";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { CustomFieldInput } from "../custom-field-input";
import { checkLeadPhoneAction, saveLeadAction } from "./actions";
import type { LeadRow, StaffOption } from "./data";

const NONE = "__none";
const t = uz.leads;

interface Form {
  branchId: string;
  name: string;
  phone: string;
  phone2: string;
  gender: string;
  source: string;
  courseId: string;
  assignedTo: string;
  targetDate: string;
  note: string;
  customData: Record<string, string>;
}

/**
 * Lid formasi (ADR 0022): ism, telefon, qo'shimcha telefon, manba, kurs, mas'ul xodim, keyingi aloqa sanasi, izoh va
 * "Lid formasi" sozlamasidagi qo'shimcha maydonlar. Telefon to'liq kiritilganda shu raqamli ochiq lid bo'lsa —
 * ogohlantirish va o'sha lidga havola (server ham takrorni qabul qilmaydi).
 */
export function LeadForm({
  open,
  onOpenChange,
  editing,
  branches,
  selectedBranch,
  courses,
  staff,
  fields,
  me,
  canReassign,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: LeadRow | null;
  branches: PickerBranch[];
  selectedBranch: string;
  courses: { id: string; name: string }[];
  staff: StaffOption[];
  fields: FormField[];
  /** Joriy xodim — yangi lid unga biriktiriladi */
  me: string;
  canReassign: boolean;
  onSaved: (id: string) => void;
}) {
  const defaults = React.useCallback(
    (): Form => ({
      branchId: editing?.branchId ?? (selectedBranch !== "all" ? selectedBranch : (branches[0]?.id ?? "")),
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      phone2: editing?.phone2 ?? "",
      gender: editing?.gender ?? "",
      source: editing?.source ?? "",
      courseId: editing?.courseId ?? "",
      assignedTo: editing ? (editing.assignedTo ?? "") : staff.some((s) => s.id === me) ? me : "",
      targetDate: editing?.targetDate ?? "",
      note: editing?.note ?? "",
      customData: editing?.customData ?? {},
    }),
    [editing, selectedBranch, branches, staff, me],
  );
  const [form, setForm] = React.useState(defaults);
  const [error, setError] = React.useState<string | null>(null);
  const [dup, setDup] = React.useState<{ id: string; name: string; stage: string } | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  if (key !== openedFor) {
    setOpenedFor(key);
    if (key) {
      setForm(defaults());
      setError(null);
      setDup(null);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  };
  const setCustom = (id: string, v: string) => set("customData", { ...form.customData, [id]: v });
  const showBranch = branches.length > 1 && selectedBranch === "all" && !editing;
  // Mas'ulni faqat leads.reassign bilan o'zgartirish mumkin (yangi lid — o'ziga yoki bo'sh)
  const assignLocked = !canReassign && !!editing;

  function onPhone(v: string) {
    set("phone", v);
    setDup(null);
    if (v.length !== 9) return;
    startTransition(async () => {
      const res = await checkLeadPhoneAction({ phone: v, except: editing?.id });
      if (res.ok) setDup(res.lead);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadInput.safeParse({
      id: editing?.id,
      branchId: form.branchId || null,
      name: form.name,
      phone: form.phone,
      phone2: form.phone2,
      gender: form.gender === "male" || form.gender === "female" ? form.gender : null,
      source: form.source,
      courseId: form.courseId || null,
      assignedTo: form.assignedTo || null,
      targetDate: form.targetDate,
      note: form.note,
      customData: form.customData,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    const missing = missingRequired(form.customData, fields);
    if (missing) return setError(uz.staff.fieldMissing(missing.label));
    startTransition(async () => {
      const res = await saveLeadAction(parsed.data);
      if (!res.ok && res.pending) {
        toast({ tone: "info", title: res.error });
        onOpenChange(false);
        return;
      }
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? t.updated : t.created, description: parsed.data.name });
      onOpenChange(false);
      onSaved(res.id);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? t.formEdit : t.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="lead-form" disabled={pending || !!dup}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : t.submitNew}
          </Button>
        </>
      }
    >
      <form id="lead-form" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="lead-name">{t.name} *</Label>
          <Input
            id="lead-name"
            autoFocus
            icon={<User />}
            placeholder={t.namePlaceholder}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="lead-phone">{t.phone} *</Label>
          <PhoneInput id="lead-phone" value={form.phone} onValueChange={onPhone} />
        </div>
        <div>
          <Label htmlFor="lead-phone2">{t.phone2}</Label>
          <PhoneInput id="lead-phone2" value={form.phone2} onValueChange={(v) => set("phone2", v)} />
        </div>
        {dup ? (
          <Notice tone="warning" className="sm:col-span-2">
            {t.duplicate(dup.name, dup.stage)}{" "}
            <Link href={`/leads/${dup.id}`} className="font-semibold underline">
              {t.duplicateOpen}
            </Link>
          </Notice>
        ) : null}
        <div>
          <Label>{t.gender}</Label>
          <Select value={form.gender || NONE} onValueChange={(v) => set("gender", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.choose}</SelectItem>
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
        <div>
          <Label>{t.source}</Label>
          <Select value={form.source || NONE} onValueChange={(v) => set("source", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.choose}</SelectItem>
              {[
                ...LEAD_SOURCES,
                ...(form.source && !LEAD_SOURCES.includes(form.source as never) ? [form.source] : []),
              ].map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t.course}</Label>
          <SearchSelect
            options={courses.map((c) => ({ value: c.id, label: c.name }))}
            value={form.courseId ? [form.courseId] : []}
            onChange={(v) => set("courseId", v[0] ?? "")}
            placeholder={t.noCourse}
            searchPlaceholder={t.courseSearch}
            emptyText={uz.common.nothingFound}
          />
        </div>
        <div>
          <Label>{t.assigned}</Label>
          <Select value={form.assignedTo || NONE} onValueChange={(v) => set("assignedTo", v === NONE ? "" : v)}>
            <SelectTrigger className="w-full" disabled={assignLocked}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{t.noStaff}</SelectItem>
              {staff
                .filter((s) => canReassign || s.id === me || s.id === form.assignedTo)
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="lead-target">{t.targetDate}</Label>
          <Input
            id="lead-target"
            type="date"
            value={form.targetDate}
            onChange={(e) => set("targetDate", e.target.value)}
          />
        </div>
        {fields.map((f) => (
          <CustomFieldInput
            key={f.id}
            field={f}
            idPrefix="lead-f"
            value={form.customData[f.id] ?? ""}
            onChange={(v) => setCustom(f.id, v)}
          />
        ))}
        <div className="sm:col-span-2">
          <Label htmlFor="lead-note">{t.note}</Label>
          <Textarea
            id="lead-note"
            rows={2}
            maxLength={1000}
            placeholder={t.notePlaceholder}
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
