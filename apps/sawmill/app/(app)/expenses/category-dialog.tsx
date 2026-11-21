"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import { createExpenseCategoryAction } from "./actions";

export interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: Locale;
}

function CategoryDialogInner({ open, onOpenChange, locale }: CategoryDialogProps) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("name", name.trim());

    const res = await createExpenseCategoryAction(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Xatolik yuz berdi");
      return;
    }

    setName("");
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal open={open} onOpenChange={onOpenChange} title={t("expenses_category_add", locale)}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-500/10 rounded-md border border-red-500/20">{error}</div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="cat-name">{t("expenses_category_name", locale)}</Label>
          <Input
            id="cat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan, Ijara, Elektr yoki Soliq"
            required
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("action_cancel", locale)}
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? t("status_loading", locale) : t("action_add", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CategoryDialog(props: CategoryDialogProps) {
  if (!props.open) return null;
  return <CategoryDialogInner {...props} />;
}
