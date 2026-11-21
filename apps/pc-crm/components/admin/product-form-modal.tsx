"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";
import { Switch } from "@ventura/ui/switch";
import { ImageUploadWithBgRemoval } from "@/components/admin/image-upload-with-bg-removal";
import { calcFinalPrice, calcSellPriceFromMargin } from "@/lib/calc/formulas";
import { formatMoney } from "@/lib/format";

export interface ProductFormData {
  id?: string;
  nameUz: string;
  nameRu?: string;
  categorySlug: string;
  brandName: string;
  sku: string;
  imageUrl: string;
  costPrice: bigint;
  sellPrice: bigint;
  marginPercent: number;
  discountPercent: number;
  stock: number;
  minStock: number;
  isNew: boolean;
  isHit: boolean;
  isActive: boolean;
  variants: { colorName: string; colorHex: string; stock: number }[];
  specs: { key: string; title: string; value: string; helpText?: string }[];
}

interface ProductFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialData?: ProductFormData | null;
  onSave: (product: ProductFormData) => void;
  isFinancial?: boolean;
}

export function ProductFormModal({
  open,
  onOpenChange,
  initialData,
  onSave,
  isFinancial = true,
}: ProductFormModalProps) {
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [categorySlug, setCategorySlug] = useState("protsessorlar");
  const [brandName, setBrandName] = useState("");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [costPriceStr, setCostPriceStr] = useState("");
  const [marginPercentStr, setMarginPercentStr] = useState("");
  const [sellPriceStr, setSellPriceStr] = useState("");
  const [discountPercentStr, setDiscountPercentStr] = useState("");

  const [stockStr, setStockStr] = useState("");
  const [minStockStr, setMinStockStr] = useState("");
  const [isNew, setIsNew] = useState(true);
  const [isHit, setIsHit] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [variants, setVariants] = useState<{ colorName: string; colorHex: string; stock: number }[]>([]);
  const [specs, setSpecs] = useState<{ key: string; title: string; value: string; helpText?: string }[]>([]);

  useEffect(() => {
    if (initialData) {
      setNameUz(initialData.nameUz);
      setNameRu(initialData.nameRu ?? "");
      setCategorySlug(initialData.categorySlug);
      setBrandName(initialData.brandName);
      setSku(initialData.sku);
      setImageUrl(initialData.imageUrl);
      setCostPriceStr(initialData.costPrice.toString());
      setSellPriceStr(initialData.sellPrice.toString());
      setMarginPercentStr(initialData.marginPercent.toString());
      setDiscountPercentStr(initialData.discountPercent.toString());
      setStockStr(initialData.stock.toString());
      setMinStockStr(initialData.minStock.toString());
      setIsNew(initialData.isNew);
      setIsHit(initialData.isHit);
      setIsActive(initialData.isActive);
      setVariants(initialData.variants);
      setSpecs(initialData.specs);
    } else {
      setNameUz("");
      setNameRu("");
      setCategorySlug("protsessorlar");
      setBrandName("");
      setSku("");
      setImageUrl("");
      setCostPriceStr("");
      setMarginPercentStr("");
      setSellPriceStr("");
      setDiscountPercentStr("");
      setStockStr("");
      setMinStockStr("");
      setIsNew(true);
      setIsHit(false);
      setIsActive(true);
      setVariants([]);
      setSpecs([]);
    }
  }, [initialData, open]);

  // Tannarx yoki marja o'zgarganda sotuv narxini yangilash
  const handleCostChange = (val: string) => {
    setCostPriceStr(val);
    const num = BigInt(val || "0");
    const percent = parseInt(marginPercentStr || "0", 10);
    const newSell = calcSellPriceFromMargin(num, percent);
    setSellPriceStr(newSell.toString());
  };

  const handleMarginChange = (valStr: string) => {
    setMarginPercentStr(valStr);
    const percent = parseInt(valStr || "0", 10);
    const num = BigInt(costPriceStr || "0");
    const newSell = calcSellPriceFromMargin(num, percent);
    setSellPriceStr(newSell.toString());
  };

  const costBig = BigInt(costPriceStr || "0");
  const sellBig = BigInt(sellPriceStr || "0");
  const marginPercent = parseInt(marginPercentStr || "0", 10);
  const discountPercent = Math.min(99, Math.max(0, parseInt(discountPercentStr || "0", 10)));
  const finalPrice = calcFinalPrice(sellBig, discountPercent);
  const profit = finalPrice - costBig;
  const stock = Math.max(0, parseInt(stockStr || "0", 10));
  const minStock = Math.max(0, parseInt(minStockStr || "0", 10));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameUz.trim()) return;

    onSave({
      id: initialData?.id,
      nameUz,
      nameRu,
      categorySlug,
      brandName,
      sku: sku || `SKU-${Date.now().toString().slice(-6)}`,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1591799264318-7e6ef8ddb7ea?w=500&q=80",
      costPrice: costBig,
      sellPrice: sellBig,
      marginPercent,
      discountPercent,
      stock,
      minStock,
      isNew,
      isHit,
      isActive,
      variants,
      specs,
    });
    onOpenChange(false);
  };

  // Xususiyat qo'shish
  const addSpec = () => {
    setSpecs([
      ...specs,
      {
        key: `spec_${Date.now()}`,
        title: "Yadro soni",
        value: "8 yadro",
        helpText: "Protsessorning parallel ishlash qobiliyati",
      },
    ]);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Mahsulotni tahrirlash" : "Yangi mahsulot qoʻshish"}
      description="Katalog, narxlar, qoldiq va texnik xususiyatlarni kiriting"
      wide
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>
          <Button type="submit" form="product-form">
            <Check /> {initialData ? "Saqlash" : "Mahsulotni yaratish"}
          </Button>
        </>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Asosiy ma'lumotlar */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="prod-name-uz">Mahsulot nomi (Oʻzbekcha) *</Label>
            <Input
              id="prod-name-uz"
              value={nameUz}
              onChange={(e) => setNameUz(e.target.value)}
              placeholder="Masalan: Intel Core i7-14700K"
              required
            />
          </div>

          <div>
            <Label htmlFor="prod-name-ru">Mahsulot nomi (Ruscha)</Label>
            <Input
              id="prod-name-ru"
              value={nameRu}
              onChange={(e) => setNameRu(e.target.value)}
              placeholder="Процессор Intel Core i7-14700K"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="prod-category">Toifa (Kategoriya)</Label>
            <Select value={categorySlug} onValueChange={setCategorySlug}>
              <SelectTrigger id="prod-category" aria-label="Toifa (Kategoriya)" className="w-full">
                <SelectValue placeholder="Toifani tanlang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="protsessorlar">Protsessorlar (CPU)</SelectItem>
                <SelectItem value="videokartalar">Videokartalar (GPU)</SelectItem>
                <SelectItem value="operativ-xotira">Operativ xotira (RAM)</SelectItem>
                <SelectItem value="ssd-disklar">SSD toʻplovchilar</SelectItem>
                <SelectItem value="ona-platalar">Ona platalar (Motherboard)</SelectItem>
                <SelectItem value="korpuslar">Korpuslar (Case)</SelectItem>
                <SelectItem value="blok-pitaniya">Blok pitaniya (PSU)</SelectItem>
                <SelectItem value="sovutish">Kuler va sovutish tizimi</SelectItem>
                <SelectItem value="monitorlar">Monitorlar</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="prod-brand">Brend</Label>
            <Input
              id="prod-brand"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="Intel, ASUS, Kingston..."
            />
          </div>

          <div>
            <Label htmlFor="prod-sku">SKU / Mahsulot kodi</Label>
            <Input
              id="prod-sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Avtomatik yaratiladi"
            />
          </div>
        </div>

        <div>
          <ImageUploadWithBgRemoval
            value={imageUrl}
            onChange={setImageUrl}
            label="Mahsulot rasmi"
            placeholder="https://... yoki rasm yuklang"
          />
        </div>

        {/* 2. Narx va Foyda Kalkulyatori (faqat moliyaviy rejimda) */}
        {isFinancial && (
          <div className="space-y-3 rounded-control border border-border bg-muted/20 p-4">
            <div className="text-body font-semibold text-foreground">Narxlar va Kutilayotgan Foyda</div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label htmlFor="prod-cost">Tannarx (soʻmda)</Label>
                <Input
                  id="prod-cost"
                  type="number"
                  value={costPriceStr}
                  onChange={(e) => handleCostChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="prod-margin">Ustama (marja %)</Label>
                <Input
                  id="prod-margin"
                  type="number"
                  value={marginPercentStr}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="prod-sell">Sotish narxi (soʻmda)</Label>
                <Input
                  id="prod-sell"
                  type="number"
                  value={sellPriceStr}
                  onChange={(e) => setSellPriceStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="prod-discount">Chegirma %</Label>
                <Input
                  id="prod-discount"
                  type="number"
                  min={0}
                  max={99}
                  value={discountPercentStr}
                  onChange={(e) => setDiscountPercentStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between rounded-control border border-border bg-card p-3">
              <div>
                <FieldHint className="mt-0">Xaridor koʻradigan yakuniy narx:</FieldHint>
                <div className="text-body font-bold text-foreground">{formatMoney(finalPrice)}</div>
              </div>

              <div className="text-right">
                <FieldHint className="mt-0">Kutilayotgan sof foyda (dona):</FieldHint>
                <div className={`text-body font-bold ${profit >= 0n ? "text-(--success-fg)" : "text-(--danger-fg)"}`}>
                  {profit >= 0n ? "+" : ""}
                  {formatMoney(profit)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Ombor va Holat */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div className="text-body font-semibold text-foreground">Ombor qoldigʻi</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-stock">Qoldiq dona (Stock)</Label>
                <Input
                  id="prod-stock"
                  type="number"
                  min={0}
                  value={stockStr}
                  onChange={(e) => setStockStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>

              <div>
                <Label htmlFor="prod-min-stock">Ogohlantirish chegarasi</Label>
                <Input
                  id="prod-min-stock"
                  type="number"
                  min={0}
                  value={minStockStr}
                  onChange={(e) => setMinStockStr(e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-body font-semibold text-foreground">Statuslar va Belgilar</div>
            <div className="space-y-2">
              <label
                htmlFor="prod-is-active"
                className="flex cursor-pointer items-center justify-between rounded-control border border-border-soft px-3 py-2 transition-colors hover:bg-muted"
              >
                <span className="text-body font-medium text-foreground">Faol (Saytda koʻrinadi)</span>
                <Switch id="prod-is-active" checked={isActive} onCheckedChange={setIsActive} />
              </label>

              <label
                htmlFor="prod-is-hit"
                className="flex cursor-pointer items-center justify-between rounded-control border border-border-soft px-3 py-2 transition-colors hover:bg-muted"
              >
                <span className="text-body font-medium text-foreground">Hit tovar (Ommabop)</span>
                <Switch id="prod-is-hit" checked={isHit} onCheckedChange={setIsHit} />
              </label>

              <label
                htmlFor="prod-is-new"
                className="flex cursor-pointer items-center justify-between rounded-control border border-border-soft px-3 py-2 transition-colors hover:bg-muted"
              >
                <span className="text-body font-medium text-foreground">Yangi mahsulot</span>
                <Switch id="prod-is-new" checked={isNew} onCheckedChange={setIsNew} />
              </label>
            </div>
          </div>
        </div>

        <FieldHint>
          Rang variantlari alohida qoldiq va buyurtma oqimiga ulanmaguncha bu formada tahrirlanmaydi.
        </FieldHint>

        {/* 4. Texnik xususiyatlar */}
        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-body font-semibold text-foreground">Texnik xususiyatlar (Specs)</div>
              <FieldHint className="mt-0">Xaridor koʻradigan parametrlar va "?" tushuntirish modali matni</FieldHint>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addSpec}>
              <Plus /> Xususiyat qoʻshish
            </Button>
          </div>

          {specs.map((s, i) => (
            <div key={i} className="space-y-2 rounded-control border border-border bg-muted/10 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`spec-title-${i}`}>Xususiyat nomi</Label>
                  <Input
                    id={`spec-title-${i}`}
                    value={s.title}
                    onChange={(e) => {
                      setSpecs(specs.map((item, idx) => (idx === i ? { ...item, title: e.target.value } : item)));
                    }}
                    placeholder="Masalan: Chastota"
                  />
                </div>
                <div>
                  <Label htmlFor={`spec-value-${i}`}>Qiymati</Label>
                  <Input
                    id={`spec-value-${i}`}
                    value={s.value}
                    onChange={(e) => {
                      setSpecs(specs.map((item, idx) => (idx === i ? { ...item, value: e.target.value } : item)));
                    }}
                    placeholder="Masalan: 5.4 GHz"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    value={s.helpText ?? ""}
                    onChange={(e) => {
                      setSpecs(specs.map((item, idx) => (idx === i ? { ...item, helpText: e.target.value } : item)));
                    }}
                    placeholder="? tushuntirish matni (masalan: Protsessor takt chastotasi nima?)"
                  />
                </div>
                <Button
                  type="button"
                  variant="icon"
                  size="icon-sm"
                  onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))}
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
      </form>
    </Modal>
  );
}
