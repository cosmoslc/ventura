"use client";

import Link from "next/link";
import { Headphones, Mail, MapPin, Monitor, Phone, ShieldCheck, Truck } from "lucide-react";
import { useStore } from "@/lib/store-context";

function renderFooterLogo(name: string) {
  const trimmed = name.trim();
  const spaceIdx = trimmed.lastIndexOf(" ");
  if (spaceIdx > 0) {
    const firstPart = trimmed.slice(0, spaceIdx);
    const lastPart = trimmed.slice(spaceIdx + 1);
    return (
      <span className="uppercase tracking-tight">
        {firstPart} <span className="text-primary font-normal">{lastPart}</span>
      </span>
    );
  }
  const dashIdx = trimmed.lastIndexOf("-");
  if (dashIdx > 0) {
    const firstPart = trimmed.slice(0, dashIdx);
    const lastPart = trimmed.slice(dashIdx + 1);
    return (
      <span className="uppercase tracking-tight">
        {firstPart} <span className="text-primary font-normal">{lastPart}</span>
      </span>
    );
  }
  return <span className="uppercase tracking-tight">{trimmed}</span>;
}

export function Footer() {
  const { branding } = useStore();
  const storeName = (branding.name || "Ventura PC").trim();

  return (
    <footer className="mt-16 border-t border-border bg-card text-card-foreground">
      {/* Afzalliklar bloki (Nega biz) */}
      <div className="border-b border-border/60 py-8">
        <div className="mx-auto grid max-w-[var(--storefront-max-w,1320px)] grid-cols-1 gap-6 px-4 sm:grid-cols-2 lg:grid-cols-4 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
              <Truck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Tez yetkazib berish</h4>
              <p className="text-xs text-muted-foreground">Viloyatlar va Toshkent boʻylab</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">1 yillik kafolat</h4>
              <p className="text-xs text-muted-foreground">Faqat original butlovchi qismlar</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
              <Monitor size={22} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground">Professional yigʻish</h4>
              <p className="text-xs text-muted-foreground">Kabel menejment va toʻliq test</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-primary/10 text-primary">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-btn bg-primary text-primary-foreground shadow-card">
                <Monitor size={18} />
              </div>
              {renderFooterLogo(storeName)}
            </Link>
            <p className="mb-4 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Kompyuterlar, ehtiyot qismlar, monitor va aksessuarlar sotuvchi eng ishonchli doʻkon. Oʻz orzuingizdagi
              kompyuterni biz bilan quring.
            </p>
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <MapPin size={14} className="text-primary" /> {branding.contacts?.address || "Toshkent shahri, Yunusobod tumani"}
              </span>
              <span className="flex items-center gap-2">
                <Phone size={14} className="text-primary" /> {branding.contacts?.phone || "+998 71 200 00 00"}
              </span>
              <span className="flex items-center gap-2">
                <Mail size={14} className="text-primary" /> {branding.contacts?.email || "info@venturapc.uz"}
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
                <Link href="/computers" className="hover:text-primary transition-colors">
                  Tayyor kompyuterlar
                </Link>
              </li>
              <li>
                <Link href="/computers/custom" className="hover:text-primary transition-colors">
                  PC Konfigurator
                </Link>
              </li>
            </ul>
          </div>

          {/* Xaridorga */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Xaridorga</h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link href="/cart" className="hover:text-primary transition-colors">
                  Savatcha
                </Link>
              </li>
              <li>
                <Link href="/profile/orders" className="hover:text-primary transition-colors">
                  Buyurtmalarim
                </Link>
              </li>
              <li>
                <Link href="/profile/liked" className="hover:text-primary transition-colors">
                  Yoqqan mahsulotlar
                </Link>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary transition-colors">
                  Koʻp beriladigan savollar
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
                  Biz haqimizda
                </Link>
              </li>
            </ul>
          </div>

          {/* Do'kon & Kafolat */}
          <div>
            <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-foreground">Servis</h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <span className="text-muted-foreground/80">Yetkazib berish: 1-3 kun</span>
              </li>
              <li>
                <span className="text-muted-foreground/80">Kafolat: 12 oy</span>
              </li>
              <li>
                <Link href="/faq" className="hover:text-primary transition-colors">
                  Toʻlov usullari
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-primary transition-colors">
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
        © {new Date().getFullYear()} {storeName}. Barcha huquqlar himoyalangan.
      </div>
    </footer>
  );
}
