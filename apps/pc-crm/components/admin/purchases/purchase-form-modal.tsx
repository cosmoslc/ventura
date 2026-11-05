"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Switch } from "@ventura/ui/switch";
import { calcUnitCost } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";

export interface PurchaseItemData {
  id?: string;
  productId: string;
  productName: string;
  variantName?: string;
  type: "piece" | "bulk";
  qty: number;
  totalCost: bigint;
  unitCost: bigint;
  supplier?: string;
  note?: string;
  purchasedAt: string;
  updateProductCost?: boolean;
}

interface PurchaseFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string; costPrice: bigint }[];
  onSave: (purchase: PurchaseItemData) => void;
  isFinancial?: boolean;
}

export function PurchaseFormModal({
  open,
  onOpenChange,
  products,
  onSave,
  isFinancial = true,
}: PurchaseFormModalProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [purchaseType, setPurchaseType] = useState<"piece" | "bulk">("piece");
  const [qty, setQty] = useState(10);
  const [unitCostStr, setUnitCostStr] = useState("1000000");
  const [totalCostStr, setTotalCostStr] = useState("10000000");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const [updateProductCost, setUpdateProductCost] = useState(true);
  const [purchasedAt, setPurchasedAt] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (products[0] && !selectedProductId) {
      setSelectedProductId(products[0].id);
      setUnitCostStr(products[0].costPrice.toString());
    }
  }, [products, selectedProductId]);

  // Mahsulot tanlanganda uning joriy tannarxini qo'yish
  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setUnitCostStr(prod.costPrice.toString());
      const total = prod.costPrice * BigInt(qty);
      setTotalCostStr(total.toString());
    }
  };

  // Dona tannarxi o'zgarganda (Dona rejimida)
  const handleUnitCostChange = (val: string) => {
    setUnitCostStr(val);
    const u = BigInt(val || "0");
    const t = u * BigInt(qty || 1);
    setTotalCostStr(t.toString());
  };

  // Jami summa o'zgarganda (Optom rejimida)
  const handleTotalCostChange = (val: string) => {
    setTotalCostStr(val);
    const t = BigInt(val || "0");
    const u = calcUnitCost(t, qty || 1);
    setUnitCostStr(u.toString());
  };

  // Soni o'zgarganda
  const handleQtyChange = (val: number) => {
    setQty(val);
    if (purchaseType === "piece") {
      const u = BigInt(unitCostStr || "0");
      setTotalCostStr((u * BigInt(val || 1)).toString());
    } else {
      const t = BigInt(totalCostStr || "0");
      setUnitCostStr(calcUnitCost(t, val || 1).toString());
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    onSave({
      productId: prod.id,
      productName: prod.name,
      type: purchaseType,
      qty,
      totalCost: BigInt(totalCostStr || "0"),
      unitCost: BigInt(unitCostStr || "0"),
      supplier: supplier.trim() || undefined,
      note: note.trim() || undefined,
      purchasedAt,
      updateProductCost,
    });

    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Omborga yangi kirim qilish"
      description="Yangi tovarlar xaridini kiriting (ombor qoldigʻi avtomatik oshadi)"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="purchase-form">
            <Check /> Kirimni saqlash
          </Button>
        </>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Mahsulot tanlash */}
        <div>
          <Label htmlFor="purchase-product">Kirim qilinayotgan tovar *</Label>
          <Select value={selectedProductId} onValueChange={handleProductSelect}>
            <SelectTrigger id="purchase-product" aria-label="Kirim qilinayotgan tovar" className="w-full">
              <SelectValue placeholder="Tovarni tanlang" />
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kirim turi: Dona yoki Optom (faqat moliyaviy rejimda) */}
        {isFinancial && (
          <div>
            <Label>Kirim hisoblash turi</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPurchaseType("piece");
                  const u = BigInt(unitCostStr || "0");
                  setTotalCostStr((u * BigInt(qty || 1)).toString());
                }}
                className={`rounded-control border p-2.5 text-center transition-all ${
                  purchaseType === "piece"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border-soft text-muted-foreground hover:bg-muted"
                }`}
              >
                Dona hisobi
                <FieldHint className="mt-0.5">(Dona narxi × Soni = Jami)</FieldHint>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPurchaseType("bulk");
                  const t = BigInt(totalCostStr || "0");
                  setUnitCostStr(calcUnitCost(t, qty || 1).toString());
                }}
                className={`rounded-control border p-2.5 text-center transition-all ${
                  purchaseType === "bulk"
                    ? "border-primary bg-primary/10 text-primary font-bold"
                    : "border-border-soft text-muted-foreground hover:bg-muted"
                }`}
              >
                Optom (Partiya)
                <FieldHint className="mt-0.5">(Jami summa / Soni = Dona tannarxi)</FieldHint>
              </button>
            </div>
          </div>
        )}

        {/* Soni, Narxlar va Xarid sanasi */}
        <div className={`grid gap-3 ${isFinancial ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <div>
            <Label htmlFor="purchase-qty">Xarid qilingan soni (dona) *</Label>
            <Input
              id="purchase-qty"
              type="number"
              min={1}
              value={qty}
              onChange={(e) => handleQtyChange(Math.max(1, Number(e.target.value)))}
            />
          </div>

          {isFinancial && (
            purchaseType === "piece" ? (
              <div>
                <Label htmlFor="purchase-unit-cost">1 dona tannarxi (soʻm) *</Label>
                <Input
                  id="purchase-unit-cost"
                  type="number"
                  value={unitCostStr}
                  onChange={(e) => handleUnitCostChange(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="purchase-total-cost">Jami partiya summasi (soʻm) *</Label>
                <Input
                  id="purchase-total-cost"
                  type="number"
                  value={totalCostStr}
                  onChange={(e) => handleTotalCostChange(e.target.value)}
                />
              </div>
            )
          )}

          <div>
            <Label htmlFor="purchase-date">Xarid sanasi</Label>
            <Input
              id="purchase-date"
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </div>
        </div>

        {/* Hisob xulosasi bloki (faqat moliyaviy rejimda) */}
        {isFinancial && (
          <div className="flex items-center justify-between rounded-control border border-border bg-muted/20 p-3.5">
            <div>
              <FieldHint className="mt-0">Hisoblangan 1 dona tannarxi:</FieldHint>
              <div className="text-body font-bold text-foreground">
                {formatMoney(BigInt(unitCostStr || "0"))}
              </div>
            </div>

            <div className="text-right">
              <FieldHint className="mt-0">Jami toʻlangan summa:</FieldHint>
              <div className="text-body font-bold text-primary">
                {formatMoney(BigInt(totalCostStr || "0"))}
              </div>
            </div>
          </div>
        )}

        {/* Yetkazib beruvchi va izoh */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="purchase-supplier">Yetkazib beruvchi (optovik / doʻkon)</Label>
            <Input
              id="purchase-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Masalan: Malika B-12 doʻkon"
            />
          </div>

          <div>
            <Label htmlFor="purchase-note">Izoh (ixtiyoriy)</Label>
            <Input
              id="purchase-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: 1 oy kafolat bilan olindi"
            />
          </div>
        </div>

        {/* Checkbox: Mahsulot tannarxi ham yangilansinmi */}
        {isFinancial && (
          <label
            htmlFor="purchase-update-cost"
            className="flex cursor-pointer items-center justify-between rounded-control border border-border-soft p-3 transition-colors hover:bg-muted"
          >
            <div>
              <div className="text-body font-medium text-foreground">Katalogdagi tannarx yangilansin</div>
              <FieldHint className="mt-0.5">
                Mahsulotning bazadagi tannarxi oxirgi kirim narxiga ({formatMoney(BigInt(unitCostStr || "0"))}) moslashtiriladi
              </FieldHint>
            </div>
            <Switch id="purchase-update-cost" checked={updateProductCost} onCheckedChange={setUpdateProductCost} />
          </label>
        )}
      </form>
    </Modal>
  );
}
