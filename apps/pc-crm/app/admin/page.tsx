import Link from "next/link";
import {
  Boxes,
  Cpu,
  DollarSign,
  PackagePlus,
  Plus,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Truck,
  Users,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { StatCard } from "@ventura/ui/stat-card";
import { formatMoney } from "@/lib/format";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      {/* 1. Sarlavha va tezkor harakatlar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Boshqaruv paneli
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Ombor holati, kirimlar, sotuvlar va doʻkon statistikasi
          </p>
        </div>

        {/* Tezkor amallar tugmalari */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/products?action=new">
            <Button variant="primary" size="sm" className="gap-1.5 font-bold text-xs">
              <Plus size={14} />
              Yangi mahsulot
            </Button>
          </Link>

          <Link href="/admin/purchases?action=new">
            <Button variant="ghost" size="sm" className="gap-1.5 font-semibold text-xs">
              <PackagePlus size={14} />
              Kirim qilish
            </Button>
          </Link>

          <Link href="/admin/sales?action=new">
            <Button variant="ghost" size="sm" className="gap-1.5 font-semibold text-xs">
              <Receipt size={14} />
              Oflayn sotuv
            </Button>
          </Link>

          <Link href="/admin/pcs?action=new">
            <Button variant="ghost" size="sm" className="gap-1.5 font-semibold text-xs">
              <Cpu size={14} />
              PC yigʻish
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Asosiy statistika kartalari (StatCard) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<DollarSign />}
          label="Jami tushum"
          value={formatMoney(48_500_000n)}
          tone={1}
          trend={{ value: "+14.2%", up: true }}
          hint="Joriy oy davomida"
        />

        <StatCard
          icon={<TrendingUp />}
          label="Sof daromad (Foyda)"
          value={formatMoney(9_850_000n)}
          tone={2}
          trend={{ value: "20.3% marja", up: true }}
          hint="Tannarx snapshot boʻyicha"
        />

        <StatCard
          icon={<Boxes />}
          label="Ombor tannarx qiymati"
          value={formatMoney(112_000_000n)}
          tone={3}
          hint="64 xil mahsulot qoldigʻi"
        />

        <StatCard
          icon={<ShoppingCart />}
          label="Yangi buyurtmalar"
          value="8 ta"
          tone={4}
          trend={{ value: "3 ta kutilmoqda", up: true }}
          hint="Sayt va konfigurator zakazlari"
        />
      </div>

      {/* 3. So'nggi buyurtmalar va so'nggi sotuvlar bloki */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Saytdan yangi buyurtmalar */}
        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-primary" />
              <h2 className="text-sm font-bold text-foreground">Soʻnggi sayt buyurtmalari</h2>
            </div>
            <Link href="/admin/orders" className="text-xs font-bold text-primary hover:underline">
              Barchasi →
            </Link>
          </div>

          <div className="space-y-3">
            {[
              {
                id: "ORD-1008",
                customer: "Javohir Toshmatov",
                item: "Gaming Titan RTX 4070 Ti",
                amount: 24_800_000n,
                status: "new",
                statusLabel: "Yangi",
                time: "15 daqiqa oldin",
              },
              {
                id: "ORD-1007",
                customer: "Sardor Alimov",
                item: "Samsung 990 Pro 2TB SSD + 32GB RAM",
                amount: 4_350_000n,
                status: "confirmed",
                statusLabel: "Tasdiqlangan",
                time: "1 soat oldin",
              },
              {
                id: "ORD-1006",
                customer: "Bobur Zokirov",
                item: "Intel Core i7-14700K",
                amount: 5_200_000n,
                status: "shipping",
                statusLabel: "Yetkazilmoqda",
                time: "3 soat oldin",
              },
            ].map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{order.id}</span>
                    <Badge
                      tone={
                        order.status === "new"
                          ? "warning"
                          : order.status === "confirmed"
                            ? "info"
                            : "success"
                      }
                      className="text-[10px]"
                    >
                      {order.statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-medium text-foreground">{order.customer}</p>
                  <p className="text-[11px] text-muted-foreground">{order.item}</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-foreground">{formatMoney(order.amount)}</p>
                  <p className="text-[10px] text-muted-foreground">{order.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* So'nggi amalga oshirilgan sotuvlar va sof foyda */}
        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-primary" />
              <h2 className="text-sm font-bold text-foreground">Soʻnggi sotuvlar (Foyda snapshot)</h2>
            </div>
            <Link href="/admin/sales" className="text-xs font-bold text-primary hover:underline">
              Barchasi →
            </Link>
          </div>

          <div className="space-y-3">
            {[
              {
                source: "Oflayn",
                buyer: "Anvar Qodirov",
                item: "RTX 4070 Ti SUPER 16GB",
                soldPrice: 13_500_000n,
                profit: 1_800_000n,
                date: "Bugun, 15:30",
              },
              {
                source: "Sayt",
                buyer: "Malika Yusupova",
                item: "Kingston FURY Beast 32GB DDR5",
                soldPrice: 1_750_000n,
                profit: 320_000n,
                date: "Bugun, 12:15",
              },
              {
                source: "Oflayn",
                buyer: "Ulugʻbek Saidov",
                item: "Custom Gaming PC (i5 / RTX 4060)",
                soldPrice: 14_200_000n,
                profit: 2_450_000n,
                date: "Kecha, 18:40",
              },
            ].map((sale, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                      {sale.source}
                    </span>
                    <span className="font-semibold text-foreground">{sale.buyer}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{sale.item}</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-foreground">{formatMoney(sale.soldPrice)}</p>
                  <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatMoney(sale.profit)} foyda
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
