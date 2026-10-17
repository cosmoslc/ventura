# 0045. edu-crm: Pul oqimi, reja va prognoz — bitta sahifa; faol o'quvchi sabablari; xodim formasi

2026-10-16 · qabul qilingan · EDU-CRM-FIXES 5.4, 4.1, 6.1; ADR 0030 (hisobotlar), 0035 (sabablar), 0016 (xarajat rejalari) bilan bog'liq

## Vaziyat

1. **Pul oqimi** va **Reja, fakt va prognoz** ikki alohida hisobot edi. Eski tizimda bitta sahifa: 12 oylik jadval, har
   oyda uch ustun (Reja, Fakt, Prognoz), reja katagini bosib kiritish, fakt katagidan ro'yxatga o'tish, grafik va
   "Operatsion ko'rsatkichlar" jadvali.
2. **Faol o'quvchini o'chirishda** "Sabablar" sahifasidagi ro'yxat har doim ham chiqmas edi.
3. **Xodim qo'shish formasi** ochilganda 6 ta qo'shimcha maydon (pasport, JSHSHIR, ta'lim va h.k.) o'zi paydo bo'lardi
   va tanlangan filial oldindan belgilanardi.

## Qaror

### Bitta sahifa: `/reports/cashflow` (5.4)

- `plan` hisoboti reyestrdan olib tashlandi; `/reports/plan` (va Excel havolasi) `/reports/cashflow`ga yo'naltiradi,
  `?yil=` saqlanadi. Hisobotlar sahifasi va menyu reyestrdan qurilgani uchun o'zi yangilanadi.
- Sahifa tarkibi (yuqoridan pastga): 4 ko'rsatkich (kirim, chiqim, sof oqim — rejaga nisbati va yil oxirigacha
  prognoz bilan — va o'rtacha oylik kirim); **12 oylik jadval** (har oy uchun Reja, Fakt, Prognoz + yillik jami;
  chap ustun qotirilgan, ochilganda joriy oy ko'rinadi); grafiklar (kirim/chiqim, chiqim tarkibi, oyma-oy kirim va
  chiqim reja-fakt-prognoz bilan, sof oqim); toifalar bo'yicha batafsil jadval; operatsion ko'rsatkichlar.
- Hisob o'zgarmadi: fakt — `loadFlows` (bosh panel bilan bir xil), reja va prognoz — `planTable`/`forecastCell`.
  Oyma-oy qatorlar `planMonths` dan, yillik jami `planTable(butun yil)` bilan bir xil (Vitest).
- **Reja kiritish**: sarlavhadagi tugma yoki jadvaldagi reja katagi bitta oynani ochadi (`PlanEditProvider`); katak
  bosilsa oyna shu oy va qator maydoniga fokus bilan ochiladi. To'lovlar, qo'shimcha daromad va ish haqi rejasi
  `finance_plans` ga yoziladi. Xarajat rejasi toifalar bo'yicha (ADR 0016) — katak Xarajatlar → Rejalashtirishga
  olib boradi. Ruxsat — `dashboard.financial_stats` (o'zgarmadi).
- **Fakt katagi** to'lovlar, qo'shimcha daromad va xarajatlar ro'yxatiga (shu oy) havola; xodimda o'sha sahifaga
  ruxsat bo'lsagina. Eski tizimdagi oyna ichidagi ro'yxat o'rniga mavjud sahifalarga o'tish — ma'lumot ikki joyda
  takrorlanmaydi.
- **Rang**: o'tgan oyning fakti rejaga nisbatan — 100% va undan ko'p (chiqimda reja doirasida) yaxshi, 90–99% (chiqimda
  +10% gacha) ogohlantirish, qolgani yomon. Prognoz faqat joriy va kelgusi oylarda.
- **Excel** — bitta fayl, varaqlar: Pul oqimi (toifalar bo'yicha oyma-oy), Reja, fakt va prognoz (qatorlar bo'yicha
  reja/fakt/bajarilish/prognoz), Oyma-oy reja va fakt (12 oy × 3 ustun), Operatsion ko'rsatkichlar.

### Operatsion ko'rsatkichlar

Eski tizimdagi 9 ta ko'rsatkichdan 8 tasi bazadan olinadi (faqat fakt): lidlar, birinchi to'lov qilganlar, konversiya,
o'quvchilar (oy oxiri), ketganlar, guruhlar, o'rtacha to'ldirilish, davomat.

- **Konversiya** — shu oy lidlaridan o'quvchi bo'lganlar / shu oy lidlari (100% dan oshmaydi). Eski tizimdagi
  "birinchi to'lov / lidlar" boshqa oy lidlari to'lovini ham sanab, 250% kabi son berardi.
- **Ketgan** — oy boshida guruhda bo'lib, oy oxirida hech bir guruhda qolmagan o'quvchilar (guruh almashtirish
  ketish emas).
- **Tashlab ketildi**: "Sinov darsiga yozilganlar" — bu tizimda sinov holati tarixi saqlanmaydi, aniq son bermaymiz.
  Operatsion **reja** kataklari ham yo'q: ular uchun saqlash joyi (jadval/migratsiya) kerak, fake son o'rniga
  ko'rsatilmadi.
- Yangi `CellKind` — `decimal` (bir xona kasr; Excel `0.0`).

### Faol o'quvchini o'chirishdagi sabablar (4.1)

Sabab ro'yxati dialog ochilganda bir marta o'qilib, xatolik bo'lsa ham `null` bo'lib **kesh**ga tushib qolardi: shu
holda sahifa qayta yuklanguncha oddiy matn maydoni qolardi, boshqa oynada tahrirlangan ro'yxat ham ko'rinmasdi.

- Kesh 15 soniya yashaydi, xato keshlanmaydi; dialog ochilganda qayta o'qiladi (yopiq dialog so'rov yubormaydi).
- Sabab maydoni endi **ochiladigan ro'yxat** (dropdown): ro'yxat bandlari + "Boshqa" (o'z matni). Guruh arxivi, lid
  arxivi va holat o'zgartirish ham shu maydondan foydalangani uchun bir xil ko'rinadi.
- Tur tanlash (`studentArchiveCategory`: sinovdagi — `student_trial`, qolgan hammasi — `student_active`) va ro'yxat
  tanlash testlandi.

### Xodim formasi (6.1)

`DEFAULT_STAFF_FIELDS` bo'sh ro'yxat (markaz maydonni o'zi qo'shadi, o'quvchi/lid kabi). Yangi xodimda filial oldindan
belgilanmaydi — faqat bitta filial bo'lsa (tanlov ko'rinmaydi) o'sha biriktiriladi. Tahrirda xodim ma'lumoti saqlanadi.
Eslatma: markaz sozlamada maydonlarni allaqachon saqlagan bo'lsa, ular qoladi (Xodim maydonlari oynasidan o'chiriladi).

## Oqibatlari

- Migratsiya yo'q. Eski `plan` havolalari ishlaydi.
- `lib/operational.ts` (toza hisob, Vitest) va `lib/server/operational-reports.ts` (baza) qo'shildi.
- DB testi (`reports.db.test.ts`) birlashgan sahifa jadvali va operatsion bo'limni ham tekshiradi.
