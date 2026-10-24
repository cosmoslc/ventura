"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import { addTerakCostAction } from "../actions";

interface CostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terakId: string;
  locale: Locale;
}

function CostDialogInner({ open, onOpenChange, terakId, locale }: CostDialogProps) {
  const [kind, setKind] = React.useState<"transport" | "res" | "truck" | "other">("transport");
  const [title, setTitle] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [trips, setTrips] = React.useState("1");
  const [pricePerTrip, setPricePerTrip] = React.useState("");
  const [amount, setAmount] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Res tanlanganda avtomatik summa
  const totalAmount = React.useMemo(() => {
    if (kind === "res") {
      const tr = Number(trips);
      const pr = Number(pricePerTrip);
      if (tr > 0 && pr > 0) return String(tr * pr);
    }
    return amount;
  }, [kind, trips, pricePerTrip, amount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("terakId", terakId);
    formData.append("kind", kind);
    formData.append("title", title || (kind === "res" ? t("cost_kind_res", locale) : ""));
    formData.append("date", date);
    formData.append("amount", totalAmount);
    if (kind === "res") {
      formData.append("trips", trips);
      formData.append("pricePerTrip", pricePerTrip);
    }

    const res = await addTerakCostAction(formData);

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
      title={t("terak_costs_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="cost-kind">{t("terak_cost_kind", locale)}</Label>
          <select
            id="cost-kind"
            value={kind}
            onChange={(e) => {
              const nextKind = e.target.value as "transport" | "res" | "truck" | "other";
              setKind(nextKind);
              if (nextKind === "res" && !title) setTitle(t("cost_kind_res", locale));
            }}
            className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="transport">{t("cost_kind_transport", locale)}</option>
            <option value="res">{t("cost_kind_res", locale)}</option>
            <option value="truck">{t("cost_kind_truck", locale)}</option>
            <option value="other">{t("cost_kind_other", locale)}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cost-title">{t("cost_title", locale)} *</Label>
          <Input
            id="cost-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Yuk ortish, kran xarajati va h.k."
            required
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="cost-date">{t("cost_date", locale)} *</Label>
          <Input
            id="cost-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        {kind === "res" ? (
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-card border border-border bg-muted/40">
            <div className="space-y-1.5">
              <Label htmlFor="cost-trips">{t("cost_trips", locale)} *</Label>
              <Input
                id="cost-trips"
                type="number"
                min="1"
                value={trips}
                onChange={(e) => setTrips(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cost-price-per-trip">{t("cost_price_per_trip", locale)} (so'm) *</Label>
              <Input
                id="cost-price-per-trip"
                type="number"
                min="0"
                step="5000"
                value={pricePerTrip}
                onChange={(e) => setPricePerTrip(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div className="col-span-2 pt-1 flex items-center justify-between text-caption font-semibold text-primary">
              <span>Jami res summasi:</span>
              <span className="font-mono text-base">{Number(totalAmount).toLocaleString()} so'm</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="cost-amount">{t("cost_amount", locale)} (so'm) *</Label>
            <Input
              id="cost-amount"
              type="number"
              min="0"
              step="5000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
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

export function CostDialog(props: CostDialogProps) {
  if (!props.open) return null;
  return <CostDialogInner {...props} />;
}
