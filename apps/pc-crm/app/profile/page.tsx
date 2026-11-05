"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Heart,
  MapPin,
  Package,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/lib/auth-client";
import { useLiked } from "@/lib/liked-context";
import { getMyOrdersAction } from "@/lib/server/actions";

interface LatestOrderItem {
  id: string;
  publicId: string;
  status: string;
  total: bigint | string;
  address: string;
  region: string;
  createdAt: string;
  items: {
    name: string;
    qty: number;
    price: bigint | string;
  }[];
}

export default function ProfileOverviewPage() {
  const { data: session, isPending } = useSession();
  const { likedCount } = useLiked();

  const [ordersCount, setOrdersCount] = useState<number | null>(null);
  const [spentTotal, setSpentTotal] = useState<bigint | null>(null);
  const [latestOrder, setLatestOrder] = useState<LatestOrderItem | null>(null);
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      setOrdersCount(0);
      setSpentTotal(0n);
      setLatestOrder(null);
      setLoadingOrders(false);
      return;
    }

    let isMounted = true;
    setLoadingOrders(true);

    getMyOrdersAction()
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.orders) {
          setOrdersCount(res.orders.length);
          const sum = res.orders.reduce((acc, o) => acc + BigInt(o.total), 0n);
          setSpentTotal(sum);
          if (res.orders.length > 0) {
            setLatestOrder(res.orders[0] as unknown as LatestOrderItem);
          } else {
            setLatestOrder(null);
          }
        } else {
          setOrdersCount(0);
          setSpentTotal(0n);
          setLatestOrder(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOrdersCount(0);
          setSpentTotal(0n);
          setLatestOrder(null);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingOrders(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session, isPending]);

  const displayName = session?.user?.name ? session.user.name.split(" ")[0] : "Foydalanuvchi";
  const displayOrdersCount = ordersCount ?? 0;
  const displaySpentTotal = spentTotal ?? 0n;
  const isPageLoading = isPending || (loadingOrders && !!session?.user);

  return (
    <div className="space-y-6">
      {/* Xush kelibsiz banneri */}
      <div className="rounded-card border border-border bg-card p-6 shadow-control">
        {isPending ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-7 w-48 bg-muted rounded" />
            <div className="h-4 w-96 max-w-full bg-muted rounded" />
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-black tracking-tight">Xush kelibsiz, {displayName}!</h1>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Bu yerda siz barcha buyurtmalaringiz holatini kuzatishingiz, sevimli mahsulotlaringizni koʻrishingiz va hisob sozlamalarini boshqarishingiz mumkin.
            </p>
          </>
        )}
      </div>

      {/* 4 ta Statistik karta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Buyurtmalar */}
        <Link
          href="/profile/orders"
          className="rounded-card border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-control"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Jami buyurtmalar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            {isPageLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <span className="text-2xl font-black">{displayOrdersCount} ta</span>
            )}
            <Package size={20} className="text-primary" />
          </div>
          <span className="text-caption text-muted-foreground font-semibold mt-1 block">
            {displayOrdersCount > 0 ? `${displayOrdersCount} ta xarid qayd etilgan` : "Hozircha buyurtma yoʻq"}
          </span>
        </Link>

        {/* PC Zakazlari */}
        <Link
          href="/profile/orders?tab=custom_pc"
          className="rounded-card border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-control"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            PC Zakazlari
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            {isPageLoading ? (
              <div className="h-8 w-16 bg-muted rounded animate-pulse" />
            ) : (
              <span className="text-2xl font-black">0 ta</span>
            )}
            <Wrench size={20} className="text-primary" />
          </div>
          <span className="text-caption text-muted-foreground font-semibold mt-1 block">
            Shaxsiy yigʻilgan kompyuterlar
          </span>
        </Link>

        {/* Saralanganlar */}
        <Link
          href="/profile/liked"
          className="rounded-card border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-control"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Saralanganlar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{likedCount} ta</span>
            <Heart size={20} className="text-(--danger-fg)" />
          </div>
          <span className="text-caption text-muted-foreground mt-1 block">
            Yoqtirilgan texnikalar
          </span>
        </Link>

        {/* Xaridlar summasi */}
        <div className="rounded-card border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Xaridlar summasi
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            {isPageLoading ? (
              <div className="h-7 w-28 bg-muted rounded animate-pulse" />
            ) : (
              <span className="text-lg font-black font-mono text-foreground truncate">
                {formatMoney(displaySpentTotal)}
              </span>
            )}
            <ShieldCheck size={20} className="text-(--success-fg) shrink-0 ml-1" />
          </div>
          <span className="text-caption text-muted-foreground mt-1 block">
            {displaySpentTotal > 0n ? "Muvaffaqiyatli xaridlar" : "Hozircha xaridlar yoʻq"}
          </span>
        </div>
      </div>

      {/* So'nggi faol buyurtma bloki */}
      <div className="rounded-card border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <h2 className="font-bold text-base">Soʻnggi buyurtma</h2>
          </div>
          <Link
            href="/profile/orders"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Barcha buyurtmalar
            <ArrowRight size={13} />
          </Link>
        </div>

        {isPageLoading ? (
          <div className="rounded-control border border-border bg-muted/20 p-5 space-y-3 animate-pulse">
            <div className="h-5 w-40 bg-muted rounded" />
            <div className="h-4 w-3/4 bg-muted rounded" />
            <div className="h-4 w-1/2 bg-muted rounded" />
          </div>
        ) : latestOrder ? (
          <div className="rounded-control border border-border bg-muted/30 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm">{latestOrder.publicId}</span>
                  <Badge
                    tone={
                      latestOrder.status === "delivered"
                        ? "success"
                        : latestOrder.status === "new"
                        ? "info"
                        : "warning"
                    }
                  >
                    {latestOrder.status === "delivered"
                      ? "Yetkazib berildi"
                      : latestOrder.status === "confirmed"
                      ? "Tasdiqlandi"
                      : latestOrder.status === "shipping"
                      ? "Yetkazilmoqda (Kuryerda)"
                      : "Qabul qilindi"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground mt-0.5 block">
                  Buyurtma sanasi: {latestOrder.createdAt.split("T")[0]}
                </span>
              </div>

              <div className="text-left sm:text-right">
                <span className="text-caption text-muted-foreground block">Umumiy summa:</span>
                <span className="font-mono font-black text-base text-foreground">
                  {formatMoney(BigInt(latestOrder.total))}
                </span>
              </div>
            </div>

            <div className="pt-3 text-xs space-y-1">
              <p className="font-semibold text-foreground">
                {latestOrder.items.map((it) => `${it.name} (${it.qty} dona)`).join(", ")}
              </p>
              <p className="text-muted-foreground flex items-center gap-1">
                <MapPin size={13} />
                Manzil: {latestOrder.region ? `${latestOrder.region}, ` : ""}{latestOrder.address || "Koʻrsatilmagan"}
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-control border border-dashed border-border bg-muted/10 p-8 text-center">
            <Package size={36} className="text-muted-foreground/30 mx-auto mb-2" />
            <h3 className="font-bold text-sm text-foreground">Hozircha faol buyurtmalaringiz mavjud emas</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Mahsulotlar yoki tayyor kompyuterlar katalogidan oʻzingizga mos texnikalarni tanlab xarid qilishingiz mumkin.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link href="/products">
                <Button variant="primary" size="sm" className="text-xs">
                  Mahsulotlar katalogi
                </Button>
              </Link>
              <Link href="/computers">
                <Button variant="ghost" size="sm" className="text-xs">
                  Tayyor kompyuterlar
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Tezkor tavsiyalar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-card border border-primary/20 bg-primary/5 p-5">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Wrench size={16} className="text-primary" />
            PC Konfigurator
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Barcha ehtiyot qismlarni oʻzingiz tanlab yangi shaxsiy kompyuter yigʻing.
          </p>
          <Link href="/computers/custom" className="mt-3 inline-block">
            <Button variant="primary" size="sm" className="text-xs">
              Konfiguratorga oʻtish
            </Button>
          </Link>
        </div>

        <div className="rounded-card border border-border bg-card p-5">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MapPin size={16} className="text-primary" />
            Yetkazib berish manzillari
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Buyurtma berishda vaqt tejash uchun uyingiz yoki ofisingiz manzilini kiritib qoʻying.
          </p>
          <Link href="/profile/settings" className="mt-3 inline-block">
            <Button variant="ghost" size="sm" className="text-xs">
              Sozlamalarga oʻtish
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}