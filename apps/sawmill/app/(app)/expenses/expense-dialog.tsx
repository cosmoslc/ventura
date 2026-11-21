"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { type Locale, t } from "@/lib/i18n";
import { createGeneralExpenseAction } from "./actions";

export interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Array<{ id: string; name: string }>;
  locale: Locale;
}

function ExpenseDialogInner({ open, onOpenChange, categories, locale }: ExpenseDialogProps) {
  const router = useRouter();

  const [categoryId, setCategoryId] = React.useState(categories[0]?.id || "");
  const [amount, setAmount] = React.useState<number | null>(null);
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoryId) {
      setError("Toifa tanlanishi shart");
      return;
    }
    if (!amount || amount <= 0) {
      setError("Xarajat summasi 0 dan katta bo'lishi shart");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("categoryId", categoryId);
    formData.append("amount", String(amount));
    formData.append("date", date);
    if (note.trim()) formData.append("note", note.trim());

    const res = await createGeneralExpenseAction(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Xatolik yuz berdi");
      return;
    }

    setAmount(null);
    setNote("");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("expenses_add", locale)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>
        )}

        {/* 1. Toifa tanlash */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-category">{t("expenses_category", locale)}</Label>
          <select
            id="expense-category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            required
          >
            {categories.length === 0 ? (
              <option value="">Toifalar mavjud emas</option>
            ) : (
              categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* 2. Summa (MoneyInput) */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-amount">{t("expenses_amount", locale)}</Label>
          <MoneyInput
            id="expense-amount"
            value={amount}
            onValueChange={setAmount}
            suffix="so'm"
            placeholder="0"
            required
          />
        </div>

        {/* 3. Sana */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-date">{t("expenses_date", locale)}</Label>
          <Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>

        {/* 4. Izoh */}
        <div className="space-y-1.5">
          <Label htmlFor="expense-note">{t("expenses_note", locale)}</Label>
          <Input
            id="expense-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Xarajat bo'yicha qo'shimcha ma'lumot (ixtiyoriy)"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("action_cancel", locale)}
          </Button>
          <Button type="submit" variant="primary" disabled={submitting || !amount || amount <= 0}>
            {submitting ? t("status_loading", locale) : t("action_add", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function ExpenseDialog(props: ExpenseDialogProps) {
  if (!props.open) return null;
  return <ExpenseDialogInner {...props} />;
}
