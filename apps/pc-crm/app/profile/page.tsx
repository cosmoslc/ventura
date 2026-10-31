"use client";

import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Heart,
  MapPin,
  Monitor,
  Package,
  ShieldCheck,
  ShoppingBag,
  Wrench,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { formatMoney } from "@/lib/format";
import { useSession } from "@/lib/auth-client";

export default function ProfileOverviewPage() {
  const { data: session } = useSession();
  const displayName = session?.user?.name ? session.user.name.split(" ")[0] : "Sardorbek";

  return (
    <div className="space-y-6">
      {/* Xush kelibsiz banneri */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-6 shadow-xs">
        <h1 className="text-2xl font-black tracking-tight">Xush kelibsiz, {displayName}!</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Bu yerda siz barcha buyurtmalaringiz holatini kuzatishingiz, sevimli mahsulotlaringizni koʻrishingiz va yetkazib berish manzillarini boshqarishingiz mumkin.
        </p>
      </div>

      {/* 4 ta Statistik karta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link
          href="/profile/orders"
          className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Jami buyurtmalar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">4 ta</span>
            <Package size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 block">
            3 ta yetkazildi, 1 ta faol
          </span>
        </Link>

        <Link
          href="/profile/orders?tab=pcs"
          className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            PC Zakazlari
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">1 ta</span>
            <Wrench size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-amber-500 font-semibold mt-1 block">
            Yigʻilish jarayonida
          </span>
        </Link>

        <Link
          href="/profile/liked"
          className="rounded-[var(--r-card,12px)] border border-border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-xs"
        >
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Saralanganlar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">3 ta</span>
            <Heart size={20} className="text-rose-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Yoqtirilgan texnikalar
          </span>
        </Link>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Xaridlar summasi
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-lg font-black font-mono text-foreground truncate">
              {formatMoney(28_950_000n)}
            </span>
            <ShieldCheck size={20} className="text-emerald-500 shrink-0 ml-1" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Doimiy mijoz (Silver)
          </span>
        </div>
      </div>

      {/* So'nggi faol buyurtma bloki */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            <h2 className="font-bold text-base">Soʻnggi faol buyurtma</h2>
          </div>
          <Link
            href="/profile/orders"
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            Barcha buyurtmalar
            <ArrowRight size={13} />
          </Link>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm">ORD-2026-042</span>
                <Badge tone="warning">Yetkazilmoqda (Kuryer yoʻlda)</Badge>
              </div>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                Buyurtma sanasi: 2026-10-28 16:45
              </span>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[11px] text-muted-foreground block">Umumiy summa:</span>
              <span className="font-mono font-black text-base text-foreground">
                {formatMoney(24_800_000n)}
              </span>
            </div>
          </div>

          <div className="pt-3 text-xs space-y-1">
            <p className="font-semibold text-foreground">
              Ventura Gaming Titan: Core i7-14700K / RTX 4070 Ti Super (1 dona)
            </p>
            <p className="text-muted-foreground flex items-center gap-1">
              <MapPin size={13} />
              Manzil: Toshkent sh., Chilonzor tumani, 9-mavze, 14-uy
            </p>
          </div>
        </div>
      </div>

      {/* Tezkor tavsiyalar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-[var(--r-card,12px)] border border-primary/20 bg-primary/5 p-5">
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

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5">
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
