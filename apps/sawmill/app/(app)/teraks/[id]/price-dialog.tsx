"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
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
  const [workerPrice, setWorkerPrice] = React.useState(String(item?.workerPrice ?? 0));
  const [sellingPrice, setSellingPrice] = React.useState(String(item?.sellingPrice ?? 0));
  const [cubeWorkerPrice, setCubeWorkerPrice] = React.useState(String(item?.cubeWorkerPrice ?? 0));
  const [cubePrice, setCubePrice] = React.useState(String(item?.cubePrice ?? 0));
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
    formData.append("workerPrice", workerPrice);
    formData.append("sellingPrice", sellingPrice);
    formData.append("cubeWorkerPrice", cubeWorkerPrice);
    formData.append("cubePrice", cubePrice);
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
            <Input
              id="stock-worker-price"
              type="number"
              min="0"
              step="500"
              value={workerPrice}
              onChange={(e) => setWorkerPrice(e.target.value)}
              placeholder="0"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock-selling-price">
              {t("stock_selling_price", locale)} ({item?.unit})
            </Label>
            <Input
              id="stock-selling-price"
              type="number"
              min="0"
              step="1000"
              value={sellingPrice}
              onChange={(e) => setSellingPrice(e.target.value)}
              placeholder="0"
              required
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
                <Input
                  id="stock-cube-worker-price"
                  type="number"
                  min="0"
                  step="5000"
                  value={cubeWorkerPrice}
                  onChange={(e) => setCubeWorkerPrice(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="stock-cube-price">{t("stock_cube_price", locale)}</Label>
                <Input
                  id="stock-cube-price"
                  type="number"
                  min="0"
                  step="10000"
                  value={cubePrice}
                  onChange={(e) => setCubePrice(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Maqsad (Goal) */}
        <div className="space-y-1.5">
          <Label htmlFor="stock-goal">{t("stock_goal", locale)} ({item?.unit})</Label>
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

export function PriceDialog(props: PriceDialogProps) {
  if (!props.open) return null;
  return <PriceDialogInner key={props.item?.materialId ?? "none"} {...props} />;
}
