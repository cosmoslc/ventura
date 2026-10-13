# 0017. edu-crm: Bosh panel (eski tizimdagi DashboardHome)

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E5 ("Bosh sahifa ko'rsatkichlari"), Saidakbar so'rovi bilan E5 dan oldin

## Vaziyat

Saidakbar eski tizimdagi bosh dashboardni "birga bir" ko'chirishni so'radi. Eski tizimda u brauzerda hamma ma'lumotni
yuklab, har sahifa ochilganda o'zi hisoblar edi:

- kutilgan daromad eski `prorata` formulasi bilan hisoblanar edi;
- qarz faqat fokus oyi bo'yicha olinar edi (Qarzdorlar sahifasidagi raqamdan farq qilar edi);
- jonli yangilanish Supabase Realtime orqali ishlar edi.

Lidlar (E4) va ish haqi (E3c) Ventura'da hali yo'q. Saidakbar qarori: ularga tayanadigan kartalarning joyi qoladi,
ichida "bo'lim hali ishga tushmagan" yozuvi turadi.

## Qaror

### Joylashuv (eski tizim bilan 1:1)

1. **Yuqori qator:**
   - chapda: "Bosh panel" sarlavhasi va LIVE belgisi, onlayn holati, yil va oy tanlovi, "Yangilandi HH:MM";
   - o'ngda: sana, "Yangilash", "Hisobot" (chop etish), Toshkent vaqti.
2. **10 ta KPI kartasi:** Tushum, Kutilgan daromad, Chiqim, Sof foyda, Qarzdorlik, Davomat, Faol o'quvchilar, Avans*,
   Yangi lidlar*, Qaytarishlar.
   - Har kartada oldingi davrga nisbatan o'zgarish va 12 oylik sparkline bor.
   - Karta tegishli sahifaga olib boradi.
3. **Ikkinchi qator:**
   - Moliya dinamikasi: 7 kun / 30 kun / 12 oy, chiziqli yoki ustunli, "reja" chizig'i, maks, min, o'rtacha;
   - Yig'ilish darajasi;
   - O'quvchilar holati (donut);
   - 4 ta plitka: guruhlar, o'qituvchilar, xona bandligi, bugungi darslar.
4. **Uchinchi qator:**
   - Guruhlar holati jadvali: saralanadi, 5 tasi ko'rinadi, qolgani "Batafsil ko'rish" bilan ochiladi;
   - Lid manbalari*;
   - Chiqim tuzilmasi (donut).
5. **To'rtinchi qator:** So'nggi amallar (to'lovlar; lidlar ustuni*), Lid konversiyasi*.

\* — bo'lim tayyor bo'lgach to'ldiriladi.

Filial tanlovi eski paneldagidek alohida emas — tepadagi umumiy filial tanlovi ishlaydi.

### Hisob (bitta manba)

- **Pul oqimi** bazada kunlar bo'yicha yig'iladi (`lib/server/dashboard.ts`). Hisobi toza funksiyalarda
  (`lib/dashboard.ts`, Vitest):
  - tushum = o'quvchi to'lovlari + qo'shimcha daromad (eski tizimda qo'shimcha daromad tushumga kirmas edi);
  - chiqim = xarajatlar + qaytarishlar (ish haqi E3c'da qo'shiladi);
  - bekor qilingan yozuvlar hech qayerga kirmaydi.
- **Kutilgan daromad, yig'ilgan va guruh qarzi** o'quvchi hisobidan olinadi (`loadAccounts`, ADR 0015):
  - fokus oyi hisoblangani (`MonthStatus.amount`);
  - shu oy hisobidan yopilgani (`covered`);
  - guruhning barcha oylar bo'yicha qarzi (`due`).
- **Qarzdorlik** — Qarzdorlar sahifasidagi bilan bir xil to'plam va raqam (barcha oylar, arxivdagilar ham).
- **Davomat** = (bor + kech) / barcha belgilar. Belgilanmagan dars hisobga kirmaydi.
- **O'quvchilar holati:** Faol (guruhda), Sinov, Muzlatilgan, Ketgan, Guruhsiz, Bitirgan (bo'lsa).
  O'chirilgan (arxivdagi) o'quvchilar kirmaydi.
- **Davr:**
  - oy tanlansa — o'sha oy, solishtirish o'tgan oy bilan;
  - faqat yil — o'sha yil, solishtirish o'tgan yil bilan;
  - "barcha" — butun davr, solishtirishsiz.
  - Davr manzilda saqlanadi (`?yil=&oy=`).

### Ruxsatlar

| Ruxsat | Nima ko'rinadi |
| --- | --- |
| `dashboard.view` / `dashboard.financial_stats` / `dashboard.conversion_stats` (birortasi) | Bosh panel ochiladi. Ruxsat bo'lmasa — oddiy bosh sahifa |
| `dashboard.financial_stats` | Pul KPI'lari, moliya grafigi, yig'ilish, chiqim tuzilmasi, so'nggi to'lovlar, jadvaldagi to'lov va qarz ustunlari |
| `dashboard.conversion_stats` | Lid kartalari |

- Eski tizimda pul raqamlari ruxsatsiz ham ko'rinar edi.
- Bu yerda ruxsat bo'lmasa pul raqamlari brauzerga umuman yuborilmaydi.

### Jonli yangilanish

Sahifa ko'rinib turganda har daqiqada server qayta o'qiydi (EDU-CRM-PLAN: avval davriy so'rov). "Yangilash" tugmasi
buni darhol qiladi.

### Komponentlar

`packages/ui` ga qo'shildi (STYLE.md 11.32, katalogda): `Sparkline`, `DonutChart`, `Gauge`, `TrendChart`.

Grafik ranglariga `--chart-3` va `--chart-4` qo'shildi (3.3a):

- dataviz validatoridan o'tgan: qo'shni juftlar CVD ΔE 9.1 / 8.4;
- light'da kontrast 3:1 dan past, shuning uchun bu ranglar faqat yozuv bilan ishlatiladi.

## Oqibatlari

- E3c: ish haqi va avans chiqimga qo'shiladi, "Avans" KPI to'ladi.
- E4: lid KPI, manbalar, konversiya va so'nggi lidlar to'ladi.
- E5 hisobotlari shu `lib/dashboard.ts` va o'quvchi hisobidan oladi, alohida formula yozilmaydi.
