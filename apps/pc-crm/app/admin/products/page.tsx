"use client";

import { useState } from "react";
import {
  AlertCircle,
  Boxes,
  CheckCircle2,
  Edit,
  Eye,
  Plus,
  Search,
  Tag,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { StatCard } from "@ventura/ui/stat-card";
import { type ProductFormData, ProductFormModal } from "@/components/admin/product-form-modal";
import { formatMoney } from "@/lib/format";

// Boshlang'ich namunaviy mahsulotlar
const INITIAL_PRODUCTS: ProductFormData[] = [
  {
    id: "p-1",
    nameUz: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor",
    nameRu: "Процессор Intel Core i7-14700K",
    categorySlug: "protsessorlar",
    brandName: "Intel",
    sku: "CPU-INT-14700K",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
    costPrice: 4_500_000n,
    sellPrice: 5_200_000n,
    marginPercent: 15,
    discountPercent: 10,
    stock: 8,
    minStock: 2,
    isNew: true,
    isHit: true,
    isActive: true,
    variants: [],
    specs: [
      { key: "cores", title: "Yadro soni", value: "20 yadro (8P + 12E)", helpText: "Protsessor bir vaqtning oʻzida bir nechta vazifani bajarish kuchi" },
      { key: "freq", title: "Maksimal chastota", value: "5.6 GHz" },
    ],
  },
  {
    id: "p-2",
    nameUz: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB",
    nameRu: "Видеокарта ASUS ROG Strix RTX 4070 Ti SUPER",
    categorySlug: "videokartalar",
    brandName: "ASUS",
    sku: "GPU-ASUS-4070TIS",
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&q=80",
    costPrice: 11_800_000n,
    sellPrice: 13_500_000n,
    marginPercent: 14,
    discountPercent: 5,
    stock: 3,
    minStock: 2,
    isNew: false,
    isHit: true,
    isActive: true,
    variants: [
      { colorName: "Qora (Black)", colorHex: "#111111", stock: 2 },
      { colorName: "Oq (White Edition)", colorHex: "#f5f5f5", stock: 1 },
    ],
    specs: [
      { key: "vram", title: "Xotira hajmi", value: "16 GB GDDR6X", helpText: "Oʻyinlar va 3D teksturalar uchun video xotira" },
    ],
  },
  {
    id: "p-3",
    nameUz: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5",
    categorySlug: "operativ-xotira",
    brandName: "Kingston",
    sku: "RAM-KNG-32DDR5",
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=500&q=80",
    costPrice: 1_450_000n,
    sellPrice: 1_750_000n,
    marginPercent: 20,
    discountPercent: 0,
    stock: 14,
    minStock: 3,
    isNew: true,
    isHit: false,
    isActive: true,
    variants: [],
    specs: [],
  },
  {
    id: "p-4",
    nameUz: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
    categorySlug: "ssd-disklar",
    brandName: "Samsung",
    sku: "SSD-SAM-990P-2T",
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&q=80",
    costPrice: 2_150_000n,
    sellPrice: 2_600_000n,
    marginPercent: 21,
    discountPercent: 12,
    stock: 1, // kam qolgan
    minStock: 2,
    isNew: false,
    isHit: true,
    isActive: true,
    variants: [],
    specs: [],
  },
];

export default function AdminProductsPage() {
  const [productsList, setProductsList] = useState<ProductFormData[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductFormData | null>(null);

  // Filtrlar
  const filteredProducts = productsList.filter((item) => {
    const matchesSearch =
      item.nameUz.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brandName.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      categoryFilter === "all" || item.categorySlug === categoryFilter;

    const matchesStock =
      stockFilter === "all" ||
      (stockFilter === "in_stock" && item.stock > 0) ||
      (stockFilter === "low_stock" && item.stock <= item.minStock && item.stock > 0) ||
      (stockFilter === "out_of_stock" && item.stock === 0);

    return matchesSearch && matchesCategory && matchesStock;
  });

  // Statistika
  const totalStockUnits = productsList.reduce((sum, p) => sum + p.stock, 0);
  const totalCostValue = productsList.reduce((sum, p) => sum + p.costPrice * BigInt(p.stock), 0n);
  const totalSellValue = productsList.reduce((sum, p) => sum + p.sellPrice * BigInt(p.stock), 0n);
  const expectedProfit = totalSellValue - totalCostValue;
  const lowStockCount = productsList.filter((p) => p.stock <= p.minStock && p.stock > 0).length;

  const handleOpenNew = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: ProductFormData) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleDelete = (id?: string) => {
    if (!id) return;
    if (confirm("Haqiqatan ham ushbu mahsulotni oʻchirmoqchimisiz?")) {
      setProductsList(productsList.filter((p) => p.id !== id));
    }
  };

  const handleSaveProduct = (data: ProductFormData) => {
    if (data.id) {
      // Tahrirlash
      setProductsList(productsList.map((p) => (p.id === data.id ? data : p)));
    } else {
      // Yangi qo'shish
      const newProduct: ProductFormData = {
        ...data,
        id: `p-${Date.now()}`,
      };
      setProductsList([newProduct, ...productsList]);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Sarlavha va qo'shish tugmasi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Mahsulotlar katalogi
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Doʻkondagi barcha tovarlar, ombor qoldigʻi va narxlar boshqaruvi
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleOpenNew} className="gap-1.5 font-bold">
          <Plus size={15} />
          Yangi mahsulot
        </Button>
      </div>

      {/* 2. Statistik kartalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Boxes />}
          label="Mahsulot turlari"
          value={`${productsList.length} xil`}
          tone={1}
          hint={`Omborda jami: ${totalStockUnits} dona`}
        />

        <StatCard
          icon={<TrendingUp />}
          label="Ombor tannarxi"
          value={formatMoney(totalCostValue)}
          tone={2}
          hint="Jami xarid tannarxi"
        />

        <StatCard
          icon={<Tag />}
          label="Kutilayotgan sof foyda"
          value={formatMoney(expectedProfit)}
          tone={3}
          trend={{ value: "Sotuv qiymatidan", up: true }}
          hint={formatMoney(totalSellValue)}
        />

        <StatCard
          icon={<AlertCircle />}
          label="Kam qolganlar"
          value={`${lowStockCount} ta`}
          tone={4}
          trend={{ value: "Diqqat", up: false }}
          hint="Zaxirasi tugamoqda"
        />
      </div>

      {/* 3. Qidiruv va Filtrlar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Nomi, SKU yoki brend boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toifa filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Barcha toifalar</option>
            <option value="protsessorlar">Protsessorlar</option>
            <option value="videokartalar">Videokartalar</option>
            <option value="operativ-xotira">Operativ xotira</option>
            <option value="ssd-disklar">SSD toʻplovchilar</option>
          </select>

          {/* Qoldiq filter */}
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Barcha qoldiqlar</option>
            <option value="in_stock">Mavjud (Bor)</option>
            <option value="low_stock">Kam qolgan</option>
            <option value="out_of_stock">Tugagan</option>
          </select>
        </div>
      </div>

      {/* 4. Mahsulotlar Jadvali */}
      <div className="overflow-x-auto rounded-[var(--r-card,12px)] border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-[11px] tracking-wider">
              <th className="p-3.5">Mahsulot</th>
              <th className="p-3.5">SKU / Brend</th>
              <th className="p-3.5 text-center">Qoldiq</th>
              <th className="p-3.5 text-right">Tannarx</th>
              <th className="p-3.5 text-right">Sotish narxi</th>
              <th className="p-3.5 text-right">Foyda</th>
              <th className="p-3.5 text-center">Holat</th>
              <th className="p-3.5 text-right">Amallar</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-8 text-center text-muted-foreground">
                  Mahsulotlar topilmadi
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const profitPerItem = p.sellPrice - p.costPrice;
                const isLow = p.stock <= p.minStock && p.stock > 0;
                const isOut = p.stock === 0;

                return (
                  <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                    {/* Mahsulot rasm + nom */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-white p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.imageUrl}
                            alt={p.nameUz}
                            className="h-full w-full object-contain"
                          />
                        </div>
                        <div>
                          <p className="font-bold text-foreground line-clamp-1 max-w-xs" title={p.nameUz}>
                            {p.nameUz}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.isHit && (
                              <span className="rounded bg-rose-500/10 px-1 text-[9px] font-bold text-rose-600">
                                HIT
                              </span>
                            )}
                            {p.isNew && (
                              <span className="rounded bg-primary/10 px-1 text-[9px] font-bold text-primary">
                                YANGI
                              </span>
                            )}
                            {p.variants.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {p.variants.length} ta rang
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU & Brend */}
                    <td className="p-3.5">
                      <p className="font-mono text-xs font-semibold text-foreground">{p.sku}</p>
                      <p className="text-[11px] text-muted-foreground">{p.brandName || "Brendsiz"}</p>
                    </td>

                    {/* Qoldiq */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold">
                        <span
                          className={
                            isOut
                              ? "text-rose-500"
                              : isLow
                                ? "text-amber-500"
                                : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {p.stock} dona
                        </span>
                        {isLow && (
                          <span title="Kam qoldi" className="text-amber-500">
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Tannarx */}
                    <td className="p-3.5 text-right font-medium text-muted-foreground">
                      {formatMoney(p.costPrice)}
                    </td>

                    {/* Sotish narxi */}
                    <td className="p-3.5 text-right font-bold text-foreground">
                      <div>
                        {formatMoney(p.sellPrice)}
                        {p.discountPercent > 0 && (
                          <span className="block text-[10px] text-rose-500">
                            -{p.discountPercent}% chegirma
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sof foyda */}
                    <td className="p-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatMoney(profitPerItem)}
                    </td>

                    {/* Holat */}
                    <td className="p-3.5 text-center">
                      <Badge tone={p.isActive ? "success" : "neutral"} className="text-[10px]">
                        {p.isActive ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>

                    {/* Amallar */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                          title="Tahrirlash"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p.id)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          title="Oʻchirish"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mahsulot formasi modali */}
      <ProductFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialData={editingProduct}
        onSave={handleSaveProduct}
      />
    </div>
  );
}
