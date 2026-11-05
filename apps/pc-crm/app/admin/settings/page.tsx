"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, DollarSign, Globe, MapPin, Save, Shield, Sliders, Truck } from "lucide-react";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Switch } from "@ventura/ui/switch";
import { getAdminSettingsAction, saveSettingAction, saveShippingRatesAction } from "@/lib/server/actions";
import { useStore } from "@/lib/store-context";

export default function AdminSettingsPage() {
  const { branding, setStoreMode: setContextStoreMode } = useStore();
  const [activeTab, setActiveTab] = useState<"finance" | "shipping" | "general" | "modules">("general");
  const [savedToast, setSavedToast] = useState(false);
  const [error, setError] = useState("");
  const [shippingRates, setShippingRates] = useState<{ region: string; price: string; enabled: boolean; estimatedDays?: string }[]>([]);

  // Doʻkon faoliyat rejimi
  const [storeMode, setStoreMode] = useState<"financial" | "inventory">(branding.storeMode ?? "financial");

  // Moliya sozlamalari
  const [usdRate, setUsdRate] = useState("0");
  const [taxPercent, setTaxPercent] = useState("0");
  const [freeShippingThreshold, setFreeShippingThreshold] = useState("1000000");

  // Umumiy do'kon
  const [storeName, setStoreName] = useState("");
  const [storePhone, setStorePhone] = useState("");
  const [storeTelegram, setStoreTelegram] = useState("");
  const [storeAddress, setStoreAddress] = useState("");

  // Modullar
  const modules = { pcBuilder: false, reviews: false, onlinePayments: false, advancedFinance: false };

  const loadSettings = useCallback(async () => {
    const result = await getAdminSettingsAction();
    if (!result.success) { setError(result.error ?? "Sozlamalarni yuklab bo'lmadi"); return; }
    setError("");
    const data = result.settings as Record<string, unknown>;
    const amount = (key: string, field: string, fallback: string) => {
      const record = data[key] && typeof data[key] === "object" ? data[key] as Record<string, unknown> : {};
      const value = record[field];
      return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
    };
    setUsdRate(amount("usd_rate", "amount", "12850"));
    setTaxPercent(amount("tax_percent", "percent", "0"));
    setFreeShippingThreshold(amount("free_shipping_from", "amount", "1000000"));
    if (data.store_mode === "financial" || data.store_mode === "inventory") {
      setStoreMode(data.store_mode as "financial" | "inventory");
    }
    const contacts = data.store_contacts && typeof data.store_contacts === "object" ? data.store_contacts as Record<string, unknown> : {};
    setStoreName(typeof contacts.storeName === "string" ? contacts.storeName : "");
    setStorePhone(typeof contacts.storePhone === "string" ? contacts.storePhone : "");
    setStoreTelegram(typeof contacts.storeTelegram === "string" ? contacts.storeTelegram : "");
    setStoreAddress(typeof contacts.storeAddress === "string" ? contacts.storeAddress : "");
    const canonicalRegions = [
      "Toshkent shahri", "Toshkent viloyati", "Samarqand viloyati", "Fargʻona vodiysi",
      "Buxoro viloyati", "Qashqadaryo viloyati", "Boshqa viloyatlar",
    ];
    const storedRates = new Map(result.shippingRates.map((rate) => [rate.region, rate]));
    setShippingRates(canonicalRegions.map((region) => {
      const rate = storedRates.get(region);
      return rate
        ? { region, price: rate.price.toString(), enabled: rate.enabled, estimatedDays: rate.estimatedDays ?? "" }
        : { region, price: "0", enabled: false, estimatedDays: "" };
    }));
  }, []);
  useEffect(() => { void loadSettings(); }, [loadSettings]);

  const handleSave = async () => {
    try {
      const values = [usdRate, taxPercent, freeShippingThreshold];
      if (values.some((value) => !/^\d+(?:\.\d+)?$/.test(value)) || Number(taxPercent) > 100 || !Number.isInteger(Number(freeShippingThreshold))) {
        throw new Error("Moliya qiymatlari noto'g'ri: soliq 0–100%, chegaralar butun musbat son bo'lishi kerak");
      }
      const [usdResult, taxResult, shippingThresholdResult, contactsResult, ratesResult, modeResult] = await Promise.all([
        saveSettingAction("usd_rate", { amount: Number(usdRate) }),
        saveSettingAction("tax_percent", { percent: Number(taxPercent) }),
        saveSettingAction("free_shipping_from", { amount: freeShippingThreshold }),
        saveSettingAction("store_contacts", { storeName, storePhone, storeTelegram, storeAddress }),
        saveShippingRatesAction(shippingRates.map((rate) => ({ ...rate, price: BigInt(rate.price || "0") }))),
        saveSettingAction("store_mode", storeMode),
      ]);
      const failure = [usdResult, taxResult, shippingThresholdResult, contactsResult, ratesResult, modeResult].find((result) => !result.success);
      if (failure) throw new Error(failure.error ?? "Sozlamalar saqlanmadi");
      setContextStoreMode(storeMode);
      setError("");
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sozlamalar saqlanmadi");
    }
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

        <Button onClick={handleSave}>
          {savedToast ? <Check /> : <Save />}
          {savedToast ? "Saqlandi!" : "Saqlash"}
        </Button>
      </div>

      {error && <div role="alert" className="rounded-control border border-(--danger-border) bg-(--danger-bg) p-3 text-sm text-(--danger-fg)">{error}</div>}

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
      <div className="max-w-3xl rounded-card border border-border bg-card p-6 shadow-card">
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
                  onFocus={(e) => e.target.select()}
                  placeholder="12850"
                />
                <p className="text-caption text-muted-foreground">Kurs DBʼda saqlanadi; storefront valyuta almashtirishi hali yoʻq</p>
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
                  onFocus={(e) => e.target.select()}
                  placeholder="12"
                />
                <p className="text-caption text-muted-foreground">0 boʻlsa hisoblanmaydi</p>
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
                  onFocus={(e) => e.target.select()}
                  placeholder="1000000"
                />
                <p className="text-caption text-muted-foreground">
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
              {shippingRates.map((item, idx) => (
                <div
                  key={item.region}
                  className="flex items-center justify-between rounded-control border border-border/70 p-3 text-xs"
                >
                  <span className="font-semibold text-foreground">{item.region}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      value={item.price}
                      onChange={(event) => setShippingRates((previous) => previous.map((rate, index) => index === idx ? { ...rate, price: event.target.value } : rate))}
                      onFocus={(e) => e.target.select()}
                      className="w-28 rounded border border-input bg-background px-2.5 py-1 text-right text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="text-muted-foreground font-medium">soʻm</span>
                    <Switch
                      checked={item.enabled}
                      onCheckedChange={(enabled) => setShippingRates((previous) => previous.map((rate, index) => index === idx ? { ...rate, enabled } : rate))}
                    />
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
                Kontaktlar DBʼda saqlanadi; sayt footer va chek bilan integratsiya hali yoʻq.
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

              {/* Doʻkon faoliyat rejimi tanlagichi */}
              <div className="rounded-control border border-border bg-muted/20 p-4 space-y-3 mt-4">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Doʻkon faoliyat rejimi
                  </Label>
                  <p className="text-2xs text-muted-foreground mt-0.5">
                    Tizim moliyaviy hisob-kitoblar bilan yoki moliyasiz faqat ombor va tovar aylanmasi bilan ishlashini belgilang:
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div
                    onClick={() => setStoreMode("financial")}
                    className={`cursor-pointer rounded-control border p-3.5 transition-all ${
                      storeMode === "financial"
                        ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                      <span>💳</span> Moliyaviy doʻkon (Toʻliq)
                    </div>
                    <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                      Tannarx, sotuv narxlari, sof foyda hisobi, buyurtma summalari va tushumlar bilan toʻliq tizim.
                    </p>
                  </div>

                  <div
                    onClick={() => setStoreMode("inventory")}
                    className={`cursor-pointer rounded-control border p-3.5 transition-all ${
                      storeMode === "inventory"
                        ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20"
                        : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center gap-2 font-bold text-foreground text-xs">
                      <span>📦</span> Moliyasiz doʻkon (Faqat ombor)
                    </div>
                    <p className="mt-1 text-2xs text-muted-foreground leading-relaxed">
                      Pul va summalarsiz. Faqat ombor qoldiqlari, tovar oqimi va sotilgan mahsulotlar soni nazorati.
                    </p>
                  </div>
                </div>
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
                Modul flaglari ilovada hali toʻliq ishlatilmaydi. Hozircha ularni yoqish oʻchirilgan.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-control border border-border p-3.5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Kompyuterlar & PC Konfigurator</h4>
                  <p className="text-caption text-muted-foreground">
                    Tayyor kompyuterlarni yigʻish va saytda foydalanuvchilar uchun bosqichma-bosqich konfigurator
                  </p>
                </div>
                <Switch checked={modules.pcBuilder} disabled />
              </div>

              <div className="flex items-center justify-between rounded-control border border-border p-3.5">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Sharhlar va Baholar (Reviews)</h4>
                  <p className="text-caption text-muted-foreground">
                    Faqat mahsulotni sotib olgan xaridorlarga sharh qoldirish imkoniyati
                  </p>
                </div>
                <Switch checked={modules.reviews} disabled />
              </div>

              <div className="flex items-center justify-between rounded-control border border-border p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Onlayn toʻlovlar (Click / Payme)</h4>
                    <Badge tone="info" className="text-2xs">
                      Tez kunda
                    </Badge>
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Click va Payme adapterlari orqali toʻgʻridan-toʻgʻri kartadan toʻlov qabul qilish
                  </p>
                </div>
                <Switch checked={modules.onlinePayments} disabled />
              </div>

              <div className="flex items-center justify-between rounded-control border border-border p-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-foreground">Kengaytirilgan Moliya va ERP</h4>
                    <Badge tone="neutral" className="text-2xs">
                      2-bosqich
                    </Badge>
                  </div>
                  <p className="text-caption text-muted-foreground">
                    Xarajatlar (ijara, maosh), kassa hisobi, qarzdorliklar (nasiya) va chuqur P&L hisoboti
                  </p>
                </div>
                <Switch checked={modules.advancedFinance} disabled />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
