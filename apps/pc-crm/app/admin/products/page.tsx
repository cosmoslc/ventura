"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Boxes, Edit, Plus, Search, Tag, Trash2, TrendingUp } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { type ProductFormData, ProductFormModal } from "@/components/admin/product-form-modal";
import { formatMoney } from "@/lib/format";
import { deleteProductAction, getAdminProductsAction, saveProductAction } from "@/lib/server/actions";
import { useFinancialMode } from "@/lib/store-context";

export default function AdminProductsPage() {
  const isFinancial = useFinancialMode();
  const [productsList, setProductsList] = useState<ProductFormData[]>([]);
  const [loadError, setLoadError] = useState("");
  const loadProducts = useCallback(async () => {
    const result = await getAdminProductsAction();
    if (!result.success) {
      setLoadError(result.error ?? "Mahsulotlarni yuklab bo'lmadi");
      return;
    }
    setLoadError("");
    setProductsList(
      result.products.map((product) => ({
        id: product.id,
        nameUz: product.name,
        nameRu: product.nameRu,
        categorySlug: product.categorySlug,
        brandName: product.brandName ?? "",
        sku: product.sku ?? "",
        imageUrl: product.imageUrl,
        costPrice: product.costPrice,
        sellPrice: product.sellPrice,
        marginPercent: product.marginPercent ?? 0,
        discountPercent: product.discountPercent,
        stock: product.stock,
        minStock: product.minStock,
        isNew: product.isNew,
        isHit: product.isHit,
        isActive: product.isActive,
        variants: (product.variants ?? []).map(({ colorName, colorHex, stock }) => ({ colorName, colorHex, stock })),
        specs: product.specs ?? [],
      })),
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yuklash: ma'lumot server action'dan olinadi
    void loadProducts();
  }, [loadProducts]);
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

    const matchesCategory = categoryFilter === "all" || item.categorySlug === categoryFilter;

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
  const outOfStockCount = productsList.filter((p) => p.stock === 0).length;

  const handleOpenNew = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const handleOpenEdit = (p: ProductFormData) => {
    setEditingProduct(p);
    setModalOpen(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id || !confirm("Haqiqatan ham ushbu mahsulotni oʻchirmoqchimisiz?")) return;
    const result = await deleteProductAction(id);
    if (!result.success) {
      setLoadError(result.error ?? "Mahsulotni o'chirib bo'lmadi");
      return;
    }
    await loadProducts();
  };

  const handleSaveProduct = async (data: ProductFormData) => {
    const result = await saveProductAction({
      id: data.id,
      nameUz: data.nameUz,
      nameRu: data.nameRu,
      categorySlug: data.categorySlug,
      brandName: data.brandName,
      sku: data.sku,
      costPrice: data.costPrice,
      sellPrice: data.sellPrice,
      discountPercent: data.discountPercent,
      stock: data.stock,
      minStock: data.minStock,
      isNew: data.isNew,
      isHit: data.isHit,
      isActive: data.isActive,
      imageUrl: data.imageUrl,
      specs: data.specs,
    });
    if (!result.success) {
      setLoadError(result.error ?? "Mahsulotni saqlab bo'lmadi");
      return;
    }
    setModalOpen(false);
    await loadProducts();
  };

  return (
    <div className="space-y-6">
      {/* 1. Sarlavha va qo'shish tugmasi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Mahsulotlar katalogi</h1>
        </div>

        <Button onClick={handleOpenNew}>
          <Plus />
          Yangi mahsulot
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)"
        >
          {loadError}
        </div>
      )}

      {/* 2. Statistik kartalar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Boxes />} label="Mahsulot turlari" value={`${productsList.length} xil`} tone={1} />

        {isFinancial ? (
          <>
            <StatCard
              icon={<TrendingUp />}
              label="Ombor tannarxi"
              value={formatMoney(totalCostValue)}
              tone={2}
              valueClassName="whitespace-nowrap text-title"
            />

            <StatCard
              icon={<Tag />}
              label="Kutilayotgan sof foyda"
              value={formatMoney(expectedProfit)}
              tone={3}
              valueClassName="whitespace-nowrap text-title"
            />
          </>
        ) : (
          <>
            <StatCard
              icon={<Boxes />}
              label="Ombordagi jami qoldiq"
              value={`${totalStockUnits} dona`}
              tone={2}
              valueClassName="whitespace-nowrap text-title"
            />

            <StatCard
              icon={<Tag />}
              label="Tugagan tovarlar"
              value={`${outOfStockCount} xil`}
              tone={3}
              valueClassName="whitespace-nowrap text-title"
            />
          </>
        )}

        <StatCard icon={<AlertCircle />} label="Kam qolganlar" value={`${lowStockCount} ta`} tone={4} />
      </div>

      {/* 3. Qidiruv va Filtrlar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card p-3 shadow-card">
        <div className="relative flex-1 min-w-60">
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
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger aria-label="Mahsulot toifasi" className="w-auto min-w-44 text-xs">
              <SelectValue placeholder="Barcha toifalar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha toifalar</SelectItem>
              <SelectItem value="protsessorlar">Protsessorlar</SelectItem>
              <SelectItem value="videokartalar">Videokartalar</SelectItem>
              <SelectItem value="operativ-xotira">Operativ xotira</SelectItem>
              <SelectItem value="ssd-disklar">SSD toʻplovchilar</SelectItem>
            </SelectContent>
          </Select>

          {/* Qoldiq filter */}
          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger aria-label="Ombor qoldigʻi" className="w-auto min-w-40 text-xs">
              <SelectValue placeholder="Barcha qoldiqlar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Barcha qoldiqlar</SelectItem>
              <SelectItem value="in_stock">Mavjud (Bor)</SelectItem>
              <SelectItem value="low_stock">Kam qolgan</SelectItem>
              <SelectItem value="out_of_stock">Tugagan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 4. Mahsulotlar Jadvali */}
      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-caption tracking-wider">
              <th className="p-3.5">Mahsulot</th>
              <th className="p-3.5">SKU / Brend</th>
              <th className="p-3.5 text-center">Ombor qoldigʻi</th>
              {isFinancial && (
                <>
                  <th className="p-3.5 text-right">Tannarx</th>
                  <th className="p-3.5 text-right">Sotish narxi</th>
                  <th className="p-3.5 text-right">Foyda</th>
                </>
              )}
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
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control border border-border/80 bg-media p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt={p.nameUz} className="h-full w-full object-contain" />
                        </div>
                        <div>
                          <p className="font-bold text-foreground line-clamp-1 max-w-xs" title={p.nameUz}>
                            {p.nameUz}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {p.isHit && (
                              <span className="rounded bg-(--danger-bg) px-1 text-2xs font-bold text-(--danger-fg)">
                                HIT
                              </span>
                            )}
                            {p.isNew && (
                              <span className="rounded bg-primary/10 px-1 text-2xs font-bold text-primary">YANGI</span>
                            )}
                            {p.variants.length > 0 && (
                              <span className="text-2xs text-muted-foreground">{p.variants.length} ta rang</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* SKU & Brend */}
                    <td className="p-3.5">
                      <p className="font-mono text-xs font-semibold text-foreground">{p.sku}</p>
                      <p className="text-caption text-muted-foreground">{p.brandName || "Brendsiz"}</p>
                    </td>

                    {/* Qoldiq */}
                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold">
                        <span
                          className={
                            isOut ? "text-(--danger-fg)" : isLow ? "text-(--warning-fg)" : "text-(--success-fg)"
                          }
                        >
                          {p.stock} dona
                        </span>
                        {isLow && (
                          <span title="Kam qoldi" className="text-(--warning-fg)">
                            ⚠
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Moliya ustunlari (faqat moliyaviy rejimda) */}
                    {isFinancial && (
                      <>
                        {/* Tannarx */}
                        <td className="p-3.5 text-right font-medium text-muted-foreground">
                          {formatMoney(p.costPrice)}
                        </td>

                        {/* Sotish narxi */}
                        <td className="p-3.5 text-right font-bold text-foreground">
                          <div>
                            {formatMoney(p.sellPrice)}
                            {p.discountPercent > 0 && (
                              <span className="block text-2xs text-(--danger-fg)">-{p.discountPercent}% chegirma</span>
                            )}
                          </div>
                        </td>

                        {/* Sof foyda */}
                        <td className="p-3.5 text-right font-bold text-(--success-fg)">
                          +{formatMoney(profitPerItem)}
                        </td>
                      </>
                    )}

                    {/* Holat */}
                    <td className="p-3.5 text-center">
                      <Badge tone={p.isActive ? "success" : "neutral"} className="text-2xs">
                        {p.isActive ? "Faol" : "Nofaol"}
                      </Badge>
                    </td>

                    {/* Amallar */}
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="icon"
                          size="icon-sm"
                          onClick={() => handleOpenEdit(p)}
                          title="Tahrirlash"
                          aria-label="Tahrirlash"
                        >
                          <Edit />
                        </Button>
                        <Button
                          variant="icon"
                          size="icon-sm"
                          onClick={() => handleDelete(p.id)}
                          className="hover:text-destructive"
                          title="Oʻchirish"
                          aria-label="Oʻchirish"
                        >
                          <Trash2 />
                        </Button>
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
        isFinancial={isFinancial}
      />
    </div>
  );
}
