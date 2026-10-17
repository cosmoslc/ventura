"use client";

import { Check, MapPin, Plus, User } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField, RadioCard, RadioGroup } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { firstError, staffInput } from "@/lib/rules";
import { type FormField, missingRequired } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import { CustomFieldInput } from "../custom-field-input";
import type { PickerBranch } from "../branch-picker";
import { saveStaffAction } from "./actions";
import type { PositionOption, StaffRow } from "./data";
import type { StaffPerms } from "./staff-menu";

interface Form {
  name: string;
  phone: string;
  gender: "male" | "female" | "";
  birthDate: string;
  address: string;
  note: string;
  positionIds: string[];
  branchIds: string[];
  salaryType: "fixed" | "kpi";
  monthlySalary: number | null;
  kpiStudentAmount: number | null;
  kpiContractBonus: number | null;
  customData: Record<string, string>;
}

export function StaffForm({
  open,
  onOpenChange,
  editing,
  positions,
  branches,
  fields,
  perms,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: StaffRow | null;
  positions: PositionOption[];
  branches: PickerBranch[];
  fields: FormField[];
  perms: StaffPerms;
  /** Yangi xodim bo'lsa — vaqtinchalik parol */
  onSaved: (password: string | null) => void;
}) {
  const defaults = React.useCallback(
    (): Form => ({
      name: editing?.name ?? "",
      phone: editing?.phone ?? "",
      gender: editing?.gender ?? "",
      birthDate: editing?.birthDate ?? "",
      address: editing?.address ?? "",
      note: editing?.note ?? "",
      positionIds: editing?.positions.map((p) => p.id) ?? [],
      // Yangi xodim: filial tanlanmagan bo'sh; faqat bitta filial bo'lsa (tanlov ko'rinmaydi) o'sha biriktiriladi
      branchIds: editing?.branchIds ?? (branches.length === 1 ? [branches[0]!.id] : []),
      salaryType: editing?.salaryType ?? "fixed",
      monthlySalary: editing ? editing.monthlySalary : null,
      kpiStudentAmount: editing ? editing.kpiStudentAmount : null,
      kpiContractBonus: editing ? editing.kpiContractBonus : null,
      customData: editing?.customData ?? {},
    }),
    [editing, branches],
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
  const toggleIn = (k: "positionIds" | "branchIds", id: string, on: boolean) =>
    set(k, on ? [...form[k], id] : form[k].filter((x) => x !== id));
  const setCustom = (id: string, v: string) => set("customData", { ...form.customData, [id]: v });

  // Lavozim, filial va maosh — faqat biriktirish ruxsati bilan va o'zinikini emas
  const assignLocked = !perms.assign || !!editing?.self;
  const assignHint = editing?.self ? uz.staff.selfForbidden : !perms.assign ? uz.staff.notAllowedFields : null;
  const kpi = form.salaryType === "kpi";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = staffInput.safeParse({
      id: editing?.id,
      name: form.name,
      phone: form.phone,
      gender: form.gender || null,
      birthDate: form.birthDate,
      address: form.address,
      note: form.note,
      positionIds: form.positionIds,
      branchIds: form.branchIds,
      salaryType: form.salaryType,
      monthlySalary: form.monthlySalary ?? 0,
      kpiStudentAmount: kpi ? (form.kpiStudentAmount ?? 0) : 0,
      kpiContractBonus: kpi ? (form.kpiContractBonus ?? 0) : 0,
      customData: form.customData,
    });
    if (!parsed.success) return setError(firstError(parsed.error));
    if (!assignLocked && !form.positionIds.length) return setError(uz.staff.positionRequired);
    if (!assignLocked && !form.branchIds.length) return setError(uz.staff.branchRequired);
    const missing = missingRequired(form.customData, fields);
    if (missing) return setError(uz.staff.fieldMissing(missing.label));
    startTransition(async () => {
      const res = await saveStaffAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: editing ? uz.staff.updated : uz.staff.created, description: parsed.data.name });
      onOpenChange(false);
      onSaved(res.password);
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editing ? uz.staff.formEdit : uz.staff.formNew}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="staff-form" disabled={pending}>
            {editing ? <Check /> : <Plus />} {editing ? uz.common.save : uz.staff.submitNew}
          </Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={submit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="staff-name">{uz.staff.name} *</Label>
            <Input
              id="staff-name"
              autoFocus
              icon={<User />}
              placeholder={uz.staff.namePlaceholder}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="staff-phone">{uz.staff.phone} *</Label>
            <PhoneInput id="staff-phone" value={form.phone} onValueChange={(v) => set("phone", v)} />
          </div>
          <div>
            <Label>{uz.staff.gender}</Label>
            <Select value={form.gender} onValueChange={(v) => set("gender", v as Form["gender"])}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={uz.staff.choose} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">{uz.staff.male}</SelectItem>
                <SelectItem value="female">{uz.staff.female}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="staff-birth">{uz.staff.birthDate}</Label>
            <Input
              id="staff-birth"
              type="date"
              value={form.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="staff-address">{uz.staff.address}</Label>
            <Input
              id="staff-address"
              icon={<MapPin />}
              placeholder={uz.staff.addressPlaceholder}
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>
        </div>

        {assignHint ? <FieldHint>{assignHint}</FieldHint> : null}

        <fieldset disabled={assignLocked} className="space-y-5 disabled:opacity-70">
          <div>
            <Label>{uz.staff.positions} *</Label>
            <div className="grid gap-2.5 rounded-control border border-border-soft p-3 sm:grid-cols-2">
              {positions.map((p) => {
                const on = form.positionIds.includes(p.id);
                return (
                  <ChoiceField
                    key={p.id}
                    label={
                      <span className="flex items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                        {p.name}
                      </span>
                    }
                    description={p.assignable ? undefined : uz.staff.positionTooWide}
                    control={
                      <Checkbox
                        checked={on}
                        disabled={assignLocked || (!on && !p.assignable)}
                        onCheckedChange={(v) => toggleIn("positionIds", p.id, v === true)}
                      />
                    }
                  />
                );
              })}
            </div>
          </div>

          {branches.length > 1 || (editing && editing.branchIds.length !== 1) ? (
            <div>
              <Label>{uz.staff.branches} *</Label>
              <div className="grid gap-2.5 rounded-control border border-border-soft p-3 sm:grid-cols-2">
                {branches.map((b) => (
                  <ChoiceField
                    key={b.id}
                    label={b.name}
                    control={
                      <Checkbox
                        checked={form.branchIds.includes(b.id)}
                        disabled={assignLocked}
                        onCheckedChange={(v) => toggleIn("branchIds", b.id, v === true)}
                      />
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <Label>{uz.staff.salaryKind}</Label>
            <RadioGroup
              value={form.salaryType}
              onValueChange={(v) => set("salaryType", v as Form["salaryType"])}
              className="grid-cols-2"
              disabled={assignLocked}
            >
              <RadioCard value="fixed" title={uz.staff.salaryFixedOption} />
              <RadioCard value="kpi" title={uz.staff.salaryKpiOption} />
            </RadioGroup>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className={kpi ? undefined : "sm:col-span-3"}>
              <Label htmlFor="staff-salary">{kpi ? uz.staff.salaryBase : uz.staff.salaryFixed}</Label>
              <MoneyInput
                id="staff-salary"
                value={form.monthlySalary}
                onValueChange={(v) => set("monthlySalary", v)}
                suffix={uz.common.som}
                placeholder={kpi ? "0" : "5 000 000"}
              />
            </div>
            {kpi ? (
              <>
                <div>
                  <Label htmlFor="staff-kpi-student">{uz.staff.kpiStudent}</Label>
                  <MoneyInput
                    id="staff-kpi-student"
                    value={form.kpiStudentAmount}
                    onValueChange={(v) => set("kpiStudentAmount", v)}
                    suffix={uz.common.som}
                    placeholder="50 000"
                  />
                </div>
                <div>
                  <Label htmlFor="staff-kpi-bonus">{uz.staff.kpiBonus}</Label>
                  <MoneyInput
                    id="staff-kpi-bonus"
                    value={form.kpiContractBonus}
                    onValueChange={(v) => set("kpiContractBonus", v)}
                    suffix={uz.common.som}
                    placeholder="100 000"
                  />
                </div>
              </>
            ) : null}
          </div>
        </fieldset>

        {fields.length ? (
          <div className="grid gap-4 border-t border-border-soft pt-5 sm:grid-cols-2">
            {fields.map((f) => (
              <CustomFieldInput
                key={f.id}
                field={f}
                idPrefix="staff-f"
                value={form.customData[f.id] ?? ""}
                onChange={(v) => setCustom(f.id, v)}
              />
            ))}
          </div>
        ) : null}

        <div>
          <Label htmlFor="staff-note">{uz.staff.note}</Label>
          <Textarea
            id="staff-note"
            placeholder={uz.staff.notePlaceholder}
            value={form.note}
            maxLength={1000}
            onChange={(e) => set("note", e.target.value)}
          />
        </div>

        {error ? <FieldHint error>{error}</FieldHint> : null}
      </form>
    </Modal>
  );
}
