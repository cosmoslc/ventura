"use client";

import { useState } from "react";
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

export interface ProductDetailData {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  categoryName: string;
  sku: string;
  price: bigint;
  originalPrice?: bigint;
  discountPercent: number;
  stock: number;
  ratingAvg: number;
  ratingCount: number;
  description: string;
  images: string[];
  variants: { id: string; colorName: string; colorHex: string; stock: number }[];
  specs: { key: string; title: string; value: string; helpTitle?: string; helpText?: string }[];
}

export function ProductDetailClient({ product }: { product: ProductDetailData }) {
  const router = useRouter();
  const { addItem } = useCart();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(product.variants[0]);
  const [qty, setQty] = useState(1);
  const { isLiked: checkIsLiked, toggleLike } = useLiked();
  const isLiked = checkIsLiked(product.id);

  // Texnik xususiyatlar bo'yicha yordam modali
  const [activeHelp, setActiveHelp] = useState<{ title: string; text: string } | null>(null);

  const handleAddToCart = () => {
    addItem(
      {
        productId: product.id,
        variantId: selectedVariant?.id,
        name: product.name,
        brandName: product.brandName,
        price: product.price,
        originalPrice: product.originalPrice,
        imageUrl: product.images[activeImageIndex] || product.images[0] || "",
        colorName: selectedVariant?.colorName,
      },
      qty,
    );
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push("/checkout");
  };

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
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
          <span className="font-semibold text-foreground truncate max-w-xs">{product.name}</span>
        </nav>

        {/* Asosiy tafsilot: Chap galereya + O'ng ma'lumot */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          {/* 1. Chap tomon: Galereya */}
          <div className="space-y-4">
            <div className="relative aspect-square w-full overflow-hidden rounded-modal border border-border bg-media p-6 shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={product.images[activeImageIndex]}
                alt={product.name}
                className="h-full w-full object-contain transition-transform duration-300 hover:scale-105"
              />
            </div>

            {/* Thumbnail rasmlar */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImageIndex(idx)}
                  className={`flex h-18 w-18 shrink-0 items-center justify-center rounded-card border bg-media p-2 transition-all ${
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
                  {product.brandName}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">SKU: {product.sku}</span>
              </div>

              <h1 className="mt-2 text-2xl font-black text-foreground sm:text-3xl leading-snug">{product.name}</h1>

              <div className="mt-2.5 flex items-center gap-4 text-xs">
                <RatingStars rating={product.ratingAvg} count={product.ratingCount} />
                <span className="text-border">|</span>
                <span className="font-bold text-(--success-fg)">Omborda mavjud ({product.stock} dona)</span>
              </div>
            </div>

            {/* Narx */}
            <div className="rounded-card border border-border/80 bg-muted/20 p-4">
              <PriceView
                price={product.price}
                originalPrice={product.originalPrice}
                discountPercent={product.discountPercent}
                size="lg"
              />
            </div>

            {/* Rang tanlagich */}
            {product.variants.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-foreground">
                  Rang: <span className="font-semibold text-muted-foreground">{selectedVariant?.colorName}</span>
                </p>
                <div className="flex items-center gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      style={{ backgroundColor: v.colorHex }}
                      className={`h-7 w-7 rounded-full border border-black/10 transition-transform ${
                        selectedVariant?.id === v.id ? "ring-2 ring-primary ring-offset-2 scale-110" : "hover:scale-105"
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
                <div className="flex items-center rounded-control border border-border bg-card">
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
                    onClick={() => setQty(Math.min(product.stock, qty + 1))}
                    className="flex h-10 w-10 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={15} />
                  </button>
                </div>

                <Button
                  variant="primary"
                  size="default"
                  className="flex-1 gap-2 font-bold shadow-card-hover"
                  onClick={handleAddToCart}
                >
                  <ShoppingCart size={16} />
                  Savatga qoʻshish
                </Button>

                <button
                  type="button"
                  onClick={() =>
                    toggleLike({
                      id: product.id,
                      type: "product",
                      name: product.name,
                      slug: product.slug,
                      imageUrl: product.images[0] ?? "",
                      price: product.price,
                      originalPrice: product.originalPrice,
                      brandName: product.brandName,
                      ratingAvg: product.ratingAvg,
                      ratingCount: product.ratingCount,
                    })
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-control border border-border text-foreground hover:bg-secondary transition-colors"
                  aria-label="Sevimlilar"
                >
                  <Heart
                    size={18}
                    className={isLiked ? "fill-(--danger-fg) text-(--danger-fg)" : "text-muted-foreground"}
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

          <div className="overflow-hidden rounded-card border border-border bg-card">
            <dl className="divide-y divide-border/60">
              {product.specs.map((spec, i) => (
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
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">{product.description}</p>
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
