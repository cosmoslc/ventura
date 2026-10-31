"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Headphones,
  Layers,
  MessageCircle,
  Monitor,
  Phone,
  Plus,
  Search,
  Send,
  Truck,
  Wrench,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { type PcOrderItem, SAMPLE_PC_ORDERS } from "@/lib/pc-data";

const STATUS_LABELS: Record<PcOrderItem["status"], { label: string; tone: "info" | "warning" | "success" | "danger" | "neutral" }> = {
  new: { label: "Yangi zakaz", tone: "info" },
  reviewing: { label: "Koʻrib chiqilmoqda", tone: "warning" },
  quoted: { label: "Narx taklif etildi", tone: "info" },
  confirmed: { label: "Tasdiqlangan", tone: "success" },
  assembling: { label: "Yigʻilmoqda", tone: "warning" },
  ready: { label: "Tayyor (Testda)", tone: "success" },
  delivered: { label: "Yetkazildi", tone: "neutral" },
  cancelled: { label: "Bekor qilindi", tone: "danger" },
};

export default function AdminPcOrdersPage() {
  const [orders, setOrders] = useState<PcOrderItem[]>(SAMPLE_PC_ORDERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Tafsilot & Narx taklif qilish modali
  const [selectedOrder, setSelectedOrder] = useState<PcOrderItem | null>(null);
  const [quotePriceStr, setQuotePriceStr] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [newStatus, setNewStatus] = useState<PcOrderItem["status"]>("reviewing");
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  // Filterlangan zakazlar
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q)
        );
      }
      return true;
    });
  }, [orders, statusFilter, searchQuery]);

  // Statistik ko'rsatkichlar
  const stats = useMemo(() => {
    const newCount = orders.filter((o) => o.status === "new").length;
    const inProgressCount = orders.filter((o) => ["reviewing", "quoted", "confirmed", "assembling"].includes(o.status)).length;
    const readyDeliveredCount = orders.filter((o) => ["ready", "delivered"].includes(o.status)).length;
    const totalRevenue = orders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + (o.quotedPrice ?? o.costPrice), 0n);

    return {
      newCount,
      inProgressCount,
      readyDeliveredCount,
      totalRevenue,
    };
  }, [orders]);

  const handleOpenDetailModal = (order: PcOrderItem) => {
    setSelectedOrder(order);
    setQuotePriceStr(order.quotedPrice ? order.quotedPrice.toString() : "");
    setOperatorNote(order.operatorNote ?? "");
    setNewStatus(order.status);
  };

  const handleSaveOrderChanges = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;

    let parsedQuote: bigint | undefined = undefined;
    if (quotePriceStr.trim()) {
      try {
        parsedQuote = BigInt(quotePriceStr.replace(/\D/g, "") || "0");
      } catch {
        // ignore
      }
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrder.id
          ? {
              ...o,
              status: newStatus,
              quotedPrice: parsedQuote,
              operatorNote,
            }
          : o
      )
    );

    setSuccessNotification(`"${selectedOrder.orderNumber}" buyurtmasi yangilandi.`);
    setSelectedOrder(null);
  };

  // "PC ga aylantirish" (Convert custom order to ready PcBuild)
  const handleConvertToBuild = (order: PcOrderItem) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id
          ? {
              ...o,
              status: "assembling",
              convertedPcId: `pc-converted-${Date.now()}`,
              operatorNote: "PC ga aylantirildi va sexga montajga berildi.",
            }
          : o
      )
    );

    setSuccessNotification(
      `"${order.orderNumber}" zakazi "PcBuild" ga aylantirildi! Komponentlar omborda zaxiralandi.`
    );
    setSelectedOrder(null);
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">PC Zakazlar (Konfigurator)</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Mijozlar onlayn konfigurator orqali tanlagan individual kompyuter yigʻish buyurtmalari
          </p>
        </div>
      </div>

      {/* Muvaffaqiyat bildirishnomasi */}
      {successNotification && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{successNotification}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessNotification(null)}
            className="hover:opacity-75"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* 4 ta Statistik karta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Yangi zakazlar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.newCount} ta</span>
            <Badge tone="info">Koʻrib chiqish kerak</Badge>
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Sayt konfiguratoridan kelgan
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Jarayonda
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.inProgressCount} ta</span>
            <Clock size={20} className="text-amber-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Kelishuvda yoki yigʻilmoqda
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Tayyor / Yetkazilgan
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.readyDeliveredCount} ta</span>
            <CheckCircle2 size={20} className="text-emerald-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Muvaffaqiyatli topshirildi
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Kutilayotgan umumiy qiymat
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-primary truncate">
              {formatMoney(stats.totalRevenue)}
            </span>
            <Wrench size={20} className="text-primary shrink-0 ml-1" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Barcha faol zakazlar summasi
          </span>
        </div>
      </div>

      {/* Filterlar qatori */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Qidiruv */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buyurtma ID, mijoz ismi yoki telefon..."
            className="w-full rounded-[var(--r-input,8px)] border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat filteri */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[var(--r-input,8px)] border border-input bg-card px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">Barcha statuslar</option>
          <option value="new">Yangi zakazlar</option>
          <option value="reviewing">Koʻrib chiqilmoqda</option>
          <option value="quoted">Narx taklif etildi</option>
          <option value="confirmed">Tasdiqlangan</option>
          <option value="assembling">Yigʻilmoqda</option>
          <option value="ready">Tayyor (Testda)</option>
          <option value="delivered">Yetkazildi</option>
          <option value="cancelled">Bekor qilindi</option>
        </select>
      </div>

      {/* Zakazlar jadvali */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Buyurtma</th>
                <th className="py-3 px-4">Mijoz maʼlumotlari</th>
                <th className="py-3 px-4">Tanlangan qismlar</th>
                <th className="py-3 px-4 text-right">Tannarx (UZS)</th>
                <th className="py-3 px-4 text-right">Kelishilgan narx (UZS)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    Zakaz topilmadi.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const statusMeta = STATUS_LABELS[order.status];
                  const hasQuote = order.quotedPrice && order.quotedPrice > 0n;
                  const estimatedMargin = hasQuote
                    ? calcMarginPercent(order.quotedPrice! - order.costPrice, order.quotedPrice!)
                    : 0;

                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      {/* ID va sana */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-foreground block">
                          {order.orderNumber}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {order.createdAt.split("T")[0]}
                        </span>
                      </td>

                      {/* Xaridor */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground block">
                          {order.customerName}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground block">
                          {order.customerPhone}
                        </span>
                        {order.deliveryAddress && (
                          <span className="text-[11px] text-muted-foreground truncate block max-w-xs">
                            {order.deliveryAddress}
                          </span>
                        )}
                      </td>

                      {/* Qismlar */}
                      <td className="py-3.5 px-4">
                        <span className="font-medium text-foreground block">
                          {order.components.length} ta komponent tanlangan
                        </span>
                        <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                          {order.components.slice(0, 3).map((c) => (
                            <span
                              key={c.role}
                              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-mono"
                            >
                              {c.roleNameUz}: {c.productName.split(" ")[0]}
                            </span>
                          ))}
                          {order.components.length > 3 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                              +{order.components.length - 3} ta
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Tannarx */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-muted-foreground">
                        {formatMoney(order.costPrice)}
                      </td>

                      {/* Kelishilgan narx */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        {hasQuote ? (
                          <>
                            <span className="font-bold text-foreground block">
                              {formatMoney(order.quotedPrice!)}
                            </span>
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              +{formatMoney(order.quotedPrice! - order.costPrice)} ({estimatedMargin}%)
                            </span>
                          </>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">
                            Belgilanmagan
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <Badge tone={statusMeta.tone}>{statusMeta.label}</Badge>
                      </td>

                      {/* Amallar */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`https://t.me/share/url?url=${encodeURIComponent(
                              `Mijoz: ${order.customerName}, Tel: ${order.customerPhone}`
                            )}&text=${encodeURIComponent(
                              `Assalomu alaykum ${order.customerName}! Ventura PC dan sizning zakazingiz (${order.orderNumber}) boʻyicha bogʻlanyapmiz.`
                            )}`}
                            target="_blank"
                            className="p-1.5 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                            title="Telegram orqali bogʻlanish"
                          >
                            <MessageCircle size={15} />
                          </Link>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetailModal(order)}
                            className="text-xs"
                          >
                            Koʻrib chiqish
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Zakazni ko'rib chiqish & Narx taklif qilish modali */}
      <Modal
        open={Boolean(selectedOrder)}
        onOpenChange={(open) => !open && setSelectedOrder(null)}
        title={selectedOrder ? `Zakaz: ${selectedOrder.orderNumber}` : "Zakaz tafsilotlari"}
      >
        {selectedOrder && (
          <form onSubmit={handleSaveOrderChanges} className="space-y-4 text-xs sm:text-sm">
            {/* Mijoz haqida ma'lumot */}
            <div className="rounded-lg bg-muted/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{selectedOrder.customerName}</h4>
                  <a
                    href={`tel:${selectedOrder.customerPhone}`}
                    className="font-mono text-xs text-primary hover:underline flex items-center gap-1 mt-0.5"
                  >
                    <Phone size={12} />
                    {selectedOrder.customerPhone}
                  </a>
                </div>
                <Badge tone={STATUS_LABELS[selectedOrder.status].tone}>
                  {STATUS_LABELS[selectedOrder.status].label}
                </Badge>
              </div>

              {selectedOrder.deliveryAddress && (
                <p className="text-xs text-muted-foreground">
                  <strong>Manzil:</strong> {selectedOrder.deliveryAddress}
                </p>
              )}

              {selectedOrder.customerNote && (
                <div className="rounded border border-primary/20 bg-primary/5 p-2 text-xs">
                  <span className="font-bold text-primary block">Mijoz istagi / Izohi:</span>
                  <p className="text-foreground mt-0.5">{selectedOrder.customerNote}</p>
                </div>
              )}
            </div>

            {/* Tanlangan komponentlar ro'yxati */}
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Tanlangan qismlar ({selectedOrder.components.length} ta):
              </span>
              <div className="rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto pr-1">
                {selectedOrder.components.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-[10px] text-muted-foreground min-w-[70px]">
                        {c.roleNameUz}
                      </span>
                      <span className="font-semibold text-foreground">{c.productName}</span>
                    </div>
                    <span className="font-mono text-xs text-foreground font-bold">
                      {formatMoney(c.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hisob-kitob qatori */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="rounded-lg bg-muted/40 p-2.5 text-xs">
                <span className="text-muted-foreground block">Komponentlar tannarxi:</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  {formatMoney(selectedOrder.costPrice)}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Taklif qilinadigan narx (UZS) *
                </Label>
                <Input
                  required
                  value={quotePriceStr}
                  onChange={(e) => setQuotePriceStr(e.target.value)}
                  placeholder="Masalan: 18500000"
                  className="font-mono text-xs font-bold"
                />
              </div>
            </div>

            {/* Status va Operator izohi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Statusni yangilash
                </Label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as any)}
                  className="w-full rounded-[var(--r-input,8px)] border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="new">Yangi zakaz</option>
                  <option value="reviewing">Koʻrib chiqilmoqda</option>
                  <option value="quoted">Narx taklif etildi</option>
                  <option value="confirmed">Tasdiqlangan</option>
                  <option value="assembling">Yigʻilmoqda</option>
                  <option value="ready">Tayyor (Testda)</option>
                  <option value="delivered">Yetkazildi</option>
                  <option value="cancelled">Bekor qilindi</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operator izohi
                </Label>
                <Input
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder="Mijoz bilan kelishuv holati..."
                />
              </div>
            </div>

            {/* Amallar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-border">
              {/* PC ga aylantirish tugmasi */}
              {selectedOrder.status !== "assembling" && selectedOrder.status !== "ready" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleConvertToBuild(selectedOrder)}
                  className="gap-1.5 text-xs text-primary hover:bg-primary/10"
                >
                  <Wrench size={14} />
                  PC ga aylantirish (Zaxiralash)
                </Button>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrder(null)}
                >
                  Bekor qilish
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Saqlash
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
