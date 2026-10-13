"use client";

import { Calendar, Hash, List, PhoneCall, Plus, RotateCcw, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { FIELD_TYPES, type FieldType, type FormField } from "@/lib/form-fields";
import type { ActionResult } from "@/lib/server/action";
import { uz } from "@/lib/uz";

const TYPE_ICON: Record<FieldType, React.ReactNode> = {
  text: <Type />,
  number: <Hash />,
  date: <Calendar />,
  tel: <PhoneCall />,
  select: <List />,
};

/** Maydon id: nomdan lotin harflari, takrorlansa raqam qo'shiladi */
function fieldId(label: string, taken: readonly string[]) {
  const base =
    label
      .toLowerCase()
      .replace(/[ʻʼ'`]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || "field";
  let id = base;
  for (let i = 2; taken.includes(id); i++) id = `${base}_${i}`;
  return id;
}

/** Formadagi qo'shimcha maydonlar sozlamasi — xodim va o'quvchi formalari uchun bitta oyna */
export function FieldsModal({
  open,
  onOpenChange,
  fields,
  canWrite,
  defaults,
  save,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fields: FormField[];
  canWrite: boolean;
  /** "Standart holatga qaytarish" ro'yxati; bo'sh bo'lsa tugma ko'rinmaydi */
  defaults: FormField[];
  save: (fields: FormField[]) => Promise<ActionResult>;
  title: string;
  description: string;
}) {
  const router = useRouter();
  const [list, setList] = React.useState(fields);
  const [label, setLabel] = React.useState("");
  const [type, setType] = React.useState<FieldType>("text");
  const [placeholder, setPlaceholder] = React.useState("");
  const [required, setRequired] = React.useState(false);
  const [optionsText, setOptionsText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setList(fields);
      setError(null);
    }
  }

  function persist(next: FormField[]) {
    startTransition(async () => {
      const res = await save(next);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      setList(next);
      toast({ tone: "success", title: uz.staff.fieldsSaved });
      router.refresh();
    });
  }

  function add() {
    const name = label.trim();
    if (!name) return setError(uz.staff.fieldLabelRequired);
    const options =
      type === "select"
        ? optionsText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    if (type === "select" && !options.length) return setError(uz.staff.fieldOptionsRequired);
    const field: FormField = {
      id: fieldId(
        name,
        list.map((f) => f.id),
      ),
      label: name,
      type,
      placeholder: placeholder.trim(),
      required,
      options,
    };
    persist([...list, field]);
    setLabel("");
    setType("text");
    setPlaceholder("");
    setRequired(false);
    setOptionsText("");
    setError(null);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      position="center"
      wide
      title={title}
      description={description}
      footer={
        <>
          {canWrite && defaults.length ? (
            <Button variant="ghost" className="mr-auto" disabled={pending} onClick={() => persist(defaults)}>
              <RotateCcw /> {uz.staff.fieldsReset}
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>{uz.staff.done}</Button>
        </>
      }
    >
      <div className="space-y-5">
        <ul className="space-y-2">
          {list.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-control border border-border-soft px-3 py-2.5 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground"
            >
              {TYPE_ICON[f.type]}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-body font-semibold text-foreground">{f.label}</span>
                  {f.required ? <Badge tone="warning">{uz.staff.fieldRequired}</Badge> : null}
                </div>
                <div className="truncate text-caption text-muted-foreground">
                  {uz.staff.fieldTypes[f.type]}
                  {f.type === "select" ? ` · ${f.options.join(", ")}` : f.placeholder ? ` · ${f.placeholder}` : ""}
                </div>
              </div>
              {canWrite ? (
                <Button
                  variant="icon"
                  size="icon-sm"
                  className="text-destructive-text"
                  title={uz.staff.fieldDelete}
                  aria-label={`${f.label} — ${uz.staff.fieldDelete}`}
                  disabled={pending}
                  onClick={() => persist(list.filter((x) => x.id !== f.id))}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
          {!list.length ? <li className="text-body text-muted-foreground">{uz.staff.fieldsEmpty}</li> : null}
        </ul>

        {canWrite ? (
          <div className="space-y-4 rounded-card border border-border-soft p-4">
            <div className="text-body font-bold text-foreground">{uz.staff.fieldAddTitle}</div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px]">
              <Input
                aria-label={uz.staff.fieldLabel}
                placeholder={uz.staff.fieldLabel}
                value={label}
                maxLength={80}
                onChange={(e) => {
                  setLabel(e.target.value);
                  setError(null);
                }}
              />
              <Select value={type} onValueChange={(v) => setType(v as FieldType)}>
                <SelectTrigger className="w-full" aria-label={uz.staff.fieldType}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {uz.staff.fieldTypes[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {type === "select" ? (
              <div>
                <Label htmlFor="field-options">{uz.staff.fieldOptions}</Label>
                <Input id="field-options" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} />
              </div>
            ) : (
              <Input
                aria-label={uz.staff.fieldPlaceholder}
                placeholder={uz.staff.fieldPlaceholder}
                value={placeholder}
                maxLength={80}
                onChange={(e) => setPlaceholder(e.target.value)}
              />
            )}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <ChoiceField
                label={uz.staff.fieldRequiredCheck}
                control={<Checkbox checked={required} onCheckedChange={(v) => setRequired(v === true)} />}
              />
              <Button onClick={add} disabled={pending}>
                <Plus /> {uz.staff.fieldAdd}
              </Button>
            </div>
            {error ? <FieldHint error>{error}</FieldHint> : null}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
