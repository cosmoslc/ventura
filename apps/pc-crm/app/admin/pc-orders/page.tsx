"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { type PcOrderItem } from "@/lib/pc-data";
import { getAdminPcOrdersAction, updatePcOrderStatusAction } from "@/lib/server/actions";

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
  const [orders, setOrders] = useState<PcOrderItem[]>([]);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async () => {
    const result = await getAdminPcOrdersAction();
    if (!result.success) { setError(result.error ?? "PC buyurtmalarini yuklab bo'lmadi"); return; }
    setError("");
    setOrders(result.orders);
  }, []);
  useEffect(() => { void loadOrders(); }, [loadOrders]);
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

  const handleSaveOrderChanges = async (e: React.FormEvent) => {
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

    const result = await updatePcOrderStatusAction(selectedOrder.id, newStatus, parsedQuote, operatorNote);
    if (!result.success) { setError(result.error ?? "PC buyurtmasini yangilab bo'lmadi"); return; }
    setSuccessNotification(`"${selectedOrder.orderNumber}" buyurtmasi yangilandi.`);
    setSelectedOrder(null);
    await loadOrders();
  };

  return (
    <div className="space-y-6">
      {error && <div role="alert" className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)">{error}</div>}

      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">PC Zakazlar</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Mijozlar onlayn konfigurator orqali tanlagan individual kompyuter yigʻish buyurtmalari
          </p>
        </div>
      </div>

      {/* Muvaffaqiyat bildirishnomasi */}
      {successNotification && (
        <div className="flex items-center justify-between rounded-control bg-(--success-bg) border border-(--success-border) p-4 text-xs sm:text-sm text-(--success-fg)">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Layers />} label="Yangi zakazlar" value={`${stats.newCount} ta`} tone={1} />
        <StatCard icon={<Clock />} label="Jarayonda" value={`${stats.inProgressCount} ta`} tone={2} />
        <StatCard icon={<CheckCircle2 />} label="Tayyor / Yetkazilgan" value={`${stats.readyDeliveredCount} ta`} tone={3} />
        <StatCard icon={<Wrench />} label="Kutilayotgan umumiy qiymat" value={formatMoney(stats.totalRevenue)} tone={4} valueClassName="whitespace-nowrap text-title" />
      </div>

      {/* Filterlar qatori */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Qidiruv */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buyurtma ID, mijoz ismi yoki telefon..."
            className="w-full rounded-control border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat filteri */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger aria-label="PC zakaz holati" className="w-auto min-w-48 text-xs">
            <SelectValue placeholder="Barcha statuslar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Barcha statuslar</SelectItem>
            <SelectItem value="new">Yangi zakazlar</SelectItem>
            <SelectItem value="reviewing">Koʻrib chiqilmoqda</SelectItem>
            <SelectItem value="quoted">Narx taklif etildi</SelectItem>
            <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
            <SelectItem value="assembling">Yigʻilmoqda</SelectItem>
            <SelectItem value="ready">Tayyor (Testda)</SelectItem>
            <SelectItem value="delivered">Yetkazildi</SelectItem>
            <SelectItem value="cancelled">Bekor qilindi</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zakazlar jadvali */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-control">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-caption font-bold uppercase tracking-wider text-muted-foreground">
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
                        <span className="font-mono text-caption text-muted-foreground">
                          {order.createdAt.split("T")[0]}
                        </span>
                      </td>

                      {/* Xaridor */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-foreground block">
                          {order.customerName}
                        </span>
                        <span className="font-mono text-caption text-muted-foreground block">
                          {order.customerPhone}
                        </span>
                        {order.deliveryAddress && (
                          <span className="text-caption text-muted-foreground truncate block max-w-xs">
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
                              className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground font-mono"
                            >
                              {c.roleNameUz}: {c.productName.split(" ")[0]}
                            </span>
                          ))}
                          {order.components.length > 3 && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-2xs text-muted-foreground">
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
                            <span className="text-caption text-(--success-fg) font-semibold">
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
            <div className="rounded-control bg-muted/60 p-3.5 space-y-2">
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
              <div className="rounded-control border border-border divide-y divide-border max-h-48 overflow-y-auto pr-1">
                {selectedOrder.components.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-2xs text-muted-foreground min-w-18">
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
              <div className="rounded-control bg-muted/40 p-2.5 text-xs">
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
                <Select value={newStatus} onValueChange={(v) => setNewStatus(v as any)}>
                  <SelectTrigger aria-label="Statusni yangilash" className="w-full text-xs h-(--control-h)">
                    <SelectValue placeholder="Statusni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Yangi zakaz</SelectItem>
                    <SelectItem value="reviewing">Koʻrib chiqilmoqda</SelectItem>
                    <SelectItem value="quoted">Narx taklif etildi</SelectItem>
                    <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                    <SelectItem value="assembling">Yigʻilmoqda</SelectItem>
                    <SelectItem value="ready">Tayyor (Testda)</SelectItem>
                    <SelectItem value="delivered">Yetkazildi</SelectItem>
                    <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                  </SelectContent>
                </Select>
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
