"use client";
import { Input } from "@ventura/ui/input";
import { SelectField } from "@ventura/ui/select";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Cpu, Filter, Monitor, RotateCcw, Search, Sparkles, Wrench, X } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type PcBuildCardData, PcCard } from "@/components/storefront/pc-card";
import { SearchModal } from "@/components/storefront/search-modal";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { formatMoney } from "@/lib/format";
import { getStorefrontPcBuildsAction } from "@/lib/server/actions";

interface PcBuildListItem {
  id: string;
  slug: string;
  name: string;
  images: string[];
  sellPrice: bigint;
  discountPercent: number;
  status: "available" | "sold" | "hidden";
  ratingAvg: number;
  ratingCount: number;
  cpu: string;
  gpu: string;
  ram: string;
  storage: string;
}

export default function ComputersListingPage() {
  const { addItem } = useCart();
  const [builds, setBuilds] = useState<PcBuildListItem[]>([]);

  useEffect(() => {
    let active = true;
    getStorefrontPcBuildsAction().then((result) => {
      if (active && result.success) setBuilds(result.builds);
    });
    return () => {
      active = false;
    };
  }, []);

  // Filter holatlari
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCpu, setSelectedCpu] = useState<string>("all");
  const [selectedGpu, setSelectedGpu] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"featured" | "price_asc" | "price_desc" | "rating">("featured");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const { isLiked, toggleLike } = useLiked();

  // CPU va GPU toifalari
  const cpuOptions = [
    { label: "Barcha protsessorlar", value: "all" },
    { label: "Intel Core i7", value: "i7" },
    { label: "Intel Core i9", value: "i9" },
    { label: "Intel Core i5", value: "i5" },
    { label: "AMD Ryzen 7", value: "Ryzen 7" },
    { label: "AMD Ryzen 5", value: "Ryzen 5" },
    { label: "AMD Ryzen 9", value: "Ryzen 9" },
  ];

  const gpuOptions = [
    { label: "Barcha videokartalar", value: "all" },
    { label: "GeForce RTX 4070", value: "4070" },
    { label: "GeForce RTX 4060", value: "4060" },
    { label: "GeForce RTX 4080 / 4090", value: "4080" },
    { label: "Radeon RX 7800", value: "7800" },
  ];

  // Faqat `available` kompyuterlarni filter qilish
  const filteredBuilds = useMemo(() => {
    return builds
      .filter((b) => {
        // 1. Faqat sotuvda mavjud bo'lganlar
        if (b.status !== "available") return false;

        // 2. Qidiruv
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = b.name.toLowerCase().includes(q);
          const matchCpu = b.cpu.toLowerCase().includes(q);
          const matchGpu = b.gpu.toLowerCase().includes(q);
          if (!matchName && !matchCpu && !matchGpu) return false;
        }

        // 3. CPU filter
        if (selectedCpu !== "all") {
          if (!b.cpu.toLowerCase().includes(selectedCpu.toLowerCase())) return false;
        }

        // 4. GPU filter
        if (selectedGpu !== "all") {
          if (!b.gpu.toLowerCase().includes(selectedGpu.toLowerCase())) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === "price_asc") return a.sellPrice > b.sellPrice ? 1 : -1;
        if (sortBy === "price_desc") return a.sellPrice < b.sellPrice ? 1 : -1;
        if (sortBy === "rating") return b.ratingAvg - a.ratingAvg;
        return 0; // featured
      });
  }, [builds, searchQuery, selectedCpu, selectedGpu, sortBy]);

  const handleAddToCart = (pcId: string) => {
    const pc = builds.find((p) => p.id === pcId);
    if (!pc) return;

    addItem({
      productId: pc.id,
      name: pc.name,
      price: pc.sellPrice,
      originalPrice: pc.discountPercent > 0 ? (pc.sellPrice * 100n) / BigInt(100 - pc.discountPercent) : undefined,
      imageUrl: pc.images[0] ?? "",
      colorName: "Standart konfiguratsiya",
    });
  };

  const handleToggleLike = (pcId: string) => {
    const build = builds.find((b) => b.id === pcId);
    if (!build) return;
    toggleLike({
      id: build.id,
      type: "pc",
      name: build.name,
      slug: build.slug,
      imageUrl: build.images[0] ?? "",
      price: build.sellPrice,
      ratingAvg: build.ratingAvg,
      ratingCount: build.ratingCount,
      isAvailable: build.status === "available",
      specs: `${build.cpu} / ${build.gpu} / ${build.ram}`,
    });
  };

  const resetFilters = () => {
    setSearchQuery("");
    setSelectedCpu("all");
    setSelectedGpu("all");
    setSortBy("featured");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* Sarlavha & Konfigurator Banneri */}
        <section className="border-b border-border bg-card/60 py-8 lg:py-10">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Tayyor oʻyin va ishchi kompyuterlar</h1>
              </div>

              {/* Konfiguratorga chaqiriq (CTA) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-card border border-primary/30 bg-primary/5 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground shadow-card">
                  <Wrench size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold">Oʻz kompyuteringizni yigʻmoqchimisiz?</h2>
                  <p className="text-xs text-muted-foreground">Komponentlarni bosqichma-bosqich oʻzingiz tanlang</p>
                </div>
                <Link href="/computers/custom" className="sm:ml-2 w-full sm:w-auto">
                  <Button variant="primary" size="sm" className="w-full gap-1.5 text-xs font-semibold">
                    Konfiguratorga oʻtish
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Asosiy kontent: Filterlar va Kompyuterlar Grid */}
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
            {/* Chap tomon: Desktop Filter paneli */}
            <aside className="hidden lg:block lg:col-span-1 space-y-6">
              <div className="rounded-card border border-border bg-card p-5 shadow-card">
                <div className="mb-4 flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="font-bold text-base flex items-center gap-2">
                    <Filter size={18} className="text-primary" />
                    Filtrlar
                  </h3>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                  >
                    <RotateCcw size={12} />
                    Tozalash
                  </button>
                </div>

                {/* Protsessor filtri */}
                <div className="mb-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Protsessor (CPU)
                  </label>
                  <div className="space-y-1">
                    {cpuOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedCpu(opt.value)}
                        className={`w-full rounded-control px-3 py-2 text-left text-xs font-medium transition-colors ${
                          selectedCpu === opt.value
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Videokarta filtri */}
                <div className="mb-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Videokarta (GPU)
                  </label>
                  <div className="space-y-1">
                    {gpuOptions.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSelectedGpu(opt.value)}
                        className={`w-full rounded-control px-3 py-2 text-left text-xs font-medium transition-colors ${
                          selectedGpu === opt.value
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Kafolat ma'lumoti */}
                <div className="rounded-control bg-muted/60 p-3 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground mb-1">100% Rasmiy Kafolat</p>
                  Har bir kompyuter uchun 12 oydan 24 oygacha bepul servis kafolati beriladi.
                </div>
              </div>
            </aside>

            {/* O'ng tomon: Qidiruv, Saralash va Grid */}
            <div className="lg:col-span-3">
              {/* Yuqori qidiruv va saralash qatori */}
              <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Qidiruv input */}
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Kompyuter modeli yoki komponenti boʻyicha qidirish..."
                    className="w-full rounded-control border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Saralash & Mobil Filtr tugmasi */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileFilterOpen(true)}
                    className="lg:hidden flex items-center gap-1.5 rounded-btn border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
                  >
                    <Filter size={14} />
                    Filtrlar
                  </button>

                  <SelectField
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-control border border-input bg-card px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="featured">Tavsiya etilganlar</option>
                    <option value="price_asc">Narx: arzondan qimmatga</option>
                    <option value="price_desc">Narx: qimmatdan arzonga</option>
                    <option value="rating">Reyting boʻyicha</option>
                  </SelectField>
                </div>
              </div>

              {/* Natijalar soni */}
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Topildi: <strong className="text-foreground">{filteredBuilds.length}</strong> ta kompyuter
                </span>
                {(selectedCpu !== "all" || selectedGpu !== "all" || searchQuery) && (
                  <button type="button" onClick={resetFilters} className="text-primary hover:underline font-semibold">
                    Filtrlarni bekor qilish
                  </button>
                )}
              </div>

              {/* Grid 4 ustun */}
              {filteredBuilds.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-card border border-dashed border-border p-12 text-center bg-card">
                  <Monitor size={48} className="text-muted-foreground/40 mb-3" />
                  <h3 className="text-lg font-bold">Mos kompyuter topilmadi</h3>
                  <p className="mt-1 text-xs sm:text-sm text-muted-foreground max-w-md">
                    Qidiruv soʻrovini yoki filtrlarni oʻzgartirib koʻring, yoki konfigurator orqali oʻzingiz istagan PC
                    ni yigʻing.
                  </p>
                  <div className="mt-5 flex gap-3">
                    <Button variant="ghost" size="sm" onClick={resetFilters}>
                      Filtrlarni tozalash
                    </Button>
                    <Link href="/computers/custom">
                      <Button variant="primary" size="sm">
                        PC Konfigurator
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredBuilds.map((build) => {
                    const cardData: PcBuildCardData = {
                      id: build.id,
                      slug: build.slug,
                      name: build.name,
                      imageUrl: build.images[0] ?? "",
                      cpu: build.cpu,
                      gpu: build.gpu,
                      ram: build.ram,
                      storage: build.storage,
                      price: build.sellPrice,
                      originalPrice:
                        build.discountPercent > 0
                          ? (build.sellPrice * 100n) / BigInt(100 - build.discountPercent)
                          : undefined,
                      discountPercent: build.discountPercent,
                      ratingAvg: build.ratingAvg,
                      ratingCount: build.ratingCount,
                      isAvailable: build.status === "available",
                    };

                    return (
                      <PcCard
                        key={build.id}
                        pc={cardData}
                        onAddToCart={handleAddToCart}
                        onToggleLike={handleToggleLike}
                        isLiked={isLiked(build.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobil Filtr Drawer */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-xs lg:hidden">
          <div className="relative ml-auto flex h-full w-full max-w-xs flex-col bg-card p-6 shadow-modal">
            <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold">Filtrlar</h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Protsessor (CPU)
                </label>
                <div className="space-y-1">
                  {cpuOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedCpu(opt.value)}
                      className={`w-full rounded-control px-3 py-2 text-left text-xs font-medium ${
                        selectedCpu === opt.value
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Videokarta (GPU)
                </label>
                <div className="space-y-1">
                  {gpuOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSelectedGpu(opt.value)}
                      className={`w-full rounded-control px-3 py-2 text-left text-xs font-medium ${
                        selectedGpu === opt.value
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "text-foreground hover:bg-secondary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-border flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-1/2"
                onClick={() => {
                  resetFilters();
                  setMobileFilterOpen(false);
                }}
              >
                Tozalash
              </Button>
              <Button variant="primary" size="sm" className="w-1/2" onClick={() => setMobileFilterOpen(false)}>
                Qoʻllash
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Savatcha modali (Drawer) */}
      <CartDrawer />

      {/* Ctrl+K Qidiruv Modali */}
      <SearchModal />

      <Footer />
    </div>
  );
}
