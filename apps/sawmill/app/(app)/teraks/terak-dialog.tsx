"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import { createTerakAction, updateTerakAction } from "./actions";

export interface TerakData {
  id?: string;
  name: string;
  purchaseDate: string;
  purchasePrice: number;
  note?: string | null;
}

interface TerakDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terak?: TerakData | null;
  locale: Locale;
}

function TerakDialogInner({ open, onOpenChange, terak, locale }: TerakDialogProps) {
  const router = useRouter();
  const isEdit = !!terak?.id;
  const [name, setName] = React.useState(terak?.name ?? "");
  const [purchaseDate, setPurchaseDate] = React.useState(
    terak?.purchaseDate ?? new Date().toISOString().slice(0, 10),
  );
  const [purchasePrice, setPurchasePrice] = React.useState(String(terak?.purchasePrice ?? 0));
  const [note, setNote] = React.useState(terak?.note ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    if (terak?.id) formData.append("id", terak.id);
    if (name) formData.append("name", name);
    formData.append("purchaseDate", purchaseDate);
    formData.append("purchasePrice", purchasePrice);
    if (note) formData.append("note", note);

    const res = isEdit ? await updateTerakAction(formData) : await createTerakAction(formData);

    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? t("status_error", locale));
      return;
    }

    onOpenChange(false);
    if (!isEdit && res.id) {
      router.push(`/teraks/${res.id}`);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? t("teraks_edit", locale) : t("teraks_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="terak-name">{t("teraks_name", locale)}</Label>
          <Input
            id="terak-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ixtiyoriy (masalan, Terak 1)"
            autoFocus
          />
          <span className="text-2xs text-muted-foreground block">
            Bo'sh qoldirilsa, avtomatik "Terak N" deb nomlanadi.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="terak-date">{t("teraks_purchase_date", locale)} *</Label>
            <Input
              id="terak-date"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="terak-price">{t("teraks_purchase_price", locale)} (so'm)</Label>
            <Input
              id="terak-price"
              type="number"
              min="0"
              step="10000"
              value={purchasePrice}
              onChange={(e) => setPurchasePrice(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="terak-note">{t("teraks_note", locale)}</Label>
          <Input
            id="terak-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Partiya haqida qisqacha ma'lumot..."
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

export function TerakDialog(props: TerakDialogProps) {
  if (!props.open) return null;
  return <TerakDialogInner key={props.terak?.id ?? "new"} {...props} />;
}
