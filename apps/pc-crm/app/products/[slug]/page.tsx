"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  ChevronRight,
  Heart,
  HelpCircle,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Zap,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { PriceView } from "@/components/storefront/price-view";
import { RatingStars } from "@/components/storefront/rating-stars";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { formatMoney } from "@/lib/format";

// Namunaviy to'liq mahsulot ma'lumoti
const PRODUCT_DATA = {
  id: "p-2",
  slug: "asus-rog-strix-geforce-rtx-4070-ti-super",
  name: "ASUS ROG Strix GeForce RTX 4070 Ti SUPER 16GB GDDR6X",
  brandName: "ASUS",
  categoryName: "Videokartalar",
  sku: "ROG-STRIX-RTX4070TIS-O16G",
  price: 13_500_000n,
  originalPrice: 14_200_000n,
  discountPercent: 5,
  stock: 4,
  ratingAvg: 5.0,
  ratingCount: 22,
  description:
    "ASUS ROG Strix GeForce RTX 4070 Ti SUPER — eng soʻnggi Ada Lovelace arxitekturasi asosidagi yuqori unumdor grafik karta. DLSS 3, 3-avlod nurlar trassirovkasi (Ray Tracing) va ilgʻor Axial-tech sovutish tizimi bilan 4K oʻyinlar va murakkab render ishlari uchun ideal yechim.",
  images: [
    "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=800&q=80",
    "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=800&q=80",
    "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=800&q=80",
  ],
  variants: [
    { id: "v1", colorName: "Qora (Classic Black)", colorHex: "#111111", stock: 3 },
    { id: "v2", colorName: "Oq (White Edition)", colorHex: "#f5f5f5", stock: 1 },
  ],
  specs: [
    {
      key: "vram",
      title: "Video xotira hajmi",
      value: "16 GB GDDR6X",
      helpTitle: "Video xotira (VRAM) nima?",
      helpText: "VRAM — bu oʻyin teksturalari, 3D modellar va 4K piksellarni saqlaydigan oʻta tezkor xotira. 16GB VRAM har qanday zamonaviy oʻyinni maksimal grafikada oʻynash imkonini beradi.",
    },
    {
      key: "bus",
      title: "Shina kengligi",
      value: "256-bit",
      helpTitle: "Xotira shinasi nima?",
      helpText: "Shina kengligi videokarta chipi va xotirasi oʻrtasidagi maʼlumot oʻtkazish quvurining kengligidir. Shina qancha keng boʻlsa, maʼlumot almashinuvi shuncha tez kechadi.",
    },
    {
      key: "boost_clock",
      title: "Maksimal chastota (OC Mode)",
      value: "2670 MHz",
      helpTitle: "Boost Clock chastotasi nima?",
      helpText: "Ogʻir oʻyin yoki render paytida videokarta avtomatik ravishda erisha oladigan maksimal chastota tezligi.",
    },
    {
      key: "psu_rec",
      title: "Tavsiya etilgan quvvat bloki",
      value: "750W yoki undan yuqori",
      helpTitle: "Blok pitaniya talabi",
      helpText: "Tizim barqaror ishlashi va quvvat yetishmovchiligi boʻlmasligi uchun kamida 750W quvvat bloki talab qilinadi.",
    },
  ],
};

export default function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  // Promise params unwrap
  const { slug } = use(params);
  const router = useRouter();
  const { addItem } = useCart();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(PRODUCT_DATA.variants[0]);
  const [qty, setQty] = useState(1);
  const { isLiked: checkIsLiked, toggleLike } = useLiked();
  const isLiked = checkIsLiked(PRODUCT_DATA.id);

  // Texnik xususiyatlar bo'yicha yordam modali
  const [activeHelp, setActiveHelp] = useState<{ title: string; text: string } | null>(null);

  const handleAddToCart = () => {
    addItem(
      {
        productId: PRODUCT_DATA.id,
        variantId: selectedVariant?.id,
        name: PRODUCT_DATA.name,
        brandName: PRODUCT_DATA.brandName,
        price: PRODUCT_DATA.price,
        originalPrice: PRODUCT_DATA.originalPrice,
        imageUrl: PRODUCT_DATA.images[activeImageIndex] || PRODUCT_DATA.images[0] || "",
        colorName: selectedVariant?.colorName,
      },
      qty
    );
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push("/checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-6 sm:px-6">
        {/* Breadcrumb navigatsiya */}
        <nav className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-primary transition-colors">
            Bosh sahifa
          </Link>
          <ChevronRight size={13} />
          <Link href="/products" className="hover:text-primary transition-colors">
            Mahsulotlar
          </Link>
          <ChevronRight size={13} />
          <span className="font-semibold text-foreground truncate max-w-xs">{PRODUCT_DATA.name}</span>
        </nav>

        {/* Asosiy tafsilot: Chap galereya + O'ng ma'lumot */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* 1. Chap tomon: Galereya */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-white p-6 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={PRODUCT_DATA.images[activeImageIndex]}
                alt={PRODUCT_DATA.name}
                className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
              />
            </div>

            {/* Thumbnail rasmlar */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {PRODUCT_DATA.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-xl border bg-white p-2 transition-all ${
                    activeImageIndex === idx
                      ? "border-primary ring-2 ring-primary/20 scale-105"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
          </div>

          {/* 2. O'ng tomon: Ma'lumot va sotib olish */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <Badge tone="info" className="text-xs font-bold uppercase">
                  {PRODUCT_DATA.brandName}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">SKU: {PRODUCT_DATA.sku}</span>
              </div>

              <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl leading-snug">
                {PRODUCT_DATA.name}
              </h1>

              <div className="mt-2.5 flex items-center gap-4 text-xs">
                <RatingStars rating={PRODUCT_DATA.ratingAvg} count={PRODUCT_DATA.ratingCount} />
                <span className="text-border">|</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Omborda mavjud ({PRODUCT_DATA.stock} dona)
                </span>
              </div>
            </div>

            {/* Narx */}
            <div className="rounded-xl border border-border/80 bg-muted/20 p-4">
              <PriceView
                price={PRODUCT_DATA.price}
                originalPrice={PRODUCT_DATA.originalPrice}
                discountPercent={PRODUCT_DATA.discountPercent}
                size="lg"
              />
            </div>

            {/* Rang tanlagich */}
            {PRODUCT_DATA.variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">
                  Rang: <span className="font-semibold text-muted-foreground">{selectedVariant?.colorName}</span>
                </p>
                <div className="flex items-center gap-2">
                  {PRODUCT_DATA.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      style={{ backgroundColor: v.colorHex }}
                      className={`h-7 w-7 rounded-full border border-black/10 transition-transform ${
                        selectedVariant?.id === v.id
                          ? "ring-2 ring-primary ring-offset-2 scale-110"
                          : "hover:scale-105"
                      }`}
                      title={v.colorName}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Miqdor va tugmalar */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    onClick={() => setQty(Math.max(1, qty - 1))}
                    className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Minus size={15} />
                  </button>
                  <span className="w-10 text-center font-bold text-sm">{qty}</span>
                  <button
                    type="button"
                    onClick={() => setQty(Math.min(PRODUCT_DATA.stock, qty + 1))}
                    className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="default"
                  className="flex-1 gap-2 font-bold shadow-md"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={16} />
                  Savatga qoʻshish
                </Button>

                <button
                  type="button"
                  onClick={() =>
                    toggleLike({
                      id: PRODUCT_DATA.id,
                      type: "product",
                      name: PRODUCT_DATA.name,
                      slug: PRODUCT_DATA.slug,
                      imageUrl: PRODUCT_DATA.images[0] ?? "",
                      price: PRODUCT_DATA.price,
                      originalPrice: PRODUCT_DATA.originalPrice,
                      brandName: PRODUCT_DATA.brandName,
                      ratingAvg: PRODUCT_DATA.ratingAvg,
                      ratingCount: PRODUCT_DATA.ratingCount,
                    })
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-foreground hover:bg-secondary transition-colors"
                  aria-label="Sevimlilar"
                >
                  <Heart
                    size={18}
                    className={isLiked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}
                  />
                </button>
              </div>

              <Button
                variant="ghost"
                size="default"
                className="w-full font-bold border border-primary text-primary hover:bg-primary/10"
                onClick={handleBuyNow}
              >
                <Zap size={16} />
                Hozir sotib olish (1 bosqichda)
              </Button>
            </div>

            {/* Afzalliklar qisqacha */}
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-primary" />
                <span>Tez yetkazib berish</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <span>12 oylik rasmiy kafolat</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Texnik xususiyatlar ("?" tushuntirish modali bilan) */}
        <section className="mt-14 border-t border-border pt-10">
          <h2 className="mb-6 text-xl font-black text-foreground">Texnik xususiyatlar</h2>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <dl className="divide-y divide-border/60">
              {PRODUCT_DATA.specs.map((spec, i) => (
                <div key={i} className="flex items-center justify-between p-4 text-xs sm:text-sm">
                  <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                    <span>{spec.title}</span>
                    {spec.helpText && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveHelp({
                            title: spec.helpTitle ?? spec.title,
                            text: spec.helpText ?? "",
                          })
                        }
                        className="text-muted-foreground hover:text-primary transition-colors p-0.5"
                        title="Batafsil maʼlumot"
                      >
                        <HelpCircle size={14} />
                      </button>
                    )}
                  </dt>
                  <dd className="font-bold text-foreground">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 4. Tavsif */}
        <section className="mt-10 border-t border-border pt-8">
          <h2 className="mb-4 text-xl font-black text-foreground">Mahsulot tavsifi</h2>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {PRODUCT_DATA.description}
          </p>
        </section>
      </main>

      {/* Texnik xususiyat "?" tushuntirish modali */}
      <Modal
        open={Boolean(activeHelp)}
        onOpenChange={(open) => !open && setActiveHelp(null)}
        title={activeHelp?.title ?? ""}
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveHelp(null)}>
            Tushundim
          </Button>
        }
      >
        <p className="text-sm leading-relaxed text-muted-foreground">{activeHelp?.text}</p>
      </Modal>

      <Footer />
    </div>
  );
}
