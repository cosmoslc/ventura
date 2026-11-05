"use client";
import { SelectField } from "@ventura/ui/select";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Modal } from "@ventura/ui/modal";
import { Switch } from "@ventura/ui/switch";
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
}

export function ProductFormModal({
  open,
  onOpenChange,
  initialData,
  onSave,
}: ProductFormModalProps) {
  const [nameUz, setNameUz] = useState("");
  const [nameRu, setNameRu] = useState("");
  const [categorySlug, setCategorySlug] = useState("protsessorlar");
  const [brandName, setBrandName] = useState("");
  const [sku, setSku] = useState("");
  const [imageUrl, setImageUrl] = useState("");

  const [costPriceStr, setCostPriceStr] = useState("1000000");
  const [marginPercent, setMarginPercent] = useState(20);
  const [sellPriceStr, setSellPriceStr] = useState("1200000");
  const [discountPercent, setDiscountPercent] = useState(0);

  const [stock, setStock] = useState(5);
  const [minStock, setMinStock] = useState(2);
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
      setMarginPercent(initialData.marginPercent);
      setDiscountPercent(initialData.discountPercent);
      setStock(initialData.stock);
      setMinStock(initialData.minStock);
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
      setCostPriceStr("1000000");
      setMarginPercent(20);
      setSellPriceStr("1200000");
      setDiscountPercent(0);
      setStock(5);
      setMinStock(2);
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
    const newSell = calcSellPriceFromMargin(num, marginPercent);
    setSellPriceStr(newSell.toString());
  };

  const handleMarginChange = (percent: number) => {
    setMarginPercent(percent);
    const num = BigInt(costPriceStr || "0");
    const newSell = calcSellPriceFromMargin(num, percent);
    setSellPriceStr(newSell.toString());
  };

  const costBig = BigInt(costPriceStr || "0");
  const sellBig = BigInt(sellPriceStr || "0");
  const finalPrice = calcFinalPrice(sellBig, discountPercent);
  const profit = finalPrice - costBig;

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
    setSpecs([...specs, { key: `spec_${Date.now()}`, title: "Yadro soni", value: "8 yadro", helpText: "Protsessorning parallel ishlash qobiliyati" }]);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={initialData ? "Mahsulotni tahrirlash" : "Yangi mahsulot qoʻshish"}
      description="Katalog, narxlar, qoldiq va texnik xususiyatlarni kiriting"
      wide
      footer={
        <div className="flex w-full items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Bekor qilish
          </Button>

          <Button variant="primary" size="sm" onClick={handleSubmit} className="font-bold">
            {initialData ? "Oʻzgarishlarni saqlash" : "Mahsulotni yaratish"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
        {/* 1. Asosiy ma'lumotlar */}
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mahsulot nomi (Oʻzbekcha) *</Label>
              <Input
                value={nameUz}
                onChange={(e) => setNameUz(e.target.value)}
                placeholder="Masalan: Intel Core i7-14700K"
                required
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mahsulot nomi (Ruscha)</Label>
              <Input
                value={nameRu}
                onChange={(e) => setNameRu(e.target.value)}
                placeholder="Процессор Intel Core i7-14700K"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Toifa (Kategoriya)</Label>
              <SelectField
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="h-(--control-h) w-full rounded-control border border-input bg-background px-3 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="protsessorlar">Protsessorlar (CPU)</option>
                <option value="videokartalar">Videokartalar (GPU)</option>
                <option value="operativ-xotira">Operativ xotira (RAM)</option>
                <option value="ssd-disklar">SSD toʻplovchilar</option>
                <option value="ona-platalar">Ona platalar (Motherboard)</option>
                <option value="korpuslar">Korpuslar (Case)</option>
                <option value="blok-pitaniya">Blok pitaniya (PSU)</option>
                <option value="sovutish">Kuler va sovutish tizimi</option>
                <option value="monitorlar">Monitorlar</option>
              </SelectField>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Brend</Label>
              <Input
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Intel, ASUS, Kingston..."
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">SKU / Mahsulot kodi</Label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Avtomatik yaratiladi"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold">Asosiy rasm havolasi (URL)</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        {/* 2. Narx va Foyda Kalkulyatori */}
        <div className="rounded-control border border-border bg-muted/20 p-4 space-y-3">
          <h3 className="font-bold text-foreground">Narxlar va Kutilayotgan Foyda</h3>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Tannarx (soʻmda)</Label>
              <Input
                type="number"
                value={costPriceStr}
                onChange={(e) => handleCostChange(e.target.value)}
                placeholder="1000000"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Ustama (marja %)</Label>
              <div className="flex items-center gap-1.5">
                <Input
                  type="number"
                  value={marginPercent}
                  onChange={(e) => handleMarginChange(Number(e.target.value))}
                  placeholder="20"
                />
                <span className="font-bold text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Sotish narxi (soʻmda)</Label>
              <Input
                type="number"
                value={sellPriceStr}
                onChange={(e) => setSellPriceStr(e.target.value)}
                placeholder="1200000"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Chegirma %</Label>
              <Input
                type="number"
                min={0}
                max={99}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>

          {/* Jonli hisob natijasi */}
          <div className="flex flex-wrap items-center justify-between rounded-control bg-card p-3 border border-border/80">
            <div>
              <p className="text-caption text-muted-foreground">Xaridor koʻradigan yakuniy narx:</p>
              <p className="text-sm font-black text-foreground">{formatMoney(finalPrice)}</p>
            </div>

            <div className="text-right">
              <p className="text-caption text-muted-foreground">Kutilayotgan sof foyda (dona):</p>
              <p className={`text-sm font-black ${profit >= 0n ? "text-(--success-fg)" : "text-(--danger-fg)"}`}>
                {profit >= 0n ? "+" : ""}{formatMoney(profit)}
              </p>
            </div>
          </div>
        </div>

        {/* 3. Ombor va Holat */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <h3 className="font-bold text-foreground">Ombor qoldigʻi</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Qoldiq dona (Stock)</Label>
                <Input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(Number(e.target.value))}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Ogohlantirish chegarasi</Label>
                <Input
                  type="number"
                  value={minStock}
                  onChange={(e) => setMinStock(Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-foreground">Statuslar va Belgilar</h3>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-foreground">Faol (Saytda koʻrinadi)</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-foreground">Hit tovar (Ommabop)</span>
                <Switch checked={isHit} onCheckedChange={setIsHit} />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="font-medium text-foreground">Yangi mahsulot</span>
                <Switch checked={isNew} onCheckedChange={setIsNew} />
              </label>
            </div>
          </div>
        </div>

        <p className="border-t border-border pt-4 text-xs text-muted-foreground">
          Rang variantlari alohida qoldiq va buyurtma oqimiga ulanmaguncha bu formada tahrirlanmaydi.
        </p>

        {/* 5. Texnik xususiyatlar ("?" tushuntirish bilan) */}
        <div className="space-y-2.5 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-foreground">Texnik xususiyatlar (Specs)</h3>
              <p className="text-caption text-muted-foreground">
                Xaridor koʻradigan parametrlar va "?" tushuntirish modali matni
              </p>
            </div>
            <Button variant="ghost" size="sm" type="button" onClick={addSpec} className="gap-1 text-xs">
              <Plus size={13} /> Xususiyat qoʻshish
            </Button>
          </div>

          {specs.map((s, i) => (
            <div key={i} className="space-y-2 rounded-control border border-border p-3 bg-muted/10">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Input
                  value={s.title}
                  onChange={(e) => {
                    setSpecs(specs.map((item, idx) => idx === i ? { ...item, title: e.target.value } : item));
                  }}
                  placeholder="Xususiyat nomi (masalan: Chastota)"
                />
                <Input
                  value={s.value}
                  onChange={(e) => {
                    setSpecs(specs.map((item, idx) => idx === i ? { ...item, value: e.target.value } : item));
                  }}
                  placeholder="Qiymati (masalan: 5.4 GHz)"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={s.helpText ?? ""}
                  onChange={(e) => {
                    setSpecs(specs.map((item, idx) => idx === i ? { ...item, helpText: e.target.value } : item));
                  }}
                  placeholder="? tushuntirish matni (masalan: Protsessor takt chastotasi nima?)"
                  className="flex-1 text-caption"
                />
                <button
                  type="button"
                  onClick={() => setSpecs(specs.filter((_, idx) => idx !== i))}
                  className="text-muted-foreground hover:text-(--danger-fg) p-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </form>
    </Modal>
  );
}
