"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { fromCm, pieceVolumeM3, toCm, type DimensionUnit } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { createMaterialAction, updateMaterialAction } from "./actions";

export interface MaterialData {
  id?: string;
  name: string;
  unit: string;
  pricingMode: "piece" | "row";
  thicknessCm: string | null;
  widthCm: string | null;
  lengthCm: string | null;
}

interface MaterialDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material?: MaterialData | null;
  defaultUnit?: DimensionUnit;
  locale: Locale;
}

function MaterialDialogInner({
  open,
  onOpenChange,
  material,
  defaultUnit = "sm",
  locale,
}: MaterialDialogProps) {
  const isEdit = !!material?.id;
  const [name, setName] = React.useState(material?.name ?? "");
  const [unit, setUnit] = React.useState(material?.unit ?? "dona");
  const [pricingMode, setPricingMode] = React.useState<"piece" | "row">(
    material?.pricingMode ?? "piece",
  );
  const [dimensionUnit, setDimensionUnit] = React.useState<DimensionUnit>(defaultUnit);

  const [thickness, setThickness] = React.useState(
    material?.thicknessCm ? String(fromCm(Number(material.thicknessCm), defaultUnit)) : "",
  );
  const [width, setWidth] = React.useState(
    material?.widthCm ? String(fromCm(Number(material.widthCm), defaultUnit)) : "",
  );
  const [length, setLength] = React.useState(
    material?.lengthCm ? String(fromCm(Number(material.lengthCm), defaultUnit)) : "",
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Dinamik hajm hisoblash
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
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    if (material?.id) formData.append("id", material.id);
    formData.append("name", name);
    formData.append("unit", unit);
    formData.append("pricingMode", pricingMode);
    formData.append("dimensionUnit", dimensionUnit);
    if (thickness) formData.append("thickness", thickness);
    if (width) formData.append("width", width);
    if (length) formData.append("length", length);

    const res = isEdit ? await updateMaterialAction(formData) : await createMaterialAction(formData);

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
      title={isEdit ? t("materials_edit", locale) : t("materials_add", locale)}
      position="center"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 border border-destructive/20 rounded-btn">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="material-name">{t("materials_name", locale)} *</Label>
          <Input
            id="material-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vassa 5×15"
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="material-unit">{t("materials_unit", locale)}</Label>
            <Input
              id="material-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="dona"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-pricing-mode">{t("materials_pricing_mode", locale)}</Label>
            <select
              id="material-pricing-mode"
              value={pricingMode}
              onChange={(e) => setPricingMode(e.target.value as "piece" | "row")}
              className="w-full h-10 px-3 rounded-control border border-input bg-input-bg text-foreground text-body focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="piece">{t("pricing_piece", locale)}</option>
              <option value="row">{t("pricing_row", locale)}</option>
            </select>
          </div>
        </div>

        {/* O'lchamlar bloki */}
        <div className="p-3.5 rounded-card border border-border bg-muted/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-bold text-foreground">
              {t("materials_dimensions", locale)}
            </span>
            <div className="flex items-center gap-1 bg-card p-0.5 rounded-btn border border-border text-2xs font-semibold">
              {(["mm", "sm", "m"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setDimensionUnit(u)}
                  className={`px-2 py-0.5 rounded-control transition-colors cursor-pointer ${
                    dimensionUnit === u ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-2xs text-muted-foreground">Qalinlik ({dimensionUnit})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={thickness}
                onChange={(e) => setThickness(e.target.value)}
                placeholder="5"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">Eni ({dimensionUnit})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="15"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-2xs text-muted-foreground">Uzunlik ({dimensionUnit})</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={length}
                onChange={(e) => setLength(e.target.value)}
                placeholder="600"
                className="mt-1"
              />
            </div>
          </div>

          {calculatedVolume !== null ? (
            <div className="text-caption font-semibold text-primary pt-1 flex items-center justify-between">
              <span>{t("materials_volume", locale)}:</span>
              <span className="font-mono">{calculatedVolume} m³</span>
            </div>
          ) : (
            <div className="text-2xs text-muted-foreground pt-1">
              (Uchala o'lcham kiritilsa, 1 dona hajmi kub metrda avtomatik hisoblanadi)
            </div>
          )}
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

export function MaterialDialog(props: MaterialDialogProps) {
  if (!props.open) return null;
  return <MaterialDialogInner key={props.material?.id ?? "new"} {...props} />;
}
