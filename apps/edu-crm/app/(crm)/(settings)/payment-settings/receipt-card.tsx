"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Card } from "@ventura/ui/card";
import { Checkbox, ChoiceField } from "@ventura/ui/checkbox";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Textarea } from "@ventura/ui/textarea";
import { toast } from "@ventura/ui/toast";
import { displayPhone } from "@/lib/format";
import { qrPath } from "@/lib/qr";
import { PAPER_SIZES, type PaperSize, type ReceiptConfig } from "@/lib/receipt-config";
import { uz } from "@/lib/uz";
import { ReceiptSheet } from "@/app/(print)/payments/[id]/receipt/receipt-sheet";
import { saveReceiptConfigAction } from "./actions";

const t = uz.receiptSettings;

/** Chek sozlamalari va jonli ko'rinishi (E6b). Telefon, manzil va QR havolasi — "Markaz sozlamalari"dan. */
export function ReceiptCard({
  config,
  centerName,
  phone,
  place,
  qrLink,
  canEdit,
}: {
  config: ReceiptConfig;
  centerName: string;
  /** Markaz telefoni (9 raqam) yoki "" */
  phone: string;
  /** Chekdagi manzil qatori namunasi */
  place: string;
  /** QR olib boradigan manzil yoki "" */
  qrLink: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = React.useState(config);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof ReceiptConfig>(k: K, v: ReceiptConfig[K]) => setForm((f) => ({ ...f, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveReceiptConfigAction(form);
      if (!res.ok) return void toast({ tone: "danger", title: res.error });
      toast({ tone: "success", title: t.saved });
      router.refresh();
    });
  }

  const qr = form.showQr ? qrPath(qrLink) : null;
  const rows: [string, string][] = [
    [uz.payments.receiptStudent, t.sampleStudent],
    [uz.payments.receiptGroup, t.sampleGroup],
  ];
  return (
    <Card className="p-5">
      <h2 className="type-heading mb-5 text-base">{t.title}</h2>
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={submit} className="min-w-0 space-y-5">
          <div>
            <Label htmlFor="r-header">{t.header}</Label>
            <Input
              id="r-header"
              maxLength={80}
              disabled={!canEdit}
              placeholder={centerName}
              value={form.header}
              onChange={(e) => set("header", e.target.value)}
            />
            <FieldHint>{t.headerHint}</FieldHint>
          </div>
          <div>
            <Label htmlFor="r-footer">{t.footer}</Label>
            <Textarea
              id="r-footer"
              rows={2}
              maxLength={200}
              disabled={!canEdit}
              placeholder={t.footerPlaceholder}
              value={form.footer}
              onChange={(e) => set("footer", e.target.value)}
            />
          </div>
          <div>
            <Label>{t.paper}</Label>
            <Select value={form.paper} onValueChange={(v) => set("paper", v as PaperSize)}>
              <SelectTrigger className="w-full" disabled={!canEdit}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAPER_SIZES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t.paperOptions[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ChoiceField
            control={
              <Checkbox checked={form.showQr} disabled={!canEdit} onCheckedChange={(v) => set("showQr", v === true)} />
            }
            label={t.showQr}
            description={
              qrLink ? (
                t.showQrHint
              ) : (
                <>
                  {t.showQrMissing}{" "}
                  <Link href="/settings" className="font-semibold text-(--primary-text) hover:underline">
                    {t.showQrMissingLink}
                  </Link>
                </>
              )
            }
          />
          <ChoiceField
            control={
              <Checkbox
                checked={form.autoPrint}
                disabled={!canEdit}
                onCheckedChange={(v) => set("autoPrint", v === true)}
              />
            }
            label={t.autoPrint}
          />
          {canEdit ? (
            <Button type="submit" disabled={pending}>
              <Check /> {uz.common.save}
            </Button>
          ) : null}
        </form>
        <div className="min-w-0">
          <div className="type-label mb-2 text-(--label-fg)">{t.preview}</div>
          <div className="overflow-x-auto rounded-card border border-border bg-muted/40 p-4">
            <ReceiptSheet
              config={form}
              title={form.header.trim() || centerName}
              place={place}
              tel={phone ? t.tel(displayPhone(phone) ?? phone) : null}
              receiptNo={uz.payments.receiptNo(1)}
              voidedLabel={null}
              rows={rows}
              totalLabel={uz.payments.receiptTotal}
              total={`0 ${uz.common.som}`}
              footer={form.footer.trim() || uz.payments.receiptThanks}
              qr={qr}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
