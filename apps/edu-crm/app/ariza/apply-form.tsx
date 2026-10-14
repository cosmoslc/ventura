"use client";

import { CheckCircle2, Send, User } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { PhoneInput } from "@ventura/ui/phone-input";
import { SearchSelect } from "@ventura/ui/search-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { plausiblePhone } from "@/lib/apply-form";
import { type FormField, missingRequired } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import { CustomFieldInput } from "../(crm)/custom-field-input";
import { submitApplyAction } from "./actions";

const t = uz.apply;

/**
 * Ariza formasi (ADR 0026): ism, telefon, kerak bo'lsa filial va kurs, sozlamada tanlangan qo'shimcha maydonlar.
 * "website" — yashirin tuzoq maydon (ekrandan tashqarida, Tab bilan ham kelinmaydi).
 */
export function ApplyForm({
  stamp,
  branches,
  defaultBranch,
  courses,
  fields,
  success,
}: {
  stamp: string;
  /** Bo'sh — filial so'ralmaydi */
  branches: { id: string; name: string }[];
  defaultBranch: string | null;
  /** null — kurs so'ralmaydi */
  courses: { id: string; name: string; branchId: string | null }[] | null;
  fields: FormField[];
  success: string;
}) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [branchId, setBranchId] = React.useState(
    branches.some((b) => b.id === defaultBranch) ? defaultBranch! : (branches[0]?.id ?? ""),
  );
  const [courseId, setCourseId] = React.useState("");
  const [customData, setCustomData] = React.useState<Record<string, string>>({});
  const [website, setWebsite] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const courseList = (courses ?? []).filter((c) => !branchId || !c.branchId || c.branchId === branchId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setError(t.nameRequired);
    if (!plausiblePhone(phone)) return setError(t.phoneInvalid);
    const missing = missingRequired(customData, fields);
    if (missing) return setError(t.fieldMissing(missing.label));
    setError(null);
    startTransition(async () => {
      const res = await submitApplyAction({
        name,
        phone,
        branchId: branchId || null,
        courseId: courseList.some((c) => c.id === courseId) ? courseId : null,
        customData,
        website,
        stamp,
      });
      if (!res.ok) return setError(res.error);
      setDone(true);
    });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <CheckCircle2 className="size-10 text-(--success-fg)" aria-hidden />
        <p className="type-heading text-base text-foreground">{t.sentTitle}</p>
        <p className="whitespace-pre-line text-body text-muted-foreground">{success}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <div>
        <Label htmlFor="apply-name">{t.name} *</Label>
        <Input
          id="apply-name"
          icon={<User />}
          autoComplete="name"
          placeholder={uz.leads.namePlaceholder}
          maxLength={120}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
      </div>
      <div>
        <Label htmlFor="apply-phone">{t.phone} *</Label>
        <PhoneInput
          id="apply-phone"
          value={phone}
          onValueChange={(v) => {
            setPhone(v);
            setError(null);
          }}
        />
      </div>
      {branches.length ? (
        <div>
          <Label>{t.branch}</Label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-full">
              <SelectValue />
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
      {courses?.length ? (
        <div>
          <Label>{t.course}</Label>
          <SearchSelect
            options={courseList.map((c) => ({ value: c.id, label: c.name }))}
            value={courseId ? [courseId] : []}
            onChange={(v) => setCourseId(v[0] ?? "")}
            placeholder={t.coursePlaceholder}
            searchPlaceholder={uz.leads.courseSearch}
            emptyText={uz.common.nothingFound}
          />
        </div>
      ) : null}
      {fields.map((f) => (
        <CustomFieldInput
          key={f.id}
          field={f}
          idPrefix="apply-f"
          value={customData[f.id] ?? ""}
          onChange={(v) => {
            setCustomData((d) => ({ ...d, [f.id]: v }));
            setError(null);
          }}
        />
      ))}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="apply-website">Website</label>
        <input
          id="apply-website"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>
      {error ? <FieldHint error>{error}</FieldHint> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        <Send /> {pending ? t.sending : t.submit}
      </Button>
      <p className="text-caption text-muted-foreground">{t.privacy}</p>
    </form>
  );
}
