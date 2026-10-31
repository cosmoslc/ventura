import Link from "next/link";
import { Headphones, Mail, MapPin, Monitor, Phone, ShieldCheck, Truck } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-card text-card-foreground">
      {/* Afzalliklar bloki (Nega biz) */}
      <div className="border-b border-border/60 py-8">
        <div className="mx-auto grid max-w-[var(--storefront-max-w,1320px)] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Tez yetkazib berish</h4>
              <p className="text-xs text-muted-foreground">Viloyatlar va Toshkent boʻylab</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">1 yillik kafolat</h4>
              <p className="text-xs text-muted-foreground">Faqat original butlovchi qismlar</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Monitor size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Professional yigʻish</h4>
              <p className="text-xs text-muted-foreground">Kabel menejment va toʻliq test</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Headphones size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">24/7 Yordam</h4>
              <p className="text-xs text-muted-foreground">Mutaxassislardan bepul maslahat</p>
            </div>
          </div>
        </div>
      </div>

      {/* Asosiy footer havolalari */}
      <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {/* Kompaniya info */}
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 inline-flex items-center gap-2 text-foreground font-black text-xl">
              <div className="flex h-8 w-8 items-center justify-center rounded-[var(--r-btn,8px)] bg-primary text-primary-foreground shadow-sm">
                <Monitor size={18} />
              </div>
              <span>
                VENTURA<span className="text-primary font-normal">PC</span>
              </span>
            </Link>
            <p className="mb-4 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Kompyuterlar, ehtiyot qismlar, monitor va aksessuarlar sotuvchi eng ishonchli doʻkon. Oʻz orzuingizdagi
              kompyuterni biz bilan quring.
            </p>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" /> Toshkent shahri, Yunusobod tumani
              </span>
              <span className="flex items-center gap-2">
                <Phone size={14} className="text-primary" /> +998 71 200 00 00
              </span>
              <span className="flex items-center gap-2">
                <Mail size={14} className="text-primary" /> info@venturapc.uz
              </span>
            </div>
          </div>

          {/* Katalog */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Katalog</h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link href="/products?category=protsessorlar" className="hover:text-primary transition-colors">
                  Protsessorlar (CPU)
                </Link>
              </li>
              <li>
                <Link href="/products?category=videokartalar" className="hover:text-primary transition-colors">
                  Videokartalar (GPU)
                </Link>
              </li>
              <li>
                <Link href="/products?category=operativ-xotira" className="hover:text-primary transition-colors">
                  Operativ xotira (RAM)
                </Link>
              </li>
              <li>
                <Link href="/products?category=ssd-disklar" className="hover:text-primary transition-colors">
                  SSD toʻplovchilar
                </Link>
              </li>
              <li>
                <Link href="/products?category=monitorlar" className="hover:text-primary transition-colors">
                  Monitorlar
                </Link>
              </li>
            </ul>
          </div>

          {/* Kompyuterlar */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Kompyuterlar</h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link href="/computers?type=gaming" className="hover:text-primary transition-colors">
                  Oʻyin kompyuterlari (Gaming)
                </Link>
              </li>
              <li>
                <Link href="/computers?type=office" className="hover:text-primary transition-colors">
                  Ofis va Oʻqish uchun
                </Link>
              </li>
              <li>
                <Link href="/computers?type=workstation" className="hover:text-primary transition-colors">
                  Render va Montaj (Workstation)
                </Link>
              </li>
              <li>
                <Link href="/computers/custom" className="text-primary font-semibold hover:underline">
                  Oʻz kompyuteringni terish →
                </Link>
              </li>
            </ul>
          </div>

          {/* Ma'lumot */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Mijozlarga</h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  Biz haqimizda
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary transition-colors">
                  Koʻp soʻraladigan savollar
                </Link>
              </li>
              <li>
                <Link href="/shipping" className="hover:text-primary transition-colors">
                  Yetkazib berish va toʻlov
                </Link>
              </li>
              <li>
                <Link href="/warranty" className="hover:text-primary transition-colors">
                  Kafolat va qaytarish
                </Link>
              </li>
              <li>
                <Link href="/admin" className="text-xs text-muted-foreground/60 hover:text-foreground">
                  Admin panel
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Mualliflik huquqi */}
      <div className="border-t border-border/50 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} VenturaPC Platformasi. Barcha huquqlar himoyalangan.
      </div>
    </footer>
  );
}
