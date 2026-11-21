"use client";
import { Input } from "@ventura/ui/input";
import { Textarea } from "@ventura/ui/textarea";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileQuestion,
  HardDrive,
  Headphones,
  Heart,
  HelpCircle,
  MemoryStick,
  Monitor,
  PackageCheck,
  Send,
  ShieldCheck,
  ShoppingCart,
  Star,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { CartDrawer } from "@/components/storefront/cart-drawer";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { type PcBuildCardData, PcCard } from "@/components/storefront/pc-card";
import { PriceView } from "@/components/storefront/price-view";
import { RatingStars } from "@/components/storefront/rating-stars";
import { SearchModal } from "@/components/storefront/search-modal";
import { useCart } from "@/lib/cart-context";
import { useLiked } from "@/lib/liked-context";
import { formatMoney } from "@/lib/format";
import type { PcBuildPublicItem, PcSpecItem } from "@/lib/pc-data";

interface PageProps {
  pc: PcBuildPublicItem;
  similarBuilds: PcBuildPublicItem[];
}

export default function ComputerDetailClient({ pc, similarBuilds }: PageProps) {
  const { addItem } = useCart();
  const { isLiked: checkIsLiked, toggleLike } = useLiked();
  const isLiked = checkIsLiked(pc.id);

  // Rasm galereyasi
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [zoomOrigin, setZoomOrigin] = useState("center");
  const [isZooming, setIsZooming] = useState(false);

  // Texnik xususiyat "?" modali
  const [activeHelpSpec, setActiveHelpSpec] = useState<PcSpecItem | null>(null);

  // Sharhlar holati
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewsList, setReviewsList] = useState([
    {
      id: "rev-1",
      name: "Bobur Mirzayev",
      rating: 5,
      date: "2026-10-24",
      comment:
        "Kompyuter ajoyib yig'ilgan! Kabel boshqaruvi (cable management) ideal, CS2 da barqaror 450 FPS ko'rsatmoqda. Judayam mamnunman.",
    },
    {
      id: "rev-2",
      name: "Javohir To'rayev",
      rating: 5,
      date: "2026-10-18",
      comment:
        "DeepCool 360mm sovutgich juda tinch ishlayapti, hatto render vaqtida ham harorat 68 darajadan oshmadi. Ventura jamoasiga rahmat!",
    },
  ]);

  const activeImage = pc.images[activeImageIndex] ?? pc.images[0] ?? "";
  const isAvailable = pc.status === "available";

  const originalPrice = pc.discountPercent > 0 ? (pc.sellPrice * 100n) / BigInt(100 - pc.discountPercent) : undefined;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${x}% ${y}%`);
  };

  const handleAddToCart = () => {
    addItem({
      productId: pc.id,
      name: pc.name,
      price: pc.sellPrice,
      originalPrice,
      imageUrl: pc.images[0] ?? "",
      colorName: "Asosiy konfiguratsiya",
    });
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    setReviewsList((prev) => [
      {
        id: `rev-${Date.now()}`,
        name: reviewName,
        rating: reviewRating,
        date: new Date().toISOString().split("T")[0] ?? "2026-10-29",
        comment: reviewComment,
      },
      ...prev,
    ]);

    setReviewName("");
    setReviewComment("");
    setReviewSubmitted(true);
  };

  // O'xshash kompyuterlar
  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* Breadcrumb navigatsiya */}
        <div className="border-b border-border bg-card/40 py-3 text-xs">
          <div className="mx-auto flex max-w-[var(--storefront-max-w,1320px)] items-center gap-2 px-4 sm:px-6 text-muted-foreground">
            <Link href="/" className="hover:text-primary transition-colors">
              Bosh sahifa
            </Link>
            <ChevronRight size={14} />
            <Link href="/computers" className="hover:text-primary transition-colors">
              Kompyuterlar
            </Link>
            <ChevronRight size={14} />
            <span className="truncate text-foreground font-medium">{pc.name}</span>
          </div>
        </div>

        {/* Asosiy tafsilotlar bo'limi */}
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Chap tomon: Galereya (5 ustun) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Katta asosiy rasm (zoom bilan) */}
              <div
                className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-card border border-border bg-media p-6 cursor-crosshair select-none"
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={handleMouseMove}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImage}
                  alt={pc.name}
                  className="max-h-full max-w-full object-contain transition-transform duration-200"
                  style={{
                    transform: isZooming ? "scale(1.35)" : "scale(1)",
                    transformOrigin: zoomOrigin,
                  }}
                />

                {/* Badge'lar */}
                <div className="absolute left-3 top-3 flex flex-col gap-1.5">
                  <Badge tone={isAvailable ? "success" : "danger"} className="font-semibold text-xs">
                    {isAvailable ? "Sotuvda mavjud" : "Sotilgan"}
                  </Badge>
                  {pc.discountPercent > 0 && (
                    <Badge tone="warning" className="font-bold text-xs">
                      -{pc.discountPercent}% CHEGIRMA
                    </Badge>
                  )}
                </div>

                <div className="absolute right-3 top-3">
                  <button
                    type="button"
                    onClick={() =>
                      toggleLike({
                        id: pc.id,
                        type: "pc",
                        name: pc.name,
                        slug: pc.slug,
                        imageUrl: pc.images[0] ?? "",
                        price: pc.sellPrice,
                        ratingAvg: pc.ratingAvg,
                        ratingCount: pc.ratingCount,
                        isAvailable,
                        specs: `${pc.cpu} / ${pc.gpu} / ${pc.ram}`,
                      })
                    }
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-card/90 shadow-card transition-transform hover:scale-110"
                    aria-label="Sevimlilar"
                  >
                    <Heart
                      size={18}
                      className={isLiked ? "fill-(--danger-fg) text-(--danger-fg)" : "text-muted-foreground"}
                    />
                  </button>
                </div>
              </div>

              {/* Thumbnails (Kichik rasmlar) */}
              {pc.images.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-1">
                  {pc.images.map((img, idx) => (
                    <button
                      key={img}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative flex h-20 w-24 shrink-0 items-center justify-center rounded-control border bg-media p-2 transition-all ${
                        activeImageIndex === idx
                          ? "border-primary ring-2 ring-primary/20 scale-102"
                          : "border-border hover:border-primary/50 opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`${pc.name} - ${idx + 1}`} className="max-h-full max-w-full object-contain" />
                    </button>
                  ))}
                </div>
              )}

              {/* Afzalliklar mini-bloklari */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="flex flex-col items-center justify-center rounded-control border border-border bg-card p-3 text-center">
                  <ShieldCheck size={22} className="text-primary mb-1" />
                  <span className="text-xs font-bold">{pc.warrantyMonths ?? 12} oy rasmiy kafolat</span>
                  <span className="text-caption text-muted-foreground">bepul texnik xizmat</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-control border border-border bg-card p-3 text-center">
                  <Truck size={22} className="text-primary mb-1" />
                  <span className="text-xs font-bold">Tezkor yetkazish</span>
                  <span className="text-caption text-muted-foreground">Oʻzbekiston boʻylab</span>
                </div>
                <div className="flex flex-col items-center justify-center rounded-control border border-border bg-card p-3 text-center">
                  <Zap size={22} className="text-primary mb-1" />
                  <span className="text-xs font-bold">24 soat stress-test</span>
                  <span className="text-caption text-muted-foreground">100% barqarorlik</span>
                </div>
              </div>
            </div>

            {/* O'ng tomon: Narx, Komponentlar va Xarid (7 ustun) */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              {/* 1. Sarlavha, Reyting va ID */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <RatingStars rating={pc.ratingAvg} count={pc.ratingCount} size="sm" />
                  <span className="text-xs font-mono text-muted-foreground">ID: {pc.id}</span>
                </div>

                {/* Sarlavha (Kichikroq va toza) */}
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{pc.name}</h1>

                {pc.description && (
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{pc.description}</p>
                )}
              </div>

              {/* 2. Narx va Tezkor Xarid kartasi */}
              <div className="rounded-card border border-border bg-card p-3.5 sm:p-4 shadow-control">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-caption uppercase tracking-wider text-muted-foreground font-bold block">
                      Umumiy narx:
                    </span>
                    <PriceView
                      price={pc.sellPrice}
                      originalPrice={originalPrice}
                      discountPercent={pc.discountPercent}
                      size="md"
                      className="mt-0.5"
                    />
                  </div>

                  {/* Amallar */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="primary"
                      size="default"
                      disabled={!isAvailable}
                      onClick={handleAddToCart}
                      className="gap-2 font-bold text-xs sm:text-sm px-4 py-2.5 shadow-control"
                    >
                      <ShoppingCart size={16} />
                      Hozir sotib olish
                    </Button>

                    <Link
                      href={`https://t.me/venturapc_operator?text=Assalomu alaykum, men "${encodeURIComponent(
                        pc.name,
                      )}" kompyuteri boʻyicha maʼlumot olmoqchiman.`}
                      target="_blank"
                    >
                      <Button variant="ghost" size="default" className="gap-1.5 text-xs font-semibold px-3 py-2.5">
                        <Headphones size={15} />
                        Mutaxassis
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* 3. Yigʻilgan komponentlar roʻyxati (Rasm yonida o'ng tomonda chiqadi) */}
              <div className="rounded-card border border-border bg-card p-4 shadow-control">
                <div className="flex items-center justify-between border-b border-border pb-2.5 mb-2.5">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
                    <PackageCheck size={18} className="text-primary" />
                    Yigʻilgan komponentlar roʻyxati ({pc.components.length} ta)
                  </h3>
                  <span className="text-caption text-(--success-fg) font-semibold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    Barchasi sinovdan oʻtgan
                  </span>
                </div>

                <div className="divide-y divide-border/60 text-xs">
                  {pc.components.map((c) => (
                    <div
                      key={c.role + c.productId}
                      className="flex items-center justify-between py-2 transition-colors hover:bg-secondary/40 px-1 rounded-control"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="rounded bg-muted px-2 py-0.5 text-2xs font-bold text-muted-foreground uppercase shrink-0 min-w-19 text-center border border-border/50">
                          {c.roleNameUz}
                        </span>
                        <span className="font-semibold text-foreground truncate">{c.productName}</span>
                      </div>
                      <span className="font-mono text-caption text-muted-foreground shrink-0 ml-1">{c.qty} dona</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Texnik xususiyatlar ("?" modal bilan) */}
          <section className="mt-14 pt-8 border-t border-border">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold sm:text-2xl">Batafsil texnik xususiyatlar</h2>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Savollaringiz boʻlsa, xususiyat yonidagi "?" belgisini bosing
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pc.specs.map((spec) => (
                <div
                  key={spec.key}
                  className="flex items-center justify-between rounded-control border border-border bg-card p-3.5 text-xs sm:text-sm transition-colors hover:border-primary/40"
                >
                  <span className="text-muted-foreground font-medium">{spec.title}</span>
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <span className="text-right">{spec.value}</span>
                    {spec.helpText && (
                      <button
                        type="button"
                        onClick={() => setActiveHelpSpec(spec)}
                        aria-label={`${spec.title} haqida tushuntirish`}
                        className="text-primary hover:text-primary/80 transition-transform hover:scale-110"
                      >
                        <HelpCircle size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Sharhlar bo'limi */}
          <section className="mt-14 pt-8 border-t border-border">
            <h2 className="text-xl font-bold sm:text-2xl mb-6">Mijozlar sharhlari</h2>

            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              {/* Chap: Sharh qoldirish formasi */}
              <div className="lg:col-span-5 rounded-card border border-border bg-card p-5">
                <h3 className="font-bold text-base mb-1">Sharh qoldirish</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Ushbu kompyuter egasisiz va taassurotlaringiz bilan boʻlishmoqchimisiz?
                </p>

                {reviewSubmitted ? (
                  <div className="rounded-control bg-(--success-bg) border border-(--success-border) p-4 text-center">
                    <CheckCircle2 size={32} className="text-(--success-fg) mx-auto mb-2" />
                    <p className="text-sm font-bold text-(--success-fg)">Sharhingiz qabul qilindi!</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fikringiz boshqa xaridorlar uchun juda muhim. Rahmat!
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Ismingiz
                      </label>
                      <Input
                        type="text"
                        required
                        value={reviewName}
                        onChange={(e) => setReviewName(e.target.value)}
                        placeholder="Masalan: Jamshid"
                        className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Baho (1-5 yulduz)
                      </label>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="p-1 hover:scale-110 transition-transform"
                          >
                            <Star
                              size={20}
                              className={
                                star <= reviewRating ? "fill-rating-star text-rating-star" : "text-muted-foreground/40"
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                        Fikringiz
                      </label>
                      <Textarea
                        rows={3}
                        required
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="Kompyuterning ishlashi, oʻyinlardagi FPS va harorati qanday?"
                        className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none resize-none"
                      />
                    </div>

                    <Button type="submit" variant="primary" size="sm" className="w-full gap-2">
                      <Send size={14} />
                      Sharhni yuborish
                    </Button>
                  </form>
                )}
              </div>

              {/* O'ng: Sharhlar ro'yxati */}
              <div className="lg:col-span-7 space-y-4">
                {reviewsList.map((rev) => (
                  <div key={rev.id} className="rounded-card border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {rev.name.charAt(0)}
                        </div>
                        <span className="font-bold text-sm">{rev.name}</span>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">{rev.date}</span>
                    </div>

                    <div className="mb-2">
                      <RatingStars rating={rev.rating} count={0} size="sm" />
                    </div>

                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{rev.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* O'xshash kompyuterlar karuseli */}
          {similarBuilds.length > 0 && (
            <section className="mt-14 pt-8 border-t border-border">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold sm:text-2xl">Boshqa tayyor variantlar</h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Sizga mos kelishi mumkin boʻlgan alternativ konfiguratsiyalar
                  </p>
                </div>
                <Link href="/computers" className="text-xs sm:text-sm font-semibold text-primary hover:underline">
                  Barchasini koʻrish →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {similarBuilds.map((b) => {
                  const cardData: PcBuildCardData = {
                    id: b.id,
                    slug: b.slug,
                    name: b.name,
                    imageUrl: b.images[0] ?? "",
                    cpu: b.cpu,
                    gpu: b.gpu,
                    ram: b.ram,
                    storage: b.storage,
                    price: b.sellPrice,
                    originalPrice:
                      b.discountPercent > 0 ? (b.sellPrice * 100n) / BigInt(100 - b.discountPercent) : undefined,
                    discountPercent: b.discountPercent,
                    ratingAvg: b.ratingAvg,
                    ratingCount: b.ratingCount,
                    isAvailable: b.status === "available",
                  };
                  return <PcCard key={b.id} pc={cardData} />;
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Texnik xususiyat "?" modali */}
      <Modal
        open={Boolean(activeHelpSpec)}
        onOpenChange={(open) => !open && setActiveHelpSpec(null)}
        title={activeHelpSpec?.helpTitle ?? activeHelpSpec?.title ?? "Texnik maʼlumot"}
        footer={
          <Button variant="primary" size="sm" onClick={() => setActiveHelpSpec(null)}>
            Tushunarli
          </Button>
        }
      >
        <div className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-control bg-primary/10 border border-primary/20 p-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Joriy parametr:</span>
            <p className="text-sm font-bold text-foreground mt-0.5">{activeHelpSpec?.value}</p>
          </div>
          <p className="leading-relaxed text-foreground">
            {activeHelpSpec?.helpText ??
              "Ushbu xususiyat kompyuterning yuqori unumdorligi va barqaror ishlashini taʼminlaydi."}
          </p>
        </div>
      </Modal>

      {/* Savatcha modali (Drawer) */}
      <CartDrawer />

      {/* Ctrl+K Qidiruv Modali */}
      <SearchModal />

      <Footer />
    </div>
  );
}
