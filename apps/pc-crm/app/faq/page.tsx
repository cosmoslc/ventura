"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  CreditCard,
  Headphones,
  HelpCircle,
  MessageCircle,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { Button } from "@ventura/ui/button";
import { Footer } from "@/components/storefront/footer";
import { Navbar } from "@/components/storefront/navbar";

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  items: FaqItem[];
}

const FAQ_DATA: FaqCategory[] = [
  {
    id: "delivery",
    name: "Yetkazib berish",
    icon: Truck,
    items: [
      {
        id: "del-1",
        question: "Yetkazib berish qancha vaqt oladi?",
        answer: "Toshkent shahri boʻylab buyurtma berilgan kuni yoki ertasi kuni kuryer orqali yetkaziladi. Viloyatlarga BTS yoki EMU xizmatlari orqali 1-3 ish kunida xavfsiz qadoqlangan holda yetkazib beriladi.",
      },
      {
        id: "del-2",
        question: "Yetkazib berish narxi qancha?",
        answer: "1 000 000 soʻmdan yuqori boʻlgan barcha buyurtmalar butun Oʻzbekiston boʻylab bepul yetkaziladi. Undan kam summadagi buyurtmalar uchun Toshkent shahrida 35 000 soʻm, viloyatlarga esa 50 000 soʻm tarif qoʻllanadi.",
      },
      {
        id: "del-3",
        question: "Yetkazib berish vaqtida tovar buzilib qolmasligiga kafolat bormi?",
        answer: "Barcha kompyuterlar va nozik texnikalar koʻp qavatli pufakchali plyonka, mustahkam karton quti va yogʻoch karkas (viloyatlar uchun) bilan xavfsiz qadoqlanadi. Shuningdek, yuk kuryerlik sugʻurtasiga ega.",
      },
    ],
  },
  {
    id: "warranty",
    name: "Kafolat va Servis",
    icon: ShieldCheck,
    items: [
      {
        id: "war-1",
        question: "Tayyor kompyuterlarga qancha muddat kafolat beriladi?",
        answer: "Ventura PC tomonidan yigʻilgan barcha kompyuterlarga 12 oydan 24 oygacha toʻliq rasmiy kafolat va bepul servis xizmati beriladi. Har bir komponent oʻz ishlab chiqaruvchisining xalqaro kafolatiga ega.",
      },
      {
        id: "war-2",
        question: "Kafolat muddati davomida kompyuter buzilsa nima qilish kerak?",
        answer: "Servis markazimizga qoʻngʻiroq qilasiz yoki Telegram operatorimizga yozasiz. Muhandislarimiz kompyuterni bepul diagnostika qilib, nuqsonli qismni zudlik bilan yangisiga almashtirib berishadi.",
      },
      {
        id: "war-3",
        question: "Kompyuter korpusini ochib tozalash kafolatni bekor qiladimi?",
        answer: "Yoʻq, oddiy changdan tozalash kafolatni bekor qilmaydi. Biroq sovutish tizimini yechish yoki komponentlarni jiddiy oʻzgartirishdan oldin operatorimiz bilan maslahatlashishni tavsiya qilamiz.",
      },
    ],
  },
  {
    id: "assembly",
    name: "PC Konfigurator va Yigʻish",
    icon: Wrench,
    items: [
      {
        id: "as-1",
        question: "Konfigurator orqali buyurtma qilingan PC qancha vaqtda yigʻiladi?",
        answer: "Komponentlar tasdiqlangach, professional muhandislarimiz kompyuterni 24 soat ichida toʻliq yigʻadi, kabel boshqaruvini (cable management) ideal qiladi va 24 soatlik stress-testdan (AIDA64 + FurMark) oʻtkazadi.",
      },
      {
        id: "as-2",
        question: "Windows va drayverlar oʻrnatib beriladimi?",
        answer: "Ha! Barcha yigʻilgan kompyuterlarga litsenziyalangan Windows 11 operatsion tizimi, eng soʻnggi BIOS versiyasi va barcha kerakli drayverlar bepul oʻrnatiladi.",
      },
    ],
  },
  {
    id: "payments",
    name: "Toʻlov usullari",
    icon: CreditCard,
    items: [
      {
        id: "pay-1",
        question: "Qanday toʻlov turlari mavjud?",
        answer: "Naqd pul, Uzcard / Humo / Visa bank kartalari orqali toʻlov qilish mumkin. Shuningdek, yuridik shaxslar uchun pul oʻtkazish (perchisleniye / shartnoma) orqali QQS bilan toʻlash imkoniyati bor.",
      },
      {
        id: "pay-2",
        question: "Boʻlib toʻlash (muddatli toʻlov / rassrochka) bormi?",
        answer: "Ha, Uzum Nasiya, Anorbank va Alif orqali 3 oydan 24 oygacha boshlangʻich toʻlovsiz muddatli toʻlovga xarid qilishingiz mumkin.",
      },
    ],
  },
];

export default function FaqPage() {
  const [activeCategoryId, setActiveCategoryId] = useState("delivery");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(["del-1"]));

  const activeCategory = FAQ_DATA.find((c) => c.id === activeCategoryId) ?? FAQ_DATA[0]!;

  const toggleItem = (id: string) => {
    setOpenItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />

      <main className="flex-1 py-10 sm:py-14">
        <div className="mx-auto max-w-[var(--storefront-max-w,1320px)] px-4 sm:px-6">
          {/* Sarlavha */}
          <div className="mx-auto max-w-2xl text-center mb-10">
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-0.5 text-xs font-bold text-primary">
              <HelpCircle size={13} />
              <span>Tez-tez beriladigan savollar</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Savollaringiz bormi? Javoblarimiz tayyor
            </h1>
            <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
              Yetkazib berish, kafolat muddatlari, kompyuter yigʻish va toʻlovlar boʻyicha eng muhim maʼlumotlar
            </p>
          </div>

          {/* Asosiy kontent: Chap menyu, O'ng savol-javoblar */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 max-w-5xl mx-auto">
            {/* Chap tomon: Kategoriyalar ro'yxati (4 ustun) */}
            <div className="lg:col-span-4 space-y-2">
              {FAQ_DATA.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategoryId === cat.id;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategoryId(cat.id)}
                    className={`flex w-full items-center gap-3 rounded-card border p-3.5 text-left text-xs sm:text-sm font-bold transition-all ${
                      isActive
                        ? "border-primary bg-primary text-primary-foreground shadow-control"
                        : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    <Icon size={18} />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>

            {/* O'ng tomon: Savollar akordeoni (8 ustun) */}
            <div className="lg:col-span-8 space-y-3">
              {activeCategory.items.map((item) => {
                const isOpen = openItems.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="rounded-card border border-border bg-card overflow-hidden transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(item.id)}
                      className="flex w-full items-center justify-between p-4 text-left font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors"
                    >
                      <span>{item.question}</span>
                      <ChevronDown
                        size={16}
                        className={`text-muted-foreground shrink-0 ml-3 transition-transform duration-200 ${
                          isOpen ? "rotate-180 text-primary" : ""
                        }`}
                      />
                    </button>

                    {isOpen && (
                      <div className="px-4 pb-4 pt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/50">
                        {item.answer}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pastdagi Mutaxassis CTA bloki */}
          <div className="mt-14 max-w-3xl mx-auto rounded-card border border-primary/20 bg-primary/5 p-6 sm:p-8 text-center space-y-3">
            <h2 className="text-xl font-bold">Savolingizga javob topmadingizmi?</h2>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              Mutaxassislarimiz har kuni 09:00 dan 21:00 gacha har qanday savolingizga javob berishga tayyor.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="https://t.me/venturapc_operator" target="_blank">
                <Button variant="primary" size="default" className="gap-2 font-bold">
                  <MessageCircle size={16} />
                  Telegram orqali yozish
                </Button>
              </Link>
              <a href="tel:+998712000000">
                <Button variant="ghost" size="default" className="gap-2 font-semibold">
                  <Headphones size={16} />
                  +998 71 200 00 00
                </Button>
              </a>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
