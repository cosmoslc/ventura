"use client";

import { useState } from "react";
import {
  Boxes,
  Calendar,
  CheckCircle2,
  DollarSign,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  Undo2,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { StatCard } from "@ventura/ui/stat-card";
import { type SaleItemData, SaleFormModal } from "@/components/admin/sales/sale-form-modal";
import { formatDate, formatMoney } from "@/lib/format";

const SAMPLE_PRODUCTS = [
  { id: "p-1", name: "Intel Core i7-14700K 3.4GHz Protsessor", costPrice: 4_500_000n, sellPrice: 5_200_000n },
  { id: "p-2", name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB", costPrice: 11_800_000n, sellPrice: 13_500_000n },
  { id: "p-3", name: "Kingston FURY Beast RGB 32GB DDR5", costPrice: 1_450_000n, sellPrice: 1_750_000n },
  { id: "p-4", name: "Samsung 990 PRO 2TB NVMe M.2 SSD", costPrice: 2_150_000n, sellPrice: 2_600_000n },
];

const INITIAL_SALES: (SaleItemData & { id: string; voidedAt?: string })[] = [
  {
    id: "sale-101",
    source: "offline",
    type: "product",
    productName: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB",
    buyerName: "Anvar Qodirov",
    buyerPhone: "+998 90 123 45 67",
    qty: 1,
    listPrice: 13_500_000n,
    soldPrice: 13_500_000n,
    costSnapshot: 11_800_000n,
    profit: 1_700_000n,
    marginPercent: 12.59,
    soldAt: "2026-10-29",
  },
  {
    id: "sale-102",
    source: "site",
    type: "product",
    productName: "Kingston FURY Beast RGB 32GB DDR5",
    buyerName: "Malika Yusupova",
    buyerPhone: "+998 97 765 43 21",
    qty: 2,
    listPrice: 1_750_000n,
    soldPrice: 1_750_000n,
    costSnapshot: 1_450_000n,
    profit: 600_000n,
    marginPercent: 17.14,
    soldAt: "2026-10-29",
  },
  {
    id: "sale-103",
    source: "site",
    type: "pc",
    productName: "Ventura Gaming Titan: i7-14700K / RTX 4070 Ti",
    buyerName: "Javohir Toshmatov",
    buyerPhone: "+998 93 555 12 34",
    qty: 1,
    listPrice: 24_800_000n,
    soldPrice: 24_800_000n,
    costSnapshot: 20_200_000n,
    profit: 4_600_000n,
    marginPercent: 18.55,
    soldAt: "2026-10-28",
  },
  {
    id: "sale-104",
    source: "offline",
    type: "product",
    productName: "Intel Core i7-14700K 3.4GHz Protsessor",
    buyerName: "Ulugʻbek Saidov",
    buyerPhone: "+998 99 888 77 66",
    qty: 1,
    listPrice: 5_200_000n,
    soldPrice: 5_000_000n, // chegirma bilan sotilgan
    costSnapshot: 4_500_000n,
    profit: 500_000n,
    marginPercent: 10.0,
    soldAt: "2026-10-27",
  },
];

export default function AdminSalesPage() {
  const [sales, setSales] = useState(INITIAL_SALES);
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
  const totalRevenue = activeSales.reduce((sum, s) => sum + s.soldPrice * BigInt(s.qty), 0n);
  const totalCost = activeSales.reduce((sum, s) => sum + s.costSnapshot * BigInt(s.qty), 0n);
  const totalProfit = activeSales.reduce((sum, s) => sum + s.profit, 0n);
  const totalUnits = activeSales.reduce((sum, s) => sum + s.qty, 0);
  const avgMargin =
    totalRevenue > 0n
      ? Number(((Number(totalProfit) / Number(totalRevenue)) * 100).toFixed(2))
      : 0;

  const handleSaveSale = (newSale: SaleItemData) => {
    const item = {
      ...newSale,
      id: `sale-${Date.now().toString().slice(-4)}`,
    };
    setSales([item, ...sales]);
  };

  const handleVoidSale = (id: string) => {
    if (confirm("Ushbu sotuvni qaytarmoqchimisiz (qaytarish/return)? Ombor qoldigʻi tiklanadi va foyda chiqariladi.")) {
      setSales(
        sales.map((s) =>
          s.id === id ? { ...s, voidedAt: new Date().toISOString() } : s
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
            Sotuvlar va Sof Foyda hisobi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sayt va oflayn doʻkon sotuvlari, har bir bitim boʻyicha tannarx snapshot va sof daromad
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={() => setModalOpen(true)} className="gap-1.5 font-bold">
          <Plus size={15} />
          Oflayn sotuv kiritish
        </Button>
      </div>

      {/* Statistika kartalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign />}
          label="Jami tushum"
          value={formatMoney(totalRevenue)}
          tone={1}
          hint={`Sotilgan: ${totalUnits} dona`}
        />

        <StatCard
          icon={<TrendingUp />}
          label="Sof daromad (Foyda)"
          value={formatMoney(totalProfit)}
          tone={2}
          trend={{ value: `${avgMargin}% marja`, up: true }}
          hint="Sof qoʻshilgan qiymat"
        />

        <StatCard
          icon={<Boxes />}
          label="Sotilgan tovarlar tannarxi"
          value={formatMoney(totalCost)}
          tone={3}
          hint="Xarid narxlari yigʻindisi"
        />

        <StatCard
          icon={<Receipt />}
          label="Bitimlar soni"
          value={`${activeSales.length} ta`}
          tone={4}
          hint="Sayt va oflayn savdolar"
        />
      </div>

      {/* Qidiruv va Manba filtri */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tovar, xaridor ismi yoki telefon boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Barcha manbalar</option>
            <option value="offline">Faqat Oflayn (Doʻkonda)</option>
            <option value="site">Faqat Saytdan (Online)</option>
          </select>
        </div>
      </div>

      {/* Sotuvlar Jadvali */}
      <div className="overflow-x-auto rounded-[var(--r-card,12px)] border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-[11px] tracking-wider">
              <th className="p-3.5">Sana</th>
              <th className="p-3.5">Xaridor</th>
              <th className="p-3.5">Sotilgan tovar / PC</th>
              <th className="p-3.5 text-center">Manba</th>
              <th className="p-3.5 text-center">Soni</th>
              <th className="p-3.5 text-right">Sotilgan narx</th>
              <th className="p-3.5 text-right">Tannarx snapshot</th>
              <th className="p-3.5 text-right">Sof foyda</th>
              <th className="p-3.5 text-right">Amal</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
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
                      <p className="text-[11px] font-mono text-muted-foreground">{item.buyerPhone}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-foreground line-clamp-1">{item.productName}</p>
                      <span className="text-[10px] text-muted-foreground uppercase">
                        {item.type === "pc" ? "Kompyuter (Build)" : "Butlovchi qism"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          item.source === "site"
                            ? "bg-primary/10 text-primary"
                            : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {item.source === "site" ? "Sayt" : "Oflayn"}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-bold text-foreground">
                      {item.qty} dona
                    </td>
                    <td className="p-3.5 text-right font-black text-foreground">
                      {formatMoney(item.soldPrice * BigInt(item.qty))}
                    </td>
                    <td className="p-3.5 text-right font-medium text-muted-foreground">
                      {formatMoney(item.costSnapshot * BigInt(item.qty))}
                    </td>
                    <td className="p-3.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(item.profit)}
                      <span className="block text-[10px] text-muted-foreground font-normal">
                        ({item.marginPercent}% marja)
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {!isVoided && (
                        <button
                          type="button"
                          onClick={() => handleVoidSale(item.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          title="Sotuvni bekor qilish (qaytarish)"
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

      {/* Oflayn sotuv modali */}
      <SaleFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        products={SAMPLE_PRODUCTS}
        onSave={handleSaveSale}
      />
    </div>
  );
}
