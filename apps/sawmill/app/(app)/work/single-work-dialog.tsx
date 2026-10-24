"use client";

import * as React from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import { t } from "@/lib/i18n";
import { calculateSingleWork, resolveWorkerCubePrice, resolveWorkerPrice } from "@/lib/calc/pay";
import { formatMoney, pieceVolumeM3 } from "@/lib/calc/units";
import { createSingleWorkAction } from "./actions";

export interface SingleWorkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workers: Array<{ id: string; name: string; salaryType: "piecework" | "daily" | "weekly" | "monthly" }>;
  teraks: Array<{ id: string; name: string; remainingRes: number }>;
  workTypes: Array<{ id: string; name: string; kind: "regular" | "sorting" }>;
  materials: Array<{
    id: string;
    name: string;
    unit: string;
    pricingMode: string;
    thicknessCm: string | null;
    widthCm: string | null;
    lengthCm: string | null;
    sizes: Array<{ id: string; thicknessCm: string | null; widthCm: string | null; lengthCm: string | null }>;
  }>;
  terakMaterials: Array<{
    terakId: string;
    materialId: string;
    workerPrice: number;
    cubeWorkerPrice: number;
  }>;
  specialPrices: Array<{ workerId: string; materialId: string; price: number }>;
  cubeInputMode: "direct" | "calculated";
  defaultTerakId?: string;
  locale: "uz" | "ru";
}

function InnerSingleWorkDialog({
  open,
  onOpenChange,
  workers,
  teraks,
  workTypes,
  materials,
  terakMaterials,
  specialPrices,
  cubeInputMode,
  defaultTerakId,
  locale,
}: SingleWorkDialogProps) {
  const [workerId, setWorkerId] = React.useState(workers[0]?.id ?? "");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = React.useState<"material" | "regular">("material");
  const [terakId, setTerakId] = React.useState(defaultTerakId ?? teraks[0]?.id ?? "");

  // Regular work state
  const [workTypeId, setWorkTypeId] = React.useState(workTypes[0]?.id ?? "");
  const [manualAmount, setManualAmount] = React.useState<number | null>(null);

  // Material work state
  const [materialId, setMaterialId] = React.useState(materials[0]?.id ?? "");
  const [sizeId, setSizeId] = React.useState<string>("");
  const [payUnit, setPayUnit] = React.useState<"piece" | "row" | "cube">("piece");
  const [quantity, setQuantity] = React.useState("");
  const [rows, setRows] = React.useState("");
  const [cubeM3, setCubeM3] = React.useState("");

  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Selected entities
  const selectedWorker = React.useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId]);
  const selectedWorkType = React.useMemo(() => workTypes.find((wt) => wt.id === workTypeId), [workTypes, workTypeId]);
  const selectedTerak = React.useMemo(() => teraks.find((tr) => tr.id === terakId), [teraks, terakId]);
  const selectedMaterial = React.useMemo(() => materials.find((m) => m.id === materialId), [materials, materialId]);

  // Sizes for selected material
  const availableSizes = React.useMemo(() => selectedMaterial?.sizes ?? [], [selectedMaterial]);

  // Is sorting selected?
  const isSorting = selectedWorkType?.kind === "sorting";
  const remainingRes = selectedTerak?.remainingRes ?? 0;

  // Pricing resolution
  const pricing = React.useMemo(() => {
    if (!selectedWorker || !materialId || !terakId) {
      return { workerPrice: 0, cubeWorkerPrice: 0 };
    }
    const tm = terakMaterials.find((x) => x.terakId === terakId && x.materialId === materialId);
    const sp = specialPrices.find((x) => x.workerId === workerId && x.materialId === materialId);

    const workerPrice = resolveWorkerPrice({
      salaryType: selectedWorker.salaryType,
      baseWorkerPrice: tm?.workerPrice ?? 0,
      specialPrice: sp?.price,
    });
    const cubeWorkerPrice = resolveWorkerCubePrice({
      salaryType: selectedWorker.salaryType,
      baseCubeWorkerPrice: tm?.cubeWorkerPrice ?? 0,
    });

    return { workerPrice, cubeWorkerPrice };
  }, [selectedWorker, materialId, terakId, terakMaterials, specialPrices, workerId]);

  // Volume resolution
  const volumeM3 = React.useMemo(() => {
    if (sizeId) {
      const sz = availableSizes.find((s) => s.id === sizeId);
      if (sz) {
        return pieceVolumeM3({
          thicknessCm: sz.thicknessCm ? Number(sz.thicknessCm) : null,
          widthCm: sz.widthCm ? Number(sz.widthCm) : null,
          lengthCm: sz.lengthCm ? Number(sz.lengthCm) : null,
        });
      }
    }
    if (selectedMaterial) {
      return pieceVolumeM3({
        thicknessCm: selectedMaterial.thicknessCm ? Number(selectedMaterial.thicknessCm) : null,
        widthCm: selectedMaterial.widthCm ? Number(selectedMaterial.widthCm) : null,
        lengthCm: selectedMaterial.lengthCm ? Number(selectedMaterial.lengthCm) : null,
      });
    }
    return null;
  }, [sizeId, availableSizes, selectedMaterial]);

  // Live calculation preview
  const preview = React.useMemo(() => {
    if (kind === "regular") {
      return {
        amount: Math.max(0, Math.round(Number(manualAmount) || 0)),
        stockDelta: 0,
      };
    }
    return calculateSingleWork({
      kind: "material",
      payUnit,
      cubeMode: cubeInputMode,
      workerPrice: pricing.workerPrice,
      workerCubePrice: pricing.cubeWorkerPrice,
      quantity: Number(quantity) || 0,
      rows: Number(rows) || 0,
      cubeM3: Number(cubeM3) || 0,
      volumeM3,
    });
  }, [kind, manualAmount, payUnit, cubeInputMode, pricing, quantity, rows, cubeM3, volumeM3]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (kind === "regular" && isSorting && remainingRes <= 0) {
      setError(t("work_sorting_no_res", locale));
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("workerId", workerId);
    fd.set("date", date);
    fd.set("kind", kind);
    if (note) fd.set("note", note);

    if (kind === "regular") {
      if (terakId) fd.set("terakId", terakId);
      if (workTypeId) fd.set("workTypeId", workTypeId);
      fd.set("manualAmount", String(manualAmount ?? 0));
    } else {
      if (!terakId) {
        setError("Terak tanlanishi shart");
        setLoading(false);
        return;
      }
      fd.set("terakId", terakId);
      fd.set("materialId", materialId);
      if (sizeId) fd.set("sizeId", sizeId);
      fd.set("payUnit", payUnit);
      if (payUnit === "piece" || (payUnit === "cube" && cubeInputMode === "calculated")) {
        fd.set("quantity", String(Number(quantity) || 0));
      }
      if (payUnit === "row") {
        fd.set("rows", String(Number(rows) || 0));
      }
      if (payUnit === "cube" && cubeInputMode === "direct") {
        fd.set("cubeM3", String(Number(cubeM3) || 0));
      }
    }

    const res = await createSingleWorkAction(fd);
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
      title={t("work_add_single", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 rounded-control border border-destructive/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="single-worker">{t("work_worker", locale)}</Label>
            <select
              id="single-worker"
              value={workerId}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWorkerId(e.target.value)}
              className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.salaryType !== "piecework" ? `(${w.salaryType})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="single-date">{t("work_date", locale)}</Label>
            <Input
              id="single-date"
              type="date"
              required
              value={date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
            />
          </div>
        </div>

        {/* Kind Toggle */}
        <div className="flex rounded-control bg-muted p-1 border border-border">
          <button
            type="button"
            onClick={() => setKind("material")}
            className={`flex-1 py-1.5 text-caption font-semibold rounded-btn transition-all cursor-pointer ${
              kind === "material"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("work_kind_material_label", locale)}
          </button>
          <button
            type="button"
            onClick={() => setKind("regular")}
            className={`flex-1 py-1.5 text-caption font-semibold rounded-btn transition-all cursor-pointer ${
              kind === "regular"
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("work_kind_regular_label", locale)}
          </button>
        </div>

        {/* Material Work Fields */}
        {kind === "material" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="single-terak">{t("work_terak", locale)}</Label>
              <select
                id="single-terak"
                value={terakId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTerakId(e.target.value)}
                required
                className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {teraks.map((tr) => (
                  <option key={tr.id} value={tr.id}>
                    {tr.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="single-mat">{t("work_material", locale)}</Label>
                <select
                  id="single-mat"
                  value={materialId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                    setMaterialId(e.target.value);
                    setSizeId("");
                  }}
                  required
                  className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="single-pay-unit">{t("work_pay_unit", locale)}</Label>
                <select
                  id="single-pay-unit"
                  value={payUnit}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setPayUnit(e.target.value as "piece" | "row" | "cube")
                  }
                  className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="piece">{t("qty_piece", locale)}</option>
                  <option value="row">{t("pricing_row", locale)}</option>
                  <option value="cube">{t("qty_cube", locale)}</option>
                </select>
              </div>
            </div>

            {availableSizes.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="single-size">{t("work_size", locale)} (ixtiyoriy)</Label>
                <select
                  id="single-size"
                  value={sizeId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSizeId(e.target.value)}
                  className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Standart o'lcham --</option>
                  {availableSizes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.thicknessCm}×{s.widthCm}×{s.lengthCm} sm
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quantity inputs based on payUnit */}
            {payUnit === "piece" && (
              <div className="space-y-1.5">
                <Label htmlFor="single-qty">
                  {t("work_quantity", locale)} ({selectedMaterial?.unit ?? "dona"})
                </Label>
                <Input
                  id="single-qty"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 120"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                />
              </div>
            )}

            {payUnit === "row" && (
              <div className="space-y-1.5">
                <Label htmlFor="single-rows">{t("work_rows", locale)}</Label>
                <Input
                  id="single-rows"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 5"
                  value={rows}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRows(e.target.value)}
                />
              </div>
            )}

            {payUnit === "cube" && cubeInputMode === "direct" && (
              <div className="space-y-1.5">
                <Label htmlFor="single-cube-m3">{t("work_cube_m3", locale)}</Label>
                <Input
                  id="single-cube-m3"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 2.5"
                  value={cubeM3}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCubeM3(e.target.value)}
                />
              </div>
            )}

            {payUnit === "cube" && cubeInputMode === "calculated" && (
              <div className="space-y-1.5">
                <Label htmlFor="single-calc-qty">
                  {t("work_quantity", locale)} (kub o'lchamidan hisoblanadi)
                </Label>
                <Input
                  id="single-calc-qty"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 120 dona"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Regular Work Fields */}
        {kind === "regular" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="single-work-type">{t("work_type", locale)}</Label>
                <select
                  id="single-work-type"
                  value={workTypeId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setWorkTypeId(e.target.value)}
                  className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {workTypes.map((wt) => (
                    <option key={wt.id} value={wt.id}>
                      {wt.name} {wt.kind === "sorting" ? "(Sartirofka)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="single-reg-terak">
                  {t("work_terak", locale)} {isSorting ? "(Shart)" : "(Ixtiyoriy)"}
                </Label>
                <select
                  id="single-reg-terak"
                  value={terakId}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTerakId(e.target.value)}
                  required={isSorting}
                  className="w-full px-3 py-2 text-body bg-surface text-foreground border border-border rounded-control focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">-- Teraksiz --</option>
                  {teraks.map((tr) => (
                    <option key={tr.id} value={tr.id}>
                      {tr.name} {isSorting ? `(Qolgan res: ${tr.remainingRes})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isSorting && (
              <div
                className={`p-3 rounded-control text-caption border ${
                  remainingRes > 0
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                    : "bg-destructive/10 border-destructive/20 text-destructive"
                }`}
              >
                {t("teraks_remaining_res", locale)}: <strong className="font-mono">{remainingRes}</strong>
                {remainingRes <= 0 && <span className="block mt-0.5">{t("work_sorting_no_res", locale)}</span>}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="single-amount">{t("work_amount", locale)}</Label>
              <MoneyInput
                id="single-amount"
                value={manualAmount}
                onValueChange={setManualAmount}
                suffix="so'm"
                placeholder="Masalan: 80 000"
                required
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="single-note">{t("work_note", locale)}</Label>
          <Input
            id="single-note"
            type="text"
            placeholder="Ixtiyoriy izoh..."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          />
        </div>

        {/* Live Preview Card */}
        <div className="p-3.5 bg-primary/5 rounded-card border border-primary/20 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-caption font-medium text-muted-foreground">
              {t("work_preview_amount", locale)}:
            </span>
            <span className="text-title font-bold text-primary font-mono">
              {formatMoney(preview.amount)}
            </span>
          </div>

          {kind === "material" && (
            <div className="flex items-center justify-between text-caption pt-1 border-t border-primary/10">
              <span className="text-muted-foreground">{t("work_preview_stock", locale)}:</span>
              <span className="font-mono font-semibold text-foreground">
                +{preview.stockDelta} {selectedMaterial?.unit ?? "dona"}
              </span>
            </div>
          )}
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
          <Button
            type="submit"
            disabled={loading || (kind === "regular" && isSorting && remainingRes <= 0)}
          >
            {loading ? t("action_save", locale) + "..." : t("action_save", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function SingleWorkDialog(props: SingleWorkDialogProps) {
  if (!props.open) return null;
  return <InnerSingleWorkDialog key={props.defaultTerakId ?? "single-work"} {...props} />;
}
