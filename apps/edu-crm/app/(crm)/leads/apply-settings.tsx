"use client";

import { Check, Copy, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Switch } from "@ventura/ui/switch";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { APPLY_PATH, type ApplyForm, iframeCode } from "@/lib/apply-form";
import type { FormField } from "@/lib/form-fields";
import { uz } from "@/lib/uz";
import type { PickerBranch } from "../branch-picker";
import { saveApplyFormAction } from "./actions";

const t = uz.leads;
const FIRST = "__first";

/** Nusxalash tugmasi: bosilgach bir zum belgi ko'rsatadi */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ tone: "danger", title: uz.common.invalid });
    }
  }
  return (
    <Button variant="ghost" size="sm" onClick={copy} aria-live="polite">
      {copied ? <Check /> : <Copy />} {copied ? t.applyCopied : t.applyCopy}
    </Button>
  );
}

/**
 * "Ariza sahifasi" sozlamasi (ADR 0026): yoqish, havola va iframe kodi, sarlavha va matnlar, filial, kurs va
 * "Lid formasi"dagi qaysi maydonlar ko'rinishi.
 */
export function ApplySettingsModal({
  open,
  onOpenChange,
  value,
  branches,
  fields,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: ApplyForm;
  branches: PickerBranch[];
  fields: FormField[];
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(value);
  const [pending, startTransition] = React.useTransition();
  const [wasOpen, setWasOpen] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setForm(value);
  }
  const set = <K extends keyof ApplyForm>(k: K, v: ApplyForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const choosable = fields.filter((f) => f.type !== "group");
  // Oyna faqat brauzerda ochiladi — manzil shu yerdan
  const url = typeof window === "undefined" ? APPLY_PATH : `${window.location.origin}${APPLY_PATH}`;

  function toggleField(id: string, on: boolean) {
    // Sahifadagi tartib — "Lid formasi"dagi tartib
    const next = new Set(form.fieldIds);
    if (on) next.add(id);
    else next.delete(id);
    set(
      "fieldIds",
      choosable.filter((f) => next.has(f.id)).map((f) => f.id),
    );
  }

  function save() {
    startTransition(async () => {
      const res = await saveApplyFormAction(form);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.applySaved });
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={t.applyTitle}
      description={t.applyIntro}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {uz.common.cancel}
          </Button>
          <Button onClick={save} disabled={pending}>
            <Check /> {uz.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-control border border-border-soft p-4">
          <span className="min-w-0">
            <span className="block text-body font-semibold text-foreground">{t.applyEnabled}</span>
            <span className="block text-xs text-muted-foreground">{t.applyEnabledHint}</span>
          </span>
          <Switch checked={form.enabled} onCheckedChange={(v) => set("enabled", v)} />
        </label>

        <div className="space-y-3">
          <div>
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="apply-url">{t.applyLink}</Label>
              <div className="flex gap-1">
                <CopyButton text={url} />
                <Button variant="ghost" size="sm" asChild>
                  <a href={APPLY_PATH} target="_blank" rel="noopener">
                    <ExternalLink /> {t.applyOpen}
                  </a>
                </Button>
              </div>
            </div>
            <Input id="apply-url" readOnly className="font-mono" value={url} onFocus={(e) => e.target.select()} />
          </div>
          <div>
            <div className="flex items-end justify-between gap-2">
              <Label htmlFor="apply-iframe">{t.applyIframe}</Label>
              <CopyButton text={iframeCode(url, form.title || uz.apply.defaultTitle)} />
            </div>
            <Textarea
              id="apply-iframe"
              readOnly
              rows={3}
              className="font-mono text-xs"
              value={iframeCode(url, form.title || uz.apply.defaultTitle)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="apply-title">{t.applyFormTitle}</Label>
            <Input
              id="apply-title"
              maxLength={120}
              placeholder={uz.apply.defaultTitle}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="apply-intro">{t.applyFormIntro}</Label>
            <Textarea
              id="apply-intro"
              rows={2}
              maxLength={500}
              placeholder={uz.apply.defaultIntro}
              value={form.intro}
              onChange={(e) => set("intro", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="apply-success">{t.applySuccess}</Label>
            <Textarea
              id="apply-success"
              rows={2}
              maxLength={300}
              placeholder={uz.apply.defaultSuccess}
              value={form.success}
              onChange={(e) => set("success", e.target.value)}
            />
          </div>
          {branches.length > 1 ? (
            <>
              <div>
                <Label>{t.applyBranch}</Label>
                <Select
                  value={form.branchId && branches.some((b) => b.id === form.branchId) ? form.branchId : FIRST}
                  onValueChange={(v) => set("branchId", v === FIRST ? null : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={FIRST}>{branches[0]!.name}</SelectItem>
                    {branches.slice(1).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end pb-2.5">
                <ChoiceField
                  label={t.applyAskBranch}
                  control={<Checkbox checked={form.askBranch} onCheckedChange={(v) => set("askBranch", v === true)} />}
                />
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <ChoiceField
              label={t.applyAskCourse}
              control={<Checkbox checked={form.askCourse} onCheckedChange={(v) => set("askCourse", v === true)} />}
            />
          </div>
        </div>

        <div>
          <Label>{t.applyFields}</Label>
          <FieldHint>{t.applyFieldsHint}</FieldHint>
          {choosable.length ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {choosable.map((f) => (
                <ChoiceField
                  key={f.id}
                  label={f.label}
                  description={f.required ? uz.staff.fieldRequired : undefined}
                  control={
                    <Checkbox
                      checked={form.fieldIds.includes(f.id)}
                      onCheckedChange={(v) => toggleField(f.id, v === true)}
                    />
                  }
                />
              ))}
            </div>
          ) : (
            <p className="mt-2 text-body text-muted-foreground">{t.applyNoFields}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
