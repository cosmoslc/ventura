"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers, Plus, Sparkles, Trash2, Wrench } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import {
  calcFinalPrice,
  calcMarginPercent,
  calcPcCostPrice,
  calcSellPriceFromMargin,
} from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { type PcBuildItem, type PcComponentItem, type PcSpecItem, type ConfiguratorPart } from "@/lib/pc-data";

interface PcBuildFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PcBuildItem | null;
  parts: ConfiguratorPart[];
  onSave: (build: PcBuildItem) => Promise<boolean> | boolean;
}

export function PcBuildFormModal({
  open,
  onOpenChange,
  initialData,
  parts,
  onSave,
}: PcBuildFormModalProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"available" | "sold" | "hidden">("available");

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
      setImageUrl(initialData.images[0] ?? "");
      setStatus(initialData.status);
      setComponents(initialData.components);
      setSellPriceStr(initialData.sellPrice.toString());
      setDiscountPercent(initialData.discountPercent);
      setSpecs(initialData.specs);
    } else {
      setName("");
      setSlug("");
      setImageUrl("");
      setStatus("available");
      setDiscountPercent(0);
      setComponents([]);
      setSellPriceStr("0");
      setSpecs([]);
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
    const part = parts.find((p) => p.id === partId);
    if (!part) return;

    setComponents((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              role: part.role,
              roleNameUz: part.roleLabel,
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

  const handleComponentRoleChange = (index: number, role: ConfiguratorPart["role"]) => {
    const part = parts.find((candidate) => candidate.role === role);
    if (!part) return;
    setComponents((prev) => prev.map((component, i) => i === index ? {
      ...component,
      role: part.role,
      roleNameUz: part.roleLabel,
      productId: part.id,
      productName: part.name,
      costSnapshot: part.costPrice,
      sellPrice: part.price,
      inStock: part.stock >= component.qty,
    } : component));
  };

  const handleRemoveComponent = (index: number) => {
    setComponents((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAddComponentRow = () => {
    const defaultPart = parts[0];
    if (!defaultPart) return;
    setComponents((prev) => [
      ...prev,
      {
        role: defaultPart.role,
        roleNameUz: defaultPart.roleLabel,
        productId: defaultPart.id,
        productName: defaultPart.name,
        qty: 1,
        costSnapshot: defaultPart.costPrice,
        sellPrice: defaultPart.price,
        inStock: defaultPart.stock >= 1,
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || components.length === 0) return;

    const cpuSpec = components.find((c) => c.role === "cpu")?.productName ?? "Intel Core i7";
    const gpuSpec = components.find((c) => c.role === "gpu")?.productName ?? "GeForce RTX";
    const ramSpec = components.find((c) => c.role === "ram")?.productName ?? "32GB DDR5";
    const ssdSpec = components.find((c) => c.role === "ssd")?.productName ?? "1TB NVMe";

    const buildRecord: PcBuildItem = {
      id: initialData?.id ?? `pc-${Date.now()}`,
      slug: slug || `pc-${Date.now()}`,
      name,
      images: imageUrl ? [imageUrl] : [],
      costPrice: totalCostPrice,
      sellPrice,
      discountPercent,
      status,
      ratingAvg: initialData?.ratingAvg ?? 5.0,
      ratingCount: initialData?.ratingCount ?? 0,
      cpu: cpuSpec,
      gpu: gpuSpec,
      ram: ramSpec,
      storage: ssdSpec,
      components,
      specs,
    };

    const saved = await onSave(buildRecord);
    if (saved) onOpenChange(false);
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
            <Select value={status} onValueChange={(val) => setStatus(val as any)}>
              <SelectTrigger aria-label="Holati" className="w-full text-xs h-(--control-h)">
                <SelectValue placeholder="Holatni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Mavjud (Sotuvda)</SelectItem>
                <SelectItem value="hidden">Yashirin (Qoralama)</SelectItem>
              </SelectContent>
            </Select>
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

        </div>

        {/* 2. Komponentlar ro'yxati (Tannarx kalkulyatori bilan) */}
        <div className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wrench size={16} className="text-primary" />
                Komponentlar (Ombordan yigʻish)
              </h3>
              <p className="text-caption text-muted-foreground">
                Tannarx komponentlar summasidan jonli hisoblanadi
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddComponentRow}
              disabled={parts.length === 0}
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
                className="grid grid-cols-12 items-center gap-2 rounded-control border border-border bg-card p-2 text-xs"
              >
                <div className="col-span-3 space-y-1">
                  <Select
                    value={comp.role}
                    onValueChange={(val) => handleComponentRoleChange(idx, val as ConfiguratorPart["role"])}
                  >
                    <SelectTrigger className="w-full text-2xs font-bold h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set(parts.map((item) => item.role))].map((role) => (
                        <SelectItem key={role} value={role}>
                          {parts.find((item) => item.role === role)?.roleLabel ?? role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={comp.productId}
                    onValueChange={(val) => handleSelectProductForComponent(idx, val)}
                  >
                    <SelectTrigger className="w-full text-caption font-medium h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {parts.filter((item) => item.role === comp.role).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · {formatMoney(item.costPrice)} · mavjud: {item.stock}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 text-center">
                  <span className="text-2xs text-muted-foreground block">Soni</span>
                  <Input
                    type="number"
                    min={1}
                    value={comp.qty}
                    onChange={(e) => handleUpdateComponentQty(idx, parseInt(e.target.value) || 1)}
                    className="w-14 text-center rounded border border-input bg-background p-1 font-mono text-xs"
                  />
                </div>

                <div className="col-span-3 text-right">
                  <span className="text-2xs text-muted-foreground block">Dona tannarx</span>
                  <span className="font-mono text-xs font-semibold">
                    {formatMoney(comp.costSnapshot)}
                  </span>
                </div>

                <div className="col-span-3 text-right">
                  <span className="text-2xs text-muted-foreground block">Jami tannarx</span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {formatMoney(comp.costSnapshot * BigInt(comp.qty))}
                  </span>
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveComponent(idx)}
                    className="text-muted-foreground hover:text-(--danger-fg) p-1"
                    aria-label="Oʻchirish"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Jonli tannarx indikatori */}
          <div className="flex items-center justify-between rounded-control bg-primary/10 border border-primary/20 p-3">
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
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={marginPercent}
                  onChange={(e) => handleMarginChange(parseInt(e.target.value) || 0)}
                  className="w-full rounded-control border border-input bg-background p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
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
              <Input
                type="number"
                min={0}
                max={90}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)}
                className="w-full rounded-control border border-input bg-background p-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          </div>

          {/* Jonli natija bloki */}
          <div className="rounded-control bg-muted/60 p-3 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sof kutilayotgan foyda:</span>
              <span className="font-mono font-bold text-(--success-fg)">
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
