"use client";
import { Input } from "@ventura/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Checkbox } from "@ventura/ui/checkbox";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { getStorefrontProductsAction } from "@/lib/server/actions";

const INITIAL_PRODUCTS: ProductCardData[] = [];

const CATEGORIES = [
  { slug: "all", name: "Barcha toifalar" },
  { slug: "protsessorlar", name: "Protsessorlar (CPU)" },
  { slug: "videokartalar", name: "Videokartalar (GPU)" },
  { slug: "ona-platalar", name: "Ona platalar" },
  { slug: "operativ-xotira", name: "Operativ xotira (RAM)" },
  { slug: "ssd-disklar", name: "SSD toʻplovchilar" },
  { slug: "blok-pitaniya", name: "Blok pitaniya (PSU)" },
  { slug: "sovutish-tizimi", name: "Kuler va sovutish" },
  { slug: "korpuslar", name: "Korpuslar (Cases)" },
  { slug: "monitorlar", name: "Monitorlar" },
];

const BRANDS = ["all", "Intel", "AMD", "ASUS", "Kingston", "Samsung", "MSI", "DeepCool", "Corsair", "NZXT", "Palit"];

function ProductsCatalogContent() {
  const searchParams = useSearchParams();
  const urlCategory = searchParams.get("category");
  const urlQuery = searchParams.get("q");
  const urlBrand = searchParams.get("brand");

  const { addItem } = useCart();
  const { isLiked, toggleLike } = useLiked();

  const [allProducts, setAllProducts] = useState<ProductCardData[]>(INITIAL_PRODUCTS);
  const [category, setCategory] = useState<string>(urlCategory || "all");
  const [selectedBrand, setSelectedBrand] = useState<string>(urlBrand || "all");
  const [searchQuery, setSearchQuery] = useState<string>(urlQuery || "");
  const [sortBy, setSortBy] = useState("popular");
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // URL query parametrlari o'zgarganda sinxronlash
  useEffect(() => {
    if (urlCategory) {
      setCategory(urlCategory);
    } else if (searchParams.has("category") && !urlCategory) {
      setCategory("all");
    }
    if (urlQuery !== null && urlQuery !== undefined) {
      setSearchQuery(urlQuery);
    }
    if (urlBrand) {
      setSelectedBrand(urlBrand);
    }
  }, [urlCategory, urlQuery, urlBrand, searchParams]);

  // DB dan real mahsulotlarni yuklash (agar mavjud bo'lsa)
  useEffect(() => {
    let isMounted = true;
    getStorefrontProductsAction().then((res) => {
      if (!isMounted) return;
      if (res.success && res.products && res.products.length > 0) {
        setAllProducts((prev) => {
          const map = new Map<string, ProductCardData>();
          for (const p of prev) map.set(p.slug, p);
          for (const p of res.products) {
            map.set(p.slug, {
              id: p.id,
              slug: p.slug,
              name: p.name,
              brandName: p.brandName,
              categorySlug: p.categorySlug,
              imageUrl: p.imageUrl,
              price: BigInt(p.price),
              discountPercent: p.discountPercent,
              stock: p.stock,
              ratingAvg: p.ratingAvg,
              ratingCount: p.ratingCount,
              isNew: p.isNew,
              isHit: p.isHit,
              variants: [],
            });
          }
          return Array.from(map.values());
        });
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Kategoriya tanlanganda URL ni yangilash
  const handleSelectCategory = (catSlug: string) => {
    setCategory(catSlug);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (catSlug === "all") {
        params.delete("category");
      } else {
        params.set("category", catSlug);
      }
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", `/products${newQuery}`);
    }
  };

  // Brend tanlanganda URL ni yangilash
  const handleSelectBrand = (brand: string) => {
    setSelectedBrand(brand);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (brand === "all") {
        params.delete("brand");
      } else {
        params.set("brand", brand);
      }
      const newQuery = params.toString() ? `?${params.toString()}` : "";
      window.history.replaceState(null, "", `/products${newQuery}`);
    }
  };

  // Filtrlarni tozalash
  const handleResetFilters = () => {
    setCategory("all");
    setSelectedBrand("all");
    setSearchQuery("");
    setOnlyDiscount(false);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", "/products");
    }
  };

  // Filtrlash va saralash
  const filtered = useMemo(() => {
    return allProducts
      .filter((item) => {
        // 1. Kategoriya filtri
        const matchCategory =
          category === "all" ||
          item.categorySlug === category ||
          (category === "sovutish" && item.categorySlug === "sovutish-tizimi") ||
          (category === "sovutish-tizimi" && item.categorySlug === "sovutish");

        // 2. Brend filtri
        const matchBrand = selectedBrand === "all" || item.brandName?.toLowerCase() === selectedBrand.toLowerCase();

        // 3. Matnli qidiruv filtri
        const matchSearch =
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          item.brandName?.toLowerCase().includes(searchQuery.toLowerCase().trim());

        // 4. Faqat chegirmadagilar
        const matchDiscount = !onlyDiscount || (item.discountPercent !== undefined && item.discountPercent > 0);

        return matchCategory && matchBrand && matchSearch && matchDiscount;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return Number(BigInt(a.price) - BigInt(b.price));
        if (sortBy === "price_desc") return Number(BigInt(b.price) - BigInt(a.price));
        if (sortBy === "rating") return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
        return 0; // popular
      });
  }, [allProducts, category, selectedBrand, searchQuery, onlyDiscount, sortBy]);

  const handleAddToCart = (productId: string, variantId?: string) => {
    const prod = allProducts.find((p) => p.id === productId);
    if (!prod) return;

    addItem({
      productId: prod.id,
      variantId,
      name: prod.name,
      brandName: prod.brandName,
      price: BigInt(prod.price),
      originalPrice: prod.originalPrice ? BigInt(prod.originalPrice) : undefined,
      imageUrl: prod.imageUrl,
    });
  };

  const hasActiveFilters = category !== "all" || selectedBrand !== "all" || onlyDiscount || searchQuery.trim() !== "";

  // Har bir kategoriya bo'yicha mahsulotlar soni
  const getCategoryCount = (slug: string) => {
    if (slug === "all") return allProducts.length;
    return allProducts.filter(
      (p) =>
        p.categorySlug === slug ||
        (slug === "sovutish" && p.categorySlug === "sovutish-tizimi") ||
        (slug === "sovutish-tizimi" && p.categorySlug === "sovutish"),
    ).length;
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
        {/* Sarlavha va Saralash */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-foreground sm:text-3xl">Mahsulotlar katalogi</h1>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-caption font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  <X size={12} />
                  Filtrlarni tozalash
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Jami {filtered.length} ta mahsulot topildi
              {category !== "all" && (
                <span className="font-semibold text-foreground ml-1">
                  ({CATEGORIES.find((c) => c.slug === category)?.name})
                </span>
              )}
              {searchQuery && <span className="ml-1 text-primary">«{searchQuery}» soʻrovi boʻyicha</span>}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 rounded-btn border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <SlidersHorizontal size={14} />
              Filtrlar {hasActiveFilters && "(Faol)"}
            </button>

            {/* Brend filtri (Headerda) */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground hidden sm:inline">Brend:</span>
              <select
                aria-label="Brend boʻyicha filter"
                tabIndex={-1}
                value={selectedBrand}
                onChange={(e) => handleSelectBrand(e.target.value)}
                className="sr-only"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b === "all" ? "Barcha brendlar" : b}
                  </option>
                ))}
              </select>
              <Select value={selectedBrand} onValueChange={handleSelectBrand}>
                <SelectTrigger aria-label="Brend boʻyicha saralash" className="w-auto min-w-36 text-xs h-(--control-h)">
                  <SelectValue placeholder="Barcha brendlar" />
                </SelectTrigger>
                <SelectContent>
                  {BRANDS.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b === "all" ? "Barcha brendlar" : b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Saralash */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground hidden sm:inline">Saralash:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger aria-label="Saralash tartibi" className="w-auto min-w-44 text-xs h-(--control-h)">
                  <SelectValue placeholder="Ommabopligi boʻyicha" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">Ommabopligi boʻyicha</SelectItem>
                  <SelectItem value="price_asc">Narx: Arzondan qimmatga</SelectItem>
                  <SelectItem value="price_desc">Narx: Qimmatdan arzonga</SelectItem>
                  <SelectItem value="rating">Reyting boʻyicha</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Asosiy kontent: Chap tomon filter + O'ng tomon grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block space-y-6">
            {/* Kategoriyalar */}
            <div className="rounded-card border border-border bg-card p-4 shadow-control">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">Kategoriyalar</h3>
                {category !== "all" && (
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("all")}
                    className="text-caption text-primary hover:underline font-semibold"
                  >
                    Barchasi
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                {CATEGORIES.map((cat) => {
                  const isSelected =
                    category === cat.slug || (cat.slug === "sovutish-tizimi" && category === "sovutish");
                  const count = getCategoryCount(cat.slug);

                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleSelectCategory(cat.slug)}
                      className={`flex items-center justify-between rounded-control px-2.5 py-2 text-left font-semibold transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-control"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={`text-2xs font-mono px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
                          isSelected
                            ? "bg-primary-foreground/20 text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Chegirmadagi tovarlar toggle */}
            <div className="rounded-card border border-border bg-card p-4 shadow-control">
              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold">
                <span>Faqat chegirmadagilar</span>
                <Checkbox checked={onlyDiscount} onCheckedChange={(checked) => setOnlyDiscount(checked === true)} />
              </label>
            </div>
          </aside>

          {/* Mahsulotlar Grid (3 ustun desktop) */}
          <div className="lg:col-span-3">
            {filtered.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center rounded-card border border-dashed border-border bg-card p-6">
                <Filter size={40} className="text-muted-foreground/30 mb-3" />
                <h3 className="text-base font-bold text-foreground">Tanlangan filtr boʻyicha tovar topilmadi</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Ushbu parametrlar boʻyicha mahsulotlar mavjud emas. Filtrlarni tozalab qayta urinib koʻring.
                </p>
                <div className="mt-4">
                  <Button variant="primary" size="sm" onClick={handleResetFilters} className="text-xs font-bold">
                    Barcha filtrlarni tozalash
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    isLiked={isLiked(prod.id)}
                    onToggleLike={() => toggleLike({ ...prod, type: "product" })}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobil Filtr Drawer / Modali */}
        {mobileFilterOpen && (
          <div className="fixed inset-0 z-50 flex lg:hidden bg-black/60 backdrop-blur-xs">
            <div className="flex-1" onClick={() => setMobileFilterOpen(false)} />
            <div className="relative flex h-full w-full max-w-xs flex-col bg-card shadow-modal p-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-primary" />
                  Filtrlar
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 rounded-control text-muted-foreground hover:bg-secondary"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobil Kategoriyalar */}
              <div className="mb-6">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">Kategoriyalar</h3>
                <div className="flex flex-col gap-1 text-xs">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => {
                        handleSelectCategory(cat.slug);
                        setMobileFilterOpen(false);
                      }}
                      className={`flex items-center justify-between rounded-control px-3 py-2 text-left font-semibold ${
                        category === cat.slug
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-2xs font-mono">{getCategoryCount(cat.slug)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobil Brendlar */}
              <div className="mb-6">
                <span className="font-bold text-xs uppercase tracking-wider text-muted-foreground block mb-2">
                  Brend
                </span>
                <Select value={selectedBrand} onValueChange={handleSelectBrand}>
                  <SelectTrigger aria-label="Mobil brend tanlash" className="w-full text-xs h-(--control-h)">
                    <SelectValue placeholder="Barcha brendlar" />
                  </SelectTrigger>
                  <SelectContent>
                    {BRANDS.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b === "all" ? "Barcha brendlar" : b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Mobil Chegirma */}
              <div className="pt-2 border-t border-border">
                <label className="flex items-center justify-between text-xs font-semibold py-2">
                  <span>Faqat chegirmadagilar</span>
                  <Checkbox checked={onlyDiscount} onCheckedChange={(checked) => setOnlyDiscount(checked === true)} />
                </label>
              </div>

              <div className="mt-auto pt-4 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    handleResetFilters();
                    setMobileFilterOpen(false);
                  }}
                >
                  Tozalash
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setMobileFilterOpen(false)}
                >
                  Koʻrish ({filtered.length})
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function ProductsCatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-transparent text-foreground">
          <Navbar />
          <div className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              <div className="h-96 bg-muted rounded-card animate-pulse hidden lg:block" />
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-80 bg-muted rounded-card animate-pulse" />
                ))}
              </div>
            </div>
          </div>
          <Footer />
        </div>
      }
    >
      <ProductsCatalogContent />
    </Suspense>
  );
}
