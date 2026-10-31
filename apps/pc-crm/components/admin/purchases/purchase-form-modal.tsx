"use client";

import { useEffect, useState } from "react";
import { PackagePlus } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
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
}

export function PurchaseFormModal({
  open,
  onOpenChange,
  products,
  onSave,
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
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>

          <Button variant="primary" size="sm" onClick={handleSubmit} className="font-bold">
            Kirimni saqlash
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Mahsulot tanlash */}
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Kirim qilinayotgan tovar *</Label>
          <select
            value={selectedProductId}
            onChange={(e) => handleProductSelect(e.target.value)}
            className="h-(--control-h) w-full rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Kirim turi: Dona yoki Optom */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">Kirim hisoblash turi</Label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setPurchaseType("piece");
                const u = BigInt(unitCostStr || "0");
                setTotalCostStr((u * BigInt(qty || 1)).toString());
              }}
              className={`rounded-lg border p-2.5 text-center font-bold transition-all ${
                purchaseType === "piece"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Dona hisobi
              <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                (Dona narxi × Soni = Jami)
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPurchaseType("bulk");
                const t = BigInt(totalCostStr || "0");
                setUnitCostStr(calcUnitCost(t, qty || 1).toString());
              }}
              className={`rounded-lg border p-2.5 text-center font-bold transition-all ${
                purchaseType === "bulk"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              Optom (Partiya)
              <span className="block text-[10px] font-normal text-muted-foreground mt-0.5">
                (Jami summa / Soni = Dona tannarxi)
              </span>
            </button>
          </div>
        </div>

        {/* Soni, Narxlar va Jonli hisob */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Xarid qilingan soni (dona) *</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => handleQtyChange(Math.max(1, Number(e.target.value)))}
            />
          </div>

          {purchaseType === "piece" ? (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">1 dona tannarxi (soʻm) *</Label>
              <Input
                type="number"
                value={unitCostStr}
                onChange={(e) => handleUnitCostChange(e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Jami partiya summasi (soʻm) *</Label>
              <Input
                type="number"
                value={totalCostStr}
                onChange={(e) => handleTotalCostChange(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Xarid sanasi</Label>
            <Input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
            />
          </div>
        </div>

        {/* Hisob xulosasi bloki */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 p-3.5">
          <div>
            <p className="text-[11px] text-muted-foreground">Hisoblangan 1 dona tannarxi:</p>
            <p className="text-base font-black text-foreground">
              {formatMoney(BigInt(unitCostStr || "0"))}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-muted-foreground">Jami toʻlangan summa:</p>
            <p className="text-base font-black text-primary">
              {formatMoney(BigInt(totalCostStr || "0"))}
            </p>
          </div>
        </div>

        {/* Yetkazib beruvchi va izoh */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Yetkazib beruvchi (optovik / doʻkon)</Label>
            <Input
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              placeholder="Masalan: Malika B-12 doʻkon"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Izoh (ixtiyoriy)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Masalan: 1 oy kafolat bilan olindi"
            />
          </div>
        </div>

        {/* Checkbox: Mahsulot tannarxi ham yangilansinmi */}
        <div className="rounded-lg border border-border p-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-foreground">Katalogdagi tannarx yangilansin</p>
            <p className="text-[11px] text-muted-foreground">
              Mahsulotning bazadagi tannarxi oxirgi kirim narxiga ({formatMoney(BigInt(unitCostStr || "0"))}) moslashtiriladi
            </p>
          </div>
          <Switch checked={updateProductCost} onCheckedChange={setUpdateProductCost} />
        </div>
      </form>
    </Modal>
  );
}
