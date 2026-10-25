// Muallif / Agent: Google Gemini
"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  GraduationCap,
  HardDrive,
  HelpCircle,
  Mail,
  MapPin,
  Moon,
  Phone,
  Send,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Avatar } from "@ventura/ui/avatar";
import { Badge } from "@ventura/ui/badge";
import { Button } from "@ventura/ui/button";
import { Input } from "@ventura/ui/input";
import { FieldHint, Label } from "@ventura/ui/label";
import { Notice } from "@ventura/ui/notice";
import { PhoneInput } from "@ventura/ui/phone-input";
import { Stepper } from "@ventura/ui/stepper";
import { cn } from "@ventura/ui/lib/utils";
import { BRAND_PRESETS, contrastWithWhite, slugify } from "@/lib/project-rules";
import { processLogoFile } from "@/lib/logo";
import type { CrmContacts } from "@/lib/server/crm-contacts";
import { checkCrmSlugAvailability, checkTrialProvisionStatus, startFreeTrialAction } from "./actions";

/* Theme hook based on document.documentElement.classList */
function useTheme() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"));
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("ventura-theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  };

  return { isDark, toggle };
}

export function CrmLanding({ contacts }: { contacts: CrmContacts }) {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [initialCenterName, setInitialCenterName] = React.useState("");
  const [initialSlug, setInitialSlug] = React.useState("");
  const { isDark, toggle: toggleTheme } = useTheme();

  const handleOpenTrial = (nameOrSlug?: string) => {
    if (nameOrSlug) {
      setInitialCenterName(nameOrSlug);
      setInitialSlug(slugify(nameOrSlug));
    } else {
      setInitialCenterName("");
      setInitialSlug("");
    }
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-indigo-500 selection:text-white transition-colors duration-300">
      {/* Background Animated Gradient Orbs */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-gradient-to-b from-indigo-500/15 dark:from-indigo-600/20 via-purple-500/10 to-transparent blur-3xl opacity-70 animate-pulse-glow" />
        <div className="absolute top-[28%] -left-[180px] w-[500px] h-[500px] bg-sky-400/10 dark:bg-sky-600/10 blur-3xl rounded-full animate-float-slow" />
        <div className="absolute top-[60%] -right-[180px] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 blur-3xl rounded-full animate-float-reverse" />
      </div>

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/80 dark:border-slate-800/80 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-md shadow-indigo-500/20 border border-indigo-400/30 group hover:scale-105 transition-transform">
              <svg viewBox="0 0 40 40" fill="none" className="size-5.5 text-white" aria-hidden>
                <path
                  d="M6.25 8.75 20 31.25 33.75 8.75"
                  stroke="currentColor"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M15 8.75 20 16.9 25 8.75"
                  stroke="currentColor"
                  strokeOpacity="0.75"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 dark:from-white dark:via-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
                Ventura CRM
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300">
                EDU v2.0
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Imkoniyatlar
            </a>
            <a href="#portals" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Kabinetlar
            </a>
            <a href="#bot" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Telegram Bot
            </a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Tariflar
            </a>
            <a href="#contacts" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Aloqa & Manzil
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              FAQ
            </a>
          </nav>

          {/* Controls: Theme Toggle & Trial CTA */}
          <div className="flex items-center gap-2.5">
            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              aria-label={isDark ? "Yorug' rejim" : "Qorong'i rejim"}
              title={isDark ? "Yorug' rejim" : "Qorong'i rejim"}
            >
              {isDark ? <Sun className="size-4.5 text-amber-400" /> : <Moon className="size-4.5 text-indigo-600" />}
            </button>

            {/* Trial Button */}
            <button
              onClick={() => handleOpenTrial()}
              className="relative group inline-flex items-center justify-center px-4 py-2 text-sm font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 shadow-md shadow-indigo-600/25 active:scale-95 cursor-pointer"
            >
              <Sparkles className="size-4 mr-1.5 text-indigo-200 group-hover:rotate-12 transition-transform" />
              <span>7 kun bepul</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-14 pb-16 md:pt-20 md:pb-24 overflow-hidden text-center">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Live Notification Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 dark:bg-indigo-950/80 border border-indigo-500/20 dark:border-indigo-500/30 text-xs sm:text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-6 shadow-sm">
            <span className="flex size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>7 kunlik to'liq bepul sinov davri</span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="text-slate-600 dark:text-slate-300">Karta talab etilmaydi</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.12]">
            O'quv markazingizni{" "}
            <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-sky-600 dark:from-indigo-400 dark:via-violet-300 dark:to-sky-300 bg-clip-text text-transparent">
              100% avtomatlashtiring
            </span>
          </h1>

          {/* Concise Subtitle */}
          <p className="mt-5 text-base sm:text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            O'quvchi va o'qituvchi shaxsiy kabinetlari, davomat, moliya, Telegram botlar, uy vazifalariga fayl
            almashinuvi va har bir markazga{" "}
            <strong className="text-slate-900 dark:text-white font-semibold">alohida mustaqil xavfsiz baza</strong>.
          </p>

          {/* Interactive Subdomain Quick Starter */}
          <div className="mt-9 max-w-xl mx-auto p-2 sm:p-2.5 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl backdrop-blur-sm hover:border-indigo-500/50 transition-all">
            <SubdomainQuickStarter onStart={(slug) => handleOpenTrial(slug)} />
          </div>

          {/* Trust Highlights */}
          <div className="mt-7 flex flex-wrap justify-center items-center gap-y-2.5 gap-x-6 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>30 soniyada faollashadi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Alohida PostgreSQL baza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>Shaxsiy Telegram bot</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <span>10 GB fayllar xotirasi</span>
            </div>
          </div>
        </div>

        {/* 3. Interactive Showcase Preview */}
        <div className="mt-12 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <InteractiveMockup onOpenTrial={() => handleOpenTrial()} />
        </div>
      </section>

      {/* 4. Features Grid */}
      <section
        id="features"
        className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950/60 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2.5">
              <Sparkles className="size-3.5" />
              <span>Asosiy Imkoniyatlar</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Barcha o'quv jarayonlari bitta tizimda
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Tarqoq jadvallar va botlardan voz keching. Ventura EDU CRM barcha filiallar va guruhlarni to'liq
              avtomatlashtiradi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<GraduationCap className="size-6 text-indigo-600 dark:text-indigo-400" />}
              title="O'quvchi Shaxsiy Portali"
              badge="/student"
              description="Dars jadvali, davomat ko'rsatkichi, to'lovlar tarixi, uy vazifalarini ko'rish va fayl ilova qilib topshirish."
            />

            <FeatureCard
              icon={<BookOpen className="size-6 text-purple-600 dark:text-purple-400" />}
              title="O'qituvchi Kabineti"
              badge="/teacher"
              description="1-klikda davomat belgilash, darslarga PDF/Word uy vazifalari biriktirish, o'quvchilar javoblarini tekshirib baholash."
            />

            <FeatureCard
              icon={<Bot className="size-6 text-sky-600 dark:text-sky-400" />}
              title="Shaxsiy Telegram Bot"
              badge="Har markazga"
              description="Har bir markaz o'z botiga ega bo'ladi. O'quvchi va o'qituvchilar 1-klikda kirish kodi oladi, eslatmalar boradi."
            />

            <FeatureCard
              icon={<Wallet className="size-6 text-emerald-600 dark:text-emerald-400" />}
              title="Shaffof Moliya & Audit"
              badge="Audit zanjiri"
              description="Kassa kirim-chiqimlari, oylik to'lovlar, qarzdorlar monitoringi va o'zgartirib bo'lmas operatsiyalar auditi."
            />

            <FeatureCard
              icon={<HardDrive className="size-6 text-amber-600 dark:text-amber-400" />}
              title="Xotira & Fayllar Ombori"
              badge="/storage (10GB)"
              description="Darsliklar va vazifalar uchun 10 GB disk xotirasi. 1, 3, 4 oylik eski fayllarni avtomatik tozalash funksiyasi."
            />

            <FeatureCard
              icon={<Shield className="size-6 text-rose-600 dark:text-rose-400" />}
              title="Mustaqil Alohida Baza"
              badge="100% Izolyatsiya"
              description="Sizning markazingiz uchun alohida mustaqil PostgreSQL bazasi va subdomen: ma'lumotlar hech qachon begonalarga ko'rinmaydi."
            />
          </div>
        </div>
      </section>

      {/* 5. Portals Showcase */}
      <section
        id="portals"
        className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-900 bg-slate-100/50 dark:bg-slate-900/30 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-700 dark:text-purple-300 mb-3.5">
                <Users className="size-3.5" />
                <span>O'quvchi & O'qituvchi Kabinetlari</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Vazifalarni tekshirish va baholash endi juda oson
              </h2>
              <p className="mt-3.5 text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
                Qog'oz daftarlar va Telegram guruhlardagi betartiblikka chek qo'ying. Har bir dars uchun vazifalar va
                javoblar tartibli tizimda saqlanadi.
              </p>

              <div className="mt-7 space-y-3.5">
                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex gap-3.5 items-start hover:border-indigo-500/40 transition-all">
                  <div className="size-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <GraduationCap className="size-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                      Fayl yuklab topshirish
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      O'quvchi vazifani ko'radi, rasm yoki PDF yuklaydi va tekshirish holatini kuzatib boradi.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex gap-3.5 items-start hover:border-purple-500/40 transition-all">
                  <div className="size-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <BookOpen className="size-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                      Topshiriqlarni tekshirib baholash
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      O'qituvchi faylni yuklab oladi, izoh yozadi va baho qo'yadi. Natija darhol o'quvchi portalida aks
                      etadi.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 shadow-sm flex gap-3.5 items-start hover:border-emerald-500/40 transition-all">
                  <div className="size-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Award className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base text-slate-900 dark:text-white">
                      Coinlar va Motivatsiya
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                      Vaqtida to'lov, 100% davomat va a'lo baholar uchun avtomatik Ventura Coinlar beriladi.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Card */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="size-2.5 rounded-full bg-red-400" />
                  <div className="size-2.5 rounded-full bg-amber-400" />
                  <div className="size-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 text-xs text-slate-500 font-mono">student.ventura.uz/homework</span>
                </div>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-500/20">
                  Baholangan: 100 ball
                </span>
              </div>

              <div className="mt-5 space-y-3.5">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      Ingliz tili - Grammar Practice
                    </span>
                    <span>Muddat: Bugun, 18:00</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    3-mashqni yozib, fotosuratini yoki PDF faylini ilova qilib yuboring.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
                    <FileText className="size-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    <span className="truncate font-mono">grammar_task_unit4.pdf (1.8 MB)</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Topshirilgan javob
                  </span>
                  <div className="mt-1.5 flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200">
                      <FileText className="size-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="font-mono">javob_farrux.pdf (2.4 MB)</span>
                    </div>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                      ✓ Qabul qilingan
                    </span>
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/20 text-xs text-slate-700 dark:text-slate-300">
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">O'qituvchi izohi:</span>{" "}
                    Barakalla, barcha qoidalar to'g'ri! +10 Coin qo'shildi.
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3.5 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                <span>⚡ O'quvchilar mobil brauzerdan ham kirishadi</span>
                <button
                  onClick={() => handleOpenTrial()}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold inline-flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>Sinab ko'rish</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Pricing Section */}
      <section
        id="pricing"
        className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2.5">
              <Zap className="size-3.5" />
              <span>Har bir tarifda 7 kun bepul sinov</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Shaffof va hamyonbop tariflar
            </h2>
            <p className="mt-2.5 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Avval 7 kun to'liq bepul sinab ko'ring. Hech qanday karta kiritish talab etilmaydi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-7 max-w-6xl mx-auto">
            <PricingCard
              name="Start"
              description="Yangi ochilgan o'quv markazlar uchun"
              price="290,000"
              period="so'm / oy"
              features={[
                "1 ta filial",
                "300 tagacha faol o'quvchi",
                "O'quvchi & O'qituvchi kabinetlari",
                "Uy vazifalariga fayl yuklash",
                "Shaxsiy Telegram bot",
                "5 GB xotira hajmi",
              ]}
              buttonText="7 kun bepul boshlash"
              onSelect={() => handleOpenTrial()}
            />

            <PricingCard
              name="Pro"
              popular
              description="O'sib borayotgan va kengayayotgan markazlar"
              price="590,000"
              period="so'm / oy"
              features={[
                "3 tagacha filial",
                "1,000 tagacha faol o'quvchi",
                "O'quvchi & O'qituvchi kabinetlari",
                "Faylli vazifalar va baholash",
                "Shaxsiy Telegram bot ekotizimi",
                "20 GB yuqori tezlikdagi xotira",
                "SMS xabarnomalar integratsiyasi",
                "Kengaytirilgan moliya va audit",
              ]}
              buttonText="7 kun bepul boshlash"
              onSelect={() => handleOpenTrial()}
            />

            <PricingCard
              name="Enterprise"
              description="Katta o'quv markazlari va tarmoqlar uchun"
              price="1,290,000"
              period="so'm / oy"
              features={[
                "Cheksiz filiallar",
                "Cheksiz o'quvchilar soni",
                "Alohida server (Dedicated VPS)",
                "100 GB+ kengaytiriluvchi disk",
                "Shaxsiy domen (crm.markaz.uz)",
                "Maxsus bot funksiyalari",
                "Shaxsiy menejer biriktiriladi",
              ]}
              buttonText="7 kun bepul boshlash"
              onSelect={() => handleOpenTrial()}
            />
          </div>
        </div>
      </section>

      {/* 7. NEW: Contacts & Office Address Section (Ventura Panel Sozlamalaridan) */}
      <section
        id="contacts"
        className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-900 bg-slate-100/60 dark:bg-slate-900/40 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2.5">
              <Phone className="size-3.5" />
              <span>Aloqa va Manzil</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Biz bilan bog'laning
            </h2>
            <p className="mt-2.5 text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Savollaringiz bormi yoki tizimni joriy qilishda ko'mak kerakmi? Mutaxassislarimiz yordam berishga tayyor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Phone Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-500/40 hover:-translate-y-1 transition-all">
              <div className="size-11 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <Phone className="size-5.5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Telefon raqamlar</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">Qo'ng'iroqlarga tezkor javob</p>
              <div className="space-y-1 font-mono text-sm">
                <a
                  href={`tel:${contacts.phonePrimary.replace(/\s+/g, "")}`}
                  className="block font-bold text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {contacts.phonePrimary}
                </a>
                {contacts.phoneSecondary && (
                  <a
                    href={`tel:${contacts.phoneSecondary.replace(/\s+/g, "")}`}
                    className="block text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                  >
                    {contacts.phoneSecondary}
                  </a>
                )}
              </div>
            </div>

            {/* Telegram Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-sky-500/40 hover:-translate-y-1 transition-all">
              <div className="size-11 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center mb-4">
                <Send className="size-5.5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Telegram aloqa</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-3">Onlayn menejer va yangiliklar</p>
              <div className="space-y-1.5 text-sm">
                {contacts.telegramSupport && (
                  <a
                    href={`https://t.me/${contacts.telegramSupport.replace("@", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    <span>{contacts.telegramSupport}</span>
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
                {contacts.telegramChannel && (
                  <a
                    href={`https://t.me/${contacts.telegramChannel.replace("@", "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 hover:text-sky-500"
                  >
                    <span>Kanal: {contacts.telegramChannel}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Address Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/40 hover:-translate-y-1 transition-all">
              <div className="size-11 rounded-xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <MapPin className="size-5.5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Bosh ofis manzili</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-2">Toshkentdagi ofisimiz</p>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-3">
                {contacts.address}
              </p>
              {contacts.mapUrl && (
                <a
                  href={contacts.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                >
                  <span>Xaritada ko'rish</span>
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>

            {/* Hours & Email Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/40 hover:-translate-y-1 transition-all">
              <div className="size-11 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4">
                <Mail className="size-5.5" />
              </div>
              <h3 className="font-semibold text-slate-900 dark:text-white">Ish vaqti & Pochta</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-2">Qabul va konsultatsiya</p>
              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-2">
                {contacts.workHours}
              </p>
              {contacts.email && (
                <a
                  href={`mailto:${contacts.email}`}
                  className="text-xs font-mono font-medium text-emerald-600 dark:text-emerald-400 hover:underline block truncate"
                >
                  {contacts.email}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 8. FAQ Section */}
      <section
        id="faq"
        className="py-16 md:py-24 border-t border-slate-200 dark:border-slate-900 bg-white/50 dark:bg-slate-950 transition-colors"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
              <HelpCircle className="size-3.5" />
              <span>Savol-Javob</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Ko'p so'raladigan savollar
            </h2>
          </div>

          <div className="space-y-3.5">
            <FaqItem
              question="7 kunlik bepul sinovda qanday cheklovlar bor?"
              answer="Hech qanday funksional cheklov yo'q. Barcha bo'limlar: o'quvchi va o'qituvchi kabinetlari, vazifalarga fayl yuklash, Telegram bot va moliya to'liq ochiq bo'ladi."
            />
            <FaqItem
              question="Ro'yxatdan o'tish uchun bank kartasi kerakmi?"
              answer="Yo'q, mutlaqo kerak emas. Sinovni boshlash uchun faqat markazingiz nomi, subdomen va telefon raqamingiz yetarli."
            />
            <FaqItem
              question="Markazim ma'lumotlari xavfsizmi?"
              answer="Ha. Ventura har bir markaz uchun alohida mustaqil PostgreSQL ma'lumotlar bazasi va shaxsiy shifrlangan subdomen taqdim etadi. Boshqa markazlar bilan ma'lumotlar aralashmaydi."
            />
            <FaqItem
              question="Shaxsiy Telegram bot qanday ulanadi?"
              answer="Markazingiz panelidan @BotFather bergan token kiritiladi. Tizim avtomatik ravishda botni sizning markazingiz nomi bilan ishga tushiradi."
            />
            <FaqItem
              question="Sinov muddati tugagach nima bo'ladi?"
              answer="O'zingizga mos tarifni tanlab to'lov qilasiz. Sinov davridagi barcha ma'lumotlar xavfsiz saqlanib qoladi."
            />
          </div>
        </div>
      </section>

      {/* 9. Final CTA */}
      <section className="py-16 md:py-20 border-t border-slate-200 dark:border-slate-900 bg-gradient-to-b from-slate-50 via-indigo-50/50 to-slate-50 dark:from-slate-950 dark:via-indigo-950/20 dark:to-slate-950 transition-colors">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-500/30 shadow-2xl relative overflow-hidden">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              O'quv markazingizni yangi bosqichga olib chiqing
            </h2>
            <p className="mt-3 text-slate-600 dark:text-slate-300 text-sm sm:text-base max-w-xl mx-auto">
              Hozir 30 soniyada o'z subdomeningizni tanlang va 7 kunlik bepul sinovni boshlang.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3.5 justify-center items-center">
              <button
                onClick={() => handleOpenTrial()}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
              >
                <span>7 kun bepul boshlash</span>
                <ArrowRight className="size-5 ml-2" />
              </button>
            </div>
            <p className="mt-3.5 text-xs text-slate-500">Karta talab etilmaydi · 30 soniyada ishga tushadi</p>
          </div>
        </div>
      </section>

      {/* 10. Footer */}
      <footer className="py-12 border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 text-slate-500 text-xs sm:text-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="size-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <svg viewBox="0 0 40 40" fill="none" className="size-4.5" aria-hidden>
                <path
                  d="M6.25 8.75 20 31.25 33.75 8.75"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-300">
              Ventura CRM · O'quv Markaz Boshqaruv Tizimi
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-600 dark:text-slate-400">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Imkoniyatlar
            </a>
            <a href="#portals" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Kabinetlar
            </a>
            <a href="#pricing" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Tariflar
            </a>
            <a href="#contacts" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              Aloqa
            </a>
            <a href="#faq" className="hover:text-indigo-600 dark:hover:text-white transition-colors">
              FAQ
            </a>
          </div>

          <p className="text-slate-400 dark:text-slate-600">© {new Date().getFullYear()} Ventura EDU CRM.</p>
        </div>
      </footer>

      {/* 11. Free Trial Registration Modal */}
      {modalOpen && (
        <FreeTrialModal
          initialCenterName={initialCenterName}
          initialSlug={initialSlug}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

/* ---------- Subdomain Quick Starter Component ---------- */

function SubdomainQuickStarter({ onStart }: { onStart: (nameOrSlug: string) => void }) {
  const [name, setName] = React.useState("");
  const autoSlug = name.trim() ? slugify(name) : "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart(name.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
      <div className="relative flex-1 w-full flex items-center bg-slate-100/90 dark:bg-slate-950/80 rounded-xl border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="O'quv markazingiz nomi (masalan: Registon)"
          className="w-full bg-transparent text-slate-900 dark:text-white font-medium text-sm placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none px-1"
        />
        {autoSlug && (
          <span className="hidden sm:inline-flex items-center text-indigo-600 dark:text-indigo-400 font-mono text-xs font-semibold select-none shrink-0 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
            {autoSlug}.ventura.uz
          </span>
        )}
      </div>
      <button
        type="submit"
        className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-600/30 shrink-0 active:scale-95 cursor-pointer"
      >
        <span>7 kun bepul boshlash</span>
        <ArrowRight className="size-4 ml-1.5" />
      </button>
    </form>
  );
}

/* ---------- Interactive Mockup Dashboard Tabs ---------- */

function InteractiveMockup({ onOpenTrial }: { onOpenTrial: () => void }) {
  const [tab, setTab] = React.useState<"student" | "teacher" | "finance" | "bot" | "storage">("student");

  return (
    <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-sm text-left transition-colors">
      {/* Top Bar with Tabs */}
      <div className="bg-slate-100/80 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800 p-2.5 sm:p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <MockupTabButton
            active={tab === "student"}
            onClick={() => setTab("student")}
            icon={<GraduationCap className="size-4 text-indigo-600 dark:text-indigo-400" />}
            label="O'quvchi Kabineti"
          />
          <MockupTabButton
            active={tab === "teacher"}
            onClick={() => setTab("teacher")}
            icon={<BookOpen className="size-4 text-purple-600 dark:text-purple-400" />}
            label="O'qituvchi Kabineti"
          />
          <MockupTabButton
            active={tab === "finance"}
            onClick={() => setTab("finance")}
            icon={<Wallet className="size-4 text-emerald-600 dark:text-emerald-400" />}
            label="Moliya & Kassa"
          />
          <MockupTabButton
            active={tab === "bot"}
            onClick={() => setTab("bot")}
            icon={<Bot className="size-4 text-sky-600 dark:text-sky-400" />}
            label="Telegram Bot"
          />
          <MockupTabButton
            active={tab === "storage"}
            onClick={() => setTab("storage")}
            icon={<HardDrive className="size-4 text-amber-600 dark:text-amber-400" />}
            label="Fayllar & Xotira"
          />
        </div>

        <button
          onClick={onOpenTrial}
          className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/10 dark:bg-indigo-600/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 dark:border-indigo-500/30 hover:bg-indigo-600/20 cursor-pointer"
        >
          <span>Sinovda ko'rish</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* Screen Content */}
      <div className="p-4 sm:p-7 min-h-[360px] bg-white dark:bg-slate-950/40 transition-all">
        {tab === "student" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  O'quvchi shaxsiy portali
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Dars jadvali, davomat, baholar va uy vazifalari
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                  Davomat: 98%
                </span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold border border-indigo-500/20">
                  240 Coin
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Keyingi dars</span>
                <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1">General English (IELTS)</p>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">Bugun, 15:30 · 2-xona</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">To'lov holati</span>
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-1">To'langan</p>
                <p className="text-xs text-slate-500 mt-0.5">Qarzdorlik yo'q · Chek #4821</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Topshirilgan vazifa</span>
                <p className="text-sm font-semibold text-amber-600 dark:text-amber-300 mt-1">Reading Practice #4</p>
                <p className="text-xs text-slate-500 mt-0.5">Topshirildi · PDF yuklangan</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-500" />
                O'quvchi mobil brauzer va Telegram bot orqali kiradi
              </span>
              <span className="text-slate-400">Avto-login mavjud</span>
            </div>
          </div>
        )}

        {tab === "teacher" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  O'qituvchi ishchi kabineti
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Guruhlar, davomat, vazifa berish va tekshirish
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-semibold border border-purple-500/20">
                Faol guruhlar: 4 ta · 48 o'quvchi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Tezkor davomat olish</span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Bugungi dars</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span>Rustam Karimov</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                      Bor (K)
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <span>Zilola Mahmudova</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">
                      Bor (K)
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Vazifalar tekshiruvi</span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Tekshirishga: 3 ta</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                    <div>
                      <span className="font-medium text-slate-800 dark:text-slate-200">Farrux Saidov</span>
                      <p className="text-[10px] text-slate-400">vazifa_unit4.pdf (1.4 MB)</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-semibold">
                      Baho qo'yish
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "finance" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">Moliya va Kassa</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Kassa balansi, to'lovlar va qarzdorlar</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-500/20">
                Kriptografik audit
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Joriy oylik tushum</span>
                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">48,500,000 so'm</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">↑ +14% o'tgan oyga nisbatan</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Qarzdorlik miqdori</span>
                <p className="text-xl font-bold text-amber-600 dark:text-amber-300 mt-1">3,200,000 so'm</p>
                <p className="text-xs text-slate-500 mt-0.5">6 ta o'quvchida</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-xs text-slate-500">Kassa qoldig'i</span>
                <p className="text-xl font-bold text-indigo-600 dark:text-indigo-300 mt-1">21,450,000 so'm</p>
                <p className="text-xs text-slate-500 mt-0.5">Naqd + Karta hisoblari</p>
              </div>
            </div>
          </div>
        )}

        {tab === "bot" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Telegram Bot Ekotizimi
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">Har bir markazning shaxsiy Telegram boti</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 dark:bg-sky-500/20 text-sky-700 dark:text-sky-300 font-semibold border border-sky-500/20">
                Onlayn & Faol
              </span>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5 font-mono text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400">
                <Bot className="size-4" />
                <span className="font-semibold">@RegistonEduCrmBot</span>
              </div>
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800">
                Assalomu alaykum! Registon o'quv markazi botiga xush kelibsiz.
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-500/30 text-indigo-900 dark:text-indigo-200">
                📢 <strong>Eslatma:</strong> Bugun soat 15:30 da IELTS guruhingizda dars boshlanadi. Xona: #2.
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-1.5">
                <div className="p-2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold">
                  📅 Dars jadvali
                </div>
                <div className="p-2 rounded bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[11px] font-semibold">
                  💳 To'lov holati
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "storage" && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Fayllar va Xotira (/storage)
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  10 GB disk, monitoring va avtomatik tozalash
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                10 GB Limiti
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Disk bandligi</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold font-mono">
                  1.84 GB / 10 GB (18%)
                </span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-950 rounded-full h-2.5 p-0.5 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-indigo-500 h-2 rounded-full w-[18%]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  📚 Darsliklar: 840 MB
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  📝 Uy vazifalari: 720 MB
                </div>
                <div className="p-2 rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  🧾 Kvitansiyalar: 280 MB
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MockupTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
        active
          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700"
          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-900"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ---------- Feature Card Component ---------- */

function FeatureCard({
  icon,
  title,
  badge,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  badge: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-xl dark:hover:border-indigo-500/30 hover:-translate-y-1 transition-all duration-300 group">
      <div className="flex items-center justify-between mb-3.5">
        <div className="size-11 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {badge}
        </span>
      </div>
      <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
      <p className="mt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

/* ---------- Pricing Card Component ---------- */

function PricingCard({
  name,
  popular,
  description,
  price,
  period,
  features,
  buttonText,
  onSelect,
}: {
  name: string;
  popular?: boolean;
  description: string;
  price: string;
  period: string;
  features: string[];
  buttonText: string;
  onSelect: () => void;
}) {
  return (
    <div
      className={`rounded-3xl p-7 flex flex-col justify-between relative transition-all duration-300 ${
        popular
          ? "bg-white dark:bg-gradient-to-b dark:from-indigo-950/70 dark:via-slate-900 dark:to-slate-900 border-2 border-indigo-600 shadow-2xl shadow-indigo-600/10 hover:-translate-y-1.5"
          : "bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:-translate-y-1"
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white font-semibold text-xs tracking-wider uppercase shadow-md animate-pulse">
          Eng ommabop tanlov
        </div>
      )}

      <div>
        <div className="flex justify-between items-baseline">
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{name}</h3>
        </div>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 min-h-[32px]">{description}</p>

        <div className="mt-5 pb-5 border-b border-slate-100 dark:border-slate-800">
          <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white">{price}</span>
          <span className="text-xs sm:text-sm text-slate-500 ml-1">{period}</span>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
            ⭐ 7 kun to'liq bepul sinov
          </div>
        </div>

        <ul className="mt-5 space-y-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="size-4 text-emerald-500 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-7 pt-2">
        <button
          onClick={onSelect}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer ${
            popular
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
              : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white"
          }`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

/* ---------- FAQ Accordion Item Component ---------- */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-semibold text-slate-900 dark:text-white text-sm sm:text-base hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors cursor-pointer"
      >
        <span>{question}</span>
        <ChevronDown
          className={`size-5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-4 sm:px-5 text-slate-600 dark:text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

/* ---------- Fullscreen Building Animation Screen ---------- */

const BUILD_STAGES = [
  "Building your system.",
  "Securing isolation & storage.",
  "Migrating your database.",
  "Configuring Cloudflare tunnel & routes.",
  "Deploying core services & health check.",
  "Finalizing your workspace.",
  "Redirecting to your CRM...",
] as const;

const PROGRESS_MAP = [15, 32, 52, 70, 85, 96, 100];

function BuildingScreen({
  info,
  error,
  onRetry,
}: {
  info: { centerName: string; slug: string; url: string; deploymentId?: string | null };
  error: string | null;
  onRetry: () => void;
}) {
  const [stageIndex, setStageIndex] = React.useState(0);
  const [failedError, setFailedError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    let pollInterval: NodeJS.Timeout | null = null;
    let currentStage = 0;
    let serverReady = false;

    // Har bir qadam kamida 1.4 soniya chiroyli o'tishi uchun taymer
    const stageTimer = setInterval(() => {
      if (!active) return;
      if (currentStage < 5) {
        currentStage += 1;
        setStageIndex(currentStage);
      } else if (serverReady && currentStage === 5) {
        currentStage = 6;
        setStageIndex(6);
        clearInterval(stageTimer);
        setTimeout(() => {
          if (active) {
            window.location.href = info.url;
          }
        }, 1200);
      }
    }, 1400);

    // Orqa fonda serverdagi deploy va tunnel holatini polling qilish
    const poll = async () => {
      try {
        const statusRes = await checkTrialProvisionStatus({
          slug: info.slug,
          deploymentId: info.deploymentId,
        });

        if (!active) return;

        if (!statusRes.ok) return;

        if (statusRes.status === "failed") {
          setFailedError(statusRes.error || "Deploy jarayonida xatolik yuz berdi");
          clearInterval(stageTimer);
          if (pollInterval) clearInterval(pollInterval);
          return;
        }

        if (statusRes.ready) {
          serverReady = true;
          if (currentStage >= 5) {
            currentStage = 6;
            setStageIndex(6);
            clearInterval(stageTimer);
            if (pollInterval) clearInterval(pollInterval);
            setTimeout(() => {
              if (active) {
                window.location.href = info.url;
              }
            }, 1200);
          }
        }
      } catch {
        // tarmoq uzilishi bo'lsa keyingi intervalda qayta so'raydi
      }
    };

    const initialPoll = setTimeout(() => {
      poll();
      pollInterval = setInterval(poll, 1600);
    }, 800);

    return () => {
      active = false;
      clearInterval(stageTimer);
      clearTimeout(initialPoll);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [info.slug, info.deploymentId, info.url]);

  const displayError = error || failedError;

  return (
    <div className="fixed inset-0 z-[100] bg-white text-slate-900 flex flex-col items-center justify-center p-6 select-none font-[family-name:var(--font-display)] animate-in fade-in duration-300">
      <div className="w-full max-w-3xl flex flex-col items-center text-center">
        {/* CRM shriftidagi markaziy katta H1 sarlavha */}
        <div className="relative min-h-[90px] sm:min-h-[120px] flex items-center justify-center">
          <h1
            key={stageIndex}
            className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 font-[family-name:var(--font-display)] text-center animate-in fade-in slide-in-from-bottom-3 duration-500"
          >
            {BUILD_STAGES[stageIndex]}
          </h1>
        </div>

        {/* Markaz nomi va subdomen manzili */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono text-xs sm:text-sm text-slate-500">
          <span className="font-semibold text-slate-700">{info.centerName}</span>
          <span className="text-slate-300">•</span>
          <span className="text-indigo-600 font-semibold">{info.url}</span>
        </div>

        {/* Minimalist Progress Bar */}
        <div className="w-64 sm:w-80 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-8">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${PROGRESS_MAP[stageIndex]}%` }}
          />
        </div>

        {/* Progress foiz ko'rsatkichi */}
        <div className="mt-3.5 flex items-center gap-2 text-xs font-mono text-slate-400">
          {stageIndex < 6 ? (
            <>
              <span className="size-2 rounded-full bg-indigo-600 animate-ping" />
              <span>{PROGRESS_MAP[stageIndex]}% yakunlandi</span>
            </>
          ) : (
            <span className="text-emerald-600 font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              100% tayyor
            </span>
          )}
        </div>

        {/* Avtomatik yo'naltirish ma'lumoti */}
        {stageIndex === 6 && (
          <div className="mt-6 flex flex-col items-center gap-2 animate-in fade-in duration-300">
            <div className="text-xs text-slate-400 font-mono">CRM kabinetingizga yo'naltirilmoqda...</div>
            <a
              href={info.url}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-1 font-mono"
            >
              <span>Agar sahifa ochilmasa, bu yerni bosing</span>
              <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {/* Xatolik yuz bergandagi ko'rinish */}
        {displayError && (
          <div className="mt-6 max-w-md w-full p-5 rounded-2xl bg-red-50 border border-red-200 text-center animate-in fade-in duration-200">
            <AlertCircle className="size-8 text-red-500 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">Deploy jarayonida to'xtalish bo'ldi</h3>
            <p className="text-xs text-red-700 mt-1">{displayError}</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={onRetry}
                className="px-4 py-2 rounded-xl bg-white border border-red-200 text-xs font-semibold text-slate-800 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Orqaga qaytish
              </button>
              <a
                href="https://t.me/ventura_support"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Qo'llab-quvvatlash
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Free Trial Modal Component ---------- */

function FreeTrialModal({
  initialCenterName = "",
  initialSlug = "",
  onClose,
}: {
  initialCenterName?: string;
  initialSlug?: string;
  onClose: () => void;
}) {
  const { isDark } = useTheme();
  const [step, setStep] = React.useState<1 | 2>(1);
  const [primaryColor, setPrimaryColor] = React.useState("#3f6df6");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [logoError, setLogoError] = React.useState<string | null>(null);

  const [centerName, setCenterName] = React.useState(initialCenterName);
  const [slug, setSlug] = React.useState(initialSlug || (initialCenterName ? slugify(initialCenterName) : ""));
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [showCustomSlug, setShowCustomSlug] = React.useState(false);

  const [ownerName, setOwnerName] = React.useState("");
  const [ownerPhone, setOwnerPhone] = React.useState("");
  const [phoneError, setPhoneError] = React.useState<string | null>(null);

  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const [checkingSlug, setCheckingSlug] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<{ available?: boolean; error?: string } | null>(null);

  const [submitError, setSubmitError] = React.useState<string | null>(null);

  const [isBuilding, setIsBuilding] = React.useState(false);
  const [buildingInfo, setBuildingInfo] = React.useState<{
    centerName: string;
    slug: string;
    url: string;
    deploymentId?: string | null;
  } | null>(null);
  const [buildError, setBuildError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!slug || slug.length < 3) {
      const timer = setTimeout(() => {
        setSlugStatus(null);
      }, 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setCheckingSlug(true);
      try {
        const res = await checkCrmSlugAvailability(slug);
        setSlugStatus(res);
      } catch {
        setSlugStatus({ available: false, error: "Aloqa xatosi" });
      } finally {
        setCheckingSlug(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [slug]);

  const handleCenterNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCenterName(val);
    if (!slugTouched) {
      const generated = slugify(val);
      setSlug(generated);
    }
  };

  const handleNext = () => {
    setSubmitError(null);
    setPhoneError(null);

    if (centerName.trim().length < 2) {
      setSubmitError("O'quv markaz nomini kiriting (kamida 2 ta belgi)");
      return;
    }

    if (!slug || slug.length < 3) {
      setSubmitError("Subdomen kamida 3 ta belgidan iborat bo'lishi kerak");
      return;
    }

    if (slugStatus && !slugStatus.available) {
      setSubmitError(slugStatus.error || "Ushbu subdomen band, boshqasini tanlang");
      return;
    }

    if (ownerName.trim().length < 2) {
      setSubmitError("Rahbar ismini kiriting (kamida 2 ta belgi)");
      return;
    }

    const cleanDigits = ownerPhone.replace(/\D/g, "");
    if (!/^\d{9}$/.test(cleanDigits)) {
      setPhoneError("Telefon raqami 9 ta raqamdan iborat bo'lishi kerak (masalan, 90 123 45 67)");
      return;
    }

    if (ownerPassword.length < 8) {
      setSubmitError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setPhoneError(null);

    if (centerName.trim().length < 2) {
      setSubmitError("O'quv markaz nomini kiriting (kamida 2 ta belgi)");
      setStep(1);
      return;
    }

    if (!slug || slug.length < 3) {
      setSubmitError("Subdomen kamida 3 ta belgidan iborat bo'lishi kerak");
      setStep(1);
      return;
    }

    if (ownerName.trim().length < 2) {
      setSubmitError("Rahbar ismini kiriting (kamida 2 ta belgi)");
      setStep(1);
      return;
    }

    const cleanDigits = ownerPhone.replace(/\D/g, "");
    if (!/^\d{9}$/.test(cleanDigits)) {
      setPhoneError("Telefon raqami 9 ta raqamdan iborat bo'lishi kerak (masalan, 90 123 45 67)");
      setStep(1);
      return;
    }

    if (ownerPassword.length < 8) {
      setSubmitError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      setStep(1);
      return;
    }

    const targetSlug = slug.trim().toLowerCase();
    const targetCenter = centerName.trim();
    const initialUrl = `https://${targetSlug}.ventura.uz`;

    setIsBuilding(true);
    setBuildingInfo({
      centerName: targetCenter,
      slug: targetSlug,
      url: initialUrl,
    });
    setBuildError(null);

    try {
      const res = await startFreeTrialAction({
        centerName: targetCenter,
        slug: targetSlug,
        ownerName: ownerName.trim(),
        ownerPhone: cleanDigits,
        ownerPassword,
        primaryColor,
        logoUrl,
      });

      if (!res.ok) {
        setBuildError(res.error);
        return;
      }

      setBuildingInfo({
        centerName: res.centerName,
        slug: res.slug,
        url: res.url,
        deploymentId: res.deploymentId,
      });
    } catch (err) {
      setBuildError((err as Error).message || "Kutilmagan xatolik yuz berdi");
    }
  };

  if (isBuilding && buildingInfo) {
    return (
      <BuildingScreen
        info={buildingInfo}
        error={buildError}
        onRetry={() => {
          setIsBuilding(false);
          setBuildError(null);
        }}
      />
    );
  }

  const isLowContrast = contrastWithWhite(primaryColor) < 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div role="dialog" aria-modal="true" className="relative w-full max-w-lg rounded-modal border border-border bg-card p-6 sm:p-7 text-card-foreground shadow-modal max-h-[92vh] overflow-y-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          disabled={isBuilding}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer"
          aria-label="Yopish"
        >
          <X className="size-4" />
        </Button>

        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-btn bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Sparkles className="size-5" />
            </div>
            <div>
              <h3 className="type-heading text-lg font-bold text-foreground">7 kunlik bepul sinov</h3>
              <p className="type-caption text-muted-foreground">Karta talab etilmaydi · 30 soniyada tayyor</p>
            </div>
          </div>

          <div className="mb-5">
            <Stepper
              steps={["Ma'lumotlar", "Brend rangi"]}
              current={step - 1}
              canGoTo={(i) => i === 0}
              onStepClick={(i) => {
                if (i === 0) setStep(1);
              }}
            />
          </div>

          {submitError && (
            <Notice tone="danger" className="mb-4">
              {submitError}
            </Notice>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                {/* 1. Markaz nomi va avtomatik subdomen */}
                <div>
                  <Label htmlFor="trial-center-name">O'quv markaz nomi *</Label>
                  <Input
                    id="trial-center-name"
                    type="text"
                    required
                    value={centerName}
                    onChange={handleCenterNameChange}
                    placeholder="Masalan: Registon Academy"
                  />

                  {/* Subdomain automatic preview & edit toggle */}
                  <div className="mt-2 rounded-control border border-border bg-input-bg p-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                        <Globe className="size-3.5 text-primary" />
                        <span>Web manzil:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCustomSlug(!showCustomSlug)}
                        className="text-caption font-semibold text-primary hover:underline cursor-pointer"
                      >
                        {showCustomSlug ? "Avtomatik" : "Subdomenni o'zgartirish"}
                      </button>
                    </div>

                    {!showCustomSlug ? (
                      <div className="mt-1.5 flex items-center gap-1 font-mono text-xs">
                        <span className="text-muted-foreground select-none">https://</span>
                        <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-btn">
                          {slug || "markaz"}
                        </span>
                        <span className="text-muted-foreground select-none">.ventura.uz</span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex items-center rounded-control bg-card border border-input px-2.5 py-1.5 focus-within:border-(--ring-border) focus-within:shadow-(--ring-shadow)">
                        <span className="text-muted-foreground font-mono text-xs select-none">https://</span>
                        <input
                          type="text"
                          value={slug}
                          onChange={(e) => {
                            setSlugTouched(true);
                            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                          }}
                          placeholder="markaz"
                          className="w-full bg-transparent text-foreground font-mono text-xs px-1 focus:outline-none"
                        />
                        <span className="text-primary font-mono text-xs font-semibold select-none shrink-0">
                          .ventura.uz
                        </span>
                      </div>
                    )}

                    {/* Availability badge */}
                    <div className="mt-1.5 min-h-[16px] text-caption">
                      {checkingSlug && <span className="text-muted-foreground">Tekshirilmoqda...</span>}
                      {!checkingSlug && slugStatus && slugStatus.available && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <Check className="size-3 text-emerald-500" /> <strong>{slug}.ventura.uz</strong> bo'sh,
                          markazingiz uchun tayyor
                        </span>
                      )}
                      {!checkingSlug && slugStatus && !slugStatus.available && (
                        <span className="text-destructive-text font-medium">❌ {slugStatus.error}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Rahbar ismi */}
                <div>
                  <Label htmlFor="trial-owner-name">Rahbar ismi va familiyasi *</Label>
                  <Input
                    id="trial-owner-name"
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    placeholder="Masalan: Javohir Alimov"
                  />
                </div>

                {/* 3. Telefon raqami — PhoneInput */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label htmlFor="trial-owner-phone" className="mb-0">
                      Telefon raqami *
                    </Label>
                    <span className="text-caption text-muted-foreground">(kabinetga kirish logini)</span>
                  </div>
                  <PhoneInput
                    id="trial-owner-phone"
                    value={ownerPhone}
                    onValueChange={(val) => {
                      setOwnerPhone(val);
                      if (phoneError) setPhoneError(null);
                    }}
                    invalid={!!phoneError}
                  />
                  {phoneError && <FieldHint error>{phoneError}</FieldHint>}
                </div>

                {/* 4. Parol */}
                <div>
                  <Label htmlFor="trial-owner-password">Kabinet paroli *</Label>
                  <div className="relative">
                    <Input
                      id="trial-owner-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={ownerPassword}
                      onChange={(e) => setOwnerPassword(e.target.value)}
                      placeholder="Kamida 8 ta belgi"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                      aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleNext}
                    disabled={isBuilding || checkingSlug || (slugStatus !== null && !slugStatus.available)}
                    className="w-full h-11 text-sm font-semibold justify-center gap-2 cursor-pointer"
                  >
                    <span>Keyingisi</span>
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                {/* Step 2: Brend rangini tanlash */}
                <div className="space-y-4">
                  <div>
                    <Label>Markazingiz asosiy rangi</Label>
                    <p className="text-caption text-muted-foreground mb-2">
                      Tizim logotipi, asosiy tugmalari va faol bo'limlari tanlangan rangda ko'rinadi.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {BRAND_PRESETS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={c}
                          aria-pressed={primaryColor.toLowerCase() === c.toLowerCase()}
                          onClick={() => setPrimaryColor(c)}
                          className={cn(
                            "size-9 cursor-pointer rounded-btn border-2 transition-transform hover:scale-105",
                            primaryColor.toLowerCase() === c.toLowerCase()
                              ? "border-foreground ring-2 ring-primary/40 scale-105"
                              : "border-transparent",
                          )}
                          style={{ background: c }}
                        />
                      ))}
                      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-btn border border-border px-2.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary transition-colors">
                        <input
                          type="color"
                          value={primaryColor}
                          onChange={(e) => setPrimaryColor(e.target.value)}
                          className="size-5 cursor-pointer border-0 bg-transparent p-0"
                          aria-label="Boshqa rang"
                        />
                        <span className="font-mono">{primaryColor}</span>
                      </label>
                    </div>
                    {isLowContrast && (
                      <p className="mt-2 flex items-center gap-1.5 text-caption font-semibold text-(--warning-fg)">
                        <TriangleAlert className="size-3.5" /> Oq matn bilan kontrast past (och ranglarda matn qiyin o'qilishi mumkin)
                      </p>
                    )}
                  </div>

                  {/* Markaz logotipi */}
                  <div>
                    <Label>Markaz logotipi (ixtiyoriy)</Label>
                    {logoUrl ? (
                      <div className="mt-1.5 flex items-center gap-3 rounded-control border border-border bg-input-bg p-3">
                        <img
                          src={logoUrl}
                          alt="Logotip"
                          className="size-11 rounded-btn object-cover border border-border bg-card shrink-0 shadow-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground truncate">Markaz logotipi yuklandi</p>
                          <p className="text-caption text-muted-foreground">Tizim yuqori sarlavhasida aks etadi</p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setLogoUrl(null)}
                          className="gap-1.5 text-destructive hover:text-destructive h-8 px-2.5 cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          <span className="text-xs">O'chirish</span>
                        </Button>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex flex-col items-center justify-center gap-1.5 rounded-control border border-dashed border-border bg-input-bg/40 p-3.5 cursor-pointer hover:border-primary/50 hover:bg-secondary/40 transition-colors">
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          className="sr-only"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setLogoError(null);
                            try {
                              const dataUrl = await processLogoFile(file);
                              setLogoUrl(dataUrl);
                            } catch (err) {
                              setLogoError((err as Error).message || "Faylni yuklashda xatolik");
                            }
                          }}
                        />
                        <div className="size-8 rounded-btn bg-secondary flex items-center justify-center text-muted-foreground">
                          <Upload className="size-4" />
                        </div>
                        <div className="text-center">
                          <span className="text-xs font-semibold text-primary hover:underline">Logotip yuklash</span>
                          <p className="text-caption text-muted-foreground mt-0.5">PNG, JPG, WebP yoki SVG (maks. 2 MB)</p>
                        </div>
                      </label>
                    )}
                    {logoError && <FieldHint error className="mt-1.5">{logoError}</FieldHint>}
                  </div>

                  {/* Jonli ko'rinish (Live preview) */}
                  <div>
                    <Label>Jonli ko'rinish (CRM interfeysi namunasi)</Label>
                    <div
                      data-brand="ventura"
                      className={cn(
                        "mt-1.5 rounded-card border border-border p-4 bg-background transition-colors",
                        isDark && "dark",
                      )}
                      style={{ "--primary": primaryColor, colorScheme: isDark ? "dark" : "light" } as React.CSSProperties}
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-border">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {logoUrl ? (
                            <img
                              src={logoUrl}
                              alt=""
                              className="size-9 rounded-btn object-cover border border-border bg-card shrink-0 shadow-xs"
                            />
                          ) : (
                            <Avatar
                              name={centerName.trim() || "O'quv markazi"}
                              size={36}
                              variant="brand"
                              className="shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-foreground truncate">
                              {centerName.trim() || "O'quv markazi"}
                            </div>
                            <div className="text-caption text-muted-foreground font-mono truncate">
                              https://{slug || "markaz"}.ventura.uz
                            </div>
                          </div>
                        </div>
                        <Badge tone="success" dot className="shrink-0">
                          Faol
                        </Badge>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="nav-active-surface flex items-center justify-between rounded-nav p-2.5 font-semibold text-(--nav-active-fg) shadow-xs">
                          <span>Faol o'quvchilar</span>
                          <span className="font-bold text-sm">128</span>
                        </div>
                        <div className="flex items-center justify-between rounded-nav p-2.5 font-medium bg-secondary text-foreground">
                          <span>Guruhlar</span>
                          <span className="font-bold text-sm">12</span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        <Button size="sm" className="pointer-events-none">
                          Yangi to'lov
                        </Button>
                        <Button size="sm" variant="ghost" className="pointer-events-none">
                          Davomat
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Tugmalar: Orqaga va Sinovni boshlash */}
                  <div
                    data-brand="ventura"
                    style={{ "--primary": primaryColor } as React.CSSProperties}
                    className="flex items-center gap-3 pt-3"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep(1)}
                      className="gap-2 cursor-pointer"
                    >
                      <ArrowLeft className="size-4" />
                      <span>Orqaga</span>
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isBuilding}
                      className="flex-1 h-11 text-sm font-semibold justify-center gap-2 cursor-pointer"
                    >
                      <span>7 kunlik bepul sinovni boshlash</span>
                      <Sparkles className="size-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
