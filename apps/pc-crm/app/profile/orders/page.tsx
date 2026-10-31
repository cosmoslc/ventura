"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/lib/auth-client";
import { getMyOrdersAction } from "@/lib/server/actions";

interface OrderItem {
  id: string;
  orderNumber: string;
  date: string;
  status: "shipping" | "delivered" | "assembling" | "reviewing" | "new";
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

interface CustomPcOrderItem {
  id: string;
  orderNumber: string;
  date: string;
  statusLabel: string;
  statusTone: "info" | "warning" | "success" | "neutral";
  total: bigint;
  summary: string;
  note?: string;
}

export default function ProfileOrdersPage() {
  const { data: session, isPending } = useSession();
  const [activeTab, setActiveTab] = useState<"in_progress" | "delivered" | "custom_pc">("in_progress");
  const [userOrders, setUserOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sharh qoldirish modali
  const [reviewingProduct, setReviewingProduct] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setUserOrders([]);
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    getMyOrdersAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.orders) {
          const mapped: OrderItem[] = res.orders.map((o) => {
            const isDelivered = o.status === "delivered";
            return {
              id: o.id,
              orderNumber: o.publicId,
              date: o.createdAt.split("T")[0] ?? "2026-10-31",
              status: (isDelivered ? "delivered" : "shipping") as any,
              statusLabel:
                o.status === "delivered"
                  ? "Yetkazib berildi"
                  : o.status === "confirmed"
                  ? "Tasdiqlandi"
                  : o.status === "shipping"
                  ? "Yetkazilmoqda (Kuryerda)"
                  : "Qabul qilindi",
              statusTone: (isDelivered ? "success" : o.status === "new" ? "info" : "warning") as any,
              total: BigInt(o.total),
              address: o.address ? `${o.region ? `${o.region}, ` : ""}${o.address}` : "Toshkent shahri",
              products: o.items.map((it) => ({
                name: it.name,
                qty: it.qty,
                price: BigInt(it.price),
                imageUrl:
                  (it as any).imageUrl ||
                  "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=300&auto=format&fit=crop&q=80",
                canReview: isDelivered,
              })),
            };
          });
          setUserOrders(mapped);
        } else {
          setUserOrders([]);
        }
      })
      .catch(() => {
        if (isMounted) setUserOrders([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session, isPending]);

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSuccess(true);
    setTimeout(() => {
      setReviewSuccess(false);
      setReviewingProduct(null);
      setComment("");
    }, 2000);
  };

  const inProgressOrders = userOrders.filter((o) => o.status !== "delivered");
  const deliveredOrders = userOrders.filter((o) => o.status === "delivered");
  const customPcOrders: CustomPcOrderItem[] = [];

  const isPageLoading = isPending || (loading && !!session?.user);

  return (
    <div className="space-y-6">
      {/* Sarlavha va Tablar */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
        <h1 className="text-2xl font-black tracking-tight">Mening buyurtmalarim</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Barcha onlayn xaridlaringiz holati, yetkazib berish jarayoni va toʻlovlar
        </p>

        {/* Tab tugmalari */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
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
            Jarayonda ({isPageLoading ? "..." : inProgressOrders.length})
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
            <Truck size={16} />
            Yetkazib berilgan ({isPageLoading ? "..." : deliveredOrders.length})
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
            PC Zakazlarim ({isPageLoading ? "..." : customPcOrders.length})
          </button>
        </div>
      </div>

      {/* Yuklanish skeleti */}
      {isPageLoading ? (
        <div className="space-y-4 animate-pulse">
          <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-5 w-24 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-4 py-2">
              <div className="h-14 w-14 rounded-lg bg-muted shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>

          <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 space-y-3">
            <div className="flex justify-between items-center pb-3 border-b border-border">
              <div className="h-5 w-32 bg-muted rounded" />
              <div className="h-5 w-24 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-4 py-2">
              <div className="h-14 w-14 rounded-lg bg-muted shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* 1. Jarayondagi buyurtmalar */}
      {!isPageLoading && activeTab === "in_progress" && (
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

      {/* 2. Yetkazilgan buyurtmalar */}
      {!isPageLoading && activeTab === "delivered" && (
        <div className="space-y-4">
          {deliveredOrders.length === 0 ? (
            <div className="rounded-[var(--r-card,12px)] border border-dashed border-border bg-card p-10 text-center">
              <CheckCircle2 size={40} className="text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="font-bold text-base">Yetkazilgan buyurtmalar yoʻq</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Yetkazib berilgan barcha buyurtmalar shu yerda saqlanadi.
              </p>
            </div>
          ) : (
            deliveredOrders.map((ord) => (
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
                      Yetkazilgan sana: {ord.date}
                    </span>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-xs text-muted-foreground block">Umumiy toʻlov:</span>
                    <span className="font-mono font-bold text-base text-foreground">
                      {formatMoney(ord.total)}
                    </span>
                  </div>
                </div>

                {/* Mahsulotlar */}
                <div className="space-y-3">
                  {ord.products.map((p, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                        </div>
                        <div className="min-w-0 flex-1">
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
                          className="text-xs font-semibold gap-1.5 self-end sm:self-center"
                        >
                          <Star size={13} className="text-amber-500 fill-amber-500" />
                          Sharh qoldirish
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. PC Zakazlarim (Konfigurator) */}
      {!isPageLoading && activeTab === "custom_pc" && (
        <div className="space-y-4">
          {customPcOrders.length === 0 ? (
            <div className="rounded-[var(--r-card,12px)] border border-dashed border-border bg-card p-10 text-center">
              <Wrench size={40} className="text-muted-foreground/40 mx-auto mb-2" />
              <h3 className="font-bold text-base">Hozircha shaxsiy yigʻilgan kompyuter buyurtmalari yoʻq</h3>
              <p className="text-xs text-muted-foreground mt-1">
                PC Konfigurator orqali oʻzingiz istagan qismlarni tanlab yangi kompyuter buyurtma qilishingiz mumkin.
              </p>
              <Link href="/computers/custom" className="mt-4 inline-block">
                <Button variant="primary" size="sm">
                  PC Konfiguratorga oʻtish
                </Button>
              </Link>
            </div>
          ) : (
            customPcOrders.map((pco) => (
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
            ))
          )}
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