"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { pieceVolumeM3, toCm, type DimensionUnit } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { addMaterialSizeAction } from "./actions";

interface AddSizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materialId: string | null;
  materialName: string;
  defaultUnit?: DimensionUnit;
  locale: Locale;
}

function AddSizeDialogInner({
  open,
  onOpenChange,
  materialId,
  materialName,
  defaultUnit = "sm",
  locale,
}: AddSizeDialogProps) {
  const [dimensionUnit, setDimensionUnit] = React.useState<DimensionUnit>(defaultUnit);
  const [thickness, setThickness] = React.useState("");
  const [width, setWidth] = React.useState("");
  const [length, setLength] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const calculatedVolume = React.useMemo(() => {
    const thNum = Number(thickness);
    const wNum = Number(width);
    const lNum = Number(length);
    if (!thNum || !wNum || !lNum) return null;
    return pieceVolumeM3({
      thicknessCm: toCm(thNum, dimensionUnit),
      widthCm: toCm(wNum, dimensionUnit),
      lengthCm: toCm(lNum, dimensionUnit),
    });
  }, [thickness, width, length, dimensionUnit]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!materialId) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("materialId", materialId);
    formData.append("dimensionUnit", dimensionUnit);
    formData.append("thickness", thickness);
    formData.append("width", width);
    formData.append("length", length);

    const res = await addMaterialSizeAction(formData);

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
      title={`${materialName} — ${t("materials_add_size", locale)}`}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between pb-1">
          <span className="text-caption font-bold text-foreground">
            {t("materials_dimensions", locale)}
          </span>
          <div className="flex items-center gap-1 bg-muted p-0.5 rounded-btn border border-border text-2xs font-semibold">
            {(["mm", "sm", "m"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setDimensionUnit(u)}
                className={`px-2 py-0.5 rounded-control transition-colors cursor-pointer ${
                  dimensionUnit === u ? "bg-card text-primary shadow-xs" : "text-muted-foreground"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-2xs text-muted-foreground">Qalinlik ({dimensionUnit}) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={thickness}
              onChange={(e) => setThickness(e.target.value)}
              placeholder="5"
              required
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label className="text-2xs text-muted-foreground">Eni ({dimensionUnit}) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="15"
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label className="text-2xs text-muted-foreground">Uzunlik ({dimensionUnit}) *</Label>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder="600"
              required
              className="mt-1"
            />
          </div>
        </div>

        {calculatedVolume !== null && (
          <div className="text-caption font-semibold text-primary pt-1 flex items-center justify-between">
            <span>{t("materials_volume", locale)}:</span>
            <span className="font-mono">{calculatedVolume} m³</span>
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

export function AddSizeDialog(props: AddSizeDialogProps) {
  if (!props.open) return null;
  return <AddSizeDialogInner key={props.materialId ?? "none"} {...props} />;
}
