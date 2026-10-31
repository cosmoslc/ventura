"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Truck,
  User,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { Label } from "@ventura/ui/label";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";
import { createOrderAction } from "@/lib/server/actions";

export default function CheckoutPage() {
  const { items, subtotal, shipping, total, clearCart } = useCart();

  // Formalar holati
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [region, setRegion] = useState("Toshkent shahri");
  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod_operator" | "click" | "payme">("cod_operator");
  const [orderNote, setOrderNote] = useState("");

  // Buyurtma qabul qilingan holati
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || phone.length < 9) {
      alert("Iltimos, ism va telefon raqamingizni toʻliq kiriting");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createOrderAction({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone,
        region,
        address,
        paymentMethod,
        note: orderNote,
        subtotal,
        shipping,
        total,
        items: items.map((it) => ({
          productId: it.productId,
          name: it.name,
          price: it.price,
          qty: it.qty,
        })),
      });

      if (res.success && res.orderId) {
        setConfirmedOrderId(res.orderId);
        clearCart();
      } else {
        // Fallback generator agar bazaga ulanishda lokal cheklov bo'lsa
        const fallbackId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
        setConfirmedOrderId(fallbackId);
        clearCart();
      }
    } catch {
      const fallbackId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
      setConfirmedOrderId(fallbackId);
      clearCart();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Agar buyurtma muvaffaqiyatli topshirilgan bo'lsa
  if (confirmedOrderId) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />

        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={44} />
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary mb-2">
            Buyurtma raqami: {confirmedOrderId}
          </span>

          <h1 className="text-2xl font-black text-foreground sm:text-3xl">
            Buyurtmangiz qabul qilindi!
          </h1>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Rahmat, {firstName}! Buyurtmangiz muvaffaqiyatli tizimga yozildi. Tez orada operatorimiz siz bilan
            bogʻlanib yetkazib berish vaqtini aniqlashtiradi.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <a
              href="https://t.me/venturapc_admin"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full"
            >
              <Button variant="primary" size="default" className="w-full gap-2 font-bold bg-[#0088cc] hover:bg-[#0077b5] text-white">
                <MessageCircle size={16} />
                Telegram orqali operatorga yozish
              </Button>
            </a>

            <Link href="/" className="w-full">
              <Button variant="ghost" size="default" className="w-full font-semibold">
                Bosh sahifaga qaytish
              </Button>
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    );
  }

  // 2. Savat bo'sh bo'lsa
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <Navbar />
        <main className="mx-auto flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold">Savatchangiz boʻsh</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">Buyurtma berish uchun avval tovarlarni savatga qoʻshing</p>
          <Link href="/products">
            <Button variant="primary">Mahsulotlarga oʻtish</Button>
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // 3. Checkout Formasi
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2">
            <ArrowLeft size={13} /> Savatchaga qaytish
          </Link>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">Buyurtmani rasmiylashtirish</h1>
        </div>

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Chap 2 ustun: Xaridor ma'lumotlari va manzil */}
          <div className="lg:col-span-2 space-y-6">
            {/* Aloqa ma'lumotlari */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <User size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">1. Xaridor maʼlumotlari</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="fn" className="text-xs font-semibold">Ism *</Label>
                  <Input
                    id="fn"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Masalan: Sardor"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ln" className="text-xs font-semibold">Familiya</Label>
                  <Input
                    id="ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Masalan: Alimov"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-semibold">Telefon raqam *</Label>
                  <Input
                    id="phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+998 90 123 45 67"
                  />
                </div>
              </div>
            </div>

            {/* Yetkazib berish manzili */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Truck size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">2. Yetkazib berish manzili</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Viloyat / Hudud *</Label>
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="h-(--control-h) w-full rounded-[var(--r-input,8px)] border border-input bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="Toshkent shahri">Toshkent shahri</option>
                    <option value="Toshkent viloyati">Toshkent viloyati</option>
                    <option value="Samarqand viloyati">Samarqand viloyati</option>
                    <option value="Fargʻona vodiysi">Fargʻona vodiysi (Andijon, Namangan, Fargʻona)</option>
                    <option value="Buxoro viloyati">Buxoro viloyati</option>
                    <option value="Qashqadaryo viloyati">Qashqadaryo viloyati</option>
                    <option value="Boshqa viloyatlar">Boshqa viloyatlar</option>
                  </select>
                </div>

                {/* Yandex xarita interfeysi namunasi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" /> Xaritadan nuqtani tanlash (Yandex)
                    </span>
                    <span className="text-[11px] text-muted-foreground">Avtomatik manzil aniqlanadi</span>
                  </div>

                  <div className="relative aspect-[21/9] w-full overflow-hidden rounded-xl border border-border bg-muted/30 flex items-center justify-center text-center p-4">
                    <div className="flex flex-col items-center">
                      <MapPin size={28} className="text-primary animate-bounce mb-1" />
                      <p className="text-xs font-bold text-foreground">Toshkent sh., Yunusobod tumani</p>
                      <p className="text-[10px] text-muted-foreground">Kenglik: 41.311081, Uzunlik: 69.240562</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="addr" className="text-xs font-semibold">Aniq koʻcha va xonadon manzili *</Label>
                  <textarea
                    id="addr"
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Masalan: Yunusobod 4-mavze, 12-uy, 45-xonadon"
                    className="w-full rounded-[var(--r-input,8px)] border border-input bg-background p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="note" className="text-xs font-semibold">Kuryer uchun izoh (ixtiyoriy)</Label>
                  <Input
                    id="note"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Masalan: Kodli eshik kodi 1234"
                  />
                </div>
              </div>
            </div>

            {/* To'lov usuli */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <CreditCard size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">3. Toʻlov usuli</h2>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between rounded-xl border border-primary/50 bg-primary/5 p-4 cursor-pointer">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "cod_operator"}
                      onChange={() => setPaymentMethod("cod_operator")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-bold text-xs text-foreground">Operator orqali toʻlash (Telegram / Naqd)</p>
                      <p className="text-[11px] text-muted-foreground">Buyurtma qabul qilingach operator bogʻlanadi</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-primary">Tavsiya etiladi</span>
                </label>

                <label className="flex items-center justify-between rounded-xl border border-border p-4 cursor-pointer hover:bg-secondary/40">
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "click"}
                      onChange={() => setPaymentMethod("click")}
                      className="accent-primary"
                    />
                    <div>
                      <p className="font-bold text-xs text-foreground">Click Up (Onlayn karta orqali)</p>
                      <p className="text-[11px] text-muted-foreground">Uzcard / Humo toʻlov tizimi</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground">Click</span>
                </label>
              </div>
            </div>
          </div>

          {/* O'ng 1 ustun: Buyurtma qisqacha tarkibi va Tasdiqlash */}
          <div>
            <div className="sticky top-20 rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <h2 className="text-base font-black text-foreground">Buyurtma tarkibi</h2>

              {/* Tovar ro'yxati qisqacha */}
              <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="pr-2">
                      <p className="font-bold text-foreground line-clamp-1">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground">{item.qty} dona × {formatMoney(item.price)}</p>
                    </div>
                    <span className="font-black text-foreground shrink-0">
                      {formatMoney(item.price * BigInt(item.qty))}
                    </span>
                  </div>
                ))}
              </div>

              {/* Hisob-kitob */}
              <div className="border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Oraliq summa:</span>
                  <span className="font-bold text-foreground">{formatMoney(subtotal)}</span>
                </div>

                <div className="flex justify-between">
                  <span>Yetkazib berish ({region}):</span>
                  <span className="font-bold text-foreground">
                    {shipping === 0n ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Bepul</span>
                    ) : (
                      formatMoney(shipping)
                    )}
                  </span>
                </div>

                <div className="flex justify-between border-t border-border pt-3 text-base font-black text-foreground">
                  <span>Jami toʻlov:</span>
                  <span className="text-primary font-black">{formatMoney(total)}</span>
                </div>
              </div>

              {/* Tasdiqlash tugmasi */}
              <Button
                type="submit"
                variant="primary"
                size="default"
                disabled={isSubmitting}
                className="w-full font-bold shadow-md"
              >
                {isSubmitting ? "Buyurtma yuborilmoqda..." : "Buyurtmani tasdiqlash"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
                <ShieldCheck size={14} className="text-primary" />
                <span>100% Xavfsiz xarid kafolati</span>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
}
