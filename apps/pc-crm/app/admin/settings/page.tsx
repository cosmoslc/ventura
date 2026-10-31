"use client";

import { useState } from "react";
import { Check, DollarSign, Globe, MapPin, Save, Shield, Sliders, Truck } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Switch } from "@ventura/ui/switch";

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState<"finance" | "shipping" | "general" | "modules">("finance");
  const [savedToast, setSavedToast] = useState(false);

  // Moliya sozlamalari
  const [usdRate, setUsdRate] = useState("12850");
  const [taxPercent, setTaxPercent] = useState("12");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("1000000");

  // Umumiy do'kon
  const [storeName, setStoreName] = useState("VenturaPC Electronics");
  const [storePhone, setStorePhone] = useState("+998 71 200 00 00");
  const [storeTelegram, setStoreTelegram] = useState("@venturapc_admin");
  const [storeAddress, setStoreAddress] = useState("Toshkent sh., Yunusobod tumani, 4-mavze");

  // Modullar
  const [modules, setModules] = useState({
    pcBuilder: true,
    reviews: true,
    onlinePayments: false,
    advancedFinance: false,
  });

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Sarlavha */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl">
            Tizim sozlamalari
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Valyuta kursi, soliq, yetkazib berish narxlari va faol modullar
          </p>
        </div>

        <Button variant="primary" size="sm" onClick={handleSave} className="gap-1.5 font-bold">
          {savedToast ? <Check size={14} /> : <Save size={14} />}
          {savedToast ? "Saqlandi!" : "Saqlash"}
        </Button>
      </div>

      {/* Tablar navigatsiyasi */}
      <div className="flex border-b border-border text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab("finance")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
            activeTab === "finance"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <DollarSign size={15} />
          Moliya & Kurs
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("shipping")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
            activeTab === "shipping"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Truck size={15} />
          Yetkazib berish
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
            activeTab === "general"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Globe size={15} />
          Doʻkon maʼlumotlari
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("modules")}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 transition-colors ${
            activeTab === "modules"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sliders size={15} />
          Modullar (Flags)
        </button>
      </div>

      {/* Tab kontentlari */}
      <div className="max-w-3xl rounded-[var(--r-card,12px)] border border-border bg-card p-6 shadow-sm">
        {/* 1. Moliya */}
        {activeTab === "finance" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-sm font-bold text-foreground">Valyuta va Soliq sozlamalari</h2>
              <p className="text-xs text-muted-foreground">
                Barcha narxlar bazada UZS (soʻm)da saqlanadi. USD narxlar ushbu kurs boʻyicha hisoblanadi.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="usdRate" className="text-xs font-semibold">
                  1 USD kursi (soʻmda)
                </Label>
                <Input
                  id="usdRate"
                  type="number"
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  placeholder="12850"
                />
                <p className="text-[11px] text-muted-foreground">Admin panelda narx koʻrinishida qoʻllaniladi</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="taxPercent" className="text-xs font-semibold">
                  Soliq stavkasi (QQS %)
                </Label>
                <Input
                  id="taxPercent"
                  type="number"
                  value={taxPercent}
                  onChange={(e) => setTaxPercent(e.target.value)}
                  placeholder="12"
                />
                <p className="text-[11px] text-muted-foreground">0 boʻlsa hisoblanmaydi</p>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="freeShippingThreshold" className="text-xs font-semibold">
                  Bepul yetkazib berish chegarasi (soʻmda)
                </Label>
                <Input
                  id="freeShippingThreshold"
                  type="number"
                  value={freeShippingThreshold}
                  onChange={(e) => setFreeShippingThreshold(e.target.value)}
                  placeholder="1000000"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shu summadan oshgan buyurtmalarda yetkazib berish avtomatik bepul (0 soʻm) boʻladi
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 2. Yetkazib berish tariflari */}
        {activeTab === "shipping" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">Hududlar boʻyicha yetkazish narxi</h2>
              <p className="text-xs text-muted-foreground">
                Xaridor checkout sahifasida viloyatini tanlaganda ushbu summa buyurtmaga qoʻshiladi.
              </p>
            </div>

            <div className="space-y-2.5">
              {[
                { region: "Toshkent shahri", defaultPrice: "35 000" },
                { region: "Toshkent viloyati", defaultPrice: "45 000" },
                { region: "Samarqand viloyati", defaultPrice: "60 000" },
                { region: "Fargʻona vodiysi (Andijon, Namangan, Fargʻona)", defaultPrice: "65 000" },
                { region: "Buxoro & Navoiy", defaultPrice: "65 000" },
                { region: "Qashqadaryo & Surxondaryo", defaultPrice: "70 000" },
                { region: "Xorazm & Qoraqalpogʻiston", defaultPrice: "75 000" },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-border/70 p-3 text-xs"
                >
                  <span className="font-semibold text-foreground">{item.region}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      defaultValue={item.defaultPrice}
                      className="w-28 rounded border border-input bg-background px-2.5 py-1 text-right text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-muted-foreground font-medium">soʻm</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Do'kon kontaktlari */}
        {activeTab === "general" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">Doʻkon rekvizitlari va kontaktlar</h2>
              <p className="text-xs text-muted-foreground">
                Sayt sarlavhasi, footer va buyurtma cheklarida koʻrinuvchi maʼlumotlar.
              </p>
            </div>

            <div className="space-y-3.5">
              <div className="space-y-1">
                <Label htmlFor="storeName" className="text-xs font-semibold">
                  Doʻkon / Brend nomi
                </Label>
                <Input
                  id="storeName"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="storePhone" className="text-xs font-semibold">
                    Telefon raqam
                  </Label>
                  <Input
                    id="storePhone"
                    value={storePhone}
                    onChange={(e) => setStorePhone(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="storeTelegram" className="text-xs font-semibold">
                    Telegram operator username
                  </Label>
                  <Input
                    id="storeTelegram"
                    value={storeTelegram}
                    onChange={(e) => setStoreTelegram(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="storeAddress" className="text-xs font-semibold">
                  Jismoniy manzil va filial
                </Label>
                <Input
                  id="storeAddress"
                  value={storeAddress}
                  onChange={(e) => setStoreAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. Modullar (Feature flags) */}
        {activeTab === "modules" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-sm font-bold text-foreground">Tizim modullarini boshqarish</h2>
              <p className="text-xs text-muted-foreground">
                Mijoz sotib olgan xizmat paketiga qarab modullarni yoqish yoki oʻchirish.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Kompyuterlar & PC Konfigurator</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Tayyor kompyuterlarni yigʻish va saytda foydalanuvchilar uchun bosqichma-bosqich konfigurator
                  </p>
                </div>
                <Switch
                  checked={modules.pcBuilder}
                  onCheckedChange={(val) => setModules({ ...modules, pcBuilder: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Sharhlar va Baholar (Reviews)</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Faqat mahsulotni sotib olgan xaridorlarga sharh qoldirish imkoniyati
                  </p>
                </div>
                <Switch
                  checked={modules.reviews}
                  onCheckedChange={(val) => setModules({ ...modules, reviews: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Onlayn toʻlovlar (Click / Payme)</h4>
                    <Badge tone="info" className="text-[9px]">
                      Tez kunda
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Click va Payme adapterlari orqali toʻgʻridan-toʻgʻri kartadan toʻlov qabul qilish
                  </p>
                </div>
                <Switch
                  checked={modules.onlinePayments}
                  onCheckedChange={(val) => setModules({ ...modules, onlinePayments: val })}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Kengaytirilgan Moliya va ERP</h4>
                    <Badge tone="neutral" className="text-[9px]">
                      2-bosqich
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Xarajatlar (ijara, maosh), kassa hisobi, qarzdorliklar (nasiya) va chuqur P&L hisoboti
                  </p>
                </div>
                <Switch
                  checked={modules.advancedFinance}
                  onCheckedChange={(val) => setModules({ ...modules, advancedFinance: val })}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
