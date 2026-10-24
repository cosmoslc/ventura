"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { type Locale, t } from "@/lib/i18n";
import { createOrderAction, updateOrderAction } from "./actions";

export interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teraks: Array<{ id: string; name: string }>;
  preselectedTerakId?: string;
  materials: Array<{ id: string; name: string; unit: string }>;
  terakMaterials?: Array<{ terakId: string; materialId: string; quantity: string }>;
  initialOrder?: {
    id: string;
    terakId: string;
    materialId: string;
    quantity: number;
    customerName: string;
    phone: string | null;
    address: string | null;
    dueDate: string | null;
  } | null;
  locale: Locale;
}

function OrderDialogInner({
  open,
  onOpenChange,
  teraks,
  preselectedTerakId,
  materials,
  terakMaterials = [],
  initialOrder,
  locale,
}: OrderDialogProps) {
  const router = useRouter();
  const isEditing = Boolean(initialOrder);

  const [terakId, setTerakId] = React.useState(
    initialOrder?.terakId || preselectedTerakId || teraks[0]?.id || "",
  );
  const [materialId, setMaterialId] = React.useState(
    initialOrder?.materialId || materials[0]?.id || "",
  );
  const [quantityStr, setQuantityStr] = React.useState(
    initialOrder ? String(initialOrder.quantity) : "",
  );
  const [customerName, setCustomerName] = React.useState(
    initialOrder?.customerName || "",
  );
  const [phone, setPhone] = React.useState(initialOrder?.phone || "");
  const [address, setAddress] = React.useState(initialOrder?.address || "");
  const [dueDate, setDueDate] = React.useState(initialOrder?.dueDate || "");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Ombordagi mavjud qoldiqni topish
  const stockQty = React.useMemo(() => {
    if (!terakId || !materialId) return 0;
    const found = terakMaterials.find(
      (tm) => tm.terakId === terakId && tm.materialId === materialId,
    );
    return found ? Number(found.quantity) : 0;
  }, [terakId, materialId, terakMaterials]);

  const selectedMaterial = React.useMemo(() => {
    return materials.find((m) => m.id === materialId);
  }, [materials, materialId]);

  const isStockReady = React.useMemo(() => {
    const q = Number(quantityStr);
    return q > 0 && stockQty >= q;
  }, [stockQty, quantityStr]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantityStr);
    if (q <= 0) {
      setError("Miqdor 0 dan katta bo'lishi shart");
      return;
    }
    if (!customerName.trim()) {
      setError("Mijoz ismi kiritilishi shart");
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("terakId", terakId);
    formData.append("materialId", materialId);
    formData.append("quantity", quantityStr);
    formData.append("customerName", customerName.trim());
    if (phone.trim()) formData.append("phone", phone.trim());
    if (address.trim()) formData.append("address", address.trim());
    if (dueDate.trim()) formData.append("dueDate", dueDate.trim());

    const res = isEditing && initialOrder
      ? await updateOrderAction(initialOrder.id, formData)
      : await createOrderAction(formData);

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
      title={isEditing ? t("orders_edit", locale) : t("orders_add", locale)}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs text-red-600 bg-red-500/10 rounded-md border border-red-500/20">
            {error}
          </div>
        )}

        {/* 1. Terak tanlash (yangi qo'shilayotganda va preselected bo'lmasa) */}
        {!isEditing && !preselectedTerakId && (
          <div className="space-y-1.5">
            <Label htmlFor="order-terak">{t("work_terak", locale)}</Label>
            <select
              id="order-terak"
              value={terakId}
              onChange={(e) => setTerakId(e.target.value)}
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
        {!isEditing ? (
          <div className="space-y-1.5">
            <Label htmlFor="order-material">{t("work_material", locale)}</Label>
            <select
              id="order-material"
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-card border border-border rounded-control focus:ring-2 focus:ring-primary focus:outline-none"
              required
            >
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="p-3 bg-muted/40 rounded-control text-xs space-y-1">
            <span className="text-muted-foreground">{t("work_material", locale)}:</span>
            <div className="font-semibold text-foreground">
              {selectedMaterial?.name ?? "Material"}
            </div>
          </div>
        )}

        {/* 3. Miqdor */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <Label htmlFor="order-qty">{t("orders_quantity", locale)}</Label>
            <span className="text-2xs text-muted-foreground font-mono">
              Omborda bor: {stockQty} {selectedMaterial?.unit ?? "dona"}
            </span>
          </div>
          <Input
            id="order-qty"
            type="number"
            step="0.001"
            min="0.0001"
            value={quantityStr}
            onChange={(e) => setQuantityStr(e.target.value)}
            placeholder="0"
            required
          />
        </div>

        {/* Omborda yetarli bo'lsa bildirishnoma */}
        {isStockReady && (
          <div className="p-2.5 rounded-control bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
            <div className="font-bold">{t("orders_ready_in_stock", locale)}</div>
            <div className="text-2xs">{t("orders_stock_ready_desc", locale)}</div>
          </div>
        )}

        {/* 4. Mijoz ma'lumotlari */}
        <div className="space-y-1.5">
          <Label htmlFor="order-customer">{t("orders_customer", locale)}</Label>
          <Input
            id="order-customer"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Mijoz ismi (masalan, Akmal aka)"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="order-phone">{t("dispatch_phone", locale)}</Label>
            <Input
              id="order-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="order-duedate">{t("orders_due_date", locale)}</Label>
            <Input
              id="order-duedate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="order-address">{t("dispatch_address", locale)}</Label>
          <Input
            id="order-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Yetkazish manzili (ixtiyoriy)"
          />
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
            disabled={submitting}
          >
            {submitting
              ? t("status_loading", locale)
              : isEditing
                ? t("action_save", locale)
                : t("orders_add", locale)}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function OrderDialog(props: OrderDialogProps) {
  if (!props.open) return null;
  return <OrderDialogInner {...props} />;
}
