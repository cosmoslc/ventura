"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { t } from "@/lib/i18n";
import { calculateGroupWork } from "@/lib/calc/pay";
import { formatMoney, pieceVolumeM3 } from "@/lib/calc/units";
import { createGroupWorkAction } from "./actions";

export interface GroupWorkDialogProps {
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

function InnerGroupWorkDialog({
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
}: GroupWorkDialogProps) {
  // Workers selection
  const [selectedWorkerIds, setSelectedWorkerIds] = React.useState<string[]>(
    workers.slice(0, 2).map((w) => w.id),
  );
  const [payFullToEach, setPayFullToEach] = React.useState(false);
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [kind, setKind] = React.useState<"material" | "regular">("material");
  const [terakId, setTerakId] = React.useState(defaultTerakId ?? teraks[0]?.id ?? "");

  // Regular
  const [workTypeId, setWorkTypeId] = React.useState(workTypes[0]?.id ?? "");
  const [totalAmountInput, setTotalAmountInput] = React.useState("");

  // Material
  const [materialId, setMaterialId] = React.useState(materials[0]?.id ?? "");
  const [sizeId, setSizeId] = React.useState<string>("");
  const [payUnit, setPayUnit] = React.useState<"piece" | "row" | "cube">("piece");
  const [quantity, setQuantity] = React.useState("");
  const [rows, setRows] = React.useState("");
  const [cubeM3, setCubeM3] = React.useState("");

  const [note, setNote] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedWorkType = React.useMemo(() => workTypes.find((wt) => wt.id === workTypeId), [workTypes, workTypeId]);
  const selectedTerak = React.useMemo(() => teraks.find((tr) => tr.id === terakId), [teraks, terakId]);
  const selectedMaterial = React.useMemo(() => materials.find((m) => m.id === materialId), [materials, materialId]);
  const availableSizes = React.useMemo(() => selectedMaterial?.sizes ?? [], [selectedMaterial]);

  const isSorting = selectedWorkType?.kind === "sorting";
  const remainingRes = selectedTerak?.remainingRes ?? 0;

  function toggleWorker(id: string) {
    if (selectedWorkerIds.includes(id)) {
      setSelectedWorkerIds(selectedWorkerIds.filter((wId) => wId !== id));
    } else {
      setSelectedWorkerIds([...selectedWorkerIds, id]);
    }
  }

  // Volume
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

  // Group work calculation preview (K2, K15)
  const groupCalc = React.useMemo(() => {
    const tm = terakMaterials.find((x) => x.terakId === terakId && x.materialId === materialId);
    const baseWorkerPrice = tm?.workerPrice ?? 0;
    const baseCubeWorkerPrice = tm?.cubeWorkerPrice ?? 0;

    const chosenWorkers = workers
      .filter((w) => selectedWorkerIds.includes(w.id))
      .map((w) => {
        const sp = specialPrices.find((x) => x.workerId === w.id && x.materialId === materialId);
        return {
          workerId: w.id,
          salaryType: w.salaryType,
          specialPrice: sp?.price,
        };
      });

    return calculateGroupWork({
      kind,
      totalAmountInput: Number(totalAmountInput) || 0,
      payUnit,
      cubeMode: cubeInputMode,
      baseWorkerPrice,
      baseCubeWorkerPrice,
      quantity: Number(quantity) || 0,
      rows: Number(rows) || 0,
      cubeM3: Number(cubeM3) || 0,
      volumeM3,
      payFullToEach,
      workers: chosenWorkers,
    });
  }, [
    kind,
    totalAmountInput,
    payUnit,
    cubeInputMode,
    terakId,
    materialId,
    terakMaterials,
    workers,
    selectedWorkerIds,
    specialPrices,
    quantity,
    rows,
    cubeM3,
    volumeM3,
    payFullToEach,
  ]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedWorkerIds.length === 0) {
      setError(t("work_workers_select", locale));
      return;
    }
    if (kind === "regular" && isSorting && remainingRes <= 0) {
      setError(t("work_sorting_no_res", locale));
      return;
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("workerIds", JSON.stringify(selectedWorkerIds));
    fd.set("payFullToEach", String(payFullToEach));
    fd.set("date", date);
    fd.set("kind", kind);
    if (note) fd.set("note", note);

    if (kind === "regular") {
      if (terakId) fd.set("terakId", terakId);
      if (workTypeId) fd.set("workTypeId", workTypeId);
      fd.set("totalAmountInput", String(Number(totalAmountInput) || 0));
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

    const res = await createGroupWorkAction(fd);
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
      title={t("work_add_group", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 text-caption text-destructive bg-destructive/10 rounded-control border border-destructive/20">
            {error}
          </div>
        )}

        {/* Worker Multi-Selection */}
        <div className="space-y-1.5">
          <Label>{t("work_workers_select", locale)} ({selectedWorkerIds.length} tanlandi)</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-2 border border-border rounded-control bg-surface">
            {workers.map((w) => {
              const selected = selectedWorkerIds.includes(w.id);
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => toggleWorker(w.id)}
                  className={`flex items-center justify-between p-2 rounded-control text-caption border transition-all text-left cursor-pointer ${
                    selected
                      ? "bg-primary/10 border-primary text-primary font-semibold"
                      : "bg-muted/30 border-border text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="truncate">{w.name}</span>
                  {selected && <Check className="size-3.5 shrink-0 ml-1 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment distribution switch */}
        <div className="flex items-center justify-between p-3 rounded-control bg-muted/40 border border-border">
          <div>
            <span className="text-caption font-semibold text-foreground block">
              {t("work_pay_full_to_each", locale)}
            </span>
            <span className="text-2xs text-muted-foreground block">
              {payFullToEach
                ? "Har bir ishchiga hisoblangan to'liq summa yoziladi"
                : "Hisoblangan summa ishchilar o'rtasida teng bo'linadi (K15)"}
            </span>
          </div>
          <input
            type="checkbox"
            checked={payFullToEach}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPayFullToEach(e.target.checked)}
            className="size-5 rounded border-border text-primary focus:ring-primary cursor-pointer"
          />
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <Label htmlFor="group-date">{t("work_date", locale)}</Label>
          <Input
            id="group-date"
            type="date"
            required
            value={date}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          />
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

        {/* Material Fields */}
        {kind === "material" && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="group-terak">{t("work_terak", locale)}</Label>
              <select
                id="group-terak"
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
                <Label htmlFor="group-mat">{t("work_material", locale)}</Label>
                <select
                  id="group-mat"
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
                <Label htmlFor="group-pay-unit">{t("work_pay_unit", locale)}</Label>
                <select
                  id="group-pay-unit"
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
                <Label htmlFor="group-size">{t("work_size", locale)} (ixtiyoriy)</Label>
                <select
                  id="group-size"
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

            {payUnit === "piece" && (
              <div className="space-y-1.5">
                <Label htmlFor="group-qty">
                  {t("work_quantity", locale)} ({selectedMaterial?.unit ?? "dona"})
                </Label>
                <Input
                  id="group-qty"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 200"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                />
              </div>
            )}

            {payUnit === "row" && (
              <div className="space-y-1.5">
                <Label htmlFor="group-rows">{t("work_rows", locale)}</Label>
                <Input
                  id="group-rows"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 10"
                  value={rows}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRows(e.target.value)}
                />
              </div>
            )}

            {payUnit === "cube" && cubeInputMode === "direct" && (
              <div className="space-y-1.5">
                <Label htmlFor="group-cube-m3">{t("work_cube_m3", locale)}</Label>
                <Input
                  id="group-cube-m3"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 3.5"
                  value={cubeM3}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCubeM3(e.target.value)}
                />
              </div>
            )}

            {payUnit === "cube" && cubeInputMode === "calculated" && (
              <div className="space-y-1.5">
                <Label htmlFor="group-calc-qty">
                  {t("work_quantity", locale)} (kub o'lchamidan hisoblanadi)
                </Label>
                <Input
                  id="group-calc-qty"
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="Masalan: 150 dona"
                  value={quantity}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuantity(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {/* Regular Fields */}
        {kind === "regular" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="group-work-type">{t("work_type", locale)}</Label>
                <select
                  id="group-work-type"
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
                <Label htmlFor="group-reg-terak">
                  {t("work_terak", locale)} {isSorting ? "(Shart)" : "(Ixtiyoriy)"}
                </Label>
                <select
                  id="group-reg-terak"
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
              <Label htmlFor="group-total-amount">Jami ish haqi summasi (so'm)</Label>
              <Input
                id="group-total-amount"
                type="number"
                step="1000"
                min="0"
                required
                placeholder="Masalan: 150000"
                value={totalAmountInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTotalAmountInput(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="group-note">{t("work_note", locale)}</Label>
          <Input
            id="group-note"
            type="text"
            placeholder="Ixtiyoriy izoh..."
            value={note}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNote(e.target.value)}
          />
        </div>

        {/* Live Group Breakdown Card (K2, K15) */}
        <div className="p-4 bg-primary/5 rounded-card border border-primary/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-caption font-semibold text-foreground">
              Jami hisoblangan:
            </span>
            <span className="text-title font-bold text-primary font-mono">
              {formatMoney(groupCalc.totalAmount)}
            </span>
          </div>

          {kind === "material" && (
            <div className="flex items-center justify-between text-caption border-t border-primary/10 pt-2">
              <span className="text-muted-foreground">{t("work_preview_stock", locale)}:</span>
              <span className="font-mono font-semibold text-foreground">
                +{groupCalc.stockDelta} {selectedMaterial?.unit ?? "dona"}{" "}
                <span className="text-2xs text-muted-foreground font-sans">(faqat 1 marta)</span>
              </span>
            </div>
          )}

          {/* Breakdown per worker */}
          {groupCalc.distributions.length > 0 && (
            <div className="pt-2 border-t border-primary/10 space-y-1">
              <span className="text-2xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Ishchilar ulushi:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {groupCalc.distributions.map((d) => {
                  const w = workers.find((item) => item.id === d.workerId);
                  return (
                    <div
                      key={d.workerId}
                      className="flex items-center justify-between p-1.5 rounded bg-surface/60 border border-primary/10 text-caption font-mono"
                    >
                      <span className="truncate text-foreground font-sans">{w?.name}</span>
                      <span className="font-bold text-foreground">{formatMoney(d.amount)}</span>
                    </div>
                  );
                })}
              </div>
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
            disabled={
              loading ||
              selectedWorkerIds.length === 0 ||
              (kind === "regular" && isSorting && remainingRes <= 0)
            }
          >
            {loading ? t("action_save", locale) + "..." : t("action_save", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function GroupWorkDialog(props: GroupWorkDialogProps) {
  if (!props.open) return null;
  return <InnerGroupWorkDialog key={props.defaultTerakId ?? "group-work"} {...props} />;
}
