"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { type Locale, t } from "@/lib/i18n";
import { createTruckAction, updateTruckAction } from "./actions";

export interface TruckData {
  id?: string;
  name: string;
  amount: number;
}

interface TruckDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  truck?: TruckData | null;
  locale: Locale;
}

function TruckDialogInner({ open, onOpenChange, truck, locale }: TruckDialogProps) {
  const isEdit = !!truck?.id;
  const [name, setName] = React.useState(truck?.name ?? "");
  const [amount, setAmount] = React.useState<number | null>(truck?.amount ?? 0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    if (truck?.id) formData.append("id", truck.id);
    formData.append("name", name);
    formData.append("amount", String(amount ?? 0));

    const res = isEdit ? await updateTruckAction(formData) : await createTruckAction(formData);

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? t("status_error", locale));
      return;
    }

    onOpenChange(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("trucks_edit", locale) : t("trucks_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="truck-name">{t("trucks_name", locale)} *</Label>
          <Input
            id="truck-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Isuzu 01 A 777 AA"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="truck-amount">{t("trucks_amount", locale)}</Label>
          <MoneyInput
            id="truck-amount"
            value={amount}
            onValueChange={setAmount}
            suffix="so'm"
            placeholder="150000"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("action_cancel", locale)}
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? t("status_loading", locale) : t("action_save", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TruckDialog(props: TruckDialogProps) {
  if (!props.open) return null;
  return <TruckDialogInner key={props.truck?.id ?? "new"} {...props} />;
}
