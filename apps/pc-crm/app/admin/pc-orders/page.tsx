"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Copy,
  Cpu,
  DollarSign,
  ExternalLink,
  Eye,
  FileText,
  Layers,
  MessageCircle,
  Phone,
  PhoneCall,
  Search,
  TrendingUp,
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

const ORDER_TIMELINE_STEPS: { status: PcOrderItem["status"]; title: string; desc: string }[] = [
  { status: "new", title: "1. Yangi zakaz", desc: "Mijoz konfigurator orqali zakaz qoldirdi" },
  { status: "reviewing", title: "2. Koʻrib chiqilmoqda", desc: "Operator qismlar mosligi va narxni tekshirmoqda" },
  { status: "quoted", title: "3. Narx taklif etildi", desc: "Mijozga yakuniy narx va yetkazish vaqti aytildi" },
  { status: "confirmed", title: "4. Tasdiqlangan", desc: "Mijoz rozi boʻldi, qismlar omborda zaxiraga olindi" },
  { status: "assembling", title: "5. Yigʻilmoqda", desc: "Texnik usta PCni montaj qilib simlarni tartibga solmoqda" },
  { status: "ready", title: "6. Tayyor (Testda)", desc: "Stress-testdan oʻtkazildi, topshirishga tayyor" },
  { status: "delivered", title: "7. Yetkazildi", desc: "Mijozga topshirildi va toʻlov toʻliq qabul qilindi" },
];

export default function AdminPcOrdersPage() {
  const [orders, setOrders] = useState<PcOrderItem[]>([]);
  const [error, setError] = useState("");
  const [successNotification, setSuccessNotification] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    const result = await getAdminPcOrdersAction();
    if (!result.success) { setError(result.error ?? "PC buyurtmalarini yuklab bo'lmadi"); return; }
    setError("");
    setOrders(result.orders);
  }, []);

  useEffect(() => { void loadOrders(); }, [loadOrders]);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modallar uchun holatlar
  const [selectedForDetail, setSelectedForDetail] = useState<PcOrderItem | null>(null);
  const [selectedForTrack, setSelectedForTrack] = useState<PcOrderItem | null>(null);
  const [selectedForProfit, setSelectedForProfit] = useState<PcOrderItem | null>(null);

  // Detail modal ichidagi tahrir
  const [quotePriceStr, setQuotePriceStr] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [modalStatus, setModalStatus] = useState<PcOrderItem["status"]>("reviewing");
  const [copiedTrack, setCopiedTrack] = useState(false);

  // Filterlangan zakazlar
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.includes(q) ||
          (o.pcName && o.pcName.toLowerCase().includes(q))
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

  // To'g'ridan-to'g'ri statusni o'zgartirish (Jadval qatoridan)
  const handleDirectStatusChange = async (order: PcOrderItem, nextStatus: PcOrderItem["status"]) => {
    if (order.status === nextStatus) return;

    // Optimistik yangilash
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o)));

    const result = await updatePcOrderStatusAction(order.id, nextStatus, order.quotedPrice, order.operatorNote);
    if (!result.success) {
      setError(result.error ?? "Statusni oʻzgartirib boʻlmadi");
      await loadOrders(); // rollback
    } else {
      setError("");
      setSuccessNotification(`"${order.orderNumber}" buyurtmasi "${STATUS_LABELS[nextStatus].label}" bosqichiga oʻtkazildi.`);
    }
  };

  // Batafsil modalini ochish
  const handleOpenDetailModal = (order: PcOrderItem) => {
    setSelectedForDetail(order);
    setQuotePriceStr(order.quotedPrice ? order.quotedPrice.toString() : "");
    setOperatorNote(order.operatorNote ?? "");
    setModalStatus(order.status);
  };

  // Batafsil modalidan saqlash
  const handleSaveDetailChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForDetail) return;

    let parsedQuote: bigint | undefined = undefined;
    if (quotePriceStr.trim()) {
      try {
        parsedQuote = BigInt(quotePriceStr.replace(/\D/g, "") || "0");
      } catch {
        // ignore
      }
    }

    const result = await updatePcOrderStatusAction(selectedForDetail.id, modalStatus, parsedQuote, operatorNote);
    if (!result.success) { setError(result.error ?? "PC buyurtmasini yangilab boʻlmadi"); return; }
    setSuccessNotification(`"${selectedForDetail.orderNumber}" buyurtmasi muvaffaqiyatli yangilandi.`);
    setSelectedForDetail(null);
    await loadOrders();
  };

  const copyTrackerUrl = (orderNumber: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/computers/custom?track=${orderNumber}`;
    void navigator.clipboard.writeText(url);
    setCopiedTrack(true);
    setTimeout(() => setCopiedTrack(false), 2000);
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)">
          {error}
        </div>
      )}

      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">PC Zakazlar</h1>
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
            placeholder="Buyurtma ID, mijoz ismi, telefon yoki PC..."
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
                <th className="py-3.5 px-4 whitespace-nowrap">Buyurtma ID</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Zakaschi</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Telefon raqami</th>
                <th className="py-3.5 px-4">Zakaz qilingan PC nomi</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Tannarx</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Kelishilgan narx</th>
                <th className="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                    Zakaz topilmadi.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const hasQuote = order.quotedPrice && order.quotedPrice > 0n;

                  return (
                    <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                      {/* 1. Buyurtma ID va sana */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-foreground block">
                          {order.orderNumber}
                        </span>
                        <span className="font-mono text-2xs text-muted-foreground">
                          {order.createdAt}
                        </span>
                      </td>

                      {/* 2. Zakaschi */}
                      <td className="py-3.5 px-4 min-w-[130px]">
                        <span className="font-bold text-foreground block">
                          {order.customerName}
                        </span>
                        {order.deliveryAddress && (
                          <span className="text-2xs text-muted-foreground truncate block max-w-[180px]" title={order.deliveryAddress}>
                            {order.deliveryAddress}
                          </span>
                        )}
                      </td>

                      {/* 3. Telefon raqami */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="font-mono font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5"
                          title="Qoʻngʻiroq qilish"
                        >
                          <Phone size={12} className="text-muted-foreground" />
                          <span>{order.customerPhone}</span>
                        </a>
                      </td>

                      {/* 4. Zakaz qilingan PC nomi */}
                      <td className="py-3.5 px-4 min-w-[200px]">
                        <span className="font-bold text-foreground block line-clamp-1">
                          {order.pcName || "Custom PC Build"}
                        </span>
                        <span className="text-2xs text-muted-foreground block mt-0.5">
                          {order.components.length} ta komponent yigʻilgan
                        </span>
                      </td>

                      {/* 5. Tannarx */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-muted-foreground whitespace-nowrap">
                        {formatMoney(order.costPrice)}
                      </td>

                      {/* 6. Kelishilgan narx (Yashil sof foyda ko'rsatgichisiz) */}
                      <td className="py-3.5 px-4 text-right font-mono whitespace-nowrap">
                        {hasQuote ? (
                          <span className="font-bold text-foreground block">
                            {formatMoney(order.quotedPrice!)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">
                            Belgilanmagan
                          </span>
                        )}
                      </td>

                      {/* 7. Status (To'g'ridan-to'g'ri o'zgaruvchan Select) */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <Select
                          value={order.status}
                          onValueChange={(val) => handleDirectStatusChange(order, val as PcOrderItem["status"])}
                        >
                          <SelectTrigger
                            aria-label="Holatni oʻzgartirish"
                            className="h-8 w-auto min-w-[145px] text-xs font-semibold px-2.5 mx-auto bg-card"
                          >
                            <Badge tone={STATUS_LABELS[order.status].tone} className="py-0 px-1.5 text-2xs font-semibold">
                              {STATUS_LABELS[order.status].label}
                            </Badge>
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
                      </td>

                      {/* 8. Amallar: Batafsil, Kuzatish, Foyda, Telefon */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Batafsil */}
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => handleOpenDetailModal(order)}
                            className="h-7 px-2 text-2xs gap-1 font-semibold text-foreground"
                            title="Batafsil maʼlumot"
                          >
                            <FileText size={12} className="text-primary" />
                            <span>Batafsil</span>
                          </Button>

                          {/* Kuzatish */}
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => setSelectedForTrack(order)}
                            className="h-7 px-2 text-2xs gap-1 font-semibold text-foreground"
                            title="Buyurtma jarayoni va kuzatuv"
                          >
                            <Compass size={12} className="text-amber-500" />
                            <span>Kuzatish</span>
                          </Button>

                          {/* Foyda ko'rish */}
                          <Button
                            variant="subtle"
                            size="sm"
                            onClick={() => setSelectedForProfit(order)}
                            className="h-7 px-2 text-2xs gap-1 font-semibold text-foreground"
                            title="Sof foyda hisob-kitobi"
                          >
                            <TrendingUp size={12} className="text-(--success-fg)" />
                            <span>Foyda</span>
                          </Button>

                          {/* Telefon qilish */}
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="inline-flex items-center justify-center gap-1 h-7 px-2.5 rounded-btn text-2xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                            title="Mijozga qoʻngʻiroq qilish"
                          >
                            <PhoneCall size={12} />
                            <span>Qoʻngʻiroq</span>
                          </a>
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

      {/* ---------------- 1. BATAFSIL MODALI ---------------- */}
      <Modal
        open={Boolean(selectedForDetail)}
        onOpenChange={(open) => !open && setSelectedForDetail(null)}
        title={selectedForDetail ? `Zakaz tafsilotlari: ${selectedForDetail.orderNumber}` : "Zakaz tafsilotlari"}
        wide
      >
        {selectedForDetail && (
          <form onSubmit={handleSaveDetailChanges} className="space-y-4 text-xs sm:text-sm">
            {/* Mijoz haqida ma'lumot */}
            <div className="rounded-control bg-muted/60 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{selectedForDetail.customerName}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <a
                      href={`tel:${selectedForDetail.customerPhone}`}
                      className="font-mono text-xs text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Phone size={12} />
                      {selectedForDetail.customerPhone}
                    </a>
                    <Link
                      href={`https://t.me/share/url?url=${encodeURIComponent(
                        `Mijoz: ${selectedForDetail.customerName}, Tel: ${selectedForDetail.customerPhone}`
                      )}&text=${encodeURIComponent(
                        `Assalomu alaykum ${selectedForDetail.customerName}! Ventura PC dan sizning zakazingiz (${selectedForDetail.orderNumber}) boʻyicha bogʻlanyapmiz.`
                      )}`}
                      target="_blank"
                      className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <MessageCircle size={12} />
                      Telegram
                    </Link>
                  </div>
                </div>
                <Badge tone={STATUS_LABELS[selectedForDetail.status].tone}>
                  {STATUS_LABELS[selectedForDetail.status].label}
                </Badge>
              </div>

              {selectedForDetail.deliveryAddress && (
                <p className="text-xs text-muted-foreground pt-1">
                  <strong>Manzil:</strong> {selectedForDetail.deliveryAddress}
                </p>
              )}

              {selectedForDetail.customerNote && (
                <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-xs mt-2">
                  <span className="font-bold text-primary block">Mijoz istagi / Izohi:</span>
                  <p className="text-foreground mt-0.5">{selectedForDetail.customerNote}</p>
                </div>
              )}
            </div>

            {/* Tanlangan komponentlar ro'yxati */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Tanlangan qismlar ({selectedForDetail.components.length} ta):
                </span>
                <span className="font-mono text-xs font-bold text-foreground">
                  Umumiy tannarx: {formatMoney(selectedForDetail.costPrice)}
                </span>
              </div>
              <div className="rounded-control border border-border divide-y divide-border max-h-56 overflow-y-auto">
                {selectedForDetail.components.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 text-xs hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="font-bold uppercase text-2xs text-muted-foreground min-w-20">
                        {c.roleNameUz}
                      </span>
                      <span className="font-semibold text-foreground">{c.productName}</span>
                    </div>
                    <span className="font-mono text-xs text-foreground font-bold whitespace-nowrap pl-2">
                      {formatMoney(c.price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hisob-kitob qatori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
              <div className="rounded-control bg-muted/40 p-3 text-xs">
                <span className="text-muted-foreground block">Komponentlar tannarxi:</span>
                <span className="font-mono font-bold text-base text-foreground mt-0.5 block">
                  {formatMoney(selectedForDetail.costPrice)}
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Kelishilgan narx (UZS) *
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
                <Select value={modalStatus} onValueChange={(v) => setModalStatus(v as PcOrderItem["status"])}>
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
                  placeholder="Mijoz bilan kelishuv tafsilotlari..."
                />
              </div>
            </div>

            {/* Tugmalar */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedForDetail(null)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" variant="primary" size="sm" className="font-bold">
                Saqlash
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------------- 2. KUZATISH MODALI ---------------- */}
      <Modal
        open={Boolean(selectedForTrack)}
        onOpenChange={(open) => !open && setSelectedForTrack(null)}
        title={selectedForTrack ? `Buyurtma jarayoni va kuzatuv: ${selectedForTrack.orderNumber}` : "Kuzatish"}
      >
        {selectedForTrack && (
          <div className="space-y-5 text-xs sm:text-sm">
            {/* Header ma'lumoti */}
            <div className="rounded-control bg-muted/40 p-3.5 flex items-center justify-between">
              <div>
                <span className="font-bold text-foreground block text-sm">{selectedForTrack.pcName || "Custom PC Build"}</span>
                <span className="text-2xs text-muted-foreground">Mijoz: {selectedForTrack.customerName} ({selectedForTrack.customerPhone})</span>
              </div>
              <Badge tone={STATUS_LABELS[selectedForTrack.status].tone}>
                {STATUS_LABELS[selectedForTrack.status].label}
              </Badge>
            </div>

            {/* Timeline bosqichlari */}
            <div className="space-y-3 relative pl-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
              {ORDER_TIMELINE_STEPS.map((step, idx) => {
                const currentIdx = ORDER_TIMELINE_STEPS.findIndex((s) => s.status === selectedForTrack.status);
                const isPassed = currentIdx >= idx;
                const isCurrent = currentIdx === idx;

                return (
                  <div key={step.status} className="relative flex items-start gap-3">
                    <div
                      className={`absolute -left-6 mt-0.5 size-5 rounded-full grid place-items-center text-2xs transition-colors ${
                        isCurrent
                          ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                          : isPassed
                            ? "bg-(--success-bg) text-(--success-fg) font-bold"
                            : "bg-muted text-muted-foreground border border-border"
                      }`}
                    >
                      {isPassed ? <Check size={12} /> : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${isCurrent ? "text-primary font-bold" : isPassed ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </p>
                      <p className="text-2xs text-muted-foreground mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Havolani nusxalash bloki */}
            <div className="rounded-control border border-border bg-card p-3 space-y-2">
              <span className="text-2xs font-bold text-muted-foreground uppercase tracking-wider block">
                Mijozga yuboriladigan kuzatuv havolasi:
              </span>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`/computers/custom?track=${selectedForTrack.orderNumber}`}
                  className="font-mono text-2xs h-8 bg-muted text-muted-foreground"
                />
                <Button
                  type="button"
                  variant="subtle"
                  size="sm"
                  onClick={() => copyTrackerUrl(selectedForTrack.orderNumber)}
                  className="h-8 gap-1 text-2xs font-bold whitespace-nowrap"
                >
                  {copiedTrack ? <Check size={12} className="text-(--success-fg)" /> : <Copy size={12} />}
                  <span>{copiedTrack ? "Nusxalandi" : "Nusxa olish"}</span>
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedForTrack(null)}
              >
                Yopish
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- 3. FOYDA KO'RISH MODALI ---------------- */}
      <Modal
        open={Boolean(selectedForProfit)}
        onOpenChange={(open) => !open && setSelectedForProfit(null)}
        title={selectedForProfit ? `Sof foyda tahlili: ${selectedForProfit.orderNumber}` : "Foyda hisob-kitobi"}
        wide
      >
        {selectedForProfit && (() => {
          const quoted = selectedForProfit.quotedPrice ?? 0n;
          const cost = selectedForProfit.costPrice;
          const profit = quoted > 0n ? quoted - cost : 0n;
          const margin = quoted > 0n ? calcMarginPercent(profit, quoted) : 0;

          return (
            <div className="space-y-4 text-xs sm:text-sm">
              {/* Asosiy 4 ta karta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <span className="text-2xs text-muted-foreground block font-semibold">Tannarx (Kirim)</span>
                  <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">
                    {formatMoney(cost)}
                  </span>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <span className="text-2xs text-muted-foreground block font-semibold">Kelishilgan narx</span>
                  <span className="font-mono font-bold text-sm text-foreground mt-0.5 block">
                    {quoted > 0n ? formatMoney(quoted) : "Belgilanmagan"}
                  </span>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <span className="text-2xs text-muted-foreground block font-semibold">Kutilayotgan sof foyda</span>
                  <span className={`font-mono font-black text-sm mt-0.5 block ${profit >= 0n ? "text-(--success-fg)" : "text-(--danger-fg)"}`}>
                    {profit >= 0n ? "+" : ""}{formatMoney(profit)}
                  </span>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <span className="text-2xs text-muted-foreground block font-semibold">Rentabellik (Marja)</span>
                  <span className="font-mono font-black text-sm text-primary mt-0.5 block">
                    {margin}%
                  </span>
                </div>
              </div>

              {/* Komponentlar bo'yicha tannarx va sotuv tahlili */}
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Komponentlar kesimida tannarx va hisob:
                </span>
                <div className="rounded-control border border-border overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-caption font-bold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-2.5">Qism</th>
                        <th className="p-2.5">Mahsulot nomi</th>
                        <th className="p-2.5 text-right">Tannarx</th>
                        <th className="p-2.5 text-right">Katalog narxi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedForProfit.components.map((c, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-2.5 font-bold uppercase text-2xs text-muted-foreground">
                            {c.roleNameUz}
                          </td>
                          <td className="p-2.5 font-semibold text-foreground">
                            {c.productName}
                          </td>
                          <td className="p-2.5 text-right font-mono text-muted-foreground">
                            {formatMoney(c.costPrice ?? 0n)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-foreground">
                            {formatMoney(c.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedForProfit(null)}
                >
                  Yopish
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
