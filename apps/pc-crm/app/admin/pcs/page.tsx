"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cpu,
  DollarSign,
  Edit2,
  ExternalLink,
  Layers,
  Monitor,
  PackageCheck,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { PcBuildFormModal } from "@/components/admin/pcs/pc-build-form-modal";
import { calcItemProfit, calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { type PcBuildItem, SAMPLE_PC_BUILDS } from "@/lib/pc-data";

export default function AdminPcsPage() {
  const [builds, setBuilds] = useState<PcBuildItem[]>(SAMPLE_PC_BUILDS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold" | "hidden">("all");

  // Yangi / Tahrirlash modali
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBuild, setEditingBuild] = useState<PcBuildItem | null>(null);

  // Oflayn sotish modali
  const [sellingBuild, setSellingBuild] = useState<PcBuildItem | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+998 ");
  const [saleDate, setSaleDate] = useState("2026-10-29");
  const [saleSuccessMessage, setSaleSuccessMessage] = useState<string | null>(null);

  // Filterlangan ro'yxat
  const filteredBuilds = useMemo(() => {
    return builds.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          b.name.toLowerCase().includes(q) ||
          b.cpu.toLowerCase().includes(q) ||
          b.gpu.toLowerCase().includes(q) ||
          b.slug.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [builds, statusFilter, searchQuery]);

  // Statistik hisob-kitoblar
  const stats = useMemo(() => {
    const available = builds.filter((b) => b.status === "available");
    const sold = builds.filter((b) => b.status === "sold");

    const totalExpectedProfit = available.reduce((sum, b) => {
      const profit = b.sellPrice > b.costPrice ? b.sellPrice - b.costPrice : 0n;
      return sum + profit;
    }, 0n);

    const totalAvailableRevenue = available.reduce((sum, b) => sum + b.sellPrice, 0n);
    const avgMargin = calcMarginPercent(totalExpectedProfit, totalAvailableRevenue);

    return {
      availableCount: available.length,
      soldCount: sold.length,
      totalExpectedProfit,
      avgMargin,
    };
  }, [builds]);

  // Saqlash (Yangi yoki Yangilangan)
  const handleSaveBuild = (savedBuild: PcBuildItem) => {
    setBuilds((prev) => {
      const idx = prev.findIndex((b) => b.id === savedBuild.id);
      if (idx >= 0) {
        return prev.map((b, i) => (i === idx ? savedBuild : b));
      }
      return [savedBuild, ...prev];
    });
    setEditingBuild(null);
  };

  // Oflayn sotuvni tasdiqlash
  const handleConfirmSale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingBuild || !buyerName.trim()) return;

    setBuilds((prev) =>
      prev.map((b) =>
        b.id === sellingBuild.id
          ? {
              ...b,
              status: "sold",
              buyerName,
              buyerPhone,
              soldAt: saleDate,
            }
          : b
      )
    );

    const profit = sellingBuild.sellPrice - sellingBuild.costPrice;
    setSaleSuccessMessage(
      `"${sellingBuild.name}" muvaffaqiyatli sotildi! Sof daromad: +${formatMoney(profit)}. Komponentlar ombordan hisobdan chiqarildi.`
    );
    setSellingBuild(null);
    setBuyerName("");
    setBuyerPhone("+998 ");
  };

  const getStatusBadge = (status: PcBuildItem["status"]) => {
    switch (status) {
      case "available":
        return <Badge tone="success">Sotuvda mavjud</Badge>;
      case "sold":
        return <Badge tone="neutral">Sotilgan</Badge>;
      case "hidden":
        return <Badge tone="warning">Yashirin</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sahifa sarlavhasi */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Tayyor kompyuterlar (PClar)</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Ombordagi komponentlardan yigʻilgan kompyuterlar katalogi va tannarx boshqaruvi
          </p>
        </div>

        <Button
          variant="primary"
          size="default"
          onClick={() => {
            setEditingBuild(null);
            setIsFormOpen(true);
          }}
          className="gap-2 font-bold shadow-xs"
        >
          <Plus size={16} />
          Yangi PC yigʻish
        </Button>
      </div>

      {/* Muvaffaqiyat xabari */}
      {saleSuccessMessage && (
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{saleSuccessMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSaleSuccessMessage(null)}
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
            Mavjud PClar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.availableCount} ta</span>
            <Monitor size={20} className="text-emerald-500" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Sotuvga tayyor holatda
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Sotilgan PClar
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black">{stats.soldCount} ta</span>
            <PackageCheck size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Sayt va oflayn orqali
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Kutilayotgan sof foyda
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400 truncate">
              +{formatMoney(stats.totalExpectedProfit)}
            </span>
            <TrendingUp size={20} className="text-emerald-500 shrink-0 ml-1" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Mavjud PClar sotilganda
          </span>
        </div>

        <div className="rounded-[var(--r-card,12px)] border border-border bg-card p-4">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Oʻrtacha Marja
          </span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-black text-primary font-mono">
              {stats.avgMargin}%
            </span>
            <DollarSign size={20} className="text-primary" />
          </div>
          <span className="text-[11px] text-muted-foreground mt-1 block">
            Kompyuterlar boʻyicha rentabellik
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
            placeholder="Nomi, CPU yoki GPU boʻyicha qidirish..."
            className="w-full rounded-[var(--r-input,8px)] border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat tablari */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
          {(
            [
              { label: "Barchasi", value: "all" },
              { label: "Sotuvda", value: "available" },
              { label: "Sotilgan", value: "sold" },
              { label: "Yashirin", value: "hidden" },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setStatusFilter(t.value)}
              className={`rounded-md px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* PClar Jadvali */}
      <div className="rounded-[var(--r-card,12px)] border border-border bg-card overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Kompyuter</th>
                <th className="py-3 px-4">Asosiy xususiyatlar</th>
                <th className="py-3 px-4 text-right">Tannarx (UZS)</th>
                <th className="py-3 px-4 text-right">Sotuv narxi (UZS)</th>
                <th className="py-3 px-4 text-right">Sof foyda / Marja</th>
                <th className="py-3 px-4 text-center">Holat</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBuilds.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-xs text-muted-foreground">
                    Kompyuter topilmadi.
                  </td>
                </tr>
              ) : (
                filteredBuilds.map((build) => {
                  const profit = build.sellPrice > build.costPrice ? build.sellPrice - build.costPrice : 0n;
                  const margin = calcMarginPercent(profit, build.sellPrice);

                  return (
                    <tr key={build.id} className="hover:bg-muted/30 transition-colors">
                      {/* Rasm va nom */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-white p-1">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={build.images[0] ?? ""}
                              alt={build.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                          <div>
                            <Link
                              href={`/computers/${build.slug}`}
                              target="_blank"
                              className="font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {build.name}
                              <ExternalLink size={12} className="text-muted-foreground" />
                            </Link>
                            <span className="font-mono text-[11px] text-muted-foreground block">
                              /{build.slug}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Asosiy xususiyatlar */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 text-xs">
                          <div className="font-medium flex items-center gap-1.5 text-foreground">
                            <Cpu size={12} className="text-primary" />
                            {build.cpu}
                          </div>
                          <div className="font-medium flex items-center gap-1.5 text-muted-foreground">
                            <Monitor size={12} className="text-primary" />
                            {build.gpu}
                          </div>
                        </div>
                      </td>

                      {/* Tannarx */}
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-muted-foreground">
                        {formatMoney(build.costPrice)}
                      </td>

                      {/* Sotuv narxi */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                        {formatMoney(build.sellPrice)}
                        {build.discountPercent > 0 && (
                          <span className="block text-[10px] text-amber-500 font-semibold">
                            -{build.discountPercent}%
                          </span>
                        )}
                      </td>

                      {/* Foyda va Marja */}
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                          +{formatMoney(profit)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {margin}% marja
                        </span>
                      </td>

                      {/* Holat */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(build.status)}
                      </td>

                      {/* Amallar */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {build.status === "available" && (
                            <button
                              type="button"
                              onClick={() => setSellingBuild(build)}
                              className="flex items-center gap-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-2 py-1 text-xs font-semibold transition-colors"
                              title="Oflayn sotuvni qayd qilish"
                            >
                              <Receipt size={13} />
                              Sotish
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingBuild(build);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                            title="Tahrirlash"
                          >
                            <Edit2 size={15} />
                          </button>
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

      {/* PC Yig'ish / Tahrirlash Modali */}
      <PcBuildFormModal
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        initialData={editingBuild}
        onSave={handleSaveBuild}
      />

      {/* Oflayn PC Sotish Modali */}
      <Modal
        open={Boolean(sellingBuild)}
        onOpenChange={(open) => !open && setSellingBuild(null)}
        title="Kompyuterni oflayn sotish"
      >
        {sellingBuild && (
          <form onSubmit={handleConfirmSale} className="space-y-4 text-xs sm:text-sm">
            <div className="rounded-lg bg-muted/60 p-3 space-y-1">
              <span className="text-xs text-muted-foreground block font-bold uppercase tracking-wider">
                Sotilayotgan kompyuter:
              </span>
              <p className="font-bold text-foreground text-sm">{sellingBuild.name}</p>
              <div className="flex justify-between pt-1 text-xs font-mono">
                <span className="text-muted-foreground">Tannarx snapshot:</span>
                <span>{formatMoney(sellingBuild.costPrice)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-muted-foreground">Sotuv narxi:</span>
                <span className="font-bold text-foreground">{formatMoney(sellingBuild.sellPrice)}</span>
              </div>
              <div className="flex justify-between text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                <span>Kutilayotgan sof daromad:</span>
                <span>+{formatMoney(sellingBuild.sellPrice - sellingBuild.costPrice)}</span>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Xaridor ismi *
              </Label>
              <Input
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Masalan: Sardor Aliyev"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Telefon raqami
              </Label>
              <Input
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>

            <div>
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sotuv sanasi *
              </Label>
              <Input
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSellingBuild(null)}
              >
                Bekor qilish
              </Button>
              <Button type="submit" variant="primary" size="sm" className="gap-1.5">
                <Receipt size={14} />
                Sotuvni tasdiqlash
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
