"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  HardDrive,
  Laptop,
  MemoryStick,
  Monitor,
  Mouse,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type PcBuildCardData, PcCard } from "@/components/storefront/pc-card";
import { type ProductCardData, ProductCard } from "@/components/storefront/product-card";
import { useLiked } from "@/lib/liked-context";
import { getStorefrontPcBuildsAction, getStorefrontProductsAction } from "@/lib/server/actions";

const CATEGORIES = [
  { slug: "protsessorlar", name: "Protsessorlar", icon: Cpu },
  { slug: "videokartalar", name: "Videokartalar", icon: Monitor },
  { slug: "operativ-xotira", name: "Operativ xotira", icon: MemoryStick },
  { slug: "ssd-disklar", name: "SSD toʻplovchilar", icon: HardDrive },
  { slug: "noutbuklar", name: "Noutbuklar", icon: Laptop },
  { slug: "aksessuarlar", name: "Aksessuarlar", icon: Mouse },
];

export default function StorefrontHomePage() {
  const { isLiked, toggleLike } = useLiked();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [pcs, setPcs] = useState<PcBuildCardData[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([getStorefrontProductsAction(), getStorefrontPcBuildsAction()]).then(([productResult, pcResult]) => {
      if (!active) return;
      if (productResult.success) {
        setProducts(productResult.products);
      }
      if (pcResult.success) {
        setPcs(pcResult.builds.map((pc) => ({
          id: pc.id,
          slug: pc.slug,
          name: pc.name,
          imageUrl: pc.images?.[0] ?? "/placeholder-product.svg",
          cpu: pc.cpu ?? undefined,
          gpu: pc.gpu ?? undefined,
          ram: pc.ram ?? undefined,
          storage: pc.storage ?? undefined,
          price: pc.sellPrice,
          discountPercent: pc.discountPercent,
          ratingAvg: pc.ratingAvg,
          ratingCount: pc.ratingCount,
          isAvailable: pc.status === "available",
        })));
      }
    }).catch((error) => console.error("Storefront home load failed", error));
    return () => { active = false; };
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero Banner bo'limi */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card/80 via-card/40 to-transparent py-12 lg:py-16">
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
                    <Button variant="primary" size="default" className="gap-2 font-bold shadow-card-hover">
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
                <div className="absolute -inset-4 rounded-modal bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-2xl -z-10" />
                <div className="relative aspect-[4/3] w-full max-w-lg overflow-hidden rounded-modal border border-border/80 bg-media p-6 shadow-modal">
                  <div className="absolute top-4 right-4 z-10 rounded-full border border-primary/20 bg-card/90 px-3 py-1 text-2xs font-extrabold text-primary shadow-xs backdrop-blur-md">
                    ⚡ 450+ FPS • Ultra 2K/4K
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&auto=format&fit=crop&q=80"
                    alt="Ventura PC Hero"
                    className="h-full w-full object-contain"
                  />
                  <div className="absolute bottom-4 left-4 rounded-card border border-border bg-card/90 p-3 shadow-popover backdrop-blur-md">
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
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                return (
                  <Link
                    key={cat.slug}
                    href={`/products?category=${cat.slug}`}
                    className="group flex flex-col items-center justify-center rounded-card border border-border bg-card p-4 text-center transition-all duration-200 hover:border-primary hover:shadow-card-hover"
                  >
                    <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-card bg-primary/10 text-primary transition-transform group-hover:scale-110">
                      <Icon size={22} />
                    </div>
                    <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                      {cat.name}
                    </span>
                    <span className="text-caption text-muted-foreground">Mahsulotlar</span>
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
              {products.slice(0, 4).map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  isLiked={isLiked(prod.id)}
                  onToggleLike={() => toggleLike({ ...prod, type: "product" })}
                />
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
              {pcs.slice(0, 4).map((pc) => (
                <PcCard
                  key={pc.id}
                  pc={pc}
                  isLiked={isLiked(pc.id)}
                  onToggleLike={() => toggleLike({ ...pc, type: "pc" })}
                />
              ))}
            </div>
          </div>
        </section>

        {/* 5. Custom PC Konfigurator Banner bloki */}
        <section className="py-12 border-b border-border/60 bg-gradient-to-r from-card via-card/90 to-primary/5">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-modal border border-border/80 bg-gradient-to-br from-card via-card to-secondary/30 p-8 sm:p-12 shadow-modal">
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 items-center">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                    <Wrench size={14} />
                    <span>Interaktiv Konstruktor</span>
                  </div>
                  <h2 className="text-2xl font-black text-foreground sm:text-4xl tracking-tight">
                    Oʻzingizga mos kompyuterni <span className="text-primary">0 dan yigʻing</span>
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-md">
                    Protsessordan tortib korpusgacha boʻlgan 8 ta asosiy komponentni tanlang. 
                    Real vaqtda narx, elektr quvvati (TDP) va komponentlar zaxirasini nazorat qiling.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-foreground">
                    <div className="flex items-center gap-1.5 rounded-control bg-secondary/60 px-3 py-1.5">
                      <CheckCircle2 size={15} className="text-(--success-fg)" />
                      <span>8 ta komponent tanlovi</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-control bg-secondary/60 px-3 py-1.5">
                      <CheckCircle2 size={15} className="text-(--success-fg)" />
                      <span>Jonli TDP quvvat hisobi</span>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-control bg-secondary/60 px-3 py-1.5">
                      <CheckCircle2 size={15} className="text-(--success-fg)" />
                      <span>Bepul yigʻish & test</span>
                    </div>
                  </div>

                  <div className="mt-8">
                    <Link href="/computers/custom">
                      <Button variant="primary" size="default" className="gap-2 font-bold shadow-card-hover">
                        <Wrench size={16} />
                        Konfiguratorni ochish <ArrowRight size={16} />
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="flex items-center justify-center">
                  <div className="relative w-full max-w-md rounded-card border border-border bg-card/90 p-6 shadow-popover backdrop-blur-md">
                    <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                      <span className="text-xs font-bold text-muted-foreground">Jonli Konfigurator namoyishi</span>
                      <span className="rounded-full bg-(--success-bg) px-2 py-0.5 text-2xs font-bold text-(--success-fg)">Mavjud</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between rounded-control bg-secondary/50 p-2">
                        <span className="text-muted-foreground">CPU: Core i7-14700K</span>
                        <span className="font-bold font-mono text-foreground">125W TDP</span>
                      </div>
                      <div className="flex items-center justify-between rounded-control bg-secondary/50 p-2">
                        <span className="text-muted-foreground">GPU: RTX 4070 Ti Super</span>
                        <span className="font-bold font-mono text-foreground">285W TDP</span>
                      </div>
                      <div className="flex items-center justify-between rounded-control bg-secondary/50 p-2">
                        <span className="text-muted-foreground">RAM: 32GB DDR5 6000MHz</span>
                        <span className="font-bold font-mono text-foreground">Kingston</span>
                      </div>
                    </div>
                    <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                      <div>
                        <span className="text-2xs text-muted-foreground">Kutilayotgan umumiy quvvat</span>
                        <p className="font-bold font-mono text-sm text-primary">~485W (750W PSU tavsiya)</p>
                      </div>
                      <span className="text-xs font-bold text-primary">100% Mos</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Mashhur Brendlar */}
        <section className="py-10 border-b border-border/60">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="mb-6 text-center">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Faqat jahonning yetakchi brendlari va original ehtiyot qismlari
              </h3>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 opacity-75 hover:opacity-100 transition-opacity">
              {["Intel", "AMD", "NVIDIA", "ASUS", "MSI", "Gigabyte", "Kingston", "Samsung", "DeepCool", "NZXT", "Corsair"].map((brand) => (
                <Link
                  key={brand}
                  href={`/products?brand=${brand}`}
                  className="rounded-control px-3.5 py-1.5 font-black text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all border border-transparent hover:border-border"
                >
                  {brand}
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
