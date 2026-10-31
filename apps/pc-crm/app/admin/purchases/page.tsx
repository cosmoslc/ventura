"use client";

import { useState } from "react";
import {
  Boxes,
  Calendar,
  DollarSign,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  Truck,
  Undo2,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { StatCard } from "@ventura/ui/stat-card";
import {
  type PurchaseItemData,
  PurchaseFormModal,
} from "@/components/admin/purchases/purchase-form-modal";
import { formatDate, formatMoney } from "@/lib/format";

const SAMPLE_PRODUCTS = [
  { id: "p-1", name: "Intel Core i7-14700K 3.4GHz Protsessor", costPrice: 4_500_000n },
  { id: "p-2", name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB", costPrice: 11_800_000n },
  { id: "p-3", name: "Kingston FURY Beast RGB 32GB DDR5", costPrice: 1_450_000n },
  { id: "p-4", name: "Samsung 990 PRO 2TB NVMe M.2 SSD", costPrice: 2_150_000n },
];

const INITIAL_PURCHASES: (PurchaseItemData & { id: string; voidedAt?: string })[] = [
  {
    id: "pur-101",
    productId: "p-1",
    productName: "Intel Core i7-14700K 3.4GHz Protsessor",
    type: "bulk",
    qty: 10,
    totalCost: 45_000_000n,
    unitCost: 4_500_000n,
    supplier: "Intel Distro Tashkent",
    purchasedAt: "2026-10-28",
    note: "Yangi partiya xaridi",
  },
  {
    id: "pur-102",
    productId: "p-3",
    productName: "Kingston FURY Beast RGB 32GB DDR5",
    type: "piece",
    qty: 20,
    totalCost: 29_000_000n,
    unitCost: 1_450_000n,
    supplier: "Malika B-14",
    purchasedAt: "2026-10-27",
  },
  {
    id: "pur-103",
    productId: "p-4",
    productName: "Samsung 990 PRO 2TB NVMe M.2 SSD",
    type: "bulk",
    qty: 15,
    totalCost: 32_250_000n,
    unitCost: 2_150_000n,
    supplier: "Samsung Korea Import",
    purchasedAt: "2026-10-25",
  },
];

export default function AdminPurchasesPage() {
  const [purchases, setPurchases] = useState(INITIAL_PURCHASES);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = purchases.filter((item) =>
    item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalSpent = purchases
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + p.totalCost, 0n);

  const totalUnits = purchases
    .filter((p) => !p.voidedAt)
    .reduce((sum, p) => sum + p.qty, 0);

  const handleSavePurchase = (newPur: PurchaseItemData) => {
    const item = {
      ...newPur,
      id: `pur-${Date.now().toString().slice(-4)}`,
    };
    setPurchases([item, ...purchases]);
  };

  const handleVoidPurchase = (id: string) => {
    if (confirm("Ushbu kirimni bekor qilmoqchimisiz? (Ombordan mos dona kamayadi)")) {
      setPurchases(
        purchases.map((p) =>
          p.id === id ? { ...p, voidedAt: new Date().toISOString() } : p
        )
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha va qo'shish */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Omborga kirimlar hisobi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Dona va optom xaridlar jurnali, yetkazib beruvchilar va tannarx nazorati
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 font-bold">
          <Plus size={15} />
          Yangi kirim qilish
        </Button>
      </div>

      {/* Statistika kartalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<DollarSign />}
          label="Jami kirim xarajati"
          value={formatMoney(totalSpent)}
          tone={1}
          hint="Barcha faol kirimlar summasi"
        />

        <StatCard
          icon={<PackagePlus />}
          label="Xarid qilingan jami dona"
          value={`${totalUnits} dona`}
          tone={2}
          hint="Ombor zaxirasiga tushgan"
        />

        <StatCard
          icon={<Truck />}
          label="Kirim partiyalari soni"
          value={`${purchases.filter((p) => !p.voidedAt).length} ta partiya`}
          tone={3}
          hint="Yetkazib beruvchilardan"
        />
      </div>

      {/* Qidiruv */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Mahsulot nomi yoki yetkazib beruvchi boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Jadval */}
      <div className="overflow-x-auto rounded-[var(--r-card,12px)] border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-[11px] tracking-wider">
              <th className="p-3.5">Sana</th>
              <th className="p-3.5">Mahsulot</th>
              <th className="p-3.5 text-center">Turi</th>
              <th className="p-3.5 text-center">Soni</th>
              <th className="p-3.5 text-right">Dona tannarxi</th>
              <th className="p-3.5 text-right">Jami summa</th>
              <th className="p-3.5">Yetkazib beruvchi</th>
              <th className="p-3.5 text-center">Holat</th>
              <th className="p-3.5 text-right">Amal</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  Kirimlar topilmadi
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isVoided = Boolean(item.voidedAt);

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-muted/30 transition-colors ${isVoided ? "opacity-50 line-through" : ""}`}
                  >
                    <td className="p-3.5 font-medium whitespace-nowrap">{formatDate(item.purchasedAt)}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-foreground">{item.productName}</p>
                      {item.note && <p className="text-[11px] text-muted-foreground">{item.note}</p>}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase">
                        {item.type === "bulk" ? "Optom" : "Dona"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-foreground">
                      +{item.qty} dona
                    </td>
                    <td className="p-3.5 text-right font-medium text-muted-foreground">
                      {formatMoney(item.unitCost)}
                    </td>
                    <td className="p-3.5 text-right font-black text-foreground">
                      {formatMoney(item.totalCost)}
                    </td>
                    <td className="p-3.5 font-medium text-muted-foreground">
                      {item.supplier ?? "—"}
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge tone={isVoided ? "danger" : "success"} className="text-[10px]">
                        {isVoided ? "Bekor qilingan" : "Kirim boʻlgan"}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      {!isVoided && (
                        <button
                          type="button"
                          onClick={() => handleVoidPurchase(item.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          title="Kirimni bekor qilish"
                        >
                          <Undo2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Yangi kirim modali */}
      <PurchaseFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={SAMPLE_PRODUCTS}
        onSave={handleSavePurchase}
      />
    </div>
  );
}
