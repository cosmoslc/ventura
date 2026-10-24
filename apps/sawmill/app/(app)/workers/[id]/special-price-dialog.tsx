"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { t } from "@/lib/i18n";
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
  const [price, setPrice] = React.useState<number | null>(initialPrice ?? null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

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
    fd.set("price", String(price ?? 0));

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
          <Label htmlFor="sp-price">{t("special_price_val", locale)}</Label>
          <MoneyInput
            id="sp-price"
            value={price}
            onValueChange={setPrice}
            suffix="so'm"
            placeholder="0 kiritilsa maxsus narx o'chiriladi"
          />
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
