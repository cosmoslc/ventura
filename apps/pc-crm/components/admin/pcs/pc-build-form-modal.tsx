"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, Plus, Sparkles, Trash2, Wrench } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import {
  calcFinalPrice,
  calcItemProfit,
  calcMarginPercent,
  calcPcCostPrice,
  calcSellPriceFromMargin,
} from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { CONFIGURATOR_CATALOG, type PcBuildItem, type PcComponentItem, type PcSpecItem } from "@/lib/pc-data";

interface PcBuildFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PcBuildItem | null;
  onSave: (build: PcBuildItem) => void;
}

export function PcBuildFormModal({
  open,
  onOpenChange,
  initialData,
  onSave,
}: PcBuildFormModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"available" | "sold" | "hidden">("available");
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  // Komponentlar ro'yxati
  const [components, setComponents] = useState<PcComponentItem[]>([]);

  // Narxlar va Marja
  const [sellPriceStr, setSellPriceStr] = useState("20000000");
  const [marginPercent, setMarginPercent] = useState(20);
  const [discountPercent, setDiscountPercent] = useState(0);

  // Spetsifikatsiyalar
  const [specs, setSpecs] = useState<PcSpecItem[]>([]);

  // initialData yuklanganda
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setSlug(initialData.slug);
      setDescription(initialData.description ?? "");
      setImageUrl(initialData.images[0] ?? "");
      setStatus(initialData.status);
      setWarrantyMonths(initialData.warrantyMonths ?? 12);
      setComponents(initialData.components);
      setSellPriceStr(initialData.sellPrice.toString());
      setDiscountPercent(initialData.discountPercent);
      setSpecs(initialData.specs);
    } else {
      setName("");
      setSlug("");
      setDescription("");
      setImageUrl("https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80");
      setStatus("available");
      setWarrantyMonths(12);
      setDiscountPercent(0);

      // Standart 8 ta komponent shabloni
      const defaultComps: PcComponentItem[] = [
        {
          role: "cpu",
          roleNameUz: "Protsessor",
          productId: "cfg-cpu-2",
          productName: "Intel Core i7-14700K",
          qty: 1,
          costSnapshot: 4_600_000n,
          sellPrice: 5_200_000n,
          inStock: true,
        },
        {
          role: "motherboard",
          roleNameUz: "Ona plata",
          productId: "cfg-mb-2",
          productName: "MSI MAG Z790 TOMAHAWK WIFI",
          qty: 1,
          costSnapshot: 2_950_000n,
          sellPrice: 3_400_000n,
          inStock: true,
        },
        {
          role: "gpu",
          roleNameUz: "Videokarta",
          productId: "cfg-gpu-2",
          productName: "ASUS Dual RTX 4070 SUPER 12GB",
          qty: 1,
          costSnapshot: 7_750_000n,
          sellPrice: 8_900_000n,
          inStock: true,
        },
        {
          role: "ram",
          roleNameUz: "RAM",
          productId: "cfg-ram-2",
          productName: "Kingston FURY Beast RGB 32GB DDR5",
          qty: 1,
          costSnapshot: 1_400_000n,
          sellPrice: 1_750_000n,
          inStock: true,
        },
        {
          role: "ssd",
          roleNameUz: "SSD",
          productId: "cfg-ssd-2",
          productName: "Samsung 990 PRO 1TB PCIe 4.0 NVMe",
          qty: 1,
          costSnapshot: 1_500_000n,
          sellPrice: 1_850_000n,
          inStock: true,
        },
        {
          role: "psu",
          roleNameUz: "PSU",
          productId: "cfg-psu-2",
          productName: "Corsair RM850e 850W Gold Modulli",
          qty: 1,
          costSnapshot: 1_350_000n,
          sellPrice: 1_650_000n,
          inStock: true,
        },
        {
          role: "cooler",
          roleNameUz: "Cooler",
          productId: "cfg-clr-3",
          productName: "DeepCool LT720 360mm AIO",
          qty: 1,
          costSnapshot: 1_100_000n,
          sellPrice: 1_450_000n,
          inStock: true,
        },
        {
          role: "case",
          roleNameUz: "Korpus",
          productId: "cfg-cs-2",
          productName: "NZXT H7 Flow RGB Black",
          qty: 1,
          costSnapshot: 1_250_000n,
          sellPrice: 1_550_000n,
          inStock: true,
        },
      ];
      setComponents(defaultComps);
      setSellPriceStr("26500000");

      setSpecs([
        { key: "cpu", title: "Protsessor (CPU)", value: "Intel Core i7-14700K (20 yadro, 5.6 GHz)", filterable: true },
        { key: "gpu", title: "Videokarta (GPU)", value: "NVIDIA GeForce RTX 4070 SUPER 12GB", filterable: true },
        { key: "ram", title: "Operativ xotira (RAM)", value: "32GB (2x16GB) DDR5 6000MHz RGB" },
        { key: "ssd", title: "Doimiy xotira (SSD)", value: "1TB Samsung 990 PRO NVMe (7450 MB/s)" },
      ]);
    }
  }, [initialData, open]);

  // Jonli PC Tannarxi hisobi
  const totalCostPrice = useMemo(() => {
    return calcPcCostPrice(
      components.map((c) => ({
        costSnapshot: c.costSnapshot,
        qty: c.qty,
      }))
    );
  }, [components]);

  const sellPrice = useMemo(() => {
    try {
      const p = BigInt(sellPriceStr.replace(/\D/g, "") || "0");
      return p;
    } catch {
      return 0n;
    }
  }, [sellPriceStr]);

  const expectedProfit = useMemo(() => {
    return sellPrice > totalCostPrice ? sellPrice - totalCostPrice : 0n;
  }, [sellPrice, totalCostPrice]);

  const calculatedMargin = useMemo(() => {
    return calcMarginPercent(expectedProfit, sellPrice);
  }, [expectedProfit, sellPrice]);

  // Nom o'zgarganda slugni avtomatik shakllantirish
  const handleNameChange = (val: string) => {
    setName(val);
    if (!initialData) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      setSlug(generatedSlug);
    }
  };

  // Marja orqali sotuv narxini avtomatik chiqarish
  const handleMarginChange = (percent: number) => {
    setMarginPercent(percent);
    const calculated = calcSellPriceFromMargin(totalCostPrice, percent);
    setSellPriceStr(calculated.toString());
  };

  // Komponent tanlanganda
  const handleSelectProductForComponent = (index: number, partId: string) => {
    const part = CONFIGURATOR_CATALOG.find((p) => p.id === partId);
    if (!part) return;

    setComponents((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              productId: part.id,
              productName: part.name,
              costSnapshot: part.costPrice,
              sellPrice: part.price,
              inStock: part.stock >= c.qty,
            }
          : c
      )
    );
  };

  const handleUpdateComponentQty = (index: number, qty: number) => {
    if (qty < 1) return;
    setComponents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, qty } : c))
    );
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddComponentRow = () => {
    const defaultPart = CONFIGURATOR_CATALOG[0]!;
    setComponents((prev) => [
      ...prev,
      {
        role: "other",
        roleNameUz: "Qoʻshimcha",
        productId: defaultPart.id,
        productName: defaultPart.name,
        qty: 1,
        costSnapshot: defaultPart.costPrice,
        sellPrice: defaultPart.price,
        inStock: defaultPart.stock >= 1,
      },
    ]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cpuSpec = components.find((c) => c.role === "cpu")?.productName ?? "Intel Core i7";
    const gpuSpec = components.find((c) => c.role === "gpu")?.productName ?? "GeForce RTX";
    const ramSpec = components.find((c) => c.role === "ram")?.productName ?? "32GB DDR5";
    const ssdSpec = components.find((c) => c.role === "ssd")?.productName ?? "1TB NVMe";

    const buildRecord: PcBuildItem = {
      id: initialData?.id ?? `pc-${Date.now()}`,
      slug: slug || `pc-${Date.now()}`,
      name,
      description,
      images: [imageUrl || "https://images.unsplash.com/photo-1587202372634-32705e3bf49c?w=900&auto=format&fit=crop&q=80"],
      costPrice: totalCostPrice,
      sellPrice,
      discountPercent,
      status,
      warrantyMonths,
      ratingAvg: initialData?.ratingAvg ?? 5.0,
      ratingCount: initialData?.ratingCount ?? 0,
      cpu: cpuSpec,
      gpu: gpuSpec,
      ram: ramSpec,
      storage: ssdSpec,
      components,
      specs,
    };

    onSave(buildRecord);
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Kompyuterni tahrirlash" : "Yangi kompyuter yigʻish (PC Assemble)"}
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs sm:text-sm">
        {/* 1. Asosiy ma'lumotlar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Kompyuter nomi *
            </Label>
            <Input
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Masalan: Ventura Gaming Titan: Core i7-14700K / RTX 4070 Ti"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Slug (URL manzili)
            </Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ventura-gaming-titan-i7-4070"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Holati
            </Label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full rounded-[var(--r-input,8px)] border border-input bg-background px-3 py-2 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
            >
              <option value="available">Mavjud (Sotuvda)</option>
              <option value="sold">Sotilgan</option>
              <option value="hidden">Yashirin (Qoralama)</option>
            </select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Asosiy rasm URL
            </Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tavsifi (User storefront uchun)
            </Label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kompyuterning maqsadi, unumdorligi va kafolat shartlari..."
              className="w-full rounded-[var(--r-input,8px)] border border-input bg-background px-3 py-2 text-xs text-foreground focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* 2. Komponentlar ro'yxati (Tannarx kalkulyatori bilan) */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wrench size={16} className="text-primary" />
                Komponentlar (Ombordan yigʻish)
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Tannarx komponentlar summasidan jonli hisoblanadi
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddComponentRow}
              className="gap-1 text-xs"
            >
              <Plus size={13} />
              Qator qoʻshish
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {components.map((comp, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs"
              >
                <div className="col-span-3">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-muted-foreground block truncate">
                    {comp.roleNameUz}
                  </span>
                  <select
                    value={comp.productId}
                    onChange={(e) => handleSelectProductForComponent(idx, e.target.value)}
                    className="w-full rounded border border-input bg-background p-1 text-[11px] font-medium"
                  >
                    {CONFIGURATOR_CATALOG.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({formatMoney(item.costPrice)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 text-center">
                  <span className="text-[10px] text-muted-foreground block">Soni</span>
                  <input
                    type="number"
                    min={1}
                    value={comp.qty}
                    onChange={(e) => handleUpdateComponentQty(idx, parseInt(e.target.value) || 1)}
                    className="w-14 text-center rounded border border-input bg-background p-1 font-mono text-xs"
                  />
                </div>

                <div className="col-span-3 text-right">
                  <span className="text-[10px] text-muted-foreground block">Dona tannarx</span>
                  <span className="font-mono text-xs font-semibold">
                    {formatMoney(comp.costSnapshot)}
                  </span>
                </div>

                <div className="col-span-3 text-right">
                  <span className="text-[10px] text-muted-foreground block">Jami tannarx</span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {formatMoney(comp.costSnapshot * BigInt(comp.qty))}
                  </span>
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(idx)}
                    className="text-muted-foreground hover:text-rose-500 p-1"
                    aria-label="Oʻchirish"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Jonli tannarx indikatori */}
          <div className="flex items-center justify-between rounded-lg bg-primary/10 border border-primary/20 p-3">
            <span className="font-bold text-xs uppercase tracking-wider text-primary">
              PC Jami Tannarxi:
            </span>
            <span className="font-mono text-base font-black text-foreground">
              {formatMoney(totalCostPrice)}
            </span>
          </div>
        </div>

        {/* 3. Narx va Marja kalkulyatori */}
        <div className="space-y-3 pt-2 border-t border-border">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Sotuv narxi va Marja hisobi
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Kutilayotgan Marja %
              </Label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={marginPercent}
                  onChange={(e) => handleMarginChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-[var(--r-input,8px)] border border-input bg-background p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <span className="text-xs font-bold">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Sotuv narxi (UZS) *
              </Label>
              <Input
                required
                value={sellPriceStr}
                onChange={(e) => setSellPriceStr(e.target.value)}
                placeholder="26500000"
                className="font-mono text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Chegirma foizi %
              </Label>
              <input
                type="number"
                min={0}
                max={90}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                className="w-full rounded-[var(--r-input,8px)] border border-input bg-background p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Jonli natija bloki */}
          <div className="rounded-lg bg-muted/60 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sof kutilayotgan foyda:</span>
              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                +{formatMoney(expectedProfit)} ({calculatedMargin}%)
              </span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Chegirmadan keyingi narx:</span>
                <span className="font-mono font-bold text-foreground">
                  {formatMoney(calcFinalPrice(sellPrice, discountPercent))}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Tugmalar */}
        <div className="flex justify-end gap-2 pt-4 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Bekor qilish
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={totalCostPrice <= 0n || !name.trim()}
          >
            {initialData ? "Oʻzgarishlarni saqlash" : "Kompyuterni saqlash"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
