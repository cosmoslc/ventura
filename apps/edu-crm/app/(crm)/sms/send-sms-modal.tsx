"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Notice } from "@ventura/ui/notice";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { toast } from "@ventura/ui/toast";
import { SAMPLE_VARS, renderSms, smsParts } from "@/lib/sms-text";
import { uz } from "@/lib/uz";
import { type SendableTemplate, sendSmsAction, smsSendOptionsAction } from "./actions";

const t = uz.smsSend;
type Audience = "parent" | "student" | "both";

/**
 * Qo'lda SMS (S3): tanlangan o'quvchilarga shablon bo'yicha. Shablonlar oyna ochilganda olinadi (sahifalar ularni
 * oldindan yuklamaydi). Matn har o'quvchi uchun serverda o'z qiymatlari bilan to'ldiriladi — bu yerda namuna.
 */
export function SendSmsModal({
  open,
  onOpenChange,
  source,
  studentIds,
  groupId,
  title,
  centerName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: "students" | "debtors" | "group";
  studentIds: readonly string[];
  groupId?: string | null;
  /** Ommaviy yuborish nomi (hisobotda ko'rinadi) */
  title: string;
  centerName: string;
  onSent?: () => void;
}) {
  const [options, setOptions] = React.useState<{ connected: boolean; templates: SendableTemplate[] } | null>(null);
  const [templateId, setTemplateId] = React.useState("");
  const [audience, setAudience] = React.useState<Audience>("parent");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    void smsSendOptionsAction().then((res) => {
      if (!alive) return;
      if (!res.ok) return setError(res.error);
      setError(null);
      setOptions(res);
      // Qarzdorlarga — qarz shabloni, boshqalarga — birinchisi
      const preferred = source === "debtors" ? res.templates.find((x) => x.kind === "debt_warning") : null;
      setTemplateId((cur) =>
        res.templates.some((x) => x.id === cur) ? cur : ((preferred ?? res.templates[0])?.id ?? ""),
      );
    });
    return () => {
      alive = false;
    };
  }, [open, source]);

  const template = options?.templates.find((x) => x.id === templateId) ?? null;
  const preview = template ? renderSms(template.body, { ...SAMPLE_VARS, markaz: centerName }) : "";
  const parts = smsParts(preview).parts;
  const ready = !!options?.connected && !!template && studentIds.length > 0;

  function submit() {
    if (!template) return;
    startTransition(async () => {
      const res = await sendSmsAction({
        source,
        templateId: template.id,
        audience,
        studentIds: [...studentIds],
        groupId: groupId ?? null,
        title,
      });
      if (!res.ok) return setError(res.error);
      toast({
        tone: "success",
        title: t.sent(res.queued),
        description: res.skipped ? t.skipped(res.skipped) : undefined,
      });
      onOpenChange(false);
      onSent?.();
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={t.recipients(studentIds.length)}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            {uz.common.cancel}
          </Button>
          <Button onClick={submit} disabled={!ready || pending}>
            <Send /> {t.send}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Notice tone="danger">{error}</Notice> : null}
        {!options && !error ? <p className="text-body text-muted-foreground">{t.loading}</p> : null}
        {options && !options.connected ? (
          <Notice tone="warning">
            {t.notConnected}{" "}
            <Link href="/sms/settings" className="font-semibold underline">
              {t.notConnectedLink}
            </Link>
          </Notice>
        ) : null}
        {options?.connected && !options.templates.length ? (
          <Notice tone="warning">
            {t.noTemplates}{" "}
            <Link href="/sms/templates" className="font-semibold underline">
              {t.noTemplatesLink}
            </Link>
          </Notice>
        ) : null}

        {options?.connected && options.templates.length ? (
          <>
            <div>
              <Label htmlFor="sms-send-template">{t.template}</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger id="sms-send-template">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.templates.map((x) => (
                    <SelectItem key={x.id} value={x.id}>
                      {x.name} · {uz.smsTemplates.moderation[x.moderation]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="sms-send-audience">{t.audience}</Label>
              <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                <SelectTrigger id="sms-send-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["parent", "student", "both"] as const).map((a) => (
                    <SelectItem key={a} value={a}>
                      {t.audiences[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {template ? (
              <div>
                <div className="flex items-end justify-between gap-3">
                  <Label>{t.preview}</Label>
                  <span className="mb-1.5 font-mono text-caption text-muted-foreground">
                    {uz.smsTemplates.parts(parts)}
                  </span>
                </div>
                <div className="rounded-card border border-border bg-muted/40 p-3 text-body whitespace-pre-line text-foreground">
                  {preview}
                </div>
                {template.moderation !== "approved" ? (
                  <p className="mt-1.5 text-caption text-muted-foreground">{t.notApproved}</p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}
