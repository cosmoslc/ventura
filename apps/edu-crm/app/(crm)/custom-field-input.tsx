"use client";

import * as React from "react";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { SearchSelect, type SearchSelectOption } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { type FormField, splitMulti } from "@/lib/form-fields";
import { uz } from "@/lib/uz";

const NONE = "__none";

/**
 * Formadagi qo'shimcha maydon (xodim va o'quvchi formalari uchun bitta). Turi bo'yicha: matn, raqam, telefon, sana,
 * soat, tanlov, ko'p tanlov, belgilash va guruh tanlash (guruhlar ro'yxatidan, qidiruv bilan).
 */
export function CustomFieldInput({
  field: f,
  value,
  onChange,
  idPrefix,
  groups = [],
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  idPrefix: string;
  /** Guruh tanlash maydoni uchun variantlar */
  groups?: readonly SearchSelectOption[];
}) {
  const id = `${idPrefix}-${f.id}`;
  const label = (
    <>
      {f.label}
      {f.required ? " *" : ""}
    </>
  );

  if (f.type === "checkbox") {
    return (
      <div className="flex min-h-full items-end pb-2.5">
        <ChoiceField
          label={label}
          description={f.placeholder || undefined}
          control={
            <Checkbox id={id} checked={value === "1"} onCheckedChange={(v) => onChange(v === true ? "1" : "")} />
          }
        />
      </div>
    );
  }

  let control: React.ReactNode;
  switch (f.type) {
    case "select":
      control = (
        <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder={uz.staff.choose} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{uz.staff.choose}</SelectItem>
            {f.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
      break;
    case "multiselect":
      control = (
        <SearchSelect
          id={id}
          multiple
          searchable={f.options.length > 6}
          options={f.options.map((o) => ({ value: o, label: o }))}
          value={splitMulti(value)}
          onChange={(v) => onChange(f.options.filter((o) => v.includes(o)).join(", "))}
          placeholder={f.placeholder || uz.staff.choose}
          searchPlaceholder={uz.common.search}
          emptyText={uz.common.nothingFound}
        />
      );
      break;
    case "group":
      control = (
        <SearchSelect
          id={id}
          options={groups}
          value={value ? [value] : []}
          onChange={(v) => onChange(v[0] ?? "")}
          placeholder={f.placeholder || uz.staff.chooseGroup}
          searchPlaceholder={uz.staff.searchGroup}
          emptyText={uz.common.nothingFound}
        />
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type={f.type}
          inputMode={f.type === "number" ? "numeric" : undefined}
          placeholder={f.placeholder || f.label}
          value={value}
          maxLength={300}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      {control}
    </div>
  );
}
