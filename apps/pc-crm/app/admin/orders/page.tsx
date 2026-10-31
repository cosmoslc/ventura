"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingCart,
  Truck,
  XCircle,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Modal } from "@ventura/ui/modal";
import { StatCard } from "@ventura/ui/stat-card";
import { formatDate, formatMoney } from "@/lib/format";

export interface OrderItemDetail {
  name: string;
  qty: number;
  price: bigint;
  cost: bigint;
}

export interface AdminOrder {
  id: string;
  publicId: string;
  customerName: string;
  customerPhone: string;
  region: string;
  address: string;
  subtotal: bigint;
  shipping: bigint;
  total: bigint;
  paymentMethod: string;
  status: "new" | "confirmed" | "shipping" | "delivered" | "cancelled";
  createdAt: string;
  items: OrderItemDetail[];
}

const INITIAL_ORDERS: AdminOrder[] = [
  {
    id: "ord-1",
    publicId: "ORD-1008",
    customerName: "Javohir Toshmatov",
    customerPhone: "+998 90 123 45 67",
    region: "Toshkent shahri",
    address: "Yunusobod 4-mavze, 12-uy, 45-xonadon",
    subtotal: 24_800_000n,
    shipping: 0n,
    total: 24_800_000n,
    paymentMethod: "Operator orqali (Naqd / Telegram)",
    status: "new",
    createdAt: "2026-10-29T11:45:00",
    items: [
      {
        name: "Ventura Gaming Titan: i7-14700K / RTX 4070 Ti",
        qty: 1,
        price: 24_800_000n,
        cost: 20_200_000n,
      },
    ],
  },
  {
    id: "ord-2",
    publicId: "ORD-1007",
    customerName: "Sardor Alimov",
    customerPhone: "+998 97 765 43 21",
    region: "Samarqand viloyati",
    address: "Samarqand sh., Registon koʻchasi 8",
    subtotal: 4_350_000n,
    shipping: 60_000n,
    total: 4_410_000n,
    paymentMethod: "Click Up",
    status: "confirmed",
    createdAt: "2026-10-29T09:30:00",
    items: [
      {
        name: "Samsung 990 PRO 2TB NVMe M.2 SSD",
        qty: 1,
        price: 2_600_000n,
        cost: 2_150_000n,
      },
      {
        name: "Kingston FURY Beast RGB 32GB DDR5",
        qty: 1,
        price: 1_750_000n,
        cost: 1_450_000n,
      },
    ],
  },
  {
    id: "ord-3",
    publicId: "ORD-1006",
    customerName: "Bobur Zokirov",
    customerPhone: "+998 93 333 44 55",
    region: "Toshkent shahri",
    address: "Chilonzor 9-mavze, 5-uy",
    subtotal: 5_200_000n,
    shipping: 0n,
    total: 5_200_000n,
    paymentMethod: "Operator orqali",
    status: "delivered",
    createdAt: "2026-10-28T16:20:00",
    items: [
      {
        name: "Intel Core i7-14700K 3.4GHz Protsessor",
        qty: 1,
        price: 5_200_000n,
        cost: 4_500_000n,
      },
    ],
  },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>(INITIAL_ORDERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  const filtered = orders.filter((o) => {
    const matchSearch =
      o.publicId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerPhone.includes(searchQuery);

    const matchStatus = statusFilter === "all" || o.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const handleUpdateStatus = (
    orderId: string,
    newStatus: "new" | "confirmed" | "shipping" | "delivered" | "cancelled"
  ) => {
    setOrders(
      orders.map((o) => {
        if (o.id === orderId) {
          return { ...o, status: newStatus };
        }
        return o;
      })
    );

    if (selectedOrder && selectedOrder.id === orderId) {
      setSelectedOrder({ ...selectedOrder, status: newStatus });
    }
  };

  const getStatusBadge = (status: AdminOrder["status"]) => {
    switch (status) {
      case "new":
        return <Badge tone="warning">Yangi</Badge>;
      case "confirmed":
        return <Badge tone="info">Tasdiqlangan</Badge>;
      case "shipping":
        return <Badge tone="neutral">Yetkazilmoqda</Badge>;
      case "delivered":
        return <Badge tone="success">Yetkazildi</Badge>;
      case "cancelled":
        return <Badge tone="danger">Bekor qilingan</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Sayt buyurtmalari
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Xaridorlarning buyurtmalari, manzil, statuslar va yetkazib berish nazorati
          </p>
        </div>
      </div>

      {/* Statistika kartalari */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          icon={<Clock />}
          label="Yangi buyurtmalar"
          value={`${orders.filter((o) => o.status === "new").length} ta`}
          tone={1}
          hint="Operator tasdigʻi kutilmoqda"
        />

        <StatCard
          icon={<Truck />}
          label="Yetkazilayotganlar"
          value={`${orders.filter((o) => o.status === "shipping" || o.status === "confirmed").length} ta`}
          tone={2}
          hint="Kuryer yoʻlida"
        />

        <StatCard
          icon={<CheckCircle2 />}
          label="Muvaffaqiyatli topshirilgan"
          value={`${orders.filter((o) => o.status === "delivered").length} ta`}
          tone={3}
          hint="Foydaga aylangan"
        />

        <StatCard
          icon={<ShoppingCart />}
          label="Jami buyurtmalar summasi"
          value={formatMoney(orders.reduce((sum, o) => sum + o.total, 0n))}
          tone={4}
          hint="Barcha faol buyurtmalar"
        />
      </div>

      {/* Qidiruv va Filtr */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buyurtma ID, ism yoki telefon boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-(--control-h) rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Barcha statuslar</option>
            <option value="new">Yangi</option>
            <option value="confirmed">Tasdiqlangan</option>
            <option value="shipping">Yetkazilmoqda</option>
            <option value="delivered">Yetkazilgan</option>
            <option value="cancelled">Bekor qilingan</option>
          </select>
        </div>
      </div>

      {/* Buyurtmalar Jadvali */}
      <div className="overflow-x-auto rounded-[var(--r-card,12px)] border border-border bg-card shadow-sm">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-[11px] tracking-wider">
              <th className="p-3.5">ID / Sana</th>
              <th className="p-3.5">Xaridor</th>
              <th className="p-3.5">Hudud / Manzil</th>
              <th className="p-3.5 text-right">Summa</th>
              <th className="p-3.5">Toʻlov usuli</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-right">Tafsilot</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-border/60">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  Buyurtmalar topilmadi
                </td>
              </tr>
            ) : (
              filtered.map((order) => (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3.5">
                    <p className="font-mono font-black text-foreground">{order.publicId}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </td>

                  <td className="p-3.5">
                    <p className="font-bold text-foreground">{order.customerName}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{order.customerPhone}</p>
                  </td>

                  <td className="p-3.5 max-w-xs">
                    <p className="font-semibold text-foreground truncate">{order.region}</p>
                    <p className="text-[11px] text-muted-foreground truncate" title={order.address}>
                      {order.address}
                    </p>
                  </td>

                  <td className="p-3.5 text-right font-black text-foreground">
                    {formatMoney(order.total)}
                  </td>

                  <td className="p-3.5 font-medium text-muted-foreground">
                    {order.paymentMethod}
                  </td>

                  <td className="p-3.5 text-center">
                    {getStatusBadge(order.status)}
                  </td>

                  <td className="p-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                      title="Koʻrish"
                    >
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Buyurtma Tafsiloti Modali */}
      {selectedOrder && (
        <Modal
          open={Boolean(selectedOrder)}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
          title={`Buyurtma ${selectedOrder.publicId}`}
          description={`Xaridor: ${selectedOrder.customerName} (${selectedOrder.customerPhone})`}
          wide
          footer={
            <div className="flex w-full items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                Yopish
              </Button>

              <div className="flex items-center gap-2">
                {selectedOrder.status === "new" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, "confirmed")}
                  >
                    Tasdiqlash
                  </Button>
                )}

                {selectedOrder.status === "confirmed" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, "shipping")}
                  >
                    Kuryerga berish
                  </Button>
                )}

                {selectedOrder.status === "shipping" && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, "delivered")}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    Yetkazildi (Foydani qayd etish)
                  </Button>
                )}

                {selectedOrder.status !== "delivered" && selectedOrder.status !== "cancelled" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleUpdateStatus(selectedOrder.id, "cancelled")}
                  >
                    Bekor qilish
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <div className="space-y-4 text-xs">
            {/* Xaridor va Manzil */}
            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <MapPin size={14} className="text-primary" /> Yetkazish manzili:
                </span>
                <span className="font-bold text-foreground">{selectedOrder.region}</span>
              </div>
              <p className="text-muted-foreground">{selectedOrder.address}</p>
              <div className="flex items-center gap-4 pt-1 text-[11px]">
                <a
                  href={`tel:${selectedOrder.customerPhone}`}
                  className="text-primary font-bold hover:underline flex items-center gap-1"
                >
                  <Phone size={12} /> {selectedOrder.customerPhone}
                </a>
              </div>
            </div>

            {/* Buyurtmadagi tovarlar */}
            <div>
              <h4 className="font-bold text-foreground mb-2">Buyurtma tarkibi:</h4>
              <div className="divide-y divide-border/60 rounded-xl border border-border bg-card">
                {selectedOrder.items.map((item, idx) => {
                  const itemProfit = item.price - item.cost;
                  return (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-foreground">{item.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.qty} dona × {formatMoney(item.price)} (Tannarxi: {formatMoney(item.cost)})
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="font-black text-foreground">{formatMoney(item.price * BigInt(item.qty))}</p>
                        <p className="text-[10px] text-emerald-600 font-semibold">
                          +{formatMoney(itemProfit * BigInt(item.qty))} sof foyda
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Hisob-kitob jami */}
            <div className="rounded-xl border border-border p-3.5 space-y-1.5 text-muted-foreground">
              <div className="flex justify-between">
                <span>Oraliq summa:</span>
                <span className="font-bold text-foreground">{formatMoney(selectedOrder.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Yetkazib berish narxi:</span>
                <span className="font-bold text-foreground">{formatMoney(selectedOrder.shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-sm font-black text-foreground">
                <span>Jami summa:</span>
                <span className="text-primary font-black">{formatMoney(selectedOrder.total)}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
