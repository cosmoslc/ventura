"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { MoneyInput } from "@ventura/ui/money-input";
import {
  convertDispatchPrice,
  type DispatchUnit,
  validateAndCalculateDispatch,
} from "@/lib/calc/dispatch";
import { formatMoney, pieceVolumeM3 } from "@/lib/calc/units";
import { type Locale, t } from "@/lib/i18n";
import { createDispatchAction } from "./actions";

export interface DispatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teraks: Array<{ id: string; name: string }>;
  preselectedTerakId?: string;
  materials: Array<{
    id: string;
    name: string;
    unit: string;
    thicknessCm?: number | null;
    widthCm?: number | null;
    lengthCm?: number | null;
  }>;
  terakMaterials: Array<{
    terakId: string;
    materialId: string;
    quantity: string;
    sellingPrice: number;
    cubePrice: number;
  }>;
  trucks: Array<{ id: string; name: string; amount: number }>;
  locale: Locale;
}

function DispatchDialogInner({
  open,
  onOpenChange,
  teraks,
  preselectedTerakId,
  materials,
  terakMaterials,
  trucks,
  locale,
}: DispatchDialogProps) {
  const router = useRouter();

  const initialTerakId = preselectedTerakId || teraks[0]?.id || "";

  // Tanlangan terakdagi mavjud materiallarni hisoblash
  const getMaterialsForTerak = React.useCallback(
    (tid: string) => {
      if (!tid) return [];
      return terakMaterials
        .filter((tm) => tm.terakId === tid)
        .map((tm) => {
          const mat = materials.find((m) => m.id === tm.materialId);
          const qty = Number(tm.quantity);
          const vol = mat
            ? pieceVolumeM3({
                thicknessCm: mat.thicknessCm ?? null,
                widthCm: mat.widthCm ?? null,
                lengthCm: mat.lengthCm ?? null,
              })
            : null;
          return {
            materialId: tm.materialId,
            name: mat?.name ?? "Material",
            unit: mat?.unit ?? "dona",
            quantity: qty,
            volumeM3: vol,
            sellingPrice: Number(tm.sellingPrice ?? 0),
            cubePrice: Number(tm.cubePrice ?? 0),
          };
        });
    },
    [terakMaterials, materials],
  );

  const [terakId, setTerakId] = React.useState(initialTerakId);
  const availableMaterials = React.useMemo(
    () => getMaterialsForTerak(terakId),
    [getMaterialsForTerak, terakId],
  );

  const [materialId, setMaterialId] = React.useState(
    () => getMaterialsForTerak(initialTerakId)[0]?.materialId || "",
  );
  const [unit, setUnit] = React.useState<DispatchUnit>("piece");
  const [quantityStr, setQuantityStr] = React.useState("");
  const [price, setPrice] = React.useState<number | null>(() => {
    const first = getMaterialsForTerak(initialTerakId)[0];
    return first && first.sellingPrice > 0 ? first.sellingPrice : null;
  });
  const [date, setDate] = React.useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [recipientName, setRecipientName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [truckId, setTruckId] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function handleTerakChange(newTerakId: string) {
    setTerakId(newTerakId);
    const mats = getMaterialsForTerak(newTerakId);
    const first = mats[0];
    if (first) {
      setMaterialId(first.materialId);
      const initialP = unit === "piece" ? first.sellingPrice : first.cubePrice;
      setPrice(initialP > 0 ? initialP : null);
    } else {
      setMaterialId("");
      setPrice(null);
    }
  }

  const selectedMaterial = React.useMemo(() => {
    return availableMaterials.find((m) => m.materialId === materialId);
  }, [availableMaterials, materialId]);

  // Material o'zgarganda narxni avtomatik to'ldirish
  function handleMaterialChange(newMatId: string) {
    setMaterialId(newMatId);
    const mat = availableMaterials.find((m) => m.materialId === newMatId);
    if (!mat) return;

    if (unit === "piece") {
      setPrice(mat.sellingPrice > 0 ? mat.sellingPrice : null);
    } else {
      setPrice(mat.cubePrice > 0 ? mat.cubePrice : null);
    }
  }

  // Birlik o'zgarganda (dona <-> kub)
  function handleUnitChange(newUnit: DispatchUnit) {
    if (newUnit === unit || !selectedMaterial) return;

    const currentP = price ?? 0;
    const newPrice = convertDispatchPrice({
      fromUnit: unit,
      toUnit: newUnit,
      currentPrice: currentP,
      volumeM3: selectedMaterial.volumeM3,
      materialSellingPrice: selectedMaterial.sellingPrice,
      materialCubePrice: selectedMaterial.cubePrice,
    });

    setUnit(newUnit);
    setPrice(newPrice > 0 ? newPrice : null);
  }

  // Hisoblangan natija
  const calcResult = React.useMemo(() => {
    if (!selectedMaterial) return null;
    const q = Number(quantityStr);
    const p = price ?? 0;
    if (q <= 0) return null;

    return validateAndCalculateDispatch({
      unit,
      quantityInput: q,
      priceInput: p,
      volumeM3: selectedMaterial.volumeM3,
      currentStock: selectedMaterial.quantity,
    });
  }, [selectedMaterial, quantityStr, price, unit]);

  const selectedTruck = React.useMemo(() => {
    return trucks.find((t) => t.id === truckId);
  }, [trucks, truckId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!calcResult || !calcResult.valid) {
      setError(
        calcResult?.error === "OUT_OF_STOCK"
          ? "Omborda material yo'q"
          : calcResult?.error === "INSUFFICIENT_STOCK"
            ? "Omborda yetarli qoldiq yo'q"
            : "Ma'lumotlar to'liq kiritilmadi",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("terakId", terakId);
    formData.append("materialId", materialId);
    formData.append("unit", unit);
    formData.append("quantity", quantityStr);
    formData.append("price", String(price ?? 0));
    formData.append("date", date);
    if (recipientName.trim()) formData.append("recipientName", recipientName.trim());
    if (phone.trim()) formData.append("phone", phone.trim());
    if (address.trim()) formData.append("address", address.trim());
    if (truckId) formData.append("truckId", truckId);

    const res = await createDispatchAction(formData);
    setSubmitting(false);

    if (!res.ok) {
      setError(res.error ?? "Xatolik yuz berdi");
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t("dispatch_add", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-500/10 rounded-md border border-red-500/20">
            {error}
          </div>
        )}

        {/* 1. Terak tanlash (agar preselected bo'lmasa) */}
        {!preselectedTerakId && (
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-terak">{t("work_terak", locale)}</Label>
            <select
              id="dispatch-terak"
              value={terakId}
              onChange={(e) => handleTerakChange(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
              required
            >
              {teraks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* 2. Material tanlash */}
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-material">{t("work_material", locale)}</Label>
          <select
            id="dispatch-material"
            value={materialId}
            onChange={(e) => handleMaterialChange(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            required
          >
            {availableMaterials.length === 0 ? (
              <option value="">{t("work_empty", locale)}</option>
            ) : (
              availableMaterials.map((m) => {
                const volText = m.volumeM3
                  ? ` / ${(m.quantity * m.volumeM3).toFixed(2)} m³`
                  : "";
                return (
                  <option key={m.materialId} value={m.materialId}>
                    {m.name} ({t("dispatch_stock_available", locale)}: {m.quantity} {m.unit}
                    {volText})
                  </option>
                );
              })
            )}
          </select>
        </div>

        {/* 3. Birlik va miqdor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("dispatch_unit", locale)}</Label>
            <div className="flex rounded-control border border-border p-1 bg-muted/40 gap-1">
              <button
                type="button"
                onClick={() => handleUnitChange("piece")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer ${
                  unit === "piece"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("dispatch_unit_piece", locale)}
              </button>
              <button
                type="button"
                disabled={!selectedMaterial?.volumeM3}
                onClick={() => handleUnitChange("cube")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-control transition-all cursor-pointer ${
                  unit === "cube"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
              >
                {t("dispatch_unit_cube", locale)}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispatch-qty">{t("dispatch_quantity", locale)}</Label>
            <Input
              id="dispatch-qty"
              type="number"
              step={unit === "cube" ? "0.001" : "1"}
              min="0.0001"
              value={quantityStr}
              onChange={(e) => setQuantityStr(e.target.value)}
              placeholder="0"
              required
            />
          </div>
        </div>

        {/* 4. Narx (MoneyInput bilan) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="dispatch-price">{t("dispatch_price", locale)}</Label>
            <span className="text-2xs text-muted-foreground font-mono">
              {unit === "piece" ? "1 dona uchun" : "1 m³ uchun"}
            </span>
          </div>
          <MoneyInput
            id="dispatch-price"
            value={price}
            onValueChange={setPrice}
            suffix="so'm"
            placeholder="0"
            required
          />
        </div>

        {/* 5. Real-time Hisob natijasi kartasi */}
        {calcResult && (
          <div
            className={`p-3 rounded-control border text-xs space-y-1.5 ${
              calcResult.valid
                ? "bg-primary/5 border-primary/20 text-foreground"
                : "bg-red-500/10 border-red-500/20 text-red-600"
            }`}
          >
            <div className="flex justify-between items-center font-semibold">
              <span>{t("dispatch_total", locale)}:</span>
              <span className="text-sm font-bold text-primary font-mono">
                {formatMoney(calcResult.totalAmount)}
              </span>
            </div>

            {unit === "cube" && (
              <div className="flex justify-between text-muted-foreground">
                <span>Bazadagi dona miqdori:</span>
                <span className="font-mono font-medium">
                  {calcResult.quantityPiece} dona
                </span>
              </div>
            )}

            {selectedMaterial && (
              <div className="flex justify-between text-muted-foreground border-t border-border/40 pt-1">
                <span>Ombor qoldig'i:</span>
                <span className="font-mono">
                  {selectedMaterial.quantity} →{" "}
                  {calcResult.valid
                    ? Math.max(0, selectedMaterial.quantity - calcResult.quantityPiece)
                    : selectedMaterial.quantity}{" "}
                  dona
                </span>
              </div>
            )}

            {!calcResult.valid && (
              <p className="text-red-500 font-medium pt-1">
                {calcResult.error === "OUT_OF_STOCK" && "Omborda material yo'q"}
                {calcResult.error === "INSUFFICIENT_STOCK" && "Omborda yetarli qoldiq yo'q"}
                {calcResult.error === "MISSING_VOLUME" && "Kub hajm hisoblab bo'lmadi"}
              </p>
            )}
          </div>
        )}

        {/* 6. Sana va Yuk mashinasi */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-date">{t("dispatch_date", locale)}</Label>
            <Input
              id="dispatch-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispatch-truck">{t("dispatch_truck", locale)}</Label>
            <select
              id="dispatch-truck"
              value={truckId}
              onChange={(e) => setTruckId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="">{t("dispatch_truck_none", locale)}</option>
              {trucks.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.name} ({formatMoney(tr.amount)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedTruck && (
          <p className="text-2xs text-muted-foreground italic">
            * {t("dispatch_truck_cost_hint", locale)}: {formatMoney(selectedTruck.amount)}
          </p>
        )}

        {/* 7. Mijoz ma'lumotlari */}
        <div className="space-y-1.5">
          <Label htmlFor="dispatch-recipient">{t("dispatch_recipient", locale)}</Label>
          <Input
            id="dispatch-recipient"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="Mijoz ismi yoki tashkilot"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dispatch-phone">{t("dispatch_phone", locale)}</Label>
            <Input
              id="dispatch-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="dispatch-address">{t("dispatch_address", locale)}</Label>
            <Input
              id="dispatch-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Yetkazish manzili"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("action_cancel", locale)}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={submitting || !calcResult?.valid}
          >
            {submitting ? t("status_loading", locale) : t("dispatch_add", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function DispatchDialog(props: DispatchDialogProps) {
  if (!props.open) return null;
  return <DispatchDialogInner {...props} />;
}
