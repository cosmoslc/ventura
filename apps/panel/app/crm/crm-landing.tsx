// Muallif / Agent: Google Gemini
"use client";

import * as React from "react";
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  HardDrive,
  HelpCircle,
  Shield,
  Sparkles,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { checkCrmSlugAvailability, startFreeTrialAction } from "./actions";

export function CrmLanding() {
  const [modalOpen, setModalOpen] = React.useState(false);
  const [initialSlug, setInitialSlug] = React.useState("");

  const handleOpenTrial = (slug?: string) => {
    if (slug) setInitialSlug(slug);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Background gradients */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-indigo-600/20 via-purple-600/10 to-transparent blur-3xl opacity-60" />
        <div className="absolute top-[35%] -left-[200px] w-[600px] h-[600px] bg-sky-600/10 blur-3xl rounded-full" />
        <div className="absolute top-[65%] -right-[200px] w-[600px] h-[600px] bg-indigo-600/10 blur-3xl rounded-full" />
      </div>

      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-slate-950/75 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 border border-indigo-400/30">
              <svg viewBox="0 0 40 40" fill="none" className="size-6 text-white" aria-hidden>
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
                  strokeOpacity="0.7"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                Ventura CRM
              </span>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300">
                EDU v2.0
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">
              Imkoniyatlar
            </a>
            <a href="#portals" className="hover:text-white transition-colors">
              Kabinetlar
            </a>
            <a href="#bot" className="hover:text-white transition-colors">
              Telegram Bot
            </a>
            <a href="#storage" className="hover:text-white transition-colors">
              Fayllar & Xotira
            </a>
            <a href="#pricing" className="hover:text-white transition-colors">
              Tariflar
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Savol-javob
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleOpenTrial()}
              className="relative group inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-200 shadow-md shadow-indigo-600/25 active:scale-95 cursor-pointer"
            >
              <Sparkles className="size-4 mr-2 text-indigo-200 group-hover:rotate-12 transition-transform" />
              <span>7 kun bepul sinov</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative pt-16 pb-20 md:pt-24 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Top Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/30 text-xs sm:text-sm font-medium text-indigo-300 mb-6 shadow-inner">
            <span className="flex size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>7 kunlik to'liq bepul sinov davri</span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">Karta talab etilmaydi</span>
          </div>

          {/* Main Title */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.15]">
            O'quv markazingizni{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-300 to-sky-300 bg-clip-text text-transparent">
              100% avtomatlashtiring
            </span>
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
            O'quvchi va o'qituvchi shaxsiy kabinetlari, davomat, moliya, shaxsiy Telegram botlar, uy vazifalariga fayl
            yuklash va har bir markaz uchun <strong className="text-white">alohida mustaqil xavfsiz baza</strong>.
          </p>

          {/* Quick Subdomain Claim Card */}
          <div className="mt-10 max-w-xl mx-auto p-2 sm:p-2.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl backdrop-blur-sm">
            <SubdomainQuickStarter onStart={(slug) => handleOpenTrial(slug)} />
          </div>

          {/* Trust Chips */}
          <div className="mt-8 flex flex-wrap justify-center items-center gap-y-3 gap-x-6 text-xs sm:text-sm text-slate-400">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>30 soniyada faollashadi</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Alohida shaxsiy baza</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>Har markazga o'z Telegram boti</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span>10 GB bepul fayllar ombori</span>
            </div>
          </div>
        </div>

        {/* 3. Interactive Showcase Preview */}
        <div className="mt-14 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <InteractiveMockup onOpenTrial={() => handleOpenTrial()} />
        </div>
      </section>

      {/* 4. Features Section */}
      <section id="features" className="py-20 md:py-28 border-t border-slate-900 bg-slate-950/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
              <Sparkles className="size-3.5" />
              <span>To'liq Ekotizim</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              O'quv markaz uchun zarur barcha imkoniyatlar
            </h2>
            <p className="mt-4 text-slate-400 text-base sm:text-lg">
              Oddiy jadvallar va tarqoq botlardan voz keching. Ventura EDU CRM barcha jarayonlarni bitta qulay tizimga
              birlashtiradi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <FeatureCard
              icon={<GraduationCap className="size-6 text-indigo-400" />}
              title="O'quvchi Shaxsiy Kabineti"
              badge="/student"
              description="Har bir o'quvchi o'z davomati, dars jadvali, to'lovlar balansi, uy vazifalari va olgan baholarini shaxsiy telefonidan ko'rib boradi."
            />

            {/* Feature 2 */}
            <FeatureCard
              icon={<BookOpen className="size-6 text-purple-400" />}
              title="O'qituvchi Kabineti & Tekshiruv"
              badge="/teacher"
              description="1-klikda davomat olish, darslarga PDF/Word uy vazifalari biriktirish va o'quvchilar yuborgan javob fayllarini tekshirib baho qo'yish."
            />

            {/* Feature 3 */}
            <FeatureCard
              icon={<Bot className="size-6 text-sky-400" />}
              title="Shaxsiy Telegram Bot Ekotizimi"
              badge="Har markazga"
              description="O'quvchi va o'qituvchilar markazingizning shaxsiy Telegram boti orqali 1-klikda tizimga kiradi, dars va to'lov xabarnomalarini oladi."
            />

            {/* Feature 4 */}
            <FeatureCard
              icon={<Wallet className="size-6 text-emerald-400" />}
              title="Shaffof Moliya & Kassa Nazorati"
              badge="Audit bilan"
              description="Kirim-chiqimlar, oylik to'lovlar, qarzdorlar monitoringi, xodimlar maoshi va hech kim o'chira olmaydigan pul operatsiyalari auditi."
            />

            {/* Feature 5 */}
            <FeatureCard
              icon={<HardDrive className="size-6 text-amber-400" />}
              title="Xotira & Fayllar Ombori"
              badge="/storage (10GB)"
              description="Darsliklar, PDF uy vazifalari va kvitansiyalar uchun ajratilgan disk hajmi. 1, 3, 4 oylik eski fayllarni avtomatik tozalash funksiyasi."
            />

            {/* Feature 6 */}
            <FeatureCard
              icon={<Shield className="size-6 text-rose-400" />}
              title="Multi-Tenant Alohida Xavfsiz Baza"
              badge="Izolyatsiya"
              description="Sizning markazingiz uchun alohida PostgreSQL ma'lumotlar bazasi va subdomen: ma'lumotlar hech qachon begonalarga ko'rinmaydi."
            />
          </div>
        </div>
      </section>

      {/* 5. Portals Deep-Dive Section */}
      <section id="portals" className="py-20 md:py-28 border-t border-slate-900 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-300 mb-4">
                <Users className="size-3.5" />
                <span>O'quvchi va O'qituvchi Portallari</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
                O'quvchilar va O'qituvchilar uchun alohida qulay kabinetlar
              </h2>
              <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed">
                Venturada barcha tomonlar o'zlariga kerakli ma'lumotni darhol topadi. Qog'ozbozlik va doimiy
                savol-javoblarga chek qo'ying.
              </p>

              <div className="mt-8 space-y-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex gap-4 items-start">
                  <div className="size-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <GraduationCap className="size-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">O'quvchiga: Uy vazifasiga fayl yuklab topshirish</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      O'quvchi o'z kabinetida berilgan uy vazifasini ko'radi, rasm, PDF yoki hujjat faylini ilova qilib
                      yuboradi va o'qituvchi tekshirganini ko'radi.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex gap-4 items-start">
                  <div className="size-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                    <BookOpen className="size-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">O'qituvchiga: Topshiriqlarni tekshirib baholash</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      O'qituvchi har bir o'quvchining yuborgan javob faylini yuklab oladi yoki ko'radi, izoh yozadi va
                      baho qo'yadi. Baholar avtomatik reytingga o'tadi.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex gap-4 items-start">
                  <div className="size-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Award className="size-5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">Coinlar va Motivatsiya Tizimi</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      Vaqtida to'lov, 100% davomat va a'lo baholar uchun avtomatik Ventura Coinlar taqdim etiladi.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Portal Card Visual */}
            <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-indigo-950/40 border border-slate-800 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="size-3 rounded-full bg-red-500/80" />
                  <div className="size-3 rounded-full bg-amber-500/80" />
                  <div className="size-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-xs text-slate-400 font-mono">student.ventura.uz/homework</span>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-medium border border-emerald-500/30">
                  Baholangan: 100 ball
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="font-medium text-slate-200">Mavzu: Ingliz tili - Present Perfect Continuous</span>
                    <span>Muddat: Bugun, 18:00</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    12-betdagi 3 va 4-mashqlarni daftarga yozib, fotosuratini yoki PDF qilib ilova qiling.
                  </p>
                  <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-300">
                    <FileText className="size-4 text-indigo-400 shrink-0" />
                    <span className="truncate">present_perfect_exercises.pdf (1.8 MB)</span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Topshirilgan javob</span>
                  <div className="mt-2 flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2 text-slate-200">
                      <FileText className="size-4 text-emerald-400" />
                      <span>mashqlar_javobi_malika.pdf (2.4 MB)</span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">✓ Qabul qilingan</span>
                  </div>
                  <div className="mt-3 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-xs text-slate-300">
                    <span className="font-semibold text-emerald-400">O'qituvchi izohi:</span> Barakalla, barcha qoidalar
                    to'g'ri qo'llanilgan! +10 Ventura Coin qo'shildi.
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>⚡ O'quvchilar Telegram bot orqali ham kirishadi</span>
                <button
                  onClick={() => handleOpenTrial()}
                  className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Sinab ko'rish</span>
                  <ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Storage & Telegram Bot Section */}
      <section id="storage" className="py-20 md:py-28 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Storage Box */}
            <div className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
              <div className="size-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
                <HardDrive className="size-6 text-amber-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">Xotira & Fayllar Boshqaruvi (/storage)</h3>
              <p className="mt-3 text-slate-300 leading-relaxed text-sm sm:text-base">
                Har bir markazga boshlang'ich 10 GB disk xotirasi ajratiladi. O'quvchilar va o'qituvchilar yuklagan barcha
                PDF darsliklar, fotosuratlar va hujjatlar markaziy xotirada tartibli saqlanadi.
              </p>
              <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Band qilingan joy:</span>
                  <span className="font-semibold text-slate-200">1.84 GB / 10.00 GB (18%)</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div className="bg-gradient-to-r from-amber-400 to-indigo-500 h-2 rounded-full w-[18%]" />
                </div>
                <div className="pt-2 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Check className="size-3.5" /> 1, 3, 4 oylik eski fayllarni tozalash
                  </span>
                  <span className="text-slate-500">25 MB gacha fayllar</span>
                </div>
              </div>
            </div>

            {/* Telegram Bot Box */}
            <div id="bot" className="p-8 rounded-3xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
              <div className="size-12 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-6">
                <Bot className="size-6 text-sky-400" />
              </div>
              <h3 className="text-2xl font-bold text-white">Shaxsiy Telegram Bot Integratsiyasi</h3>
              <p className="mt-3 text-slate-300 leading-relaxed text-sm sm:text-base">
                O'quv markazingiz uchun @BotFather orqali yaratilgan bot tokenni ulab qo'yishingiz bilan tizim uni to'liq
                ishga tushiradi. Hech qanday murakkab server sozlash talab qilinmaydi.
              </p>
              <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-sky-400" />
                  <span>O'quvchilar telefon raqami orqali 1-klikda kirish</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-sky-400" />
                  <span>Dars jadvali va xonalar haqida avtomatik eslatmalar</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-sky-400" />
                  <span>Uy vazifasi yuklangani haqida tezkor bildirishnoma</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-sky-400" />
                  <span>Ota-onalar uchun to'lov va davomat hisoboti</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Comparison Table */}
      <section className="py-20 md:py-28 border-t border-slate-900 bg-slate-900/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold tracking-tight text-white">Nega aynan Ventura CRM?</h2>
            <p className="mt-3 text-slate-400 text-base">
              Bozordagi eski va cheklangan CRM tizimlariga nisbatan farqimiz
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 shadow-xl">
            <div className="grid grid-cols-3 bg-slate-900/80 p-4 border-b border-slate-800 text-xs sm:text-sm font-semibold text-slate-300">
              <div>Imkoniyat</div>
              <div className="text-center text-slate-400">Oddiy CRM tizimlari</div>
              <div className="text-center text-indigo-400 font-bold">Ventura EDU CRM</div>
            </div>

            <ComparisonRow
              feature="Ma'lumotlar bazasi"
              other="Barcha mijozlar umumiy bazada"
              ventura="Har markazga alohida mustaqil baza"
              positive
            />
            <ComparisonRow
              feature="Shaxsiy Subdomen"
              other="Yo'q, umumiy sayt orqali"
              ventura="sizning-markaz.ventura.uz"
              positive
            />
            <ComparisonRow
              feature="O'quvchi & O'qituvchi Kabineti"
              other="Qo'shimcha to'lov talab qiladi"
              ventura="O'rnatilgan va bepul kiritilgan"
              positive
            />
            <ComparisonRow
              feature="Faylli Uy Vazifasi"
              other="Cheklangan yoki faqat matn"
              ventura="PDF, rasm, word 25MB gacha"
              positive
            />
            <ComparisonRow
              feature="Shaxsiy Telegram Bot"
              other="Qo'shimcha oyiga to'lov"
              ventura="Har markazga o'z shaxsiy boti"
              positive
            />
            <ComparisonRow
              feature="Fayllar xotirasi"
              other="1 GB dan kam yoki yo'q"
              ventura="10 GB boshlang'ich disk"
              positive
            />
            <ComparisonRow
              feature="Sinov muddati"
              other="Cheklangan yoki karta so'raydi"
              ventura="7 kun 100% to'liq bepul sinov"
              positive
            />
          </div>
        </div>
      </section>

      {/* 8. Pricing Section */}
      <section id="pricing" className="py-20 md:py-28 border-t border-slate-900 bg-slate-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 mb-3">
              <Zap className="size-3.5" />
              <span>Har bir tarifda 7 kun bepul</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Shaffof va qulay narxlar
            </h2>
            <p className="mt-3 text-slate-400 text-base sm:text-lg">
              Avval 7 kun bepul sinab ko'ring. Hech qanday karta talab etilmaydi.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Start Plan */}
            <PricingCard
              name="Start"
              description="Kichik va yangi ochilgan o'quv markazlari uchun"
              price="290,000"
              period="so'm / oy"
              features={[
                "1 ta filial",
                "300 tagacha faol o'quvchi",
                "O'quvchi & O'qituvchi kabinetlari",
                "Uy vazifalariga fayl yuklash",
                "Shaxsiy Telegram bot",
                "5 GB xotira hajmi",
                "Standart qo'llab-quvvatlash",
              ]}
              buttonText="7 kun bepul boshlash"
              onSelect={() => handleOpenTrial()}
            />

            {/* Pro Plan */}
            <PricingCard
              name="Pro"
              popular
              description="O'sib borayotgan va filiallarini kengaytirayotgan markazlar"
              price="590,000"
              period="so'm / oy"
              features={[
                "3 tagacha filial",
                "1,000 tagacha faol o'quvchi",
                "O'quvchi & O'qituvchi kabinetlari",
                "Faylli uy vazifalari va baholash",
                "Shaxsiy Telegram bot ekotizimi",
                "20 GB yuqori tezlikdagi xotira",
                "SMS xabarnomalar integratsiyasi",
                "Kengaytirilgan moliya va audit",
                "24/7 tezkor qo'llab-quvvatlash",
              ]}
              buttonText="7 kun bepul boshlash"
              onSelect={() => handleOpenTrial()}
            />

            {/* Enterprise Plan */}
            <PricingCard
              name="Enterprise"
              description="Katta o'quv markazlari tarmoqlari va akademiyalar"
              price="1,290,000"
              period="so'm / oy"
              features={[
                "Cheksiz filiallar",
                "Cheksiz o'quvchilar soni",
                "Barcha mavjud kabinetlar",
                "Alohida ajratilgan server (VPS)",
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

      {/* 9. FAQ Section */}
      <section id="faq" className="py-20 md:py-28 border-t border-slate-900 bg-slate-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-400 mb-3">
              <HelpCircle className="size-3.5" />
              <span>Savol-Javob</span>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white">Ko'p so'raladigan savollar</h2>
            <p className="mt-3 text-slate-400 text-base">
              7 kunlik bepul sinov va tizim bo'yicha eng muhim savollarga javoblar
            </p>
          </div>

          <div className="space-y-4">
            <FaqItem
              question="7 kunlik bepul sinovda qanday cheklovlar bor?"
              answer="Hech qanday funksional cheklov yo'q! Siz 7 kun davomida o'quvchilar, guruhlar, to'lovlar, o'quvchi va o'qituvchi kabinetlari, uy vazifalariga fayl yuklash hamda Telegram bot imkoniyatlaridan 100% to'liq foydalanishingiz mumkin."
            />
            <FaqItem
              question="Ro'yxatdan o'tish uchun bank kartasi kerakmi?"
              answer="Yo'q, mutlaqo kerak emas. 7 kunlik sinovni boshlash uchun faqat o'quv markazingiz nomi, subdomen va telefon raqamingizni kiritish kifoya. Karta ma'lumotlari talab etilmaydi."
            />
            <FaqItem
              question="Markazim ma'lumotlari boshqalarga ko'rinib qolmaydimi?"
              answer="Yo'q, ko'rinmaydi. Ventura har bir markaz uchun alohida mustaqil PostgreSQL ma'lumotlar bazasi va shaxsiy shifrlangan subdomen taqdim etadi. Tizim arxitekturasi ko'p tenantli to'liq izolyatsiyaga ega."
            />
            <FaqItem
              question="Shaxsiy Telegram bot qanday ulanadi?"
              answer="O'quv markazingiz boshqaruv panelidan @BotFather orqali olingan token kiritiladi. Ventura avtomatik ravishda barcha buyruqlar, menyular va bildirishnomalarni sizning markazingiz nomi bilan ishga tushiradi."
            />
            <FaqItem
              question="7 kunlik sinov muddati tugagach nima bo'ladi?"
              answer="Sinov muddati tugagach, sizga mos tarifni tanlab to'lovni amalga oshirasiz. Sinov davomida kiritgan barcha o'quvchilaringiz, to'lovlar va dars ma'lumotlaringiz xavfsiz saqlanadi va ishlashda davom etadi."
            />
            <FaqItem
              question="O'zimizning shaxsiy domenimizni (masalan crm.markaz.uz) ulash mumkinmi?"
              answer="Ha, Enterprise tarifida yoki qo'shimcha xizmat sifatida o'zingizning shaxsiy domeningizni ulash imkoniyati mavjud. Standart holda barcha markazlar tekin va tezkor sizning-markaz.ventura.uz manziliga ega bo'ladi."
            />
          </div>
        </div>
      </section>

      {/* 10. Final Call To Action */}
      <section className="py-20 md:py-24 border-t border-slate-900 bg-gradient-to-b from-slate-950 via-indigo-950/20 to-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="p-8 sm:p-14 rounded-3xl bg-gradient-to-tr from-indigo-900/40 via-slate-900 to-slate-900 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              O'quv markazingizni yangi bosqichga olib chiqing
            </h2>
            <p className="mt-4 text-slate-300 text-base sm:text-lg max-w-2xl mx-auto">
              Hozir 30 soniyada o'z subdomeningizni tanlang va 7 kunlik to'liq bepul sinovni boshlang.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => handleOpenTrial()}
                className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3.5 text-base font-semibold rounded-xl text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
              >
                <span>7 kun bepul boshlash</span>
                <ArrowRight className="size-5 ml-2" />
              </button>
            </div>
            <p className="mt-4 text-xs text-slate-400">Hech qanday karta talab etilmaydi · 30 soniyada tayyor</p>
          </div>
        </div>
      </section>

      {/* 11. Footer */}
      <footer className="py-12 border-t border-slate-900 bg-slate-950 text-slate-500 text-xs sm:text-sm">
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
            <span className="font-semibold text-slate-300">Ventura CRM · O'quv Markaz Boshqaruv Tizimi</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-slate-400">
            <a href="#features" className="hover:text-slate-200 transition-colors">
              Imkoniyatlar
            </a>
            <a href="#portals" className="hover:text-slate-200 transition-colors">
              Kabinetlar
            </a>
            <a href="#pricing" className="hover:text-slate-200 transition-colors">
              Tariflar
            </a>
            <a href="#faq" className="hover:text-slate-200 transition-colors">
              FAQ
            </a>
          </div>

          <p className="text-slate-600">
            © {new Date().getFullYear()} Ventura EDU CRM. Barcha huquqlar himoyalangan.
          </p>
        </div>
      </footer>

      {/* 12. Free Trial Registration Modal */}
      {modalOpen && (
        <FreeTrialModal initialSlug={initialSlug} onClose={() => setModalOpen(false)} />
      )}
    </div>
  );
}

/* ---------- Subdomain Quick Starter in Hero ---------- */

function SubdomainQuickStarter({ onStart }: { onStart: (slug: string) => void }) {
  const [slug, setSlug] = React.useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    onStart(clean);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-center gap-2">
      <div className="relative flex-1 w-full flex items-center bg-slate-950/80 rounded-xl border border-slate-800 px-3.5 py-2.5 focus-within:border-indigo-500 transition-colors">
        <span className="text-slate-500 font-mono text-sm select-none">https://</span>
        <input
          type="text"
          value={slug}
          onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
          placeholder="sizning-markaz"
          className="w-full bg-transparent text-white font-medium text-sm placeholder:text-slate-600 focus:outline-none px-1"
        />
        <span className="text-slate-400 font-mono text-xs select-none shrink-0">.ventura.uz</span>
      </div>
      <button
        type="submit"
        className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm transition-all shadow-md shadow-indigo-600/30 shrink-0 active:scale-95 cursor-pointer"
      >
        <span>7 kun bepul boshlash</span>
        <ArrowRight className="size-4 ml-1.5" />
      </button>
    </form>
  );
}

/* ---------- Interactive Mockup Component ---------- */

function InteractiveMockup({ onOpenTrial }: { onOpenTrial: () => void }) {
  const [tab, setTab] = React.useState<"student" | "teacher" | "finance" | "bot" | "storage">("student");

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl overflow-hidden backdrop-blur-sm">
      {/* Top Bar with Tabs */}
      <div className="bg-slate-950/90 border-b border-slate-800 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <MockupTabButton
            active={tab === "student"}
            onClick={() => setTab("student")}
            icon={<GraduationCap className="size-4 text-indigo-400" />}
            label="O'quvchi Kabineti"
          />
          <MockupTabButton
            active={tab === "teacher"}
            onClick={() => setTab("teacher")}
            icon={<BookOpen className="size-4 text-purple-400" />}
            label="O'qituvchi Kabineti"
          />
          <MockupTabButton
            active={tab === "finance"}
            onClick={() => setTab("finance")}
            icon={<Wallet className="size-4 text-emerald-400" />}
            label="Moliya & Kassa"
          />
          <MockupTabButton
            active={tab === "bot"}
            onClick={() => setTab("bot")}
            icon={<Bot className="size-4 text-sky-400" />}
            label="Telegram Bot"
          />
          <MockupTabButton
            active={tab === "storage"}
            onClick={() => setTab("storage")}
            icon={<HardDrive className="size-4 text-amber-400" />}
            label="Fayllar & Xotira"
          />
        </div>

        <button
          onClick={onOpenTrial}
          className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 cursor-pointer"
        >
          <span>Sinovda ko'rish</span>
          <ArrowRight className="size-3.5" />
        </button>
      </div>

      {/* Screen Content based on active tab */}
      <div className="p-4 sm:p-8 min-h-[380px] bg-slate-950/40">
        {tab === "student" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">O'quvchi shaxsiy portali</h4>
                <p className="text-xs text-slate-400">Dars jadvali, davomat, baholar va uy vazifalari</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Davomat: 98%
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  240 Ventura Coin
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Keyingi dars</span>
                <p className="text-sm font-semibold text-white mt-1">General English (IELTS 7.0)</p>
                <p className="text-xs text-indigo-400 mt-0.5">Bugun, 15:30 · 2-xona</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">To'lov holati</span>
                <p className="text-sm font-semibold text-emerald-400 mt-1">To'langan (Noyabr)</p>
                <p className="text-xs text-slate-400 mt-0.5">Qarzdorlik yo'q · Chek #4821</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Faol uy vazifasi</span>
                <p className="text-sm font-semibold text-amber-300 mt-1">Reading Practice Test #4</p>
                <p className="text-xs text-slate-400 mt-0.5">Topshirildi · Fayl: reading_test.pdf</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-300">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-400" />
                O'quvchi mobil brauzer va Telegram bot orqali kiradi
              </span>
              <span className="text-slate-500">Avto-login orqali parol kiritish shart emas</span>
            </div>
          </div>
        )}

        {tab === "teacher" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">O'qituvchi ishchi kabineti</h4>
                <p className="text-xs text-slate-400">Guruhlar, davomat olish, uy vazifasi berish va tekshirish</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Faol guruhlar: 4 ta · 48 o'quvchi
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-slate-300">Tezkor davomat olish</span>
                  <span className="text-[11px] text-emerald-400 font-medium">Bugungi dars</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                    <span>Rustam Karimov</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Bor (K)</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                    <span>Zilola Mahmudova</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-semibold">Bor (K)</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-semibold text-slate-300">Uy vazifasi tekshiruvi</span>
                  <span className="text-[11px] text-amber-400 font-medium">Tekshirishga: 3 ta</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-950">
                    <div>
                      <span className="font-medium text-slate-200">Farrux Saidov</span>
                      <p className="text-[10px] text-slate-500">vazifa_3.pdf (1.4 MB)</p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-indigo-500/20 text-indigo-300 font-medium">Baho qo'yish</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "finance" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">Moliya va Kassa boshqaruvi</h4>
                <p className="text-xs text-slate-400">Kassa balansi, to'lovlar, qarzdorlar va o'zgarmas audit</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Kriptografik zanjir himoyasi
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Joriy oylik tushum</span>
                <p className="text-xl font-bold text-white mt-1">48,500,000 so'm</p>
                <p className="text-xs text-emerald-400 mt-1">↑ +14% o'tgan oyga nisbatan</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Qarzdorlik miqdori</span>
                <p className="text-xl font-bold text-amber-300 mt-1">3,200,000 so'm</p>
                <p className="text-xs text-slate-400 mt-1">6 ta o'quvchida qarzdorlik</p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">Kassa qoldig'i</span>
                <p className="text-xl font-bold text-indigo-300 mt-1">21,450,000 so'm</p>
                <p className="text-xs text-slate-400 mt-1">Naqd + Karta hisoblari</p>
              </div>
            </div>
          </div>
        )}

        {tab === "bot" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">Telegram Bot Ekotizimi</h4>
                <p className="text-xs text-slate-400">Har bir o'quv markazining o'z shaxsiy boti</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                Status: Onlayn & Faol
              </span>
            </div>

            <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800 text-sky-400">
                <Bot className="size-4" />
                <span className="font-semibold">@RegistonEduCrmBot</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-950 text-slate-300">
                Assalomu alaykum, Jasur! Registon o'quv markazi botiga xush kelibsiz.
              </div>
              <div className="p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-500/30 text-indigo-200">
                📢 <strong>Eslatma:</strong> Bugun soat 15:30 da IELTS 7.0 guruhingizda dars boshlanadi. Xona: #2.
              </div>
              <div className="grid grid-cols-2 gap-2 text-center pt-2">
                <div className="p-2 rounded bg-slate-800 text-slate-200 text-[11px]">📅 Dars jadvali</div>
                <div className="p-2 rounded bg-slate-800 text-slate-200 text-[11px]">💳 To'lov holati</div>
              </div>
            </div>
          </div>
        )}

        {tab === "storage" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <h4 className="text-lg font-bold text-white">Fayllar va Xotira ombori (/storage)</h4>
                <p className="text-xs text-slate-400">Markazga ajratilgan 10GB disk, fayllar monitoringi va avto-tozalash</p>
              </div>
              <span className="text-xs px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                10 GB Ajratilgan Limiti
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-300 font-medium">Disk bandligi</span>
                <span className="text-amber-400 font-semibold">1.84 GB / 10 GB</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-3 p-0.5 overflow-hidden">
                <div className="bg-gradient-to-r from-amber-400 to-indigo-500 h-2 rounded-full w-[18%]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs text-slate-400">
                <div className="p-2 rounded-lg bg-slate-950">📚 Darsliklar: 840 MB</div>
                <div className="p-2 rounded-lg bg-slate-950">📝 Uy vazifalari: 720 MB</div>
                <div className="p-2 rounded-lg bg-slate-950">🧾 Kvitansiyalar: 280 MB</div>
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
      className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
        active
          ? "bg-slate-800 text-white shadow-sm border border-slate-700"
          : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
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
    <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-all group">
      <div className="flex items-center justify-between mb-4">
        <div className="size-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
          {badge}
        </span>
      </div>
      <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>
      <p className="mt-2 text-sm text-slate-400 leading-relaxed">{description}</p>
    </div>
  );
}

/* ---------- Comparison Row Component ---------- */

function ComparisonRow({
  feature,
  other,
  ventura,
  positive,
}: {
  feature: string;
  other: string;
  ventura: string;
  positive?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 p-4 border-b border-slate-800/80 text-xs sm:text-sm items-center hover:bg-slate-900/30 transition-colors">
      <div className="font-medium text-slate-200">{feature}</div>
      <div className="text-center text-slate-400">{other}</div>
      <div className={`text-center font-semibold ${positive ? "text-emerald-400" : "text-white"}`}>
        {ventura}
      </div>
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
      className={`rounded-3xl p-8 flex flex-col justify-between relative transition-all ${
        popular
          ? "bg-gradient-to-b from-indigo-950/70 via-slate-900 to-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/10"
          : "bg-slate-900/60 border border-slate-800 hover:border-slate-700"
      }`}
    >
      {popular && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500 text-white font-semibold text-xs tracking-wider uppercase shadow-md">
          Eng ommabop tanlov
        </div>
      )}

      <div>
        <div className="flex justify-between items-baseline">
          <h3 className="text-2xl font-bold text-white">{name}</h3>
        </div>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 min-h-[36px]">{description}</p>

        <div className="mt-6 pb-6 border-b border-slate-800">
          <span className="text-3xl sm:text-4xl font-extrabold text-white">{price}</span>
          <span className="text-xs sm:text-sm text-slate-400 ml-1.5">{period}</span>
          <div className="mt-1 text-xs text-emerald-400 font-medium">⭐ 7 kun to'liq bepul sinov</div>
        </div>

        <ul className="mt-6 space-y-3 text-xs sm:text-sm text-slate-300">
          {features.map((f, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <Check className="size-4 text-emerald-400 shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8 pt-4">
        <button
          onClick={onSelect}
          className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer ${
            popular
              ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30"
              : "bg-slate-800 hover:bg-slate-700 text-white"
          }`}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
}

/* ---------- FAQ Item Component ---------- */

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-semibold text-white text-sm sm:text-base hover:text-indigo-300 transition-colors cursor-pointer"
      >
        <span>{question}</span>
        <ChevronDown className={`size-5 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-5 sm:px-5 text-slate-300 text-xs sm:text-sm leading-relaxed border-t border-slate-800/60 pt-3">
          {answer}
        </div>
      )}
    </div>
  );
}

/* ---------- Free Trial Modal Component ---------- */

function FreeTrialModal({ initialSlug, onClose }: { initialSlug: string; onClose: () => void }) {
  const [centerName, setCenterName] = React.useState("");
  const [slug, setSlug] = React.useState(initialSlug || "");
  const [ownerName, setOwnerName] = React.useState("");
  const [ownerPhone, setOwnerPhone] = React.useState("");
  const [ownerPassword, setOwnerPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  // Slug check state
  const [checkingSlug, setCheckingSlug] = React.useState(false);
  const [slugStatus, setSlugStatus] = React.useState<{ available?: boolean; error?: string } | null>(null);

  // Submit state
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [successResult, setSuccessResult] = React.useState<{ slug: string; url: string; centerName: string } | null>(
    null,
  );
  const [copied, setCopied] = React.useState(false);

  // Debounced check
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

  // Auto slug generation from center name if slug is empty
  const handleCenterNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCenterName(val);
    if (!slug || slug === initialSlug) {
      const generated = val
        .toLowerCase()
        .replace(/['`ʻʼ]/g, "")
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      if (generated) setSlug(generated.slice(0, 30));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);

    try {
      const res = await startFreeTrialAction({
        centerName,
        slug,
        ownerName,
        ownerPhone,
        ownerPassword,
      });

      if (!res.ok) {
        setSubmitError(res.error);
        setSubmitting(false);
        return;
      }

      setSuccessResult(res);
    } catch (err) {
      setSubmitError((err as Error).message || "Kutilmagan xatolik yuz berdi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyUrl = () => {
    if (!successResult) return;
    navigator.clipboard.writeText(successResult.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 text-slate-100 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="size-5" />
        </button>

        {!successResult ? (
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="size-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">7 kunlik bepul sinovni boshlash</h3>
                <p className="text-xs text-slate-400">Hech qanday karta talab etilmaydi · 30 soniyada tayyor</p>
              </div>
            </div>

            {submitError && (
              <div className="my-4 p-3.5 rounded-xl bg-red-950/60 border border-red-500/30 text-red-200 text-xs">
                ⚠️ {submitError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4 text-xs sm:text-sm">
              {/* 1. Center Name */}
              <div>
                <label className="block font-medium text-slate-300 mb-1.5">O'quv markaz nomi *</label>
                <input
                  type="text"
                  required
                  value={centerName}
                  onChange={handleCenterNameChange}
                  placeholder="Masalan: Registon Academy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 2. Subdomain */}
              <div>
                <label className="block font-medium text-slate-300 mb-1.5">
                  Subdomen manzili *{" "}
                  <span className="text-[11px] text-slate-400 font-normal">(o'quv markazingiz web manzili)</span>
                </label>
                <div className="flex items-center rounded-xl bg-slate-950 border border-slate-800 px-3.5 py-2 focus-within:border-indigo-500">
                  <span className="text-slate-500 font-mono text-xs select-none">https://</span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    placeholder="registon"
                    className="w-full bg-transparent text-white font-medium px-1 focus:outline-none"
                  />
                  <span className="text-indigo-400 font-mono text-xs font-semibold shrink-0">.ventura.uz</span>
                </div>

                {/* Subdomain status */}
                <div className="mt-1.5 min-h-[20px] text-xs">
                  {checkingSlug && <span className="text-slate-400">Tekshirilmoqda...</span>}
                  {!checkingSlug && slugStatus && slugStatus.available && (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check className="size-3.5" /> <strong>{slug}.ventura.uz</strong> bo'sh, tanlashingiz mumkin
                    </span>
                  )}
                  {!checkingSlug && slugStatus && !slugStatus.available && (
                    <span className="text-red-400">❌ {slugStatus.error}</span>
                  )}
                </div>
              </div>

              {/* 3. Owner Name */}
              <div>
                <label className="block font-medium text-slate-300 mb-1.5">Direktor (Rahbar) ismi va familiyasi *</label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Masalan: Javohir Alimov"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 4. Owner Phone */}
              <div>
                <label className="block font-medium text-slate-300 mb-1.5">
                  Telefon raqami * <span className="text-[11px] text-slate-400 font-normal">(kirish logini bo'ladi)</span>
                </label>
                <input
                  type="tel"
                  required
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* 5. Owner Password */}
              <div>
                <label className="block font-medium text-slate-300 mb-1.5">Direktor paroli *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Kamida 8 ta belgi"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting || checkingSlug || (slugStatus !== null && !slugStatus.available)}
                  className="w-full py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none transition-all shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Markaz yaratilmoqda va tizim sozlanmoqda...</span>
                    </>
                  ) : (
                    <>
                      <span>7 kunlik bepul sinovni boshlash</span>
                      <ArrowRight className="size-4" />
                    </>
                  )}
                </button>
              </div>

              <p className="text-[11px] text-center text-slate-500 mt-2">
                Ro'yxatdan o'tish orqali siz Ventura foydalanish shartlariga rozilik bildirasiz.
              </p>
            </form>
          </div>
        ) : (
          /* Success Screen */
          <div className="text-center py-4 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="size-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="size-9" />
            </div>

            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Tabriklaymiz!</span>
              <h3 className="text-2xl font-extrabold text-white mt-1">O'quv markazingiz muvaffaqiyatli yaratildi!</h3>
              <p className="text-xs sm:text-sm text-slate-300 mt-2 max-w-sm mx-auto">
                <strong>{successResult.centerName}</strong> uchun 7 kunlik to'liq bepul sinov davri faollashtirildi.
              </p>
            </div>

            {/* Access Details Box */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left space-y-3 font-mono text-xs">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase">CRM Tizim manzili</span>
                <div className="flex items-center justify-between mt-1 p-2 rounded-lg bg-slate-900 border border-slate-800">
                  <a
                    href={successResult.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 font-bold hover:underline truncate"
                  >
                    {successResult.url}
                  </a>
                  <button
                    onClick={handleCopyUrl}
                    className="p-1 rounded text-slate-400 hover:text-white shrink-0 ml-2 cursor-pointer"
                  >
                    {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-slate-300">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Login (Telefon)</span>
                  <span className="font-semibold text-slate-200">{ownerPhone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase">Parol</span>
                  <span className="font-semibold text-slate-200">••••••••</span>
                </div>
              </div>
            </div>

            {/* Direct Open Button */}
            <div className="pt-2">
              <a
                href={successResult.url}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center py-3.5 px-4 rounded-xl font-semibold text-sm text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/30 active:scale-95"
              >
                <span>CRM Tizimiga Kirish</span>
                <ExternalLink className="size-4 ml-2" />
              </a>
            </div>

            <p className="text-[11px] text-slate-400">
              ⚡ Tizim serverda bir daqiqada ishga tushadi. Sahifani saqlab oling!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
