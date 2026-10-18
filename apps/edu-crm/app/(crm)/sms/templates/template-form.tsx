"use client";

import { Check, Sparkles } from "lucide-react";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { cn } from "@ventura/ui/lib/utils";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { firstError } from "@/lib/rules";
import {
  KIND_VARS,
  SAMPLE_VARS,
  SMS_PRESETS,
  SMS_TEMPLATE_KINDS,
  type SmsTemplateKind,
  renderSms,
  smsParts,
  smsTemplateInput,
  unknownVars,
} from "@/lib/sms-text";
import type { SmsTemplateRow } from "@/lib/server/sms/templates";
import { uz } from "@/lib/uz";
import { saveSmsTemplateAction } from "./actions";

const t = uz.smsTemplates;

interface FormState {
  kind: SmsTemplateKind;
  name: string;
  body: string;
}

/** Shablon tahriri: o'zgaruvchi tugmalari, jonli namuna (namuna qiymatlar bilan) va belgi / qism hisoblagichi. */
export function TemplateForm({
  open,
  onOpenChange,
  editing,
  centerName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: SmsTemplateRow | null;
  centerName: string;
  onSaved: () => void;
}) {
  const defaults = React.useCallback(
    (): FormState => ({
      kind: editing?.kind ?? "payment_received",
      name: editing?.name ?? "",
      body: editing?.body ?? "",
    }),
    [editing],
  );
  const [form, setForm] = React.useState<FormState>(defaults);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [openedFor, setOpenedFor] = React.useState<string | null>(null);
  const bodyRef = React.useRef<HTMLTextAreaElement>(null);

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

  const preview = renderSms(form.body, { ...SAMPLE_VARS, markaz: centerName });
  const counter = smsParts(preview);
  const bad = unknownVars(form.body, form.kind);
  const preset = form.kind === "custom" ? null : SMS_PRESETS[form.kind];
  // Matn yuborilgandan keyin o'zgarsa Eskiz qayta tekshiradi
  const resubmit = !!editing && editing.moderation !== "draft" && editing.body !== form.body;

  function insertVar(v: string) {
    const el = bodyRef.current;
    const token = `{${v}}`;
    const start = el?.selectionStart ?? form.body.length;
    const end = el?.selectionEnd ?? form.body.length;
    set("body", form.body.slice(0, start) + token + form.body.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = smsTemplateInput.safeParse({ id: editing?.id, ...form });
    if (!parsed.success) return setError(firstError(parsed.error));
    startTransition(async () => {
      const res = await saveSmsTemplateAction(parsed.data);
      if (!res.ok) return setError(res.error);
      toast({ tone: "success", title: t.saved, description: parsed.data.name });
      onOpenChange(false);
      onSaved();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t.formEdit : t.formAdd}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button type="submit" form="sms-template-form" disabled={pending}>
            <Check /> {t.save}
          </Button>
        </>
      }
    >
      <form id="sms-template-form" onSubmit={submit} className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tpl-kind">{t.kind}</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v as SmsTemplateKind)}>
              <SelectTrigger id="tpl-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SMS_TEMPLATE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t.kinds[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="tpl-name">{t.name}</Label>
            <Input id="tpl-name" value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          </div>
        </div>

        <div>
          <div className="flex items-end justify-between gap-3">
            <Label htmlFor="tpl-body">{t.body}</Label>
            {preset && form.body !== preset ? (
              <Button type="button" variant="ghost" size="sm" className="mb-1.5" onClick={() => set("body", preset)}>
                <Sparkles /> {t.usePreset}
              </Button>
            ) : null}
          </div>
          <Textarea
            id="tpl-body"
            ref={bodyRef}
            rows={5}
            value={form.body}
            onChange={(e) => set("body", e.target.value)}
            aria-invalid={bad.length > 0 || undefined}
          />
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption text-muted-foreground">
            <span className={cn(bad.length && "text-(--danger-fg)")}>
              {bad.length ? t.unknownVars(bad.map((b) => `{${b}}`)) : counter.unicode ? t.unicode : null}
            </span>
            <span className="font-mono">
              {t.chars(counter.length, counter.perPart * counter.parts)} · {t.parts(counter.parts)}
            </span>
          </div>
        </div>

        <div>
          <Label>{t.vars}</Label>
          <div className="flex flex-wrap gap-1.5">
            {KIND_VARS[form.kind].map((v) => (
              <Button
                key={v}
                type="button"
                variant="ghost"
                size="sm"
                className="font-mono"
                onClick={() => insertVar(v)}
              >
                {`{${v}}`}
              </Button>
            ))}
          </div>
          <FieldHint>{t.varsHint}</FieldHint>
        </div>

        <div>
          <Label>{t.preview}</Label>
          <div className="min-h-16 rounded-card border border-border bg-muted/40 p-3 text-body whitespace-pre-line text-foreground">
            {preview || <span className="text-muted-foreground">—</span>}
          </div>
          {resubmit ? <FieldHint>{t.resubmitHint}</FieldHint> : null}
        </div>
      </form>
    </Modal>
  );
}
