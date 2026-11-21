"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Trash2, Wrench } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { ImageUploadWithBgRemoval } from "@/components/admin/image-upload-with-bg-removal";
import { calcFinalPrice, calcMarginPercent, calcPcCostPrice, calcSellPriceFromMargin } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";
import { useFinancialMode } from "@/lib/store-context";
import { type PcBuildItem, type PcComponentItem, type PcSpecItem, type ConfiguratorPart } from "@/lib/pc-data";

interface PcBuildFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: PcBuildItem | null;
  parts: ConfiguratorPart[];
  onSave: (build: PcBuildItem) => Promise<boolean> | boolean;
  isFinancial?: boolean;
}

export function PcBuildFormModal({
  open,
  onOpenChange,
  initialData,
  parts,
  onSave,
  isFinancial: isFinancialProp,
}: PcBuildFormModalProps) {
  const financialMode = useFinancialMode();
  const isFinancial = isFinancialProp ?? financialMode;
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"available" | "sold" | "hidden">("available");

  // Komponentlar ro'yxati
  const [components, setComponents] = useState<(PcComponentItem & { qtyStr?: string })[]>([]);

  // Narxlar va Marja
  const [sellPriceStr, setSellPriceStr] = useState("");
  const [marginPercentStr, setMarginPercentStr] = useState("");
  const [discountPercentStr, setDiscountPercentStr] = useState("");

  // Spetsifikatsiyalar
  const [specs, setSpecs] = useState<PcSpecItem[]>([]);

  // initialData yuklanganda
  useEffect(() => {
    if (initialData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- tahrirlanayotgan yozuvni formaga yuklash
      setName(initialData.name);
      setSlug(initialData.slug);
      setImageUrl(initialData.images[0] ?? "");
      setStatus(initialData.status);
      setComponents(initialData.components.map((c) => ({ ...c, qtyStr: String(c.qty) })));
      setSellPriceStr(initialData.sellPrice.toString());
      setDiscountPercentStr(initialData.discountPercent.toString());
      setSpecs(initialData.specs);
    } else {
      setName("");
      setSlug("");
      setImageUrl("");
      setStatus("available");
      setDiscountPercentStr("");
      setMarginPercentStr("");
      setComponents([]);
      setSellPriceStr("");
      setSpecs([]);
    }
  }, [initialData, open]);

  // Jonli PC Tannarxi hisobi
  const totalCostPrice = useMemo(() => {
    return calcPcCostPrice(
      components.map((c) => ({
        costSnapshot: c.costSnapshot,
        qty: c.qty,
      })),
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

  const discountPercent = Math.max(0, parseInt(discountPercentStr || "0", 10));

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
    setMarginPercentStr(percent.toString());
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
          : c,
      ),
    );
  };

  const handleUpdateComponentQty = (index: number, valStr: string) => {
    setComponents((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const parsed = parseInt(valStr, 10);
        return {
          ...c,
          qty: isNaN(parsed) ? 0 : parsed,
          qtyStr: valStr,
        };
      }),
    );
  };

  const handleComponentQtyBlur = (index: number) => {
    setComponents((prev) =>
      prev.map((c, i) => {
        if (i !== index) return c;
        const validQty = Math.max(1, c.qty || 1);
        return {
          ...c,
          qty: validQty,
          qtyStr: String(validQty),
        };
      }),
    );
  };

  const handleComponentRoleChange = (index: number, role: ConfiguratorPart["role"]) => {
    const part = parts.find((candidate) => candidate.role === role);
    if (!part) return;
    setComponents((prev) =>
      prev.map((component, i) =>
        i === index
          ? {
              ...component,
              role: part.role,
              roleNameUz: part.roleLabel,
              productId: part.id,
              productName: part.name,
              costSnapshot: part.costPrice,
              sellPrice: part.price,
              inStock: part.stock >= component.qty,
            }
          : component,
      ),
    );
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
        qtyStr: "1",
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

    const discountPercent = Math.max(0, parseInt(discountPercentStr || "0", 10));
    const validComponents: PcComponentItem[] = components.map((c) => ({
      role: c.role,
      roleNameUz: c.roleNameUz,
      productId: c.productId,
      productName: c.productName,
      qty: Math.max(1, c.qty || 1),
      costSnapshot: c.costSnapshot,
      sellPrice: c.sellPrice,
      imageUrl: c.imageUrl,
      inStock: c.inStock,
    }));

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
      components: validComponents,
      specs,
    };

    const saved = await onSave(buildRecord);
    if (saved) onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Kompyuterni tahrirlash" : "Yangi kompyuter yigʻish"}
      description="Ombordagi komponentlardan kompyuter jamlash va sotuvga chiqarish"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="pc-build-form"
            disabled={!name.trim() || components.length === 0 || (isFinancial && totalCostPrice <= 0n)}
          >
            <Check /> {initialData ? "Saqlash" : "Kompyuterni saqlash"}
          </Button>
        </>
      }
    >
      <form id="pc-build-form" onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Asosiy ma'lumotlar */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="build-name">Kompyuter nomi *</Label>
            <Input
              id="build-name"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Masalan: Gaming Titan (Core i7 / RTX 4070)"
            />
          </div>

          <div>
            <Label htmlFor="build-slug">Slug (URL manzili)</Label>
            <Input
              id="build-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="gaming-titan-i7-4070"
            />
          </div>

          <div>
            <Label htmlFor="build-status">Holati</Label>
            <Select value={status} onValueChange={(val) => setStatus(val as typeof status)}>
              <SelectTrigger id="build-status" aria-label="Holati" className="w-full">
                <SelectValue placeholder="Holatni tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Mavjud (Sotuvda)</SelectItem>
                <SelectItem value="hidden">Yashirin (Qoralama)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <ImageUploadWithBgRemoval
              value={imageUrl}
              onChange={setImageUrl}
              label="Kompyuter rasmi"
              placeholder="https://... yoki rasm yuklang"
            />
          </div>
        </div>

        {/* 2. Komponentlar ro'yxati */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-body font-semibold text-foreground flex items-center gap-2">
                <Wrench size={16} className="text-primary" />
                Komponentlar (Ombordan yigʻish)
              </div>
              <FieldHint className="mt-0">Tannarx komponentlar summasidan jonli hisoblanadi</FieldHint>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleAddComponentRow}
              disabled={parts.length === 0}
            >
              <Plus /> Qator qoʻshish
            </Button>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {components.map((comp, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 items-center gap-2 rounded-control border border-border bg-card p-2.5"
              >
                <div className="col-span-3">
                  <Select
                    value={comp.role}
                    onValueChange={(val) => handleComponentRoleChange(idx, val as ConfiguratorPart["role"])}
                  >
                    <SelectTrigger className="w-full h-8 font-semibold">
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
                </div>

                <div className={isFinancial ? "col-span-4" : "col-span-7"}>
                  <Select value={comp.productId} onValueChange={(val) => handleSelectProductForComponent(idx, val)}>
                    <SelectTrigger className="w-full h-8 font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {parts
                        .filter((item) => item.role === comp.role)
                        .map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} {isFinancial ? `· ${formatMoney(item.costPrice)}` : ""} · mavjud: {item.stock}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 text-center">
                  <Input
                    type="number"
                    min={1}
                    value={comp.qtyStr ?? String(comp.qty)}
                    onChange={(e) => handleUpdateComponentQty(idx, e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => handleComponentQtyBlur(idx)}
                    className="w-16 h-8 text-center mx-auto"
                  />
                </div>

                {isFinancial && (
                  <div className="col-span-2 text-right">
                    <FieldHint className="mt-0">Jami tannarx</FieldHint>
                    <div className="text-body font-bold text-foreground">
                      {formatMoney(comp.costSnapshot * BigInt(comp.qty))}
                    </div>
                  </div>
                )}

                <div className="col-span-1 flex justify-end">
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-sm"
                    onClick={() => handleRemoveComponent(idx)}
                    className="hover:text-destructive"
                    title="Oʻchirish"
                    aria-label="Oʻchirish"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Jonli tannarx indikatori */}
          {isFinancial && (
            <div className="flex items-center justify-between rounded-control bg-primary/10 border border-primary/20 p-3">
              <span className="font-semibold text-primary">PC Jami Tannarxi:</span>
              <span className="text-base font-bold text-foreground">{formatMoney(totalCostPrice)}</span>
            </div>
          )}
        </div>

        {/* 3. Narx va Marja kalkulyatori (faqat moliyaviy rejimda) */}
        {isFinancial && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="text-body font-semibold text-foreground">Sotuv narxi va Marja hisobi</div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="build-margin">Kutilayotgan Marja %</Label>
                <Input
                  id="build-margin"
                  type="number"
                  min={0}
                  max={100}
                  value={marginPercentStr}
                  onChange={(e) => {
                    setMarginPercentStr(e.target.value);
                    handleMarginChange(parseInt(e.target.value || "0", 10));
                  }}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="build-sell-price">Sotuv narxi (UZS) *</Label>
                <Input
                  id="build-sell-price"
                  required
                  value={sellPriceStr}
                  onChange={(e) => setSellPriceStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="build-discount">Chegirma %</Label>
                <Input
                  id="build-discount"
                  type="number"
                  min={0}
                  max={90}
                  value={discountPercentStr}
                  onChange={(e) => setDiscountPercentStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between rounded-control border border-border bg-muted/20 p-3">
              <div>
                <FieldHint className="mt-0">Sof kutilayotgan foyda:</FieldHint>
                <div className="text-body font-bold text-(--success-fg)">
                  +{formatMoney(expectedProfit)} ({calculatedMargin}%)
                </div>
              </div>
              {discountPercent > 0 && (
                <div className="text-right">
                  <FieldHint className="mt-0">Chegirmadan keyingi narx:</FieldHint>
                  <div className="text-body font-bold text-foreground">
                    {formatMoney(calcFinalPrice(sellPrice, discountPercent))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
