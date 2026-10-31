"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { getStorefrontProductsAction } from "@/lib/server/actions";

const INITIAL_PRODUCTS: ProductCardData[] = [
  // 1. Protsessorlar (CPU)
  {
    id: "p-1",
    slug: "intel-core-i7-14700k",
    name: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor",
    brandName: "Intel",
    categorySlug: "protsessorlar",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
    price: 5_200_000n,
    originalPrice: 5_800_000n,
    discountPercent: 10,
    stock: 8,
    ratingAvg: 4.9,
    ratingCount: 14,
    isNew: true,
    isHit: true,
  },
  {
    id: "p-1a",
    slug: "intel-core-i9-14900k",
    name: "Intel Core i9-14900K 3.2GHz LGA1700 Protsessor",
    brandName: "Intel",
    categorySlug: "protsessorlar",
    imageUrl: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=500&q=80",
    price: 7_800_000n,
    stock: 5,
    ratingAvg: 5.0,
    ratingCount: 18,
    isHit: true,
  },
  {
    id: "p-1b",
    slug: "amd-ryzen-7-7800x3d",
    name: "AMD Ryzen 7 7800X3D 4.2GHz AM5 3D V-Cache Protsessor",
    brandName: "AMD",
    categorySlug: "protsessorlar",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
    price: 5_950_000n,
    originalPrice: 6_400_000n,
    discountPercent: 7,
    stock: 7,
    ratingAvg: 5.0,
    ratingCount: 26,
    isHit: true,
  },
  {
    id: "p-1c",
    slug: "amd-ryzen-5-7600x",
    name: "AMD Ryzen 5 7600X 4.7GHz AM5 Protsessor",
    brandName: "AMD",
    categorySlug: "protsessorlar",
    imageUrl: "https://images.unsplash.com/photo-1555680202-c86f0e12f086?w=500&q=80",
    price: 2_750_000n,
    stock: 12,
    ratingAvg: 4.8,
    ratingCount: 11,
    isNew: true,
  },

  // 2. Videokartalar (GPU)
  {
    id: "p-2",
    slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
    name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
    brandName: "ASUS",
    categorySlug: "videokartalar",
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&q=80",
    price: 13_500_000n,
    originalPrice: 14_200_000n,
    discountPercent: 5,
    stock: 4,
    ratingAvg: 5.0,
    ratingCount: 22,
    isHit: true,
    variants: [
      { id: "v1", colorName: "Qora", colorHex: "#111111", stock: 3 },
      { id: "v2", colorName: "Oq", colorHex: "#f0f0f0", stock: 1 },
    ],
  },
  {
    id: "p-2a",
    slug: "asus-dual-rtx-4070-super-12gb",
    name: "ASUS Dual GeForce RTX 4070 SUPER OC Edition 12GB",
    brandName: "ASUS",
    categorySlug: "videokartalar",
    imageUrl: "https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500&q=80",
    price: 8_900_000n,
    originalPrice: 9_400_000n,
    discountPercent: 5,
    stock: 6,
    ratingAvg: 4.9,
    ratingCount: 17,
    isNew: true,
  },
  {
    id: "p-2b",
    slug: "palit-geforce-rtx-4060-dual-8gb",
    name: "Palit GeForce RTX 4060 Dual 8GB GDDR6",
    brandName: "Palit",
    categorySlug: "videokartalar",
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&q=80",
    price: 4_400_000n,
    stock: 10,
    ratingAvg: 4.7,
    ratingCount: 19,
    isHit: true,
  },

  // 3. Ona platalar
  {
    id: "p-5",
    slug: "msi-mag-b760-tomahawk-wifi",
    name: "MSI MAG B760 TOMAHAWK WIFI DDR5 Ona plata",
    brandName: "MSI",
    categorySlug: "ona-platalar",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80",
    price: 3_100_000n,
    stock: 6,
    ratingAvg: 4.7,
    ratingCount: 8,
  },
  {
    id: "p-5a",
    slug: "msi-mag-z790-tomahawk-wifi",
    name: "MSI MAG Z790 TOMAHAWK WIFI DDR5 LGA1700",
    brandName: "MSI",
    categorySlug: "ona-platalar",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80",
    price: 3_400_000n,
    stock: 6,
    ratingAvg: 4.8,
    ratingCount: 15,
  },

  // 4. Operativ xotira (RAM)
  {
    id: "p-3",
    slug: "kingston-fury-beast-rgb-32gb-ddr5",
    name: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5",
    brandName: "Kingston",
    categorySlug: "operativ-xotira",
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=500&q=80",
    price: 1_750_000n,
    stock: 15,
    ratingAvg: 4.8,
    ratingCount: 9,
    isNew: true,
  },

  // 5. SSD to'plovchilar
  {
    id: "p-4",
    slug: "samsung-990-pro-2tb-nvme-ssd",
    name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
    brandName: "Samsung",
    categorySlug: "ssd-disklar",
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&q=80",
    price: 2_600_000n,
    originalPrice: 2_950_000n,
    discountPercent: 12,
    stock: 11,
    ratingAvg: 4.9,
    ratingCount: 31,
    isHit: true,
  },
  {
    id: "p-4a",
    slug: "samsung-990-pro-1tb-nvme-ssd",
    name: "Samsung 990 PRO 1TB PCIe 4.0 NVMe M.2 SSD",
    brandName: "Samsung",
    categorySlug: "ssd-disklar",
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&q=80",
    price: 1_850_000n,
    stock: 14,
    ratingAvg: 4.9,
    ratingCount: 20,
  },

  // 6. Kuler va sovutish tizimi
  {
    id: "p-6",
    slug: "deepcool-ak620-digital-cooler",
    name: "DeepCool AK620 DIGITAL Qora Protsessor sovutgichi",
    brandName: "DeepCool",
    categorySlug: "sovutish-tizimi",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80",
    price: 1_050_000n,
    stock: 9,
    ratingAvg: 4.9,
    ratingCount: 16,
    isNew: true,
  },
  {
    id: "p-6a",
    slug: "deepcool-lt720-360mm-aio",
    name: "DeepCool LT720 360mm ARGB Suyuqlikli Sovutgich (AIO)",
    brandName: "DeepCool",
    categorySlug: "sovutish-tizimi",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80",
    price: 1_450_000n,
    stock: 8,
    ratingAvg: 4.8,
    ratingCount: 12,
    isNew: true,
  },

  // 7. Blok pitaniya (PSU)
  {
    id: "p-7",
    slug: "corsair-rm850e-850w-gold",
    name: "Corsair RM850e 850W 80+ Gold To'liq Modulli Blok Pitaniya",
    brandName: "Corsair",
    categorySlug: "blok-pitaniya",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80",
    price: 1_650_000n,
    stock: 9,
    ratingAvg: 4.9,
    ratingCount: 14,
  },

  // 8. Korpuslar (Cases)
  {
    id: "p-8",
    slug: "nzxt-h7-flow-rgb-black",
    name: "NZXT H7 Flow RGB Black Mid-Tower O'yin Korpusi",
    brandName: "NZXT",
    categorySlug: "korpuslar",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80",
    price: 1_750_000n,
    stock: 7,
    ratingAvg: 4.9,
    ratingCount: 10,
    isNew: true,
  },

  // 9. Monitorlar
  {
    id: "p-9",
    slug: "asus-rog-swift-oled-pg27aqdm",
    name: "ASUS ROG Swift OLED PG27AQDM 27\" 240Hz 0.03ms QHD O'yin Monitori",
    brandName: "ASUS",
    categorySlug: "monitorlar",
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80",
    price: 12_800_000n,
    stock: 4,
    ratingAvg: 5.0,
    ratingCount: 8,
    isHit: true,
  },
  {
    id: "p-9a",
    slug: "samsung-odyssey-g7-28-4k",
    name: "Samsung Odyssey G7 28\" 4K UHD 144Hz 1ms IPS O'yin Monitori",
    brandName: "Samsung",
    categorySlug: "monitorlar",
    imageUrl: "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=500&q=80",
    price: 7_600_000n,
    stock: 5,
    ratingAvg: 4.8,
    ratingCount: 12,
  },
];

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
              variants: p.variants,
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
        const matchBrand =
          selectedBrand === "all" ||
          item.brandName?.toLowerCase() === selectedBrand.toLowerCase();

        // 3. Matnli qidiruv filtri
        const matchSearch =
          !searchQuery.trim() ||
          item.name.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
          item.brandName?.toLowerCase().includes(searchQuery.toLowerCase().trim());

        // 4. Faqat chegirmadagilar
        const matchDiscount =
          !onlyDiscount ||
          (item.discountPercent !== undefined && item.discountPercent > 0);

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
        (slug === "sovutish-tizimi" && p.categorySlug === "sovutish")
    ).length;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
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
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary hover:bg-primary/20 transition-colors"
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
              {searchQuery && (
                <span className="ml-1 text-primary">«{searchQuery}» soʻrovi boʻyicha</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-1.5 rounded-[var(--r-btn,8px)] border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <SlidersHorizontal size={14} />
              Filtrlar {hasActiveFilters && "(Faol)"}
            </button>

            {/* Brend filtri (Headerda) */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="brand-filter" className="text-xs font-bold text-muted-foreground hidden sm:inline">
                Brend:
              </label>
              <select
                id="brand-filter"
                value={selectedBrand}
                onChange={(e) => handleSelectBrand(e.target.value)}
                className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b === "all" ? "Barcha brendlar" : b}
                  </option>
                ))}
              </select>
            </div>

            {/* Saralash */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="sort-filter" className="text-xs font-bold text-muted-foreground hidden sm:inline">
                Saralash:
              </label>
              <select
                id="sort-filter"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs cursor-pointer"
              >
                <option value="popular">Ommabopligi boʻyicha</option>
                <option value="price_asc">Narx: Arzondan qimmatga</option>
                <option value="price_desc">Narx: Qimmatdan arzonga</option>
                <option value="rating">Reyting boʻyicha</option>
              </select>
            </div>
          </div>
        </div>

        {/* Gorizontal Brend pillari (Tezkor tanlash) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none border-b border-border/50">
          <span className="text-xs font-bold text-muted-foreground shrink-0 hidden md:inline">
            Ommabop brendlar:
          </span>
          {BRANDS.map((b) => {
            const isSelected = selectedBrand.toLowerCase() === b.toLowerCase();
            return (
              <button
                key={b}
                type="button"
                onClick={() => handleSelectBrand(b)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
                }`}
              >
                {b === "all" ? "Barcha brendlar" : b}
              </button>
            );
          })}
        </div>

        {/* Asosiy kontent: Chap tomon filter + O'ng tomon grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block space-y-6">
            {/* Kategoriyalar */}
            <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
                  Kategoriyalar
                </h3>
                {category !== "all" && (
                  <button
                    type="button"
                    onClick={() => handleSelectCategory("all")}
                    className="text-[11px] text-primary hover:underline font-semibold"
                  >
                    Barchasi
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1 text-xs">
                {CATEGORIES.map((cat) => {
                  const isSelected =
                    category === cat.slug ||
                    (cat.slug === "sovutish-tizimi" && category === "sovutish");
                  const count = getCategoryCount(cat.slug);

                  return (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => handleSelectCategory(cat.slug)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-2 text-left font-semibold transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span className="truncate">{cat.name}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ml-1 shrink-0 ${
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
            <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 shadow-xs">
              <label className="flex items-center justify-between cursor-pointer text-xs font-semibold">
                <span>Faqat chegirmadagilar</span>
                <input
                  type="checkbox"
                  checked={onlyDiscount}
                  onChange={(e) => setOnlyDiscount(e.target.checked)}
                  className="accent-primary h-4 w-4 rounded"
                />
              </label>
            </div>
          </aside>

          {/* Mahsulotlar Grid (3 ustun desktop) */}
          <div className="lg:col-span-3">
            {filtered.length === 0 ? (
              <div className="flex h-72 flex-col items-center justify-center text-center rounded-[var(--r-card,12px)] border border-dashed border-border bg-card p-6">
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
            <div className="relative flex h-full w-full max-w-xs flex-col bg-card shadow-2xl p-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-primary" />
                  Filtrlar
                </h2>
                <button
                  type="button"
                  onClick={() => setMobileFilterOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:bg-secondary"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Mobil Kategoriyalar */}
              <div className="mb-6">
                <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Kategoriyalar
                </h3>
                <div className="flex flex-col gap-1 text-xs">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => {
                        handleSelectCategory(cat.slug);
                        setMobileFilterOpen(false);
                      }}
                      className={`flex items-center justify-between rounded-lg px-3 py-2 text-left font-semibold ${
                        category === cat.slug
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-[10px] font-mono">{getCategoryCount(cat.slug)}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobil Brendlar */}
              <div className="mb-6">
                <label htmlFor="mobile-brand-select" className="font-bold text-xs uppercase tracking-wider text-muted-foreground block mb-2">
                  Brend
                </label>
                <select
                  id="mobile-brand-select"
                  value={selectedBrand}
                  onChange={(e) => {
                    handleSelectBrand(e.target.value);
                  }}
                  className="w-full h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {BRANDS.map((b) => (
                    <option key={b} value={b}>
                      {b === "all" ? "Barcha brendlar" : b}
                    </option>
                  ))}
                </select>
              </div>

              {/* Mobil Chegirma */}
              <div className="pt-2 border-t border-border">
                <label className="flex items-center justify-between text-xs font-semibold py-2">
                  <span>Faqat chegirmadagilar</span>
                  <input
                    type="checkbox"
                    checked={onlyDiscount}
                    onChange={(e) => setOnlyDiscount(e.target.checked)}
                    className="accent-primary h-4 w-4"
                  />
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
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <Navbar />
          <div className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
            <div className="h-8 w-48 bg-muted rounded animate-pulse mb-6" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
              <div className="h-96 bg-muted rounded-xl animate-pulse hidden lg:block" />
              <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-80 bg-muted rounded-xl animate-pulse" />
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