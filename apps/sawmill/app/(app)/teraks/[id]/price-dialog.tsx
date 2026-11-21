"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { type Locale, t } from "@/lib/i18n";
import { updateMaterialPricesAction } from "../actions";

export interface StockMaterialItem {
  materialId: string;
  name: string;
  unit: string;
  pricingMode: "piece" | "row";
  workerPrice: number;
  sellingPrice: number;
  cubeWorkerPrice: number;
  cubePrice: number;
  goal: string | null;
  volumeM3: number | null;
}

interface PriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  terakId: string;
  item?: StockMaterialItem | null;
  locale: Locale;
}

function PriceDialogInner({ open, onOpenChange, terakId, item, locale }: PriceDialogProps) {
  const [workerPrice, setWorkerPrice] = React.useState<number | null>(item?.workerPrice ?? 0);
  const [sellingPrice, setSellingPrice] = React.useState<number | null>(item?.sellingPrice ?? 0);
  const [cubeWorkerPrice, setCubeWorkerPrice] = React.useState<number | null>(item?.cubeWorkerPrice ?? 0);
  const [cubePrice, setCubePrice] = React.useState<number | null>(item?.cubePrice ?? 0);
  const [goal, setGoal] = React.useState(String(item?.goal ?? 0));

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canCube = item?.volumeM3 !== null && (item?.volumeM3 ?? 0) > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("terakId", terakId);
    formData.append("materialId", item.materialId);
    formData.append("workerPrice", String(workerPrice ?? 0));
    formData.append("sellingPrice", String(sellingPrice ?? 0));
    formData.append("cubeWorkerPrice", String(cubeWorkerPrice ?? 0));
    formData.append("cubePrice", String(cubePrice ?? 0));
    formData.append("goal", goal);

    const res = await updateMaterialPricesAction(formData);

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
      title={`${item?.name} — ${t("stock_edit_prices", locale)}`}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="p-3 rounded-card bg-muted/50 text-caption font-semibold flex items-center justify-between">
          <span>Hisoblash usuli:</span>
          <span className="text-primary font-bold">
            {item?.pricingMode === "piece" ? t("pricing_piece", locale) : t("pricing_row", locale)} ({item?.unit})
          </span>
        </div>

        {/* Dona / Qator narxlari */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stock-worker-price">
              {t("stock_worker_price", locale)} ({item?.unit})
            </Label>
            <MoneyInput
              id="stock-worker-price"
              value={workerPrice}
              onValueChange={setWorkerPrice}
              suffix="so'm"
              placeholder="0"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-selling-price">
              {t("stock_selling_price", locale)} ({item?.unit})
            </Label>
            <MoneyInput
              id="stock-selling-price"
              value={sellingPrice}
              onValueChange={setSellingPrice}
              suffix="so'm"
              placeholder="0"
            />
          </div>
        </div>

        {/* Kub narxlari (faqat o'lchamlari bor va kubga aylanadigan materiallar uchun) */}
        {canCube && (
          <div className="p-3.5 rounded-card border border-border bg-card space-y-3">
            <span className="text-2xs font-bold text-muted-foreground uppercase">
              Kub bo'yicha narxlar (1 m³ uchun)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="stock-cube-worker-price">{t("stock_cube_worker_price", locale)}</Label>
                <MoneyInput
                  id="stock-cube-worker-price"
                  value={cubeWorkerPrice}
                  onValueChange={setCubeWorkerPrice}
                  suffix="so'm"
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-cube-price">{t("stock_cube_price", locale)}</Label>
                <MoneyInput
                  id="stock-cube-price"
                  value={cubePrice}
                  onValueChange={setCubePrice}
                  suffix="so'm"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Maqsad (Goal) */}
        <div className="space-y-1.5">
          <Label htmlFor="stock-goal">
            {t("stock_goal", locale)} ({item?.unit})
          </Label>
          <Input
            id="stock-goal"
            type="number"
            min="0"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="0"
          />
          <span className="text-2xs text-muted-foreground block">
            Ushbu partiyada ishlab chiqarilishi rejalashtirilgan miqdor.
          </span>
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
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

export function PriceDialog(props: PriceDialogProps) {
  if (!props.open) return null;
  return <PriceDialogInner key={props.item?.materialId ?? "none"} {...props} />;
}
