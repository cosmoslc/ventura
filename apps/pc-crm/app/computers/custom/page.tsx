"use client";
import { Input } from "@ventura/ui/input";
import { Textarea } from "@ventura/ui/textarea";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Cpu,
  HardDrive,
  Info,
  Layers,
  MemoryStick,
  Monitor,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Wrench,
  Zap,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Modal } from "@ventura/ui/modal";
import { Footer } from "@/components/storefront/footer";
import { AuthModal } from "@/components/storefront/auth-modal";
import { Navbar } from "@/components/storefront/navbar";
import { formatMoney } from "@/lib/format";
import { getStorefrontConfiguratorPartsAction, savePcOrderAction } from "@/lib/server/actions";
import {
  type ConfiguratorPart,
} from "@/lib/pc-data";

type ComponentRole = "cpu" | "motherboard" | "gpu" | "ram" | "ssd" | "psu" | "cooler" | "case";
type StorefrontConfiguratorPart = Omit<ConfiguratorPart, "costPrice">;

interface CategoryMeta {
  role: ComponentRole;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  description: string;
}

const CATEGORIES: CategoryMeta[] = [
  { role: "cpu", title: "Protsessor (CPU)", icon: Cpu, description: "Tizimning yuragi va hisoblash kuchi" },
  { role: "motherboard", title: "Ona plata", icon: Layers, description: "Barcha komponentlarni birlashtiruvchi poydevor" },
  { role: "gpu", title: "Videokarta (GPU)", icon: Monitor, description: "Grafika, oʻyinlar va 3D render unumdorligi" },
  { role: "ram", title: "Operativ xotira (RAM)", icon: MemoryStick, description: "Koʻp vazifalilik va tezkor maʼlumot oqimi" },
  { role: "ssd", title: "Doimiy xotira (SSD)", icon: HardDrive, description: "Operatsion tizim va oʻyinlar yuklanish tezligi" },
  { role: "psu", title: "Quvvat bloki (PSU)", icon: Zap, description: "Komponentlarga barqaror elektr taʼminoti" },
  { role: "cooler", title: "Sovutish tizimi", icon: Sparkles, description: "Protsessor haroratini optimal saqlash" },
  { role: "case", title: "Korpus (Case)", icon: Wrench, description: "Dizayn, shamollatish va kabel boshqaruvi" },
];

export default function CustomPcConfiguratorPage() {
  const [activeRole, setActiveRole] = useState<ComponentRole>("cpu");
  const [searchQuery, setSearchQuery] = useState("");
  const [parts, setParts] = useState<StorefrontConfiguratorPart[]>([]);
  const [error, setError] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [selectedParts, setSelectedParts] = useState<Partial<Record<ComponentRole, StorefrontConfiguratorPart>>>({});

  useEffect(() => {
    let active = true;
    void getStorefrontConfiguratorPartsAction().then((result) => {
      if (!active) return;
      if (result.success) {
        setParts(result.parts);
        setSelectedParts((prev) => {
          if (Object.keys(prev).length > 0) return prev;
          const initial: Partial<Record<ComponentRole, StorefrontConfiguratorPart>> = {};
          for (const cat of CATEGORIES) {
            const part = result.parts.find((p) => p.role === cat.role);
            if (part) initial[cat.role] = part;
          }
          return initial;
        });
      }
      else setError(result.error ?? "Konfigurator qismlarini yuklab bo'lmadi");
    }).catch(() => { if (active) setError("Konfigurator qismlarini yuklab bo'lmadi"); });
    return () => { active = false; };
  }, []);


  // Buyurtma formasi holati
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("+998 ");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [orderCreatedId, setOrderCreatedId] = useState<string | null>(null);

  // Faol kategoriyaga mos mahsulotlar
  const availablePartsForActiveRole = useMemo(() => {
    return parts.filter((p) => {
      if (p.role !== activeRole) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q) ||
          p.specsSummary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [parts, activeRole, searchQuery]);

  // Jami hisob-kitoblar
  const selectedCount = Object.keys(selectedParts).length;
  const totalPrice = useMemo(() => {
    return Object.values(selectedParts).reduce((acc, part) => {
      return acc + (part ? part.price : 0n);
    }, 0n);
  }, [selectedParts]);

  // Taxminiy elektr iste'moli (TDP)
  const estimatedTdp = useMemo(() => {
    const cpuTdp = selectedParts.cpu?.tdpWatts ?? 0;
    const gpuTdp = selectedParts.gpu?.tdpWatts ?? 0;
    // Tizimning qolgan qismi uchun ~75W baza
    const baseTdp = 75;
    return cpuTdp + gpuTdp + (cpuTdp || gpuTdp ? baseTdp : 0);
  }, [selectedParts]);

  const handleSelectPart = (part: StorefrontConfiguratorPart) => {
    setSelectedParts((prev) => ({
      ...prev,
      [part.role]: part,
    }));
  };

  const handleRemovePart = (role: ComponentRole) => {
    setSelectedParts((prev) => {
      const copy = { ...prev };
      delete copy[role];
      return copy;
    });
  };

  const handleResetAll = () => {
    setSelectedParts({});
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim() || selectedCount === 0) return;
    const result = await savePcOrderAction({
      customerName,
      customerPhone,
      deliveryAddress: customerAddress,
      customerNote,
      componentIds: Object.values(selectedParts).filter((part): part is StorefrontConfiguratorPart => Boolean(part)).map(({ role, id }) => ({ role, productId: id })),
    });
    if (!result.success) {
      if (result.error?.toLowerCase().includes("tizimga") || result.error?.toLowerCase().includes("kirish")) {
        setIsOrderModalOpen(false);
        setAuthModalOpen(true);
      }
      setError(result.error ?? "PC buyurtmasi saqlanmadi. Qayta urinib ko'ring.");
      return;
    }
    setError("");
    if (!result.orderNumber) {
      setError("Server buyurtma raqamini qaytarmadi. Qayta urinib ko'ring.");
      return;
    }
    setOrderCreatedId(result.orderNumber);
  };

  const activeCategoryMeta = CATEGORIES.find((c) => c.role === activeRole) ?? CATEGORIES[0]!;

  return (
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* Banner qismi */}
        <section className="border-b border-border bg-card/60 py-6 sm:py-8">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
                  <Wrench size={13} />
                  <span>Onlayn PC Konfigurator</span>
                </div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  Oʻz orzuingizdagi shaxsiy kompyuterni yigʻing
                </h1>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                  Har bir komponent omborda mavjudligiga qarab tanlanadi. Yakunda buyurtma operatorga yuboriladi.
                </p>
              </div>

              {/* Tozalash va Yordam */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetAll}
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw size={13} />
                  Hammasini tozalash
                </Button>
                <Link href="/computers">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
                    Tayyor PC larni koʻrish
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Asosiy Konfigurator ish maydoni */}
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 py-8 sm:px-6">
          {error && <div role="alert" className="mb-4 rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)">{error}</div>}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            {/* Chap tomon: Bosqichlar va Komponentlar katalogi (8 ustun) */}
            <div className="lg:col-span-8 space-y-6">
              {/* Kategoriya tablari (Gorizontal qator) */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {CATEGORIES.map((cat, idx) => {
                  const Icon = cat.icon;
                  const isSelected = Boolean(selectedParts[cat.role]);
                  const isActive = activeRole === cat.role;

                  return (
                    <button
                      key={cat.role}
                      type="button"
                      onClick={() => {
                        setActiveRole(cat.role);
                        setSearchQuery("");
                      }}
                      className={`flex shrink-0 items-center gap-2 rounded-btn border px-3.5 py-2 text-xs font-semibold transition-all ${
                        isActive
                          ? "border-primary bg-primary text-primary-foreground shadow-card"
                          : isSelected
                          ? "border-(--success-border) bg-(--success-bg) text-foreground"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      <Icon size={14} />
                      <span>{cat.title.split(" ")[0]}</span>
                      {isSelected && (
                        <Check size={12} className={isActive ? "text-primary-foreground" : "text-(--success-fg)"} />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Faol kategoriya tavsifi va qidiruv */}
              <div className="rounded-card border border-border bg-card p-5">
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2">
                      <activeCategoryMeta.icon size={18} className="text-primary" />
                      {activeCategoryMeta.title}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{activeCategoryMeta.description}</p>
                  </div>

                  {/* Qidiruv */}
                  <div className="relative w-full sm:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Qidirish..."
                      className="w-full rounded-control border border-input bg-background py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Komponentlar ro'yxati */}
                <div className="space-y-3">
                  {availablePartsForActiveRole.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      Ushbu toifada qidiruv boʻyicha mahsulot topilmadi.
                    </div>
                  ) : (
                    availablePartsForActiveRole.map((part) => {
                      const isChosen = selectedParts[activeRole]?.id === part.id;

                      return (
                        <div
                          key={part.id}
                          onClick={() => handleSelectPart(part)}
                          className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-card border p-4 cursor-pointer transition-all ${
                            isChosen
                              ? "border-primary bg-primary/5 ring-1 ring-primary shadow-control"
                              : "border-border bg-card hover:border-primary/50 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            {/* Rasm */}
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-control border border-border bg-media p-1.5">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={part.imageUrl}
                                alt={part.name}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs uppercase tracking-wider text-primary">
                                  {part.brand}
                                </span>
                                <Badge tone="neutral" className="text-2xs font-mono py-0 px-1.5">
                                  Omborda: {part.stock} dona
                                </Badge>
                              </div>
                              <h3 className="font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                                {part.name}
                              </h3>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {part.specsSummary}
                              </p>
                            </div>
                          </div>

                          {/* Narx va Tanlash tugmasi */}
                          <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-border">
                            <span className="font-mono text-base font-bold text-foreground">
                              {formatMoney(part.price)}
                            </span>

                            <button
                              type="button"
                              className={`flex h-8 items-center gap-1.5 rounded-btn px-3 text-xs font-bold transition-all ${
                                isChosen
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-secondary text-secondary-foreground hover:bg-primary hover:text-primary-foreground"
                              }`}
                            >
                              {isChosen ? (
                                <>
                                  <Check size={14} />
                                  Tanlangan
                                </>
                              ) : (
                                <>
                                  <Plus size={14} />
                                  Tanlash
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* O'ng tomon: Tanlangan konfiguratsiya va Xulosa (4 ustun, Sticky) */}
            <div className="lg:col-span-4 space-y-5">
              <div className="sticky top-20 rounded-card border border-border bg-card p-5 shadow-card space-y-5">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h3 className="font-bold text-base flex items-center gap-2">
                      <PackageCheck size={18} className="text-primary" />
                      Konfiguratsiya xulosasi
                    </h3>
                    <span className="text-xs font-bold text-primary">
                      {selectedCount} / 8 tanlandi
                    </span>
                  </div>

                  {/* Tanlangan qismlar ro'yxati */}
                  <div className="mt-3 space-y-2.5 max-h-95 overflow-y-auto pr-1">
                    {CATEGORIES.map((cat) => {
                      const part = selectedParts[cat.role];

                      if (!part) {
                        return (
                          <div
                            key={cat.role}
                            onClick={() => setActiveRole(cat.role)}
                            className="flex items-center justify-between rounded-control border border-dashed border-border p-2.5 text-xs text-muted-foreground hover:border-primary/50 cursor-pointer"
                          >
                            <span className="font-medium flex items-center gap-1.5">
                              <cat.icon size={13} />
                              {cat.title.split(" ")[0]}
                            </span>
                            <span className="text-caption text-primary hover:underline font-semibold">
                              + Tanlash
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={cat.role}
                          className="flex items-center justify-between gap-2 rounded-control border border-border bg-muted/30 p-2.5 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-2xs font-bold uppercase tracking-wider text-muted-foreground">
                              {cat.title.split(" ")[0]}
                            </span>
                            <span className="block font-semibold text-foreground truncate">
                              {part.name}
                            </span>
                            <span className="font-mono text-caption text-primary">
                              {formatMoney(part.price)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemovePart(cat.role)}
                            className="p-1 text-muted-foreground hover:text-(--danger-fg) transition-colors"
                            aria-label="Oʻchirish"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Quvvat hisobi (TDP Dashboard Meter) */}
                <div className="rounded-card bg-secondary/40 border border-border/80 p-3.5 text-xs space-y-2 shadow-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span className="flex items-center gap-1.5 text-primary">
                      <Zap size={14} />
                      Tizim quvvat sarfi (TDP):
                    </span>
                    <span className="font-mono font-black text-foreground">
                      {estimatedTdp > 0 ? `${estimatedTdp}W` : "0W"}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full bg-border/60 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-primary-hover rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(8, (estimatedTdp / 850) * 100))}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-2xs text-muted-foreground pt-0.5">
                    <span>Tavsiya etilgan PSU:</span>
                    <span className="font-bold text-foreground font-mono">
                      {estimatedTdp > 0 ? `${Math.ceil((estimatedTdp + 150) / 50) * 50}W` : "650W+"}
                    </span>
                  </div>
                </div>

                {/* Umumiy narx */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                      Jami qiymat:
                    </span>
                    <span className="font-mono text-2xl font-black text-foreground">
                      {formatMoney(totalPrice)}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    size="default"
                    disabled={selectedCount === 0}
                    onClick={() => setIsOrderModalOpen(true)}
                    className="w-full gap-2 font-bold shadow-card-hover"
                  >
                    <Send size={16} />
                    Buyurtma berish ({selectedCount} ta qism)
                  </Button>

                  <p className="mt-2 text-center text-caption text-muted-foreground">
                    Yakuniy narx va mavjudlikni operator buyurtmadan soʻng tasdiqlaydi.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Buyurtma berish modali */}
      <Modal
        open={isOrderModalOpen}
        onOpenChange={(open) => {
          setIsOrderModalOpen(open);
          if (!open) setOrderCreatedId(null);
        }}
        title={orderCreatedId ? "Buyurtmangiz qabul qilindi!" : "Shaxsiy PC uchun buyurtma rasmiylashtirish"}
      >
        {orderCreatedId ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-(--success-bg) text-(--success-fg)">
              <CheckCircle2 size={36} />
            </div>

            <div>
              <Badge tone="success" className="font-mono text-xs px-2.5 py-1 font-bold">
                ID: {orderCreatedId}
              </Badge>
              <h3 className="mt-2 text-lg font-bold">Rahmat, {customerName}!</h3>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Sizning yigʻma kompyuter buyurtmangiz muvaffaqiyatli saqlandi. Muhandislarimiz komponentlarni tekshirib, tez orada siz bilan bogʻlanishadi.
              </p>
            </div>

            <div className="rounded-control bg-muted/60 p-3.5 text-left text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mijoz:</span>
                <span className="font-bold text-foreground">{customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telefon:</span>
                <span className="font-bold text-foreground">{customerPhone}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Taxminiy summa:</span>
                <span className="font-bold text-primary">{formatMoney(totalPrice)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <p className="rounded-control bg-muted/50 p-3 text-xs text-muted-foreground">
                Operator buyurtmangizni tekshirib, siz bilan ko‘rsatilgan telefon raqami orqali bog‘lanadi.
              </p>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsOrderModalOpen(false);
                  setOrderCreatedId(null);
                }}
              >
                Yopish
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleOrderSubmit} className="space-y-4 text-xs sm:text-sm">
            <div className="rounded-control bg-muted/50 p-3 text-xs space-y-1">
              <div className="flex justify-between font-bold">
                <span>Tanlangan qismlar:</span>
                <span>{selectedCount} ta komponent</span>
              </div>
              <div className="flex justify-between font-bold text-primary">
                <span>Jami summa:</span>
                <span className="font-mono text-sm">{formatMoney(totalPrice)}</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Ism va familiyangiz *
              </label>
              <Input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Masalan: Sardorbek Rahimov"
                className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Telefon raqamingiz *
              </label>
              <Input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground font-mono focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Yetkazib berish manzili *
              </label>
              <Input
                type="text"
                required
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Toshkent sh., Chilonzor tumani..."
                className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                Qoʻshimcha istaklar yoki izoh
              </label>
              <Textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Masalan: Oq rangli kabel management, Windows 11 oʻrnatish..."
                className="w-full rounded-control border border-input bg-background px-3 py-2 text-xs sm:text-sm text-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsOrderModalOpen(false)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" variant="primary" size="sm" className="gap-2">
                <Send size={14} />
                Tasdiqlash va yuborish
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Footer />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
