"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { t } from "@/lib/i18n";
import { recordPaymentAction } from "./actions";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  locale: "uz" | "ru";
}

function InnerPaymentDialog({
  open,
  onOpenChange,
  workerId,
  locale,
}: PaymentDialogProps) {
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = React.useState<number | null>(null);
  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const numAmount = Number(amount ?? 0);
    if (!numAmount || numAmount <= 0) {
      setError("To'lov summasi 0 dan katta bo'lishi kerak");
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("workerId", workerId);
    fd.set("date", date);
    fd.set("amount", String(numAmount));
    if (note) fd.set("note", note);

    const res = await recordPaymentAction(fd);
    setLoading(false);

    if (!res.ok) {
      setError(res.error ?? "Xatolik yuz berdi");
      return;
    }

    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("payment_add", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 rounded-control border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="payment-date">{t("payment_date", locale)}</Label>
          <Input
            id="payment-date"
            type="date"
            required
            value={date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-amount">{t("payment_amount", locale)}</Label>
          <MoneyInput
            id="payment-amount"
            value={amount}
            onValueChange={setAmount}
            suffix="so'm"
            placeholder="Masalan: 500 000"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payment-note">{t("payment_note", locale)}</Label>
          <Input
            id="payment-note"
            type="text"
            placeholder="Izoh (masalan: Avans yoki haftalik hisob)"
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {t("action_cancel", locale)}
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? t("action_save", locale) + "..." : t("action_save", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PaymentDialog(props: PaymentDialogProps) {
  if (!props.open) return null;
  return <InnerPaymentDialog key={props.workerId + "-payment"} {...props} />;
}
