"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ventura/ui/select";

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
import { Radio, RadioGroup } from "@ventura/ui/checkbox";
import { Textarea } from "@ventura/ui/textarea";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";
import { useCart } from "@/lib/cart-context";
import { formatMoney } from "@/lib/format";
import { useFinancialMode } from "@/lib/store-context";
import { createOrderAction } from "@/lib/server/actions";
import { AuthModal } from "@/components/storefront/auth-modal";
import { useSession } from "@/lib/auth-client";
import { z } from "zod";

const checkoutSchema = z.object({
  firstName: z.string().trim().min(2, "Ism kamida 2 belgi bo'lishi kerak").max(60, "Ism juda uzun"),
  lastName: z.string().trim().max(60, "Familiya juda uzun").optional(),
  phone: z
    .string()
    .trim()
    .regex(/^\+998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}$/, "Telefon formati: +998 90 123 45 67"),
  region: z.string().trim().min(2, "Viloyatni tanlang"),
  address: z.string().trim().min(5, "Manzil kamida 5 belgi bo'lishi kerak").max(500),
  orderNote: z.string().trim().max(1000).optional(),
});

type CheckoutErrors = Partial<Record<keyof z.infer<typeof checkoutSchema>, string>>;

export default function CheckoutPage() {
  const isFinancial = useFinancialMode();
  const { items, subtotal, shipping, total, clearCart } = useCart();
  const { data: session } = useSession();

  // Formalar holati
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("+998 ");
  const [region, setRegion] = useState("Toshkent shahri");
  const [address, setAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CheckoutErrors>({});

  // Buyurtma qabul qilingan holati
  const [confirmedOrderId, setConfirmedOrderId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Client-side validatsiya
    const parsed = checkoutSchema.safeParse({ firstName, lastName, phone, region, address, orderNote });
    if (!parsed.success) {
      const errs: CheckoutErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CheckoutErrors;
        if (!errs[field]) errs[field] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    setIsSubmitting(true);
    try {
      const res = await createOrderAction({
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
        phone,
        region,
        address,
        paymentMethod: "cod_operator",
        note: orderNote,
        items: items.map((it) => ({
          productId: it.productId,
          qty: it.qty,
        })),
      });

      if (res.success && res.orderId) {
        setConfirmedOrderId(res.orderId);
        clearCart();
      } else {
        setSubmitError(res.error ?? "Buyurtma saqlanmadi. Qayta urinib ko'ring.");
      }
    } catch {
      setSubmitError("Buyurtma yuborilmadi. Savatingiz saqlanib qoldi, qayta urinib ko'ring.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1. Agar buyurtma muvaffaqiyatli topshirilgan bo'lsa
  if (confirmedOrderId) {
    return (
      <div className="flex min-h-screen flex-col bg-transparent text-foreground">
        <Navbar />

        <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-(--success-bg) text-(--success-fg)">
            <CheckCircle2 size={44} />
          </div>

          <span className="rounded-full bg-primary/10 px-3 py-1 font-mono text-xs font-bold text-primary mb-2">
            Buyurtma raqami: {confirmedOrderId}
          </span>

          <h1 className="text-2xl font-black text-foreground sm:text-3xl">Buyurtmangiz qabul qilindi!</h1>

          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Rahmat, {firstName}! Buyurtmangiz muvaffaqiyatli tizimga yozildi. Tez orada operatorimiz siz bilan bogʻlanib
            yetkazib berish vaqtini aniqlashtiradi.
          </p>

          <div className="mt-6 flex w-full flex-col gap-3">
            <a href="https://t.me/venturapc_admin" target="_blank" rel="noopener noreferrer" className="w-full">
              <Button variant="telegram" size="default" className="w-full gap-2 font-bold">
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
      <div className="flex min-h-screen flex-col bg-transparent text-foreground">
        <Navbar />
        <main className="mx-auto flex flex-1 flex-col items-center justify-center p-6 text-center">
          <h2 className="text-xl font-bold">Savatchangiz boʻsh</h2>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Buyurtma berish uchun avval tovarlarni savatga qoʻshing
          </p>
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
    <div className="flex min-h-screen flex-col bg-transparent text-foreground">
      <Navbar />

      <main className="mx-auto w-full max-w-[var(--storefront-max-w,1320px)] flex-1 px-4 py-8 sm:px-6">
        <div className="mb-6">
          <Link
            href="/cart"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary mb-2"
          >
            <ArrowLeft size={13} /> Savatchaga qaytish
          </Link>
          <h1 className="text-2xl font-black text-foreground sm:text-3xl">Buyurtmani rasmiylashtirish</h1>
        </div>

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Chap 2 ustun: Xaridor ma'lumotlari va manzil */}
          <div className="lg:col-span-2 space-y-6">
            {/* Aloqa ma'lumotlari */}
            <div className="rounded-modal border border-border bg-card p-6 shadow-control space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <User size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">1. Xaridor maʼlumotlari</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="fn" className="text-xs font-semibold">
                    Ism *
                  </Label>
                  <Input
                    id="fn"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Masalan: Sardor"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="ln" className="text-xs font-semibold">
                    Familiya
                  </Label>
                  <Input
                    id="ln"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Masalan: Alimov"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="phone" className="text-xs font-semibold">
                    Telefon raqam *
                  </Label>
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
            <div className="rounded-modal border border-border bg-card p-6 shadow-control space-y-4">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <Truck size={18} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">2. Yetkazib berish manzili</h2>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Viloyat / Hudud *</Label>
                  <Select value={region} onValueChange={setRegion}>
                    <SelectTrigger aria-label="Viloyat / Hudud" className="w-full text-xs h-(--control-h)">
                      <SelectValue placeholder="Viloyatni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Toshkent shahri">Toshkent shahri</SelectItem>
                      <SelectItem value="Toshkent viloyati">Toshkent viloyati</SelectItem>
                      <SelectItem value="Samarqand viloyati">Samarqand viloyati</SelectItem>
                      <SelectItem value="Fargʻona vodiysi">Fargʻona vodiysi (Andijon, Namangan, Fargʻona)</SelectItem>
                      <SelectItem value="Buxoro viloyati">Buxoro viloyati</SelectItem>
                      <SelectItem value="Qashqadaryo viloyati">Qashqadaryo viloyati</SelectItem>
                      <SelectItem value="Boshqa viloyatlar">Boshqa viloyatlar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Yandex xarita interfeysi namunasi */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" /> Xaritadan nuqtani tanlash (Yandex)
                    </span>
                    <span className="text-caption text-muted-foreground">Avtomatik manzil aniqlanadi</span>
                  </div>

                  <div className="relative aspect-[21/9] w-full overflow-hidden rounded-card border border-border bg-muted/30 flex items-center justify-center text-center p-4">
                    <div className="flex flex-col items-center">
                      <MapPin size={28} className="text-primary animate-bounce mb-1" />
                      <p className="text-xs font-bold text-foreground">Toshkent sh., Yunusobod tumani</p>
                      <p className="text-2xs text-muted-foreground">Kenglik: 41.311081, Uzunlik: 69.240562</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="addr" className="text-xs font-semibold">
                    Aniq koʻcha va xonadon manzili *
                  </Label>
                  <Textarea
                    id="addr"
                    required
                    rows={2}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Masalan: Yunusobod 4-mavze, 12-uy, 45-xonadon"
                    className="text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="note" className="text-xs font-semibold">
                    Kuryer uchun izoh (ixtiyoriy)
                  </Label>
                  <Input
                    id="note"
                    value={orderNote}
                    onChange={(e) => setOrderNote(e.target.value)}
                    placeholder="Masalan: Kodli eshik kodi 1234"
                  />
                </div>
              </div>
            </div>

            {/* To'lov usuli (faqat moliyaviy rejimda) */}
            {isFinancial && (
              <div className="rounded-modal border border-border bg-card p-6 shadow-control space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <CreditCard size={18} className="text-primary" />
                  <h2 className="text-sm font-bold text-foreground">3. Toʻlov usuli</h2>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between rounded-card border border-primary/50 bg-primary/5 p-4">
                    <div className="flex items-center gap-3">
                      <RadioGroup value="operator" aria-label="Toʻlov turi">
                        <Radio value="operator" />
                      </RadioGroup>
                      <div>
                        <p className="font-bold text-xs text-foreground">Operator orqali toʻlash (Telegram / Naqd)</p>
                        <p className="text-caption text-muted-foreground">
                          Buyurtma qabul qilingach operator bogʻlanadi
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-primary">Tavsiya etiladi</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* O'ng 1 ustun: Buyurtma qisqacha tarkibi va Tasdiqlash */}
          <div>
            <div className="sticky top-20 rounded-modal border border-border bg-card p-6 shadow-card space-y-4">
              <h2 className="text-base font-black text-foreground">Buyurtma tarkibi</h2>

              {/* Tovar ro'yxati qisqacha */}
              <div className="divide-y divide-border/60 max-h-60 overflow-y-auto pr-1">
                {items.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="pr-2">
                      <p className="font-bold text-foreground line-clamp-1">{item.name}</p>
                      <p className="text-caption text-muted-foreground">
                        {item.qty} dona {isFinancial ? `× ${formatMoney(item.price)}` : ""}
                      </p>
                    </div>
                    {isFinancial && (
                      <span className="font-black text-foreground shrink-0">
                        {formatMoney(item.price * BigInt(item.qty))}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Hisob-kitob */}
              <div className="border-t border-border pt-3 space-y-2 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Jami mahsulotlar:</span>
                  <span className="font-bold text-foreground">{items.reduce((s, it) => s + it.qty, 0)} dona</span>
                </div>

                {isFinancial && (
                  <>
                    <div className="flex justify-between">
                      <span>Oraliq summa:</span>
                      <span className="font-bold text-foreground">{formatMoney(subtotal)}</span>
                    </div>

                    <div className="flex justify-between">
                      <span>Yetkazib berish ({region}):</span>
                      <span className="font-bold text-foreground">
                        {shipping === 0n ? <span className="text-(--success-fg)">Bepul</span> : formatMoney(shipping)}
                      </span>
                    </div>

                    <div className="flex justify-between border-t border-border pt-3 text-base font-black text-foreground">
                      <span>Jami toʻlov:</span>
                      <span className="text-primary font-black">{formatMoney(total)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Tasdiqlash tugmasi */}
              {submitError && (
                <p role="alert" className="rounded-control bg-(--danger-bg) p-3 text-xs text-(--danger-fg)">
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                variant="primary"
                size="default"
                disabled={isSubmitting}
                className="w-full font-bold shadow-card-hover"
              >
                {isSubmitting ? "Buyurtma yuborilmoqda..." : isFinancial ? "Buyurtmani tasdiqlash" : "Buyurtma berish"}
              </Button>

              <div className="flex items-center justify-center gap-2 text-caption text-muted-foreground pt-1">
                <ShieldCheck size={14} className="text-primary" />
                <span>100% Xavfsiz xarid kafolati</span>
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
