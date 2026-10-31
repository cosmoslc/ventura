"use client";

import { useEffect, useState } from "react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { calcItemProfit, calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";

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
}

export function SaleFormModal({ open, onOpenChange, products, onSave }: SaleFormModalProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+998 ");
  const [qty, setQty] = useState(1);
  const [soldPriceStr, setSoldPriceStr] = useState("0");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (products[0] && !selectedProductId) {
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

  const totalRevenue = soldPrice * BigInt(qty || 1);
  const profit = calcItemProfit(soldPrice, costSnapshot, qty || 1);
  const marginPercent = calcMarginPercent(profit, totalRevenue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !buyerName.trim() || buyerPhone.length < 9) {
      alert("Iltimos, xaridor ismi va telefonini kiriting");
      return;
    }

    onSave({
      source: "offline",
      type: "product",
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      buyerName: buyerName.trim(),
      buyerPhone: buyerPhone.trim(),
      qty,
      listPrice,
      soldPrice,
      costSnapshot,
      profit,
      marginPercent,
      soldAt,
    });

    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Yangi oflayn sotuv kiritish"
      description="Doʻkondan toʻgʻridan-toʻgʻri naqd/karta bilan sotilgan tovar hisobi"
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>

          <Button variant="primary" size="sm" onClick={handleSubmit} className="font-bold">
            Sotuvni saqlash
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Xaridor ma'lumotlari (majburiy) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-1">
            <Label className="text-xs font-semibold">Xaridor ismi *</Label>
            <Input
              required
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Masalan: Anvar Qodirov"
            />
          </div>

          <div className="space-y-1 sm:col-span-1">
            <Label className="text-xs font-semibold">Telefon raqam *</Label>
            <Input
              required
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
            />
          </div>

          <div className="space-y-1 sm:col-span-1">
            <Label className="text-xs font-semibold">Sotilgan sana *</Label>
            <Input
              type="date"
              required
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
            />
          </div>
        </div>

        {/* Mahsulot tanlash */}
        <div className="space-y-1 border-t border-border pt-3">
          <Label className="text-xs font-semibold">Sotilgan tovar *</Label>
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

        {/* Narx va soni */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Soni (dona) *</Label>
            <Input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Roʻyxat narxi (Katalogdagi)</Label>
            <Input
              disabled
              value={formatMoney(listPrice)}
              className="bg-muted text-muted-foreground"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Haqiqiy sotilgan narx (soʻm) *</Label>
            <Input
              type="number"
              value={soldPriceStr}
              onChange={(e) => setSoldPriceStr(e.target.value)}
            />
          </div>
        </div>

        {/* Sof foyda va Marja hisob-kitob kartasi */}
        <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Tannarx snapshot (1 dona):</span>
            <span className="font-semibold text-foreground">{formatMoney(costSnapshot)}</span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Jami tushum ({qty} dona):</span>
            <span className="font-bold text-foreground">{formatMoney(totalRevenue)}</span>
          </div>

          <div className="flex items-center justify-between border-t border-border/80 pt-2 text-sm font-bold">
            <span>Ushbu sotuvdan sof daromad:</span>
            <span className={profit >= 0n ? "text-emerald-600 dark:text-emerald-400 font-black" : "text-rose-500 font-black"}>
              {profit >= 0n ? "+" : ""}{formatMoney(profit)} ({marginPercent}% marja)
            </span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
