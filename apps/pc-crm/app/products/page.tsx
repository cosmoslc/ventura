"use client";

import { useMemo, useState } from "react";
import { Filter, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";
import { useCart } from "@/lib/cart-context";

const ALL_PRODUCTS: ProductCardData[] = [
  {
    id: "p-1",
    slug: "intel-core-i7-14700k",
    name: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor",
    brandName: "Intel",
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
    id: "p-2",
    slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
    name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
    brandName: "ASUS",
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
    id: "p-3",
    slug: "kingston-fury-beast-rgb-32gb-ddr5",
    name: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5",
    brandName: "Kingston",
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=500&q=80",
    price: 1_750_000n,
    stock: 15,
    ratingAvg: 4.8,
    ratingCount: 9,
    isNew: true,
  },
  {
    id: "p-4",
    slug: "samsung-990-pro-2tb-nvme-ssd",
    name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
    brandName: "Samsung",
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
    id: "p-5",
    slug: "msi-mag-b760-tomahawk-wifi",
    name: "MSI MAG B760 TOMAHAWK WIFI DDR5 Ona plata",
    brandName: "MSI",
    imageUrl: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&q=80",
    price: 3_100_000n,
    stock: 6,
    ratingAvg: 4.7,
    ratingCount: 8,
  },
  {
    id: "p-6",
    slug: "deepcool-ak620-digital-cooler",
    name: "DeepCool AK620 DIGITAL Qora Protsessor sovutgichi",
    brandName: "DeepCool",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=500&q=80",
    price: 1_050_000n,
    stock: 9,
    ratingAvg: 4.9,
    ratingCount: 16,
    isNew: true,
  },
];

export default function ProductsCatalogPage() {
  const { addItem } = useCart();
  const [category, setCategory] = useState("all");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [sortBy, setSortBy] = useState("popular");
  const [onlyDiscount, setOnlyDiscount] = useState(false);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  const categories = [
    { slug: "all", name: "Barcha toifalar" },
    { slug: "protsessorlar", name: "Protsessorlar (CPU)" },
    { slug: "videokartalar", name: "Videokartalar (GPU)" },
    { slug: "operativ-xotira", name: "Operativ xotira (RAM)" },
    { slug: "ssd-disklar", name: "SSD toʻplovchilar" },
    { slug: "ona-platalar", name: "Ona platalar" },
    { slug: "sovutish", name: "Kuler va sovutish" },
  ];

  const brands = ["all", "Intel", "ASUS", "Kingston", "Samsung", "MSI", "DeepCool"];

  // Filtrlash va saralash
  const filtered = useMemo(() => {
    return ALL_PRODUCTS.filter((item) => {
      const matchBrand = selectedBrand === "all" || item.brandName === selectedBrand;
      const matchDiscount = !onlyDiscount || (item.discountPercent && item.discountPercent > 0);
      return matchBrand && matchDiscount;
    }).sort((a, b) => {
      if (sortBy === "price_asc") return Number(BigInt(a.price) - BigInt(b.price));
      if (sortBy === "price_desc") return Number(BigInt(b.price) - BigInt(a.price));
      if (sortBy === "rating") return (b.ratingAvg ?? 0) - (a.ratingAvg ?? 0);
      return 0; // popular
    });
  }, [selectedBrand, onlyDiscount, sortBy]);

  const handleAddToCart = (productId: string, variantId?: string) => {
    const prod = ALL_PRODUCTS.find((p) => p.id === productId);
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

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
        {/* Sarlavha */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
          <div>
            <h1 className="text-2xl font-black text-foreground sm:text-3xl">Mahsulotlar katalogi</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Jami {filtered.length} ta butlovchi qism va kompyuter texnikasi
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 rounded-[var(--r-btn,8px)] border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-secondary"
            >
              <SlidersHorizontal size={14} />
              Filtrlar
            </button>

            {/* Saralash */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-card px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="popular">Ommabopligi boʻyicha</option>
              <option value="price_asc">Narx: Arzondan qimmatga</option>
              <option value="price_desc">Narx: Qimmatdan arzonga</option>
              <option value="rating">Reyting boʻyicha</option>
            </select>
          </div>
        </div>

        {/* Asosiy kontent: Chap tomon filter + O'ng tomon grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block space-y-6">
            {/* Kategoriyalar */}
            <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 shadow-xs">
              <h3 className="mb-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Kategoriyalar
              </h3>
              <div className="flex flex-col gap-1.5 text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => setCategory(cat.slug)}
                    className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left font-semibold transition-colors ${
                      category === cat.slug
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : "text-foreground hover:bg-secondary"
                    }`}
                  >
                    <span>{cat.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Brendlar */}
            <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 shadow-xs">
              <h3 className="mb-3 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                Brendlar
              </h3>
              <div className="flex flex-col gap-1.5 text-xs">
                {brands.map((b) => (
                  <label key={b} className="flex items-center gap-2 cursor-pointer text-foreground hover:text-primary">
                    <input
                      type="radio"
                      name="brand"
                      checked={selectedBrand === b}
                      onChange={() => setSelectedBrand(b)}
                      className="accent-primary"
                    />
                    <span className="capitalize">{b === "all" ? "Barcha brendlar" : b}</span>
                  </label>
                ))}
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
                  className="accent-primary h-4 w-4"
                />
              </label>
            </div>
          </aside>

          {/* Mahsulotlar Grid (3 ustun desktop) */}
          <div className="lg:col-span-3">
            {filtered.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center rounded-[var(--r-card,12px)] border border-border bg-card">
                <Filter size={36} className="text-muted-foreground/30 mb-2" />
                <p className="text-sm font-bold text-foreground">Tanlangan filtr boʻyicha tovar topilmadi</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Filtr parametrlarini oʻzgartirib koʻring
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((prod) => (
                  <ProductCard
                    key={prod.id}
                    product={prod}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
