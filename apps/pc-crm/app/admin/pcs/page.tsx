"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Cpu,
  DollarSign,
  Edit2,
  ExternalLink,
  Monitor,
  PackageCheck,
  Plus,
  Receipt,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { StatCard } from "@ventura/ui/stat-card";
import { PcBuildFormModal } from "@/components/admin/pcs/pc-build-form-modal";
import { calcFinalPrice, calcMarginPercent } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { useFinancialMode } from "@/lib/store-context";
import { type PcBuildItem, type ConfiguratorPart } from "@/lib/pc-data";
import {
  getAdminPcBuildsAction,
  getAdminConfiguratorPartsAction,
  savePcBuildAction,
  sellPcBuildAction,
} from "@/lib/server/actions";

export default function AdminPcsPage() {
  const isFinancial = useFinancialMode();
  const [builds, setBuilds] = useState<PcBuildItem[]>([]);
  const [parts, setParts] = useState<ConfiguratorPart[]>([]);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const [buildResult, partsResult] = await Promise.all([getAdminPcBuildsAction(), getAdminConfiguratorPartsAction()]);
    if (!buildResult.success) setError(buildResult.error ?? "PC buildlarni yuklab bo'lmadi");
    else setBuilds(buildResult.builds);
    if (!partsResult.success) setError(partsResult.error ?? "Komponentlarni yuklab bo'lmadi");
    else setParts(partsResult.parts);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ilk yuklash: ma'lumot server action'dan olinadi
    void loadData();
  }, [loadData]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "sold" | "hidden">("all");

  // Yangi / Tahrirlash modali
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBuild, setEditingBuild] = useState<PcBuildItem | null>(null);

  // Oflayn sotish modali
  const [sellingBuild, setSellingBuild] = useState<PcBuildItem | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("+998 ");
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10));
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
      const finalPrice = calcFinalPrice(b.sellPrice, b.discountPercent);
      const profit = finalPrice > b.costPrice ? finalPrice - b.costPrice : 0n;
      return sum + profit;
    }, 0n);

    const totalAvailableRevenue = available.reduce(
      (sum, b) => sum + calcFinalPrice(b.sellPrice, b.discountPercent),
      0n,
    );
    const avgMargin = calcMarginPercent(totalExpectedProfit, totalAvailableRevenue);

    return {
      availableCount: available.length,
      soldCount: sold.length,
      totalExpectedProfit,
      avgMargin,
    };
  }, [builds]);

  const handleSaveBuild = async (savedBuild: PcBuildItem) => {
    const result = await savePcBuildAction({
      id: editingBuild?.id,
      slug: savedBuild.slug,
      name: savedBuild.name,
      images: savedBuild.images,
      sellPrice: savedBuild.sellPrice,
      discountPercent: savedBuild.discountPercent,
      status: savedBuild.status === "hidden" ? "hidden" : "available",
      components: savedBuild.components.map(({ role, productId, qty }) => ({ role, productId, qty })),
      specs: savedBuild.specs.map(({ key, title, value, filterable, helpTitle, helpText }) => ({
        key,
        title,
        value,
        filterable,
        helpTitle,
        helpText,
      })),
    });
    if (!result.success) {
      setError(result.error ?? "PC buildni saqlab bo'lmadi");
      return false;
    }
    setEditingBuild(null);
    setIsFormOpen(false);
    await loadData();
    return true;
  };

  const handleConfirmSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellingBuild || !buyerName.trim()) return;
    const result = await sellPcBuildAction({ id: sellingBuild.id, buyerName, buyerPhone, soldAt: saleDate });
    if (!result.success) {
      setError(result.error ?? "PC sotuvini saqlab bo'lmadi");
      return;
    }
    const profit = calcFinalPrice(sellingBuild.sellPrice, sellingBuild.discountPercent) - sellingBuild.costPrice;
    setSaleSuccessMessage(
      isFinancial
        ? `"${sellingBuild.name}" sotildi. Sof daromad: ${formatMoney(profit)}.`
        : `"${sellingBuild.name}" muvaffaqiyatli topshirildi.`,
    );
    setSellingBuild(null);
    setBuyerName("");
    setBuyerPhone("+998 ");
    await loadData();
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
          <h1 className="text-2xl font-black tracking-tight">Tayyor kompyuterlar</h1>
        </div>

        <Button
          onClick={() => {
            setEditingBuild(null);
            setIsFormOpen(true);
          }}
        >
          <Plus />
          Yangi PC yigʻish
        </Button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)"
        >
          {error}
        </div>
      )}

      {/* Muvaffaqiyat xabari */}
      {saleSuccessMessage && (
        <div className="flex items-center justify-between rounded-control bg-(--success-bg) border border-(--success-border) p-4 text-xs sm:text-sm text-(--success-fg)">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} />
            <span>{saleSuccessMessage}</span>
          </div>
          <button type="button" onClick={() => setSaleSuccessMessage(null)} className="hover:opacity-75">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Statistik kartalar */}
      <div className={`grid grid-cols-1 gap-4 ${isFinancial ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2"}`}>
        <StatCard icon={<Monitor />} label="Mavjud PClar" value={`${stats.availableCount} ta`} tone={1} />
        <StatCard icon={<PackageCheck />} label="Sotilgan PClar" value={`${stats.soldCount} ta`} tone={2} />
        {isFinancial && (
          <>
            <StatCard
              icon={<TrendingUp />}
              label="Kutilayotgan sof foyda"
              value={`+${formatMoney(stats.totalExpectedProfit)}`}
              tone={3}
              valueClassName="whitespace-nowrap text-title"
            />
            <StatCard icon={<DollarSign />} label="Oʻrtacha marja" value={`${stats.avgMargin}%`} tone={4} />
          </>
        )}
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
            placeholder="Nomi, CPU yoki GPU boʻyicha qidirish..."
            className="w-full rounded-control border border-input bg-card py-2 pl-9 pr-4 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        {/* Holat tablari */}
        <div className="flex items-center gap-1 rounded-control border border-border bg-card p-1">
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
              className={`rounded-control px-3 py-1 text-xs font-semibold transition-all ${
                statusFilter === t.value
                  ? "bg-primary text-primary-foreground shadow-control"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* PClar Jadvali */}
      <div className="rounded-card border border-border bg-card overflow-hidden shadow-control">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-border bg-muted/40 text-caption font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-3 px-4">Kompyuter</th>
                <th className="py-3 px-4">Asosiy xususiyatlar</th>
                {isFinancial && (
                  <>
                    <th className="py-3 px-4 text-right">Tannarx (UZS)</th>
                    <th className="py-3 px-4 text-right">Sotuv narxi (UZS)</th>
                    <th className="py-3 px-4 text-right">Sof foyda / Marja</th>
                  </>
                )}
                <th className="py-3 px-4 text-center">Holat</th>
                <th className="py-3 px-4 text-right">Amallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBuilds.length === 0 ? (
                <tr>
                  <td colSpan={isFinancial ? 7 : 4} className="py-8 text-center text-xs text-muted-foreground">
                    Kompyuter topilmadi.
                  </td>
                </tr>
              ) : (
                filteredBuilds.map((build) => {
                  const finalPrice = calcFinalPrice(build.sellPrice, build.discountPercent);
                  const profit = finalPrice > build.costPrice ? finalPrice - build.costPrice : 0n;
                  const margin = calcMarginPercent(profit, finalPrice);

                  return (
                    <tr key={build.id} className="hover:bg-muted/30 transition-colors">
                      {/* Rasm va nom */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-border bg-media p-1">
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
                            <span className="font-mono text-caption text-muted-foreground block">/{build.slug}</span>
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

                      {/* Tannarx, Sotuv narxi, Foyda */}
                      {isFinancial && (
                        <>
                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-muted-foreground">
                            {formatMoney(build.costPrice)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                            {formatMoney(build.sellPrice)}
                            {build.discountPercent > 0 && (
                              <span className="block text-2xs text-(--warning-fg) font-semibold">
                                -{build.discountPercent}%
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono">
                            <span className="font-bold text-(--success-fg) block">+{formatMoney(profit)}</span>
                            <span className="text-caption text-muted-foreground">{margin}% marja</span>
                          </td>
                        </>
                      )}

                      {/* Holat */}
                      <td className="py-3.5 px-4 text-center">{getStatusBadge(build.status)}</td>

                      {/* Amallar */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {build.status === "available" && (
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => setSellingBuild(build)}
                              title="Oflayn sotuvni qayd qilish"
                              aria-label="Sotish"
                            >
                              <Receipt />
                              Sotish
                            </Button>
                          )}

                          {build.status !== "sold" && (
                            <Button
                              variant="icon"
                              size="icon-sm"
                              onClick={() => {
                                setEditingBuild(build);
                                setIsFormOpen(true);
                              }}
                              title="Tahrirlash"
                              aria-label="Tahrirlash"
                            >
                              <Edit2 />
                            </Button>
                          )}
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
        parts={parts}
        onSave={handleSaveBuild}
        isFinancial={isFinancial}
      />

      {/* Oflayn PC Sotish / Topshirish Modali */}
      <Modal
        open={Boolean(sellingBuild)}
        onOpenChange={(open) => !open && setSellingBuild(null)}
        title={isFinancial ? "Kompyuterni oflayn sotish" : "Kompyuterni mijozga topshirish"}
        description={
          isFinancial
            ? "Doʻkondan toʻgʻridan-toʻgʻri sotilgan kompyuter hisobi"
            : "Kompyuterni mijozga topshirish va ombor qoldigʻidan chiqarish"
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSellingBuild(null)}>
              Bekor qilish
            </Button>
            <Button type="submit" form="sell-build-form">
              <Check /> {isFinancial ? "Sotuvni tasdiqlash" : "Topshirishni tasdiqlash"}
            </Button>
          </>
        }
      >
        {sellingBuild && (
          <form id="sell-build-form" onSubmit={handleConfirmSale} className="space-y-4">
            <div className="rounded-control bg-muted/60 p-3.5 space-y-2">
              <FieldHint className="mt-0 font-medium">
                {isFinancial ? "Sotilayotgan kompyuter:" : "Topshirilayotgan kompyuter:"}
              </FieldHint>
              <div className="font-bold text-foreground text-base">{sellingBuild.name}</div>
              {isFinancial && (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <div className="flex justify-between text-body">
                    <FieldHint className="mt-0">Tannarx snapshot:</FieldHint>
                    <span className="font-semibold">{formatMoney(sellingBuild.costPrice)}</span>
                  </div>
                  <div className="flex justify-between text-body">
                    <FieldHint className="mt-0">Sotuv narxi:</FieldHint>
                    <span className="font-bold text-foreground">{formatMoney(sellingBuild.sellPrice)}</span>
                  </div>
                  <div className="flex justify-between text-body font-bold text-(--success-fg)">
                    <span>Kutilayotgan sof daromad:</span>
                    <span>
                      +
                      {formatMoney(
                        calcFinalPrice(sellingBuild.sellPrice, sellingBuild.discountPercent) - sellingBuild.costPrice,
                      )}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="sell-buyer-name">Xaridor ismi *</Label>
              <Input
                id="sell-buyer-name"
                required
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Masalan: Sardor Aliyev"
              />
            </div>

            <div>
              <Label htmlFor="sell-buyer-phone">Telefon raqami</Label>
              <Input
                id="sell-buyer-phone"
                value={buyerPhone}
                required
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
              />
            </div>

            <div>
              <Label htmlFor="sell-date">Sotuv sanasi *</Label>
              <Input
                id="sell-date"
                type="date"
                required
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
