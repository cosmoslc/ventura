"use client";

import { useCallback, useEffect, useState } from "react";
import { Boxes, DollarSign, Plus, Receipt, Search, TrendingUp, Undo2 } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { type SaleItemData, SaleFormModal } from "@/components/admin/sales/sale-form-modal";
import { formatDate, formatMoney } from "@/lib/format";
import { getAdminProductsAction, getAdminSalesAction, saveSaleAction, voidSaleAction } from "@/lib/server/actions";
import { useFinancialMode } from "@/lib/store-context";

export default function AdminSalesPage() {
  const isFinancial = useFinancialMode();
  const [sales, setSales] = useState<(SaleItemData & { id: string; voidedAt?: string })[]>([]);
  const [products, setProducts] = useState<{ id: string; name: string; costPrice: bigint; sellPrice: bigint }[]>([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [saleResult, productResult] = await Promise.all([getAdminSalesAction(), getAdminProductsAction()]);
    if (!saleResult.success) setError(saleResult.error ?? "Sotuvlarni yuklab bo'lmadi");
    else setSales(saleResult.sales);
    if (!productResult.success) setError(productResult.error ?? "Mahsulotlarni yuklab bo'lmadi");
    else
      setProducts(
        productResult.products
          .filter((p) => p.isActive)
          .map((p) => ({ id: p.id, name: p.name, costPrice: p.costPrice, sellPrice: p.sellPrice })),
      );
  }, []);
  useEffect(() => {
    void loadData();
  }, [loadData]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  // Filtrlar
  const filtered = sales.filter((item) => {
    const matchSearch =
      item.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.buyerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.buyerPhone.includes(searchQuery);

    const matchSource = sourceFilter === "all" || item.source === sourceFilter;

    return matchSearch && matchSource;
  });

  // Statistika
  const activeSales = sales.filter((s) => !s.voidedAt);
  const totalRevenue = activeSales.reduce((sum, s) => sum + s.soldPrice, 0n);
  const totalCost = activeSales.reduce((sum, s) => sum + s.costSnapshot, 0n);
  const totalProfit = activeSales.reduce((sum, s) => sum + s.profit, 0n);
  const totalUnits = activeSales.reduce((sum, s) => sum + s.qty, 0);
  const avgMargin = totalRevenue > 0n ? Number(((Number(totalProfit) / Number(totalRevenue)) * 100).toFixed(2)) : 0;

  const handleSaveSale = async (newSale: SaleItemData) => {
    const result = await saveSaleAction({
      source: newSale.source,
      type: newSale.type,
      productId: newSale.productId,
      productName: newSale.productName,
      buyerName: newSale.buyerName,
      buyerPhone: newSale.buyerPhone,
      qty: newSale.qty,
      listPrice: newSale.listPrice,
      soldPrice: newSale.soldPrice,
      costSnapshot: newSale.costSnapshot,
      profit: newSale.profit,
      soldAt: newSale.soldAt,
    });
    if (!result.success) {
      setError(result.error ?? "Sotuvni saqlab bo'lmadi");
      return;
    }
    setModalOpen(false);
    await loadData();
  };

  const handleVoidSale = async (id: string) => {
    if (!confirm("Ushbu sotuvni qaytarmoqchimisiz? Ombor qoldigʻi qaytariladi.")) return;
    const result = await voidSaleAction(id);
    if (!result.success) {
      setError(result.error ?? "Sotuvni bekor qilib bo'lmadi");
      return;
    }
    await loadData();
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha va qo'shish */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            {isFinancial ? "Sotuvlar va Sof Foyda hisobi" : "Sotuvlar jurnali"}
          </h1>
        </div>

        <Button onClick={() => setModalOpen(true)}>
          <Plus />
          {isFinancial ? "Oflayn sotuv kiritish" : "Chiqim / Sotuv kiritish"}
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
      {isFinancial ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<DollarSign />}
            label="Jami tushum"
            value={formatMoney(totalRevenue)}
            tone={1}
            valueClassName="whitespace-nowrap text-title"
          />

          <StatCard
            icon={<TrendingUp />}
            label="Sof daromad (Foyda)"
            value={formatMoney(totalProfit)}
            tone={2}
            valueClassName="whitespace-nowrap text-title"
          />

          <StatCard
            icon={<Boxes />}
            label="Sotilgan tovarlar tannarxi"
            value={formatMoney(totalCost)}
            tone={3}
            valueClassName="whitespace-nowrap text-title"
          />

          <StatCard icon={<Receipt />} label="Bitimlar soni" value={`${activeSales.length} ta`} tone={4} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StatCard
            icon={<Receipt />}
            label="Jami sotuvlar (bitimlar soni)"
            value={`${activeSales.length} ta`}
            tone={1}
          />

          <StatCard icon={<Boxes />} label="Sotilgan tovarlar umumiy soni" value={`${totalUnits} dona`} tone={2} />
        </div>
      )}

      {/* Qidiruv va Manba filtri */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card p-3 shadow-card">
        <div className="relative flex-1 min-w-60">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tovar, xaridor ismi yoki telefon boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger aria-label="Sotuv manbasi" className="w-auto min-w-48 text-xs">
              <SelectValue placeholder="Barcha manbalar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha manbalar</SelectItem>
              <SelectItem value="offline">Faqat Oflayn (Doʻkonda)</SelectItem>
              <SelectItem value="site">Faqat Saytdan (Online)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Sotuvlar Jadvali */}
      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-caption tracking-wider">
              <th className="p-3.5">Sana</th>
              <th className="p-3.5">Xaridor</th>
              <th className="p-3.5">Sotilgan tovar / PC</th>
              <th className="p-3.5 text-center">Manba</th>
              <th className="p-3.5 text-center">Soni</th>
              {isFinancial && <th className="p-3.5 text-right">Sotilgan narx</th>}
              {isFinancial && <th className="p-3.5 text-right">Tannarx snapshot</th>}
              {isFinancial && <th className="p-3.5 text-right">Sof foyda</th>}
              <th className="p-3.5 text-right">Amal</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={isFinancial ? 9 : 6} className="p-8 text-center text-muted-foreground">
                  Sotuvlar topilmadi
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
                    <td className="p-3.5 font-medium whitespace-nowrap">{formatDate(item.soldAt)}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-foreground">{item.buyerName}</p>
                      <p className="text-caption font-mono text-muted-foreground">{item.buyerPhone}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-foreground line-clamp-1">{item.productName}</p>
                      <span className="text-2xs text-muted-foreground uppercase">
                        {item.type === "pc" ? "Kompyuter (Build)" : "Butlovchi qism"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-2xs font-bold uppercase ${
                          item.source === "site"
                            ? "bg-primary/10 text-primary"
                            : "bg-(--success-bg) text-(--success-fg)"
                        }`}
                      >
                        {item.source === "site" ? "Sayt" : "Oflayn"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-foreground">{item.qty} dona</td>
                    {isFinancial && (
                      <td className="p-3.5 text-right font-black text-foreground">{formatMoney(item.soldPrice)}</td>
                    )}
                    {isFinancial && (
                      <td className="p-3.5 text-right font-medium text-muted-foreground">
                        {formatMoney(item.costSnapshot)}
                      </td>
                    )}
                    {isFinancial && (
                      <td className="p-3.5 text-right font-black text-(--success-fg)">
                        +{formatMoney(item.profit)}
                        <span className="block text-2xs text-muted-foreground font-normal">
                          ({item.marginPercent}% marja)
                        </span>
                      </td>
                    )}
                    <td className="p-3.5 text-right">
                      {!isVoided && item.source === "offline" && item.type === "product" && (
                        <Button
                          variant="icon"
                          size="icon-sm"
                          onClick={() => handleVoidSale(item.id)}
                          className="hover:text-destructive"
                          title="Sotuvni bekor qilish (qaytarish)"
                          aria-label="Sotuvni bekor qilish"
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

      {/* Oflayn sotuv modali */}
      <SaleFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={products}
        onSave={handleSaveSale}
        isFinancial={isFinancial}
      />
    </div>
  );
}
