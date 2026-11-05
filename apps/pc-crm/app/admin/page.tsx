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
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { StatCard } from "@ventura/ui/stat-card";
import { formatDate, formatMoney } from "@/lib/format";
import { getDbProducts } from "@/lib/server/products";
import { getDbOrders } from "@/lib/server/orders";
import { getDbSales } from "@/lib/server/sales";
import { getDbNewOrderCount } from "@/lib/server/dashboard";

export default async function AdminDashboardPage() {
  const [orders, sales, products, pendingOrders] = await Promise.all([
    getDbOrders(3), getDbSales(), getDbProducts(), getDbNewOrderCount(),
  ]);
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlySales = sales.filter((sale) => !sale.voidedAt && new Date(sale.soldAt) >= monthStart);
  const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.soldPrice, 0n);
  const monthlyProfit = monthlySales.reduce((sum, sale) => sum + sale.profit, 0n);
  const stockValue = products.reduce((sum, product) => sum + product.costPrice * BigInt(product.stock), 0n);
  const recentOrders = orders.slice(0, 3);
  const recentSales = sales.filter((sale) => !sale.voidedAt).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* 1. Sarlavha va tezkor harakatlar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Boshqaruv paneli
          </h1>
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
          value={formatMoney(monthlyRevenue)}
          tone={1}
          valueClassName="whitespace-nowrap text-title"
        />

        <StatCard
          icon={<TrendingUp />}
          label="Sof daromad (Foyda)"
          value={formatMoney(monthlyProfit)}
          tone={2}
          valueClassName="whitespace-nowrap text-title"
        />

        <StatCard
          icon={<Boxes />}
          label="Ombor tannarx qiymati"
          value={formatMoney(stockValue)}
          tone={3}
          valueClassName="whitespace-nowrap text-title"
        />

        <StatCard
          icon={<ShoppingCart />}
          label="Yangi buyurtmalar"
          value={`${pendingOrders} ta`}
          tone={4}
        />
      </div>

      {/* 3. So'nggi buyurtmalar va so'nggi sotuvlar bloki */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Saytdan yangi buyurtmalar */}
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
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
            {recentOrders.map((order) => {
              const statusLabel = order.status === "new" ? "Yangi" : order.status === "confirmed" ? "Tasdiqlangan" : order.status === "shipping" ? "Yetkazilmoqda" : order.status === "delivered" ? "Yetkazildi" : "Bekor qilingan";
              const itemLabel = order.items.slice(0, 2).map((item) => item.name).join(", ") || "—";
              return (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-control border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{order.publicId}</span>
                    <Badge
                      tone={
                        order.status === "new"
                          ? "warning"
                          : order.status === "confirmed"
                            ? "info"
                            : "success"
                      }
                      className="text-2xs"
                    >
                      {statusLabel}
                    </Badge>
                  </div>
                  <p className="mt-0.5 font-medium text-foreground">{order.name}</p>
                  <p className="text-caption text-muted-foreground">{itemLabel}</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-foreground">{formatMoney(order.total)}</p>
                  <p className="text-2xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
              </div>
              );
            })}
          </div>
        </div>

        {/* So'nggi amalga oshirilgan sotuvlar va sof foyda */}
        <div className="rounded-card border border-border bg-card p-5 shadow-card">
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
            {recentSales.map((sale) => (
              <div
                key={sale.id}
                className="flex items-center justify-between rounded-control border border-border/60 bg-muted/20 p-3 text-xs"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-bold text-primary">
                      {sale.source === "site" ? "Sayt" : "Oflayn"}
                    </span>
                    <span className="font-semibold text-foreground">{sale.buyerName}</span>
                  </div>
                  <p className="mt-0.5 text-caption text-muted-foreground">{sale.productName}</p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-foreground">{formatMoney(sale.soldPrice)}</p>
                  <p className="text-caption font-semibold text-(--success-fg)">
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
