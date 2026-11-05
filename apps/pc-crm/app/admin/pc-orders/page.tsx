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
  MoreHorizontal,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@ventura/ui/dropdown-menu";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { StatCard } from "@ventura/ui/stat-card";
import { toast } from "@ventura/ui/toast";
import { calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { type PcOrderItem } from "@/lib/pc-data";
import { getAdminPcOrdersAction, updatePcOrderStatusAction } from "@/lib/server/actions";
import { useFinancialMode } from "@/lib/store-context";

const getStatusLabels = (isFinancial: boolean): Record<PcOrderItem["status"], { label: string; tone: "info" | "warning" | "success" | "neutral" | "danger" }> => ({
  new: { label: "Yangi zakaz", tone: "info" },
  reviewing: { label: "Koʻrib chiqilmoqda", tone: "warning" },
  quoted: { label: isFinancial ? "Narx taklif etildi" : "Kelishildi", tone: "info" },
  confirmed: { label: "Tasdiqlangan", tone: "success" },
  assembling: { label: "Yigʻilmoqda", tone: "warning" },
  ready: { label: "Tayyor (Testda)", tone: "success" },
  delivered: { label: "Yetkazildi", tone: "neutral" },
  cancelled: { label: "Bekor qilindi", tone: "danger" },
});

const getOrderTimelineSteps = (isFinancial: boolean): { status: PcOrderItem["status"]; title: string; desc: string }[] => [
  { status: "new", title: "1. Yangi zakaz", desc: "Mijoz konfigurator orqali zakaz qoldirdi" },
  { status: "reviewing", title: "2. Koʻrib chiqilmoqda", desc: isFinancial ? "Operator qismlar mosligi va narxni tekshirmoqda" : "Operator qismlar mosligi va ombor qoldigʻini tekshirmoqda" },
  { status: "quoted", title: isFinancial ? "3. Narx taklif etildi" : "3. Buyurtma kelishildi", desc: isFinancial ? "Mijozga yakuniy narx va yetkazish vaqti aytildi" : "Mijozga buyurtma tafsilotlari va yetkazish vaqti aytildi" },
  { status: "confirmed", title: "4. Tasdiqlangan", desc: "Mijoz rozi boʻldi, qismlar omborda zaxiraga olindi" },
  { status: "assembling", title: "5. Yigʻilmoqda", desc: "Texnik usta PCni montaj qilib simlarni tartibga solmoqda" },
  { status: "ready", title: "6. Tayyor (Testda)", desc: "Stress-testdan oʻtkazildi, topshirishga tayyor" },
  { status: "delivered", title: "7. Yetkazildi", desc: isFinancial ? "Mijozga topshirildi va toʻlov toʻliq qabul qilindi" : "Mijozga kompyuter muvaffaqiyatli topshirildi" },
];

export default function AdminPcOrdersPage() {
  const isFinancial = useFinancialMode();
  const STATUS_LABELS = useMemo(() => getStatusLabels(isFinancial), [isFinancial]);
  const ORDER_TIMELINE_STEPS = useMemo(() => getOrderTimelineSteps(isFinancial), [isFinancial]);
  const [orders, setOrders] = useState<PcOrderItem[]>([]);

  const loadOrders = useCallback(async () => {
    const result = await getAdminPcOrdersAction();
    if (!result.success) {
      toast({ tone: "danger", title: result.error ?? "PC buyurtmalarini yuklab boʻlmadi" });
      return;
    }
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
      toast({ tone: "danger", title: result.error ?? "Statusni oʻzgartirib boʻlmadi" });
      await loadOrders(); // rollback
    } else {
      toast({
        tone: "success",
        title: "Holat yangilandi",
        description: `"${order.orderNumber}" buyurtmasi "${STATUS_LABELS[nextStatus].label}" bosqichiga oʻtkazildi.`,
      });
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
    if (!result.success) {
      toast({ tone: "danger", title: result.error ?? "PC buyurtmasini yangilab boʻlmadi" });
      return;
    }
    toast({
      tone: "success",
      title: "Muvaffaqiyatli saqlandi",
      description: `"${selectedForDetail.orderNumber}" buyurtmasi yangilandi.`,
    });
    setSelectedForDetail(null);
    await loadOrders();
  };

  const copyTrackerUrl = (orderNumber: string) => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/computers/custom?track=${orderNumber}`;
    void navigator.clipboard.writeText(url);
    setCopiedTrack(true);
    toast({
      tone: "success",
      title: "Havola nusxalandi",
      description: "Buyurtmani kuzatish havolasi clipboardga saqlandi.",
    });
    setTimeout(() => setCopiedTrack(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            PC Zakazlar
          </h1>
        </div>
      </div>

      {/* 4 ta Statistik karta */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Layers />} label="Yangi zakazlar" value={`${stats.newCount} ta`} tone={1} />
        <StatCard icon={<Clock />} label="Jarayonda" value={`${stats.inProgressCount} ta`} tone={2} />
        <StatCard icon={<CheckCircle2 />} label="Tayyor / Yetkazilgan" value={`${stats.readyDeliveredCount} ta`} tone={3} />
        {isFinancial ? (
          <StatCard icon={<Wrench />} label="Kutilayotgan umumiy qiymat" value={formatMoney(stats.totalRevenue)} tone={4} valueClassName="whitespace-nowrap text-title" />
        ) : (
          <StatCard icon={<Wrench />} label="Jami buyurtmalar" value={`${orders.length} ta`} tone={4} />
        )}
      </div>

      {/* Filterlar qatori */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-card p-3 shadow-card">
        {/* Qidiruv */}
        <div className="relative flex-1 min-w-60">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buyurtma ID, ism, telefon yoki PC boʻyicha qidirish..."
            className="pl-9 text-xs"
          />
        </div>

        {/* Holat filteri */}
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="PC zakaz holati" className="w-auto min-w-44 text-xs">
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
      </div>

      {/* Zakazlar jadvali */}
      <div className="overflow-x-auto rounded-card border border-border bg-card shadow-card">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-border bg-muted/40 font-bold text-muted-foreground uppercase text-caption tracking-wider">
              <th className="p-3.5">Zakaz qilingan PC</th>
              <th className="p-3.5 whitespace-nowrap">Zakaschi</th>
              {isFinancial ? (
                <>
                  <th className="p-3.5 text-right whitespace-nowrap">Tannarx</th>
                  <th className="p-3.5 text-right whitespace-nowrap">Kelishilgan narx</th>
                </>
              ) : (
                <th className="p-3.5 text-center whitespace-nowrap">Tarkibiy qismlar</th>
              )}
              <th className="p-3.5 text-center whitespace-nowrap">Status</th>
              <th className="p-3.5 text-right whitespace-nowrap">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  Zakaz topilmadi.
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const hasQuote = order.quotedPrice && order.quotedPrice > 0n;

                return (
                  <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                    {/* 1. Zakaz qilingan PC nomi va tagida kichik Buyurtma ID */}
                    <td className="p-3.5 max-w-xs">
                      <p className="font-bold text-foreground truncate" title={order.pcName || "Custom PC Build"}>
                        {order.pcName || "Custom PC Build"}
                      </p>
                      <div className="flex items-center gap-1.5 text-caption font-mono text-muted-foreground mt-0.5">
                        <span>{order.orderNumber}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span>{order.createdAt}</span>
                      </div>
                    </td>

                    {/* 2. Zakaschi: Ism-familiya tagida telefon raqami */}
                    <td className="p-3.5 min-w-[150px]">
                      <p className="font-bold text-foreground">{order.customerName}</p>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="text-caption font-mono text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1 mt-0.5"
                        title="Qoʻngʻiroq qilish"
                      >
                        <Phone size={11} className="text-muted-foreground" />
                        <span>{order.customerPhone}</span>
                      </a>
                      {order.deliveryAddress && (
                        <p className="text-2xs text-muted-foreground/80 truncate max-w-[200px] mt-0.5" title={order.deliveryAddress}>
                          {order.deliveryAddress}
                        </p>
                      )}
                    </td>

                    {isFinancial ? (
                      <>
                        {/* 3. Tannarx */}
                        <td className="p-3.5 text-right font-mono font-semibold text-muted-foreground whitespace-nowrap">
                          {formatMoney(order.costPrice)}
                        </td>

                        {/* 4. Kelishilgan narx */}
                        <td className="p-3.5 text-right font-black text-foreground whitespace-nowrap">
                          {hasQuote ? (
                            formatMoney(order.quotedPrice!)
                          ) : (
                            <span className="text-caption text-muted-foreground italic font-normal">
                              Belgilanmagan
                            </span>
                          )}
                        </td>
                      </>
                    ) : (
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-2xs font-semibold text-muted-foreground">
                          {order.components?.length || 0} ta butlovchi
                        </span>
                      </td>
                    )}

                    {/* 5. Status (To'g'ridan-to'g'ri o'zgaruvchan toza Selector Box, ortiqcha Badge'siz) */}
                    <td className="p-3.5 text-center whitespace-nowrap">
                      <Select
                        value={order.status}
                        onValueChange={(val) => handleDirectStatusChange(order, val as PcOrderItem["status"])}
                      >
                        <SelectTrigger
                          aria-label="Holatni oʻzgartirish"
                          className="h-7.5 w-auto min-w-[145px] text-xs font-semibold px-2.5 mx-auto bg-card"
                        >
                          <span className="inline-flex items-center gap-1.5 font-medium text-xs">
                            <span
                              className={`size-2 rounded-full shrink-0 ${
                                order.status === "new" || order.status === "reviewing"
                                  ? "bg-amber-500"
                                  : order.status === "quoted"
                                  ? "bg-blue-500"
                                  : order.status === "confirmed" || order.status === "ready"
                                  ? "bg-emerald-500"
                                  : order.status === "assembling"
                                  ? "bg-orange-500"
                                  : order.status === "delivered"
                                  ? "bg-slate-400"
                                  : "bg-rose-500"
                              }`}
                            />
                            <span className="text-foreground">{STATUS_LABELS[order.status].label}</span>
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Yangi zakaz</SelectItem>
                          <SelectItem value="reviewing">Koʻrib chiqilmoqda</SelectItem>
                          <SelectItem value="quoted">{isFinancial ? "Narx taklif etildi" : "Kelishildi"}</SelectItem>
                          <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                          <SelectItem value="assembling">Yigʻilmoqda</SelectItem>
                          <SelectItem value="ready">Tayyor (Testda)</SelectItem>
                          <SelectItem value="delivered">Yetkazildi</SelectItem>
                          <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>

                    {/* 6. Amallar: edu crm kabi 3 ta nuqta menyusi */}
                    <td className="p-3.5 text-right whitespace-nowrap">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="subtle"
                            size="icon-sm"
                            aria-label="Amallar"
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onSelect={() => handleOpenDetailModal(order)}>
                            <FileText className="size-4 mr-2 text-primary" />
                            <span>Batafsil</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setSelectedForTrack(order)}>
                            <Compass className="size-4 mr-2 text-amber-500" />
                            <span>Kuzatish</span>
                          </DropdownMenuItem>
                          {isFinancial && (
                            <DropdownMenuItem onSelect={() => setSelectedForProfit(order)}>
                              <TrendingUp className="size-4 mr-2 text-(--success-fg)" />
                              <span>Foyda koʻrish</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => window.open(`tel:${order.customerPhone}`, "_self")}>
                            <PhoneCall className="size-4 mr-2 text-primary" />
                            <span>Telefon qilish</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ---------------- 1. BATAFSIL MODALI ---------------- */}
      <Modal
        open={Boolean(selectedForDetail)}
        onOpenChange={(open) => !open && setSelectedForDetail(null)}
        title={selectedForDetail ? `Zakaz tafsilotlari: ${selectedForDetail.orderNumber}` : "Zakaz tafsilotlari"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelectedForDetail(null)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="order-detail-form">
              <Check /> Saqlash
            </Button>
          </>
        }
      >
        {selectedForDetail && (
          <form id="order-detail-form" onSubmit={handleSaveDetailChanges} className="space-y-4">
            {/* Mijoz haqida ma'lumot */}
            <div className="rounded-control bg-muted/60 p-4 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-foreground text-base">{selectedForDetail.customerName}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <a
                      href={`tel:${selectedForDetail.customerPhone}`}
                      className="font-mono text-body text-primary hover:underline flex items-center gap-1 font-semibold"
                    >
                      <Phone size={14} />
                      {selectedForDetail.customerPhone}
                    </a>
                    <Link
                      href={`https://t.me/share/url?url=${encodeURIComponent(
                        `Mijoz: ${selectedForDetail.customerName}, Tel: ${selectedForDetail.customerPhone}`
                      )}&text=${encodeURIComponent(
                        `Assalomu alaykum ${selectedForDetail.customerName}! Ventura PC dan sizning zakazingiz (${selectedForDetail.orderNumber}) boʻyicha bogʻlanyapmiz.`
                      )}`}
                      target="_blank"
                      className="text-body text-muted-foreground hover:text-primary flex items-center gap-1"
                    >
                      <MessageCircle size={14} />
                      Telegram
                    </Link>
                  </div>
                </div>
                <Badge tone={STATUS_LABELS[selectedForDetail.status].tone}>
                  {STATUS_LABELS[selectedForDetail.status].label}
                </Badge>
              </div>

              {selectedForDetail.deliveryAddress && (
                <FieldHint className="mt-1">
                  <strong>Manzil:</strong> {selectedForDetail.deliveryAddress}
                </FieldHint>
              )}

              {selectedForDetail.customerNote && (
                <div className="rounded-control border border-primary/20 bg-primary/5 p-3 text-body mt-2">
                  <div className="font-semibold text-primary">Mijoz istagi / Izohi:</div>
                  <p className="text-foreground mt-0.5">{selectedForDetail.customerNote}</p>
                </div>
              )}
            </div>

            {/* Tanlangan komponentlar ro'yxati */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-body font-semibold text-foreground">
                  Tanlangan qismlar ({selectedForDetail.components.length} ta):
                </div>
                {isFinancial && (
                  <div className="text-body font-bold text-foreground">
                    Umumiy tannarx: {formatMoney(selectedForDetail.costPrice)}
                  </div>
                )}
              </div>
              <div className="rounded-control border border-border divide-y divide-border max-h-56 overflow-y-auto">
                {selectedForDetail.components.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 text-body hover:bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-caption text-muted-foreground min-w-20">
                        {c.roleNameUz}
                      </span>
                      <span className="font-medium text-foreground">{c.productName}</span>
                    </div>
                    {isFinancial && (
                      <span className="font-bold text-foreground whitespace-nowrap pl-2">
                        {formatMoney(c.price)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Hisob-kitob qatori (faqat moliyaviy rejimda) */}
            {isFinancial && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border">
                <div className="rounded-control bg-muted/40 p-3">
                  <FieldHint className="mt-0">Komponentlar tannarxi:</FieldHint>
                  <div className="font-bold text-base text-foreground mt-0.5">
                    {formatMoney(selectedForDetail.costPrice)}
                  </div>
                </div>

                <div>
                  <Label htmlFor="order-quote-price">Kelishilgan narx (UZS)</Label>
                  <Input
                    id="order-quote-price"
                    value={quotePriceStr}
                    onChange={(e) => setQuotePriceStr(e.target.value)}
                    placeholder="Masalan: 18 500 000"
                  />
                </div>
              </div>
            )}

            {/* Status va Operator izohi */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div>
                <Label htmlFor="order-status-select">Statusni yangilash</Label>
                <Select value={modalStatus} onValueChange={(v) => setModalStatus(v as PcOrderItem["status"])}>
                  <SelectTrigger id="order-status-select" aria-label="Statusni yangilash" className="w-full">
                    <SelectValue placeholder="Statusni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Yangi zakaz</SelectItem>
                    <SelectItem value="reviewing">Koʻrib chiqilmoqda</SelectItem>
                    <SelectItem value="quoted">{isFinancial ? "Narx taklif etildi" : "Kelishildi"}</SelectItem>
                    <SelectItem value="confirmed">Tasdiqlangan</SelectItem>
                    <SelectItem value="assembling">Yigʻilmoqda</SelectItem>
                    <SelectItem value="ready">Tayyor (Testda)</SelectItem>
                    <SelectItem value="delivered">Yetkazildi</SelectItem>
                    <SelectItem value="cancelled">Bekor qilindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="order-operator-note">Operator izohi</Label>
                <Input
                  id="order-operator-note"
                  value={operatorNote}
                  onChange={(e) => setOperatorNote(e.target.value)}
                  placeholder="Mijoz bilan kelishuv tafsilotlari..."
                />
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* ---------------- 2. KUZATISH MODALI ---------------- */}
      <Modal
        open={Boolean(selectedForTrack)}
        onOpenChange={(open) => !open && setSelectedForTrack(null)}
        title={selectedForTrack ? `Buyurtma jarayoni: ${selectedForTrack.orderNumber}` : "Kuzatish"}
        footer={
          <Button variant="ghost" onClick={() => setSelectedForTrack(null)}>
            Yopish
          </Button>
        }
      >
        {selectedForTrack && (
          <div className="space-y-4">
            {/* Header ma'lumoti */}
            <div className="rounded-control bg-muted/40 p-3.5 flex items-center justify-between">
              <div>
                <div className="font-bold text-foreground text-base">{selectedForTrack.pcName || "Custom PC Build"}</div>
                <FieldHint className="mt-0.5">Mijoz: {selectedForTrack.customerName} ({selectedForTrack.customerPhone})</FieldHint>
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
                      className={`absolute -left-6 mt-0.5 size-5 rounded-full grid place-items-center text-caption transition-colors ${
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
                      <p className={`text-body font-semibold ${isCurrent ? "text-primary font-bold" : isPassed ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.title}
                      </p>
                      <FieldHint className="mt-0.5">
                        {step.desc}
                      </FieldHint>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Havolani nusxalash bloki */}
            <div className="rounded-control border border-border bg-card p-3 space-y-2">
              <FieldHint className="mt-0 font-semibold text-foreground">
                Mijozga yuboriladigan kuzatuv havolasi:
              </FieldHint>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={`/computers/custom?track=${selectedForTrack.orderNumber}`}
                  className="font-mono bg-muted text-muted-foreground"
                />
                <Button
                  type="button"
                  variant="subtle"
                  onClick={() => copyTrackerUrl(selectedForTrack.orderNumber)}
                  className="gap-1.5 font-bold whitespace-nowrap"
                >
                  {copiedTrack ? <Check size={14} className="text-(--success-fg)" /> : <Copy size={14} />}
                  <span>{copiedTrack ? "Nusxalandi" : "Nusxa olish"}</span>
                </Button>
              </div>
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
        footer={
          <Button variant="ghost" onClick={() => setSelectedForProfit(null)}>
            Yopish
          </Button>
        }
      >
        {selectedForProfit && (() => {
          const quoted = selectedForProfit.quotedPrice ?? 0n;
          const cost = selectedForProfit.costPrice;
          const profit = quoted > 0n ? quoted - cost : 0n;
          const margin = quoted > 0n ? calcMarginPercent(profit, quoted) : 0;

          return (
            <div className="space-y-4">
              {/* Asosiy 4 ta karta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <FieldHint className="mt-0">Tannarx (Kirim)</FieldHint>
                  <div className="font-bold text-body text-foreground mt-0.5">
                    {formatMoney(cost)}
                  </div>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <FieldHint className="mt-0">Kelishilgan narx</FieldHint>
                  <div className="font-bold text-body text-foreground mt-0.5">
                    {quoted > 0n ? formatMoney(quoted) : "Belgilanmagan"}
                  </div>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <FieldHint className="mt-0">Kutilayotgan sof foyda</FieldHint>
                  <div className={`font-bold text-body mt-0.5 ${profit >= 0n ? "text-(--success-fg)" : "text-(--danger-fg)"}`}>
                    {profit >= 0n ? "+" : ""}{formatMoney(profit)}
                  </div>
                </div>

                <div className="rounded-control bg-muted/40 p-3 border border-border">
                  <FieldHint className="mt-0">Rentabellik (Marja)</FieldHint>
                  <div className="font-bold text-body text-primary mt-0.5">
                    {margin}%
                  </div>
                </div>
              </div>

              {/* Komponentlar bo'yicha tannarx va sotuv tahlili */}
              <div>
                <div className="text-body font-semibold text-foreground mb-2">
                  Komponentlar kesimida tannarx va hisob:
                </div>
                <div className="rounded-control border border-border overflow-hidden">
                  <table className="w-full text-left text-body">
                    <thead className="bg-muted/60 text-caption font-semibold text-muted-foreground border-b border-border">
                      <tr>
                        <th className="p-3">Qism</th>
                        <th className="p-3">Mahsulot nomi</th>
                        <th className="p-3 text-right">Tannarx</th>
                        <th className="p-3 text-right">Katalog narxi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedForProfit.components.map((c, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="p-3 font-semibold text-caption text-muted-foreground">
                            {c.roleNameUz}
                          </td>
                          <td className="p-3 font-medium text-foreground">
                            {c.productName}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">
                            {formatMoney(c.costPrice ?? 0n)}
                          </td>
                          <td className="p-3 text-right font-bold text-foreground">
                            {formatMoney(c.price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
