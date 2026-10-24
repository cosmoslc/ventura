"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/calc/units";
import { accrueWageAction } from "./actions";

interface WageAccrualDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  salaryType: "daily" | "weekly" | "monthly" | "piecework";
  defaultRate: number;
  teraks: { id: string; name: string }[];
  locale: "uz" | "ru";
}

function InnerWageAccrualDialog({
  open,
  onOpenChange,
  workerId,
  salaryType,
  defaultRate,
  teraks,
  locale,
}: WageAccrualDialogProps) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultStart = React.useMemo(() => {
    const d = new Date();
    if (salaryType === "weekly") {
      d.setDate(d.getDate() - 6);
    } else if (salaryType === "monthly") {
      d.setDate(1);
    }
    return d.toISOString().slice(0, 10);
  }, [salaryType]);

  const [periodStart, setPeriodStart] = React.useState(defaultStart);
  const [periodEnd, setPeriodEnd] = React.useState(today);

  const defaultUnits = React.useMemo(() => {
    try {
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const diffMs = end.getTime() - start.getTime();
      const diffDays = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1);
      if (salaryType === "weekly") {
        return Math.max(1, Math.round((diffDays / 7) * 10) / 10);
      }
      if (salaryType === "monthly") {
        return 1;
      }
      return diffDays;
    } catch {
      return 1;
    }
  }, [periodStart, periodEnd, salaryType]);

  const [units, setUnits] = React.useState(String(defaultUnits));
  const [rate, setRate] = React.useState(String(defaultRate));
  const [terakId, setTerakId] = React.useState<string>("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const numUnits = Number(units) || 0;
  const numRate = Number(rate) || 0;
  const totalAmount = Math.round(numUnits * numRate);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (periodStart > periodEnd) {
      setError("Boshlanish sanasi tugash sanasidan katta bo'lishi mumkin emas");
      return;
    }
    if (numUnits <= 0) {
      setError("Soni 0 dan katta bo'lishi kerak");
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("workerId", workerId);
    fd.set("periodStart", periodStart);
    fd.set("periodEnd", periodEnd);
    fd.set("units", String(numUnits));
    fd.set("rate", String(numRate));
    if (terakId) fd.set("terakId", terakId);

    const res = await accrueWageAction(fd);
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
      title={t("wage_accrual_title", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 rounded-control border border-destructive/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="wage-start">{t("wage_accrual_start", locale)}</Label>
            <Input
              id="wage-start"
              type="date"
              required
              value={periodStart}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wage-end">{t("wage_accrual_end", locale)}</Label>
            <Input
              id="wage-end"
              type="date"
              required
              value={periodEnd}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="wage-units">{t("wage_accrual_units", locale)}</Label>
            <Input
              id="wage-units"
              type="number"
              step="any"
              min="0.1"
              required
              value={units}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUnits(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wage-rate">{t("wage_accrual_rate", locale)} (so'm)</Label>
            <Input
              id="wage-rate"
              type="number"
              step="1000"
              min="0"
              required
              value={rate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wage-terak">{t("wage_accrual_terak", locale)}</Label>
          <select
            id="wage-terak"
            value={terakId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTerakId(e.target.value)}
            className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">-- Terakka biriktirilmaydi (umumiy maosh) --</option>
            {teraks.map((tr) => (
              <option key={tr.id} value={tr.id}>
                {tr.name}
              </option>
            ))}
          </select>
          <p className="text-2xs text-muted-foreground mt-1">
            Terak tanlansa, ushbu maosh summasi terakning ish haqi xarajatiga kiritiladi (K1).
          </p>
        </div>

        {/* Live Preview of Calculated Total */}
        <div className="p-3.5 bg-primary/5 rounded-card border border-primary/20 flex items-center justify-between">
          <span className="text-caption font-medium text-muted-foreground">
            {t("work_preview_amount", locale)}:
          </span>
          <span className="text-title font-bold text-primary font-mono">
            {formatMoney(totalAmount)}
          </span>
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

export function WageAccrualDialog(props: WageAccrualDialogProps) {
  if (!props.open) return null;
  return <InnerWageAccrualDialog key={props.workerId + "-wage"} {...props} />;
}
