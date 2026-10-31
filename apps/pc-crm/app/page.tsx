import Link from "next/link";
import {
  ArrowRight,
  Cpu,
  HardDrive,
  Headphones,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  ShieldCheck,
  Sparkles,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type PcBuildCardData, PcCard } from "@/components/storefront/pc-card";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";

// Namunaviy toifalar
const SAMPLE_CATEGORIES = [
  { slug: "protsessorlar", name: "Protsessorlar", icon: Cpu, count: 24 },
  { slug: "videokartalar", name: "Videokartalar", icon: Monitor, count: 18 },
  { slug: "operativ-xotira", name: "Operativ xotira", icon: MemoryStick, count: 32 },
  { slug: "ssd-disklar", name: "SSD toʻplovchilar", icon: HardDrive, count: 29 },
  { slug: "noutbuklar", name: "Noutbuklar", icon: Laptop, count: 15 },
  { slug: "aksessuarlar", name: "Aksessuarlar", icon: Mouse, count: 42 },
];

// Namunaviy mahsulotlar
const SAMPLE_PRODUCTS: ProductCardData[] = [
  {
    id: "p-1",
    slug: "intel-core-i7-14700k",
    name: "Intel Core i7-14700K 3.4GHz LGA1700 Protsessor",
    brandName: "Intel",
    imageUrl: "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&auto=format&fit=crop&q=80",
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
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=500&auto=format&fit=crop&q=80",
    price: 13_500_000n,
    originalPrice: 14_200_000n,
    discountPercent: 5,
    stock: 4,
    ratingAvg: 5.0,
    ratingCount: 22,
    isHit: true,
  },
  {
    id: "p-3",
    slug: "kingston-fury-beast-rgb-32gb-ddr5",
    name: "Kingston FURY Beast RGB 32GB (2x16GB) 6000MHz DDR5",
    brandName: "Kingston",
    imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=500&auto=format&fit=crop&q=80",
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
    imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=500&auto=format&fit=crop&q=80",
    price: 2_600_000n,
    originalPrice: 2_950_000n,
    discountPercent: 12,
    stock: 11,
    ratingAvg: 4.9,
    ratingCount: 31,
    isHit: true,
  },
];

// Namunaviy PClar
const SAMPLE_PCS: PcBuildCardData[] = [
  {
    id: "pc-1",
    slug: "ventura-gaming-titan-i7-4070",
    name: "Ventura Gaming Titan: Core i7-14700K / RTX 4070 Ti Super",
    imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=600&auto=format&fit=crop&q=80",
    cpu: "i7-14700K",
    gpu: "RTX 4070 Ti 16GB",
    ram: "32GB DDR5",
    storage: "1TB M.2 NVMe",
    price: 24_800_000n,
    originalPrice: 26_500_000n,
    discountPercent: 6,
    ratingAvg: 5.0,
    ratingCount: 8,
    isAvailable: true,
  },
  {
    id: "pc-2",
    slug: "ventura-streamer-pro-ryzen7-4060ti",
    name: "Ventura Streamer Pro: Ryzen 7 7800X3D / RTX 4060 Ti",
    imageUrl: "https://images.unsplash.com/photo-1593640408182-31c70c8268f5?w=600&auto=format&fit=crop&q=80",
    cpu: "Ryzen 7 7800X3D",
    gpu: "RTX 4060 Ti 8GB",
    ram: "32GB DDR5",
    storage: "1TB Gen4 SSD",
    price: 18_900_000n,
    ratingAvg: 4.9,
    ratingCount: 12,
    isAvailable: true,
  },
  {
    id: "pc-3",
    slug: "ventura-cyber-beast-i9-4090",
    name: "Ventura Cyber Beast: Core i9-14900K / RTX 4090 24GB",
    imageUrl: "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=600&auto=format&fit=crop&q=80",
    cpu: "i9-14900K",
    gpu: "RTX 4090 24GB",
    ram: "64GB DDR5",
    storage: "2TB NVMe",
    price: 51_000_000n,
    originalPrice: 53_500_000n,
    discountPercent: 5,
    ratingAvg: 5.0,
    ratingCount: 7,
    isAvailable: true,
  },
  {
    id: "pc-4",
    slug: "ventura-creator-amd-rx7800xt",
    name: "Ventura Creator: Ryzen 5 7600X / Radeon RX 7800 XT",
    imageUrl: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=600&auto=format&fit=crop&q=80",
    cpu: "Ryzen 5 7600X",
    gpu: "RX 7800 XT 16GB",
    ram: "32GB DDR5",
    storage: "1TB NVMe",
    price: 16_800_000n,
    ratingAvg: 4.8,
    ratingCount: 9,
    isAvailable: true,
  },
];

export default function StorefrontHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar cartCount={2} likedCount={3} />

      <main className="flex-1">
        {/* 1. Hero Banner bo'limi */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card via-card to-background py-12 lg:py-16">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
              <div className="flex flex-col items-start">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                  <Sparkles size={14} />
                  <span>2026 Yangi avlod PC modellari tayyor</span>
                </div>

                <h1 className="mb-4 text-3xl font-black tracking-tight sm:text-5xl sm:leading-tight">
                  Cheksiz quvvat. <br />
                  <span className="text-primary">Maksimal unumdorlik.</span>
                </h1>

                <p className="mb-8 max-w-lg text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Oʻyinlar, render, 3D modellashtirish va dasturlash uchun maxsus yigʻilgan tayyor kompyuterlar hamda
                  eng yangi original butlovchi qismlar.
                </p>

                <div className="flex flex-wrap items-center gap-3.5">
                  <Link href="/computers">
                    <Button variant="primary" size="default" className="gap-2 font-bold shadow-md">
                      PClarni koʻrish <ArrowRight size={16} />
                    </Button>
                  </Link>

                  <Link href="/computers/custom">
                    <Button variant="ghost" size="default" className="gap-2 font-semibold">
                      <Wrench size={16} />
                      Oʻz kompyuteringni terish
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Hero o'ng tomon vizual */}
              <div className="relative flex items-center justify-center">
                <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-2xl border border-border/80 bg-white p-6 shadow-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80"
                    alt="Ventura PC Hero"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute bottom-4 left-4 rounded-xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur-md">
                    <p className="text-xs font-semibold text-muted-foreground">Eng ommabop model</p>
                    <p className="text-sm font-bold text-foreground">Gaming Titan RTX 4070 Ti</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Kategoriyalar bloki */}
        <section className="py-12 border-b border-border/60">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Ommabop boʻlimlar</h2>
                <p className="text-xs text-muted-foreground">Kerakli ehtiyot qismlarni toifalar boʻyicha toping</p>
              </div>

              <Link href="/products" className="text-xs font-bold text-primary hover:underline">
                Barchasi →
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {SAMPLE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.slug}
                    href={`/products?category=${cat.slug}`}
                    className="group flex flex-col items-center justify-center rounded-[var(--r-card,12px)] border border-border bg-card p-4 text-center transition-all duration-200 hover:border-primary hover:shadow-md"
                  >
                    <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                      <Icon size={22} />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{cat.count} xil</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. Yangi kelgan mahsulotlar */}
        <section className="py-12 border-b border-border/60 bg-muted/20">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Yangi kelgan tovarlar</h2>
                <p className="text-xs text-muted-foreground">Omborga yaqinda tushgan original butlovchi qismlar</p>
              </div>

              <Link href="/products" className="text-xs font-bold text-primary hover:underline">
                Katalogga oʻtish →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_PRODUCTS.map((prod) => (
                <ProductCard key={prod.id} product={prod} />
              ))}
            </div>
          </div>
        </section>

        {/* 4. Tayyor Gaming va Ishchi PClar */}
        <section className="py-12">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Zap size={14} />
                  <span>Optimal yigʻilgan</span>
                </div>
                <h2 className="text-xl font-bold text-foreground sm:text-2xl">Tayyor Kompyuterlar (PC Builds)</h2>
                <p className="text-xs text-muted-foreground">Sinovdan oʻtgan, drayverlari oʻrnatilgan tayyor tizimlar</p>
              </div>

              <Link href="/computers" className="text-xs font-bold text-primary hover:underline">
                Barcha PClar →
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {SAMPLE_PCS.map((pc) => (
                <PcCard key={pc.id} pc={pc} />
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
