"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { t } from "@/lib/i18n";
import { formatMoney } from "@/lib/calc/units";
import { setWorkerSpecialPriceAction } from "./actions";

interface SpecialPriceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workerId: string;
  allMaterials: { id: string; name: string; unit: string; pricingMode: string }[];
  initialMaterialId?: string;
  initialPrice?: number;
  locale: "uz" | "ru";
}

function InnerSpecialPriceDialog({
  open,
  onOpenChange,
  workerId,
  allMaterials,
  initialMaterialId,
  initialPrice,
  locale,
}: SpecialPriceDialogProps) {
  const [materialId, setMaterialId] = React.useState(initialMaterialId ?? allMaterials[0]?.id ?? "");
  const [price, setPrice] = React.useState(initialPrice ? String(initialPrice) : "");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const numPrice = Number(price) || 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!materialId) {
      setError("Material tanlanishi shart");
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("workerId", workerId);
    fd.set("materialId", materialId);
    fd.set("price", String(numPrice));

    const res = await setWorkerSpecialPriceAction(fd);
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
      title={t("special_price_set", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 rounded-control border border-destructive/20">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="sp-material">{t("work_material", locale)}</Label>
          <select
            id="sp-material"
            value={materialId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMaterialId(e.target.value)}
            disabled={!!initialMaterialId}
            className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          >
            {allMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.pricingMode === "row" ? "qator" : "dona"})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sp-price">{t("special_price_val", locale)} (so'm)</Label>
          <Input
            id="sp-price"
            type="number"
            step="100"
            min="0"
            required
            placeholder="0 kiritilsa maxsus narx o'chiriladi"
            value={price}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPrice(e.target.value)}
          />
          {numPrice > 0 && (
            <p className="text-2xs text-muted-foreground mt-1 font-mono">
              {formatMoney(numPrice)}
            </p>
          )}
          <p className="text-2xs text-muted-foreground mt-1">
            {t("special_price_hint", locale)}
          </p>
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

export function SpecialPriceDialog(props: SpecialPriceDialogProps) {
  if (!props.open) return null;
  return (
    <InnerSpecialPriceDialog
      key={props.workerId + "-" + (props.initialMaterialId ?? "new")}
      {...props}
    />
  );
}
