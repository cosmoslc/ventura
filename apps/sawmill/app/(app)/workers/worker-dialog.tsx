"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PhoneInput } from "@ventura/ui/phone-input";
import { type Locale, t } from "@/lib/i18n";
import { createWorkerAction, updateWorkerAction } from "./actions";

export interface WorkerData {
  id?: string;
  name: string;
  phone: string | null;
  salaryType: "piecework" | "daily" | "weekly" | "monthly";
  wageAmount: number;
}

interface WorkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worker?: WorkerData | null;
  locale: Locale;
}

function WorkerDialogInner({ open, onOpenChange, worker, locale }: WorkerDialogProps) {
  const isEdit = !!worker?.id;
  const [name, setName] = React.useState(worker?.name ?? "");
  const [phone, setPhone] = React.useState(worker?.phone ?? "");
  const [salaryType, setSalaryType] = React.useState<"piecework" | "daily" | "weekly" | "monthly">(
    worker?.salaryType ?? "piecework",
  );
  const [wageAmount, setWageAmount] = React.useState(String(worker?.wageAmount ?? 0));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    if (worker?.id) formData.append("id", worker.id);
    formData.append("name", name);
    formData.append("phone", phone);
    formData.append("salaryType", salaryType);
    formData.append("wageAmount", wageAmount);

    const res = isEdit ? await updateWorkerAction(formData) : await createWorkerAction(formData);

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
      title={isEdit ? t("workers_edit", locale) : t("workers_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="worker-name">{t("workers_name", locale)} *</Label>
          <Input
            id="worker-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ali Valiyev"
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="worker-phone">{t("workers_phone", locale)}</Label>
          <PhoneInput
            id="worker-phone"
            value={phone}
            onValueChange={setPhone}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="worker-salary-type">{t("workers_salary_type", locale)}</Label>
          <select
            id="worker-salary-type"
            value={salaryType}
            onChange={(e) => setSalaryType(e.target.value as "piecework" | "daily" | "weekly" | "monthly")}
            className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="piecework">{t("salary_piecework", locale)}</option>
            <option value="daily">{t("salary_daily", locale)}</option>
            <option value="weekly">{t("salary_weekly", locale)}</option>
            <option value="monthly">{t("salary_monthly", locale)}</option>
          </select>
        </div>

        {salaryType !== "piecework" && (
          <div className="space-y-1.5 animate-in fade-in duration-150">
            <Label htmlFor="worker-wage-amount">{t("workers_wage_amount", locale)} (so'm)</Label>
            <Input
              id="worker-wage-amount"
              type="number"
              min="0"
              step="1000"
              value={wageAmount}
              onChange={(e) => setWageAmount(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        )}

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

export function WorkerDialog(props: WorkerDialogProps) {
  if (!props.open) return null;
  return <WorkerDialogInner key={props.worker?.id ?? "new"} {...props} />;
}
