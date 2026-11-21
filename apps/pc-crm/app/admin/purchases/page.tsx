"use client";

import { useCallback, useEffect, useState } from "react";
import { DollarSign, PackagePlus, Plus, Search, Truck, Undo2 } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { StatCard } from "@ventura/ui/stat-card";
import { type PurchaseItemData, PurchaseFormModal } from "@/components/admin/purchases/purchase-form-modal";
import { formatDate, formatMoney } from "@/lib/format";
import {
  getAdminProductsAction,
  getAdminPurchasesAction,
  savePurchaseAction,
  voidPurchaseAction,
} from "@/lib/server/actions";
import { useFinancialMode } from "@/lib/store-context";

export default function AdminPurchasesPage() {
  const isFinancial = useFinancialMode();
  const [purchases, setPurchases] = useState<(PurchaseItemData & { id: string; voidedAt?: string })[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; costPrice: bigint }[]>([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [purchaseResult, productResult] = await Promise.all([getAdminPurchasesAction(), getAdminProductsAction()]);
    if (!purchaseResult.success) setError(purchaseResult.error ?? "Kirimlarni yuklab bo'lmadi");
    else setPurchases(purchaseResult.purchases);
    if (!productResult.success) setError(productResult.error ?? "Mahsulotlarni yuklab bo'lmadi");
    else
      setProducts(
        productResult.products
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name, costPrice: p.costPrice })),
      );
  }, []);
  useEffect(() => {
    void loadData();
  }, [loadData]);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const filtered = purchases.filter(
    (item) =>
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const totalSpent = purchases.filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.totalCost, 0n);

  const totalUnits = purchases.filter((p) => !p.voidedAt).reduce((sum, p) => sum + p.qty, 0);

  const handleSavePurchase = async (newPur: PurchaseItemData) => {
    const result = await savePurchaseAction({
      productId: newPur.productId,
      type: newPur.type,
      qty: newPur.qty,
      totalCost: newPur.totalCost,
      unitCost: newPur.unitCost,
      supplier: newPur.supplier,
      purchasedAt: newPur.purchasedAt,
      note: newPur.note,
    });
    if (!result.success) {
      setError(result.error ?? "Kirimni saqlab bo'lmadi");
      return;
    }
    setModalOpen(false);
    await loadData();
  };

  const handleVoidPurchase = async (id: string) => {
    if (!confirm("Ushbu kirimni bekor qilmoqchimisiz? (Ombordan mos dona kamayadi)")) return;
    const result = await voidPurchaseAction(id);
    if (!result.success) {
      setError(result.error ?? "Kirimni bekor qilib bo'lmadi");
      return;
    }
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha va qo'shish */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Omborga kirimlar hisobi</h1>
        </div>

        <Button onClick={() => setModalOpen(true)}>
          <Plus />
          Yangi kirim qilish
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)"
        >
          {error}
        </div>
      )}

      {/* Statistika kartalari */}
      <div className={`grid grid-cols-1 gap-4 ${isFinancial ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
        {isFinancial && (
          <StatCard
            icon={<DollarSign />}
            label="Jami kirim xarajati"
            value={formatMoney(totalSpent)}
            tone={1}
            valueClassName="whitespace-nowrap text-title"
          />
        )}

        <StatCard
          icon={<PackagePlus />}
          label="Xarid qilingan jami dona"
          value={`${totalUnits} dona`}
          tone={isFinancial ? 2 : 1}
        />

        <StatCard
          icon={<Truck />}
          label="Kirim partiyalari soni"
          value={`${purchases.filter((p) => !p.voidedAt).length} ta partiya`}
          tone={isFinancial ? 3 : 2}
        />
      </div>

      {/* Qidiruv */}
      <div className="flex items-center justify-between rounded-control border border-border bg-card p-3 shadow-card">
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
      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-caption tracking-wider">
              <th className="p-3.5">Sana</th>
              <th className="p-3.5">Mahsulot</th>
              <th className="p-3.5 text-center">Turi</th>
              <th className="p-3.5 text-center">Soni</th>
              {isFinancial && (
                <>
                  <th className="p-3.5 text-right">Dona tannarxi</th>
                  <th className="p-3.5 text-right">Jami summa</th>
                </>
              )}
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
                      {item.note && <p className="text-caption text-muted-foreground">{item.note}</p>}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className="rounded bg-secondary px-2 py-0.5 text-2xs font-bold uppercase">
                        {item.type === "bulk" ? "Optom" : "Dona"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-foreground">+{item.qty} dona</td>
                    {isFinancial && (
                      <>
                        <td className="p-3.5 text-right font-medium text-muted-foreground">
                          {formatMoney(item.unitCost)}
                        </td>
                        <td className="p-3.5 text-right font-black text-foreground">{formatMoney(item.totalCost)}</td>
                      </>
                    )}
                    <td className="p-3.5 font-medium text-muted-foreground">{item.supplier ?? "—"}</td>
                    <td className="p-3.5 text-center">
                      <Badge tone={isVoided ? "danger" : "success"} className="text-2xs">
                        {isVoided ? "Bekor qilingan" : "Kirim boʻlgan"}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right">
                      {!isVoided && (
                        <Button
                          variant="icon"
                          size="icon-sm"
                          onClick={() => handleVoidPurchase(item.id)}
                          className="hover:text-destructive"
                          title="Kirimni bekor qilish"
                          aria-label="Kirimni bekor qilish"
                        >
                          <Undo2 />
                        </Button>
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
        products={products}
        onSave={handleSavePurchase}
        isFinancial={isFinancial}
      />
    </div>
  );
}
