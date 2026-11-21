"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { calcItemProfit, calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { useFinancialMode } from "@/lib/store-context";

export interface SaleItemData {
  id?: string;
  source: "site" | "offline";
  type: "product" | "pc";
  productId?: string;
  productName: string;
  buyerName: string;
  buyerPhone: string;
  qty: number;
  listPrice: bigint;
  soldPrice: bigint;
  costSnapshot: bigint;
  profit: bigint;
  marginPercent: number;
  soldAt: string;
}

interface SaleFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: { id: string; name: string; costPrice: bigint; sellPrice: bigint }[];
  onSave: (sale: SaleItemData) => void;
  isFinancial?: boolean;
}

export function SaleFormModal({
  open,
  onOpenChange,
  products,
  onSave,
  isFinancial: isFinancialProp,
}: SaleFormModalProps) {
  const contextIsFinancial = useFinancialMode();
  const isFinancial = isFinancialProp ?? contextIsFinancial;
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+998 ");
  const [qtyStr, setQtyStr] = useState("");
  const [soldPriceStr, setSoldPriceStr] = useState("0");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (products[0] && !selectedProductId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- birinchi mahsulotni standart tanlash
      setSelectedProductId(products[0].id);
      setSoldPriceStr(products[0].sellPrice.toString());
    }
  }, [products, selectedProductId]);

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find((p) => p.id === id);
    if (prod) {
      setSoldPriceStr(prod.sellPrice.toString());
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const costSnapshot = selectedProduct?.costPrice ?? 0n;
  const listPrice = selectedProduct?.sellPrice ?? 0n;
  const soldPrice = BigInt(soldPriceStr || "0");
  const qty = Math.max(1, parseInt(qtyStr || "1", 10));

  const totalRevenue = soldPrice * BigInt(qty);
  const profit = calcItemProfit(soldPrice, costSnapshot, qty);
  const marginPercent = calcMarginPercent(profit, totalRevenue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !buyerName.trim() || buyerPhone.length < 9) {
      alert("Iltimos, xaridor ismi va telefonini kiriting");
      return;
    }

    const finalQty = Math.max(1, parseInt(qtyStr || "1", 10));

    onSave({
      source: "offline",
      type: "product",
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      qty: finalQty,
      listPrice: isFinancial ? listPrice : 0n,
      soldPrice: isFinancial ? soldPrice : 0n,
      costSnapshot: isFinancial ? costSnapshot : 0n,
      profit: isFinancial ? profit : 0n,
      marginPercent: isFinancial ? marginPercent : 0,
      soldAt,
    });

    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isFinancial ? "Yangi oflayn sotuv kiritish" : "Yangi chiqim / sotuv kiritish"}
      description={
        isFinancial
          ? "Doʻkondan toʻgʻridan-toʻgʻri naqd/karta bilan sotilgan tovar hisobi"
          : "Doʻkondan tovar chiqimi (xaridor va soni hisobi)"
      }
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="sale-form">
            <Check /> {isFinancial ? "Sotuvni saqlash" : "Chiqimni tasdiqlash"}
          </Button>
        </>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Xaridor ma'lumotlari */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="sale-buyer-name">Xaridor ismi *</Label>
            <Input
              id="sale-buyer-name"
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Masalan: Anvar Qodirov"
            />
          </div>

          <div>
            <Label htmlFor="sale-buyer-phone">Telefon raqam *</Label>
            <Input
              id="sale-buyer-phone"
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div>
            <Label htmlFor="sale-date">Sotilgan sana *</Label>
            <Input id="sale-date" type="date" required value={soldAt} onChange={(e) => setSoldAt(e.target.value)} />
          </div>
        </div>

        {/* Mahsulot tanlash */}
        <div>
          <Label htmlFor="sale-product">Sotilgan tovar *</Label>
          <Select value={selectedProductId} onValueChange={handleProductSelect}>
            <SelectTrigger id="sale-product" aria-label="Sotilgan tovar" className="w-full">
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

        {/* Narx va soni */}
        {isFinancial ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="sale-qty">Soni (dona) *</Label>
              <Input
                id="sale-qty"
                type="number"
                min={1}
                value={qtyStr}
                onChange={(e) => setQtyStr(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>

            <div>
              <Label htmlFor="sale-list-price">Roʻyxat narxi (Katalogdagi)</Label>
              <Input
                id="sale-list-price"
                disabled
                value={formatMoney(listPrice)}
                className="bg-muted text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="sale-sold-price">Haqiqiy sotilgan narx (soʻm) *</Label>
              <Input
                id="sale-sold-price"
                type="number"
                value={soldPriceStr}
                onChange={(e) => setSoldPriceStr(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
          </div>
        ) : (
          <div>
            <Label htmlFor="sale-qty-only">Soni (dona) *</Label>
            <Input
              id="sale-qty-only"
              type="number"
              min={1}
              value={qtyStr}
              onChange={(e) => setQtyStr(e.target.value)}
              onFocus={(e) => e.target.select()}
            />
          </div>
        )}

        {/* Sof foyda va Marja hisob-kitob kartasi */}
        {isFinancial && (
          <div className="space-y-2 rounded-control border border-border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <FieldHint className="mt-0">Tannarx snapshot (1 dona):</FieldHint>
              <div className="text-body font-semibold text-foreground">{formatMoney(costSnapshot)}</div>
            </div>

            <div className="flex items-center justify-between">
              <FieldHint className="mt-0">Jami tushum ({qty} dona):</FieldHint>
              <div className="text-body font-bold text-foreground">{formatMoney(totalRevenue)}</div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-2">
              <div className="text-body font-semibold">Ushbu sotuvdan sof daromad:</div>
              <div className={`text-body font-bold ${profit >= 0n ? "text-(--success-fg)" : "text-(--danger-fg)"}`}>
                {profit >= 0n ? "+" : ""}
                {formatMoney(profit)} ({marginPercent}% marja)
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
