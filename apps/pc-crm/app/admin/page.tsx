import Link from "next/link";
import { Boxes, Cpu, DollarSign, PackagePlus, Plus, Receipt, ShoppingCart, TrendingUp } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { StatCard } from "@ventura/ui/stat-card";
import { formatDate, formatMoney } from "@/lib/format";
import { getDbProducts } from "@/lib/server/products";
import { getDbOrders } from "@/lib/server/orders";
import { getDbSales } from "@/lib/server/sales";
import { getDbPurchases } from "@/lib/server/purchases";
import { getDbNewOrderCount } from "@/lib/server/dashboard";
import { getStoreBranding } from "@/lib/server/branding";

export default async function AdminDashboardPage() {
  const branding = await getStoreBranding();
  const isFinancial = branding.storeMode !== "inventory";

  const [orders, sales, products, pendingOrders, purchases] = await Promise.all([
    getDbOrders(3),
    isFinancial ? getDbSales() : Promise.resolve([]),
    getDbProducts(),
    getDbNewOrderCount(),
    !isFinancial ? getDbPurchases() : Promise.resolve([]),
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthlySales = sales.filter((sale) => !sale.voidedAt && new Date(sale.soldAt) >= monthStart);
  const monthlyRevenue = monthlySales.reduce((sum, sale) => sum + sale.soldPrice, 0n);
  const monthlyProfit = monthlySales.reduce((sum, sale) => sum + sale.profit, 0n);
  const stockValue = products.reduce((sum, product) => sum + product.costPrice * BigInt(product.stock), 0n);
  const totalStockUnits = products.reduce((sum, product) => sum + product.stock, 0);
  const lowStockCount = products.filter((p) => p.stock <= p.minStock && p.stock > 0).length;
  const recentOrders = orders.slice(0, 3);
  const recentSales = sales.filter((sale) => !sale.voidedAt).slice(0, 3);
  const recentPurchases = purchases.filter((p) => !p.voidedAt).slice(0, 3);

  return (
    <div className="space-y-8">
      {/* 1. Sarlavha va tezkor harakatlar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">Boshqaruv paneli</h1>
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
              {isFinancial ? "Oflayn sotuv" : "Sotuv kiritish"}
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
        {isFinancial ? (
          <>
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
          </>
        ) : (
          <>
            <StatCard
              icon={<Boxes />}
              label="Ombordagi jami qoldiq"
              value={`${totalStockUnits} dona`}
              tone={1}
              valueClassName="whitespace-nowrap text-title"
            />

            <StatCard
              icon={<Boxes />}
              label="Mahsulot turlari"
              value={`${products.length} xil`}
              tone={2}
              valueClassName="whitespace-nowrap text-title"
            />

            <StatCard
              icon={<TrendingUp />}
              label="Kam qolgan tovarlar"
              value={`${lowStockCount} ta`}
              tone={3}
              valueClassName="whitespace-nowrap text-title"
            />
          </>
        )}

        <StatCard icon={<ShoppingCart />} label="Yangi buyurtmalar" value={`${pendingOrders} ta`} tone={4} />
      </div>

      {/* 3. So'nggi buyurtmalar va so'nggi sotuvlar / kirimlar bloki */}
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
              const statusLabel =
                order.status === "new"
                  ? "Yangi"
                  : order.status === "confirmed"
                    ? "Tasdiqlangan"
                    : order.status === "shipping"
                      ? "Yetkazilmoqda"
                      : order.status === "delivered"
                        ? "Yetkazildi"
                        : "Bekor qilingan";
              const itemLabel =
                order.items
                  .slice(0, 2)
                  .map((item) => item.name)
                  .join(", ") || "—";
              return (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-control border border-border/60 bg-muted/20 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-foreground">{order.publicId}</span>
                      <Badge
                        tone={order.status === "new" ? "warning" : order.status === "confirmed" ? "info" : "success"}
                        className="text-2xs"
                      >
                        {statusLabel}
                      </Badge>
                    </div>
                    <p className="mt-0.5 font-medium text-foreground">{order.name}</p>
                    <p className="text-caption text-muted-foreground">{itemLabel}</p>
                  </div>

                  <div className="text-right">
                    {isFinancial ? (
                      <p className="font-bold text-foreground">{formatMoney(order.total)}</p>
                    ) : (
                      <p className="font-bold text-foreground">
                        {order.items?.reduce((s, i) => s + i.qty, 0) || 0} dona
                      </p>
                    )}
                    <p className="text-2xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2-karta: Moliyaviy rejimda so'nggi sotuvlar, Moliyasiz rejimda so'nggi kirimlar */}
        {isFinancial ? (
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
                    <p className="text-caption font-semibold text-(--success-fg)">+{formatMoney(sale.profit)} foyda</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PackagePlus size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">Soʻnggi ombor kirimlari</h2>
              </div>
              <Link href="/admin/purchases" className="text-xs font-bold text-primary hover:underline">
                Barchasi →
              </Link>
            </div>

            <div className="space-y-3">
              {recentPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between rounded-control border border-border/60 bg-muted/20 p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-2xs font-bold text-primary">
                        {purchase.supplier || "Taʼminotchi"}
                      </span>
                      <span className="font-semibold text-foreground">{purchase.productName}</span>
                    </div>
                    {purchase.note && <p className="mt-0.5 text-caption text-muted-foreground">{purchase.note}</p>}
                  </div>

                  <div className="text-right">
                    <p className="font-bold text-foreground">+{purchase.qty} dona</p>
                    <p className="text-2xs text-muted-foreground">{formatDate(purchase.purchasedAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
