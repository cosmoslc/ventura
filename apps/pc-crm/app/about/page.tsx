"use client";

import Link from "next/link";
import {
  Award,
  CheckCircle2,
  Clock,
  Headphones,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";

const STATS = [
  { value: "5+ yil", label: "Oʻzbekiston bozorida tajriba" },
  { value: "12 000+", label: "Yigʻilgan va yetkazilgan kompyuterlar" },
  { value: "99.8%", label: "Mijozlar mamnuniyat darajasi" },
  { value: "100%", label: "Original va kafolatlangan detallar" },
];

const TEAM = [
  {
    name: "Alisher Vohidov",
    role: "Bosh muhandis va asoschi",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    phone: "+998 71 200 00 01",
  },
  {
    name: "Rustam Ikromov",
    role: "PC Assembling yetakchisi",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    phone: "+998 71 200 00 02",
  },
  {
    name: "Dilnoza Rahimova",
    role: "Mijozlar bilan ishlash boʻlimi rahbari",
    image: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80",
    phone: "+998 71 200 00 03",
  },
  {
    name: "Jasur Qosimov",
    role: "Texnik nazorat va sifat mutaxassisi",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80",
    phone: "+998 71 200 00 04",
  },
];

const BRANCHES = [
  {
    city: "Toshkent shahri (Markaziy doʻkon & Servis)",
    address: "Chilonzor tumani, Bunyodkor shoh koʻchasi, 42-uy",
    landmark: "Mirzo Ulugʻbek metrosi yaqinida",
    hours: "Dushanba - Yakshanba: 09:00 - 21:00",
    phone: "+998 71 200 00 00",
  },
  {
    city: "Samarqand filiali",
    address: "Registon koʻchasi, 18-uy",
    landmark: "Registon maydoni roʻparasida",
    hours: "Dushanba - Shanba: 09:00 - 19:00",
    phone: "+998 66 230 00 00",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero bo'limi */}
        <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-card via-card to-background py-16 sm:py-24">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-bold text-primary">
                <Sparkles size={14} />
                <span>Ventura PC — Kompyuter texnologiyalari markazi</span>
              </div>
              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Oʻzbekistonda professional kompyuter madaniyatini yaratmoqdamiz
              </h1>
              <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
                Biz shunchaki temir detallar sotmaymiz — geymerlar, dasturchilar, 3D animatorlar va biznes uchun eng yuqori unumdorlikdagi ishonchli ish qurollarini yigʻib beramiz.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Raqamlar va yutuqlar */}
        <section className="border-b border-border bg-muted/30 py-10">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {STATS.map((stat, idx) => (
                <div key={idx} className="flex flex-col items-center text-center">
                  <span className="font-mono text-3xl sm:text-4xl font-black text-primary">
                    {stat.value}
                  </span>
                  <span className="text-xs sm:text-sm text-muted-foreground mt-1 font-medium">
                    {stat.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Missiyamiz va Tamoyillarimiz */}
        <section className="py-14 border-b border-border">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="rounded-card border border-border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <ShieldCheck size={22} />
                </div>
                <h3 className="text-lg font-bold">100% Halol va Sifatli detallar</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Barcha videokarta, protsessor va xotiralar toʻgʻridan-toʻgʻri rasmiy distribyutorlardan keltiriladi. Ishlatilgan (refurbished / used) detallar qatʼiyan sotilmaydi.
                </p>
              </div>

              <div className="rounded-card border border-border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Wrench size={22} />
                </div>
                <h3 className="text-lg font-bold">Mukammal yigʻish madaniyati</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Kabel boshqaruvi (cable management), toʻgʻri havo aylanish oqimi (airflow) va termopastaning toʻgʻri qoʻllanilishi har bir kompyuterda ideal darajada bajariladi.
                </p>
              </div>

              <div className="rounded-card border border-border bg-card p-6 space-y-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-control bg-primary/10 text-primary">
                  <Zap size={22} />
                </div>
                <h3 className="text-lg font-bold">24 soatlik toʻliq stress-test</h3>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Mijozga topshirishdan oldin har bir tizim AIDA64 va FurMark orqali maksimal yuklamada sinaladi. Harorat meʼyorida ekanligiga toʻliq ishonch hosil qilinadi.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Jamoa */}
        <section className="py-14 border-b border-border bg-card/40">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-2xl font-black sm:text-3xl">Bizning asosiy jamoamiz</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Texnologiya ishqibozlari va tajribali apparat muhandislari
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {TEAM.map((member) => (
                <div
                  key={member.name}
                  className="rounded-card border border-border bg-card p-4 text-center transition-all hover:shadow-control"
                >
                  <div className="relative mx-auto mb-3 h-32 w-32 overflow-hidden rounded-full border-2 border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={member.image} alt={member.name} className="h-full w-full object-cover" />
                  </div>
                  <h3 className="font-bold text-sm text-foreground">{member.name}</h3>
                  <span className="text-xs text-primary font-medium block mt-0.5">{member.role}</span>
                  <a
                    href={`tel:${member.phone.replace(/\s+/g, "")}`}
                    className="mt-2 inline-flex items-center gap-1 text-caption font-mono text-muted-foreground hover:text-foreground"
                  >
                    <Phone size={11} />
                    {member.phone}
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Filiallar va Manzillar */}
        <section className="py-14">
          <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-2xl font-black sm:text-3xl">Bizning filiallarimiz</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Doʻkonlarimizga tashrif buyuring, tayyor kompyuterlarni jonli sinab koʻring
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              {BRANCHES.map((b, idx) => (
                <div
                  key={idx}
                  className="rounded-card border border-border bg-card p-6 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <MapPin size={20} className="text-primary" />
                    <h3 className="font-bold text-base">{b.city}</h3>
                  </div>
                  <div className="space-y-1 text-xs sm:text-sm text-muted-foreground">
                    <p><strong>Manzil:</strong> {b.address}</p>
                    <p><strong>Moʻljal:</strong> {b.landmark}</p>
                    <p className="flex items-center gap-1 pt-1 text-foreground">
                      <Clock size={13} className="text-primary" />
                      {b.hours}
                    </p>
                    <p className="flex items-center gap-1 font-mono text-primary font-bold">
                      <Phone size={13} />
                      {b.phone}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
