"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  Send,
  Star,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/format";

interface OrderItem {
  id: string;
  orderNumber: string;
  date: string;
  status: "shipping" | "delivered" | "assembling" | "reviewing";
  statusLabel: string;
  statusTone: "info" | "warning" | "success" | "neutral";
  total: bigint;
  address: string;
  products: {
    name: string;
    qty: number;
    price: bigint;
    imageUrl: string;
    canReview?: boolean;
  }[];
}

const SAMPLE_USER_ORDERS: OrderItem[] = [
  {
    id: "ord-1",
    orderNumber: "ORD-2026-042",
    date: "2026-10-28",
    status: "shipping",
    statusLabel: "Yetkazilmoqda (Kuryerda)",
    statusTone: "warning",
    total: 24_800_000n,
    address: "Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy",
    products: [
      {
        name: "Ventura Gaming Titan: Core i7-14700K / RTX 4070 Ti Super",
        qty: 1,
        price: 24_800_000n,
        imageUrl: "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
      },
    ],
  },
  {
    id: "ord-2",
    orderNumber: "ORD-2026-031",
    date: "2026-10-15",
    status: "delivered",
    statusLabel: "Yetkazib berildi",
    statusTone: "success",
    total: 2_600_000n,
    address: "Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy",
    products: [
      {
        name: "Samsung 990 PRO 2TB PCIe 4.0 NVMe M.2 SSD",
        qty: 1,
        price: 2_600_000n,
        imageUrl: "https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&auto=format&fit=crop&q=80",
        canReview: true,
      },
    ],
  },
  {
    id: "ord-3",
    orderNumber: "ORD-2026-019",
    date: "2026-09-20",
    status: "delivered",
    statusLabel: "Yetkazib berildi",
    statusTone: "success",
    total: 1_750_000n,
    address: "Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy",
    products: [
      {
        name: "Kingston FURY Beast RGB 32GB (2x16GB) DDR5 6000MHz",
        qty: 1,
        price: 1_750_000n,
        imageUrl: "https://images.unsplash.com/photo-1541029071515-84cc54f84dc5?w=300&auto=format&fit=crop&q=80",
        canReview: true,
      },
    ],
  },
];

const SAMPLE_USER_PC_ORDERS = [
  {
    id: "pco-101",
    orderNumber: "PCO-2026-089",
    date: "2026-10-29",
    statusLabel: "Operator koʻrib chiqmoqda",
    statusTone: "info" as const,
    total: 18_500_000n,
    summary: "Core i7-14700K / Z790 / RTX 4070 Super / 32GB DDR5 / 1TB 990 Pro / 850W Gold / 360mm AIO",
    note: "Operativ xotira RGB boʻlsin, montaj uchun qulay va sovutish yaxshi boʻlsin.",
  },
];

export default function ProfileOrdersPage() {
  const [activeTab, setActiveTab] = useState<"in_progress" | "delivered" | "custom_pc">("in_progress");

  // Sharh qoldirish modali
  const [reviewingProduct, setReviewingProduct] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const inProgressOrders = SAMPLE_USER_ORDERS.filter((o) => o.status === "shipping");
  const deliveredOrders = SAMPLE_USER_ORDERS.filter((o) => o.status === "delivered");

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;

    setReviewSuccess(true);
    setTimeout(() => {
      setReviewingProduct(null);
      setReviewSuccess(false);
      setComment("");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha va Tablar */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
        <h1 className="text-2xl font-black tracking-tight">Mening buyurtmalarim</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Barcha sayt buyurtmalaringiz va shaxsiy konfigurator zakazlaringiz roʻyxati
        </p>

        {/* Tab tugmalari */}
        <div className="mt-5 flex flex-wrap gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("in_progress")}
            className={`flex items-center gap-2 rounded-[var(--r-btn,8px)] px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "in_progress"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Clock size={16} />
            Jarayonda ({inProgressOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivered")}
            className={`flex items-center gap-2 rounded-[var(--r-btn,8px)] px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "delivered"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <CheckCircle2 size={16} />
            Yetkazib berilgan ({deliveredOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("custom_pc")}
            className={`flex items-center gap-2 rounded-[var(--r-btn,8px)] px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "custom_pc"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <Wrench size={16} />
            PC Zakazlarim ({SAMPLE_USER_PC_ORDERS.length})
          </button>
        </div>
      </div>

      {/* 1. Jarayondagi buyurtmalar */}
      {activeTab === "in_progress" && (
        <div className="space-y-4">
          {inProgressOrders.length === 0 ? (
            <div className="rounded-[var(--r-card,12px)] border border-dashed border-border bg-card p-10 text-center">
              <Package size={40} className="text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="font-bold text-base">Hozirda faol buyurtmalaringiz yoʻq</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Katalogdan oʻzingizga yoqqan mahsulotlarni tanlang.
              </p>
              <Link href="/products" className="mt-4 inline-block">
                <Button variant="primary" size="sm">
                  Mahsulotlar katalogi
                </Button>
              </Link>
            </div>
          ) : (
            inProgressOrders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{ord.orderNumber}</span>
                      <Badge tone={ord.statusTone}>{ord.statusLabel}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono mt-0.5 block">
                      Sana: {ord.date}
                    </span>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-muted-foreground block">Umumiy summa:</span>
                    <span className="font-mono font-bold text-base text-foreground">
                      {formatMoney(ord.total)}
                    </span>
                  </div>
                </div>

                {/* Mahsulotlar */}
                <div className="space-y-3">
                  {ord.products.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">{p.name}</h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.qty} dona × {formatMoney(p.price)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground gap-2">
                  <span className="flex items-center gap-1">
                    <MapPin size={13} />
                    {ord.address}
                  </span>

                  <Link
                    href="https://t.me/venturapc_operator"
                    target="_blank"
                    className="inline-flex items-center gap-1.5 font-bold text-primary hover:underline"
                  >
                    <Headphones size={13} />
                    Kuryer/Operator bilan bogʻlanish
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 2. Yetkazib berilgan buyurtmalar */}
      {activeTab === "delivered" && (
        <div className="space-y-4">
          {deliveredOrders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{ord.orderNumber}</span>
                    <Badge tone="success">Yetkazib berilgan</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono mt-0.5 block">
                    Yetkazilgan sana: {ord.date}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-muted-foreground block">Toʻlangan summa:</span>
                  <span className="font-mono font-bold text-base text-foreground">
                    {formatMoney(ord.total)}
                  </span>
                </div>
              </div>

              {/* Mahsulotlar va Sharh qoldirish tugmasi */}
              <div className="space-y-3">
                {ord.products.map((p, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">{p.name}</h4>
                        <span className="text-xs text-muted-foreground font-mono">
                          {p.qty} dona × {formatMoney(p.price)}
                        </span>
                      </div>
                    </div>

                    {p.canReview && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReviewingProduct(p.name)}
                        className="gap-1.5 text-xs text-primary hover:bg-primary/10 self-start sm:self-auto"
                      >
                        <Star size={13} />
                        Sharh qoldirish
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. PC Zakazlarim (Konfigurator) */}
      {activeTab === "custom_pc" && (
        <div className="space-y-4">
          {SAMPLE_USER_PC_ORDERS.map((pco) => (
            <div
              key={pco.id}
              className="rounded-[var(--r-card,12px)] border border-primary/20 bg-card p-5 space-y-4 shadow-xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-primary">{pco.orderNumber}</span>
                    <Badge tone={pco.statusTone}>{pco.statusLabel}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono mt-0.5 block">
                    Yuborilgan sana: {pco.date}
                  </span>
                </div>

                <div className="text-left sm:text-right">
                  <span className="text-xs text-muted-foreground block">Kelishilgan narx:</span>
                  <span className="font-mono font-bold text-base text-foreground">
                    {formatMoney(pco.total)}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-2">
                <div>
                  <span className="font-bold uppercase tracking-wider text-muted-foreground text-[10px] block">
                    Konfiguratsiya tarkibi:
                  </span>
                  <p className="font-medium text-foreground mt-0.5">{pco.summary}</p>
                </div>
                {pco.note && (
                  <div>
                    <span className="font-bold text-primary text-[10px] uppercase block">
                      Sizning istaklaringiz:
                    </span>
                    <p className="text-muted-foreground mt-0.5">{pco.note}</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Link
                  href={`https://t.me/venturapc_operator?text=${encodeURIComponent(
                    `Assalomu alaykum! Men shaxsiy PC zakazim (${pco.orderNumber}) boʻyicha maʼlumot olmoqchi edim.`
                  )}`}
                  target="_blank"
                >
                  <Button variant="primary" size="sm" className="gap-2 text-xs font-bold">
                    <MessageCircle size={14} />
                    Operator bilan Telegramda bogʻlanish
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Sharh qoldirish modali */}
      <Modal
        open={Boolean(reviewingProduct)}
        onOpenChange={(open) => !open && setReviewingProduct(null)}
        title="Mahsulotga sharh qoldirish"
      >
        {reviewSuccess ? (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 size={40} className="text-emerald-500 mx-auto" />
            <h3 className="font-bold text-base">Sharhingiz qabul qilindi!</h3>
            <p className="text-xs text-muted-foreground">Katta rahmat! Fikringiz xaridorni toʻgʻri tanlov qilishiga yordam beradi.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmitReview} className="space-y-4 text-xs sm:text-sm">
            <div className="rounded-lg bg-muted/60 p-3">
              <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">
                Mahsulot:
              </span>
              <p className="font-bold text-foreground mt-0.5">{reviewingProduct}</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Baholang (1 dan 5 gacha)
              </label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      size={24}
                      className={s <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Fikringiz va taassurotlaringiz *
              </label>
              <textarea
                rows={3}
                required
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Mahsulotning sifati, ishlashi va yetkazib berish xizmati qanday boʻldi?"
                className="w-full rounded-[var(--r-input,8px)] border border-input bg-background p-2.5 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setReviewingProduct(null)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" variant="primary" size="sm" className="gap-2">
                <Send size={14} />
                Sharhni yuborish
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
