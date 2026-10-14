# 0034. edu-crm: har hisobotning o'z ko'rinishi

2026-10-14 · qabul qilingan · ADR 0030–0033 davomi

## Vaziyat

E5 da 13 ta hisobot bitta umumiy shablonda chizilardi: 4 ta qisqa ko'rsatkich va jadval. Eski CRM'da har hisobotning
o'z sahifasi bor edi: grafiklar, taqsimotlar, voronka, kohorta jadvali va boshqalar. Saidakbar hamma hisobot
sahifasini eski CRM uslubida yoki undan yaxshiroq qilib qayta loyihalashni so'radi.

## Qaror

- **Ko'rinishlar ro'yxati.** Har hisobotning o'z ko'rinish fayli bor: `app/(crm)/reports/views/<kalit>.tsx`. Ro'yxat —
  `views/index.ts` (`REPORT_VIEWS`). Sahifa (`[report]/page.tsx`) faqat umumiy qismni chizadi: sarlavha, filtr
  qatori, Excel va hisobotga xos tugma (reja, sabablar). Qolgan tarkibni ko'rinish chizadi.
- **Ma'lumot.** Yuklovchi avvalgidek `metrics`, `table` va `extra` qaytaradi. Excel va DB testlari shulardan
  foydalanadi, raqamlar o'zgarmadi. Grafiklar uchun qo'shimcha ma'lumot `ReportData.view` da keladi; uning turi
  yuklovchi faylida eksport qilinadi (masalan `CashflowViewData`, `FunnelViewData`). Yangi hisob — toza funksiyalarda,
  Vitest bilan: `lib/cashflow-views.ts`, `lib/finance-views.ts`, `lib/academic-reports.ts`, `lib/teacher-reports.ts`.
- **Yuklovchi fayllari.** Moliya hisobotlari ikki faylga ajratildi: `cashflow-reports.ts` (pul oqimi, reja) va
  `finance-reports.ts` (xarajat, chegirma, kurs). `reports.ts` da faqat ro'yxat, davr va ruxsatlar qoldi.
- **Umumiy bloklar** — `views/blocks.tsx`, hamma hisobotda bir xil ko'rinish uchun:
  - `Panel` — karta, kichik bosh harfli sarlavha va izoh;
  - `KpiRow` — yuklovchining ko'rsatkichlari;
  - `PanelEmpty` va `EmptyPanel` — bo'sh holat;
  - `BlockTitle` — blok sarlavhasi.
- **Grafiklar** `packages/ui` dagilaridan (`TrendChart`, `DonutChart`, `Meter`, `MetricCard`). Yo'q bo'lganlari
  hisobot papkasida yozildi:
  - voronka chiziqlari;
  - sof oqim (manfiy qiymat bilan);
  - kohorta jadvali;
  - o'qituvchilar taqqoslash grafigi.
- **Qisqa oy nomlari** — `uz.monthsShort`. "Iyun" va "Iyul" ikkalasi "Iyu" bo'lib chiqmasligi uchun "Iyn" va "Iyl".
- **"Hisobotlar" sahifasi** — guruhlar bo'limlarga ajratilgan, har hisobot nomi va izohi bilan kartochkada. Ruxsat
  filtri avvalgidek.

## Qanday qilindi

- **Ish taqsimoti:** 5 ta yordamchi agent (Sonnet) parallel ishladi. Har biri o'z fayllarida: moliya (2 ta),
  o'quv, lidlar, o'qituvchi va "Hisobotlar" sahifasi.
- **Yakuniy tekshiruv:**
  - takrorlangan bloklar va oy nomlari birlashtirildi;
  - sarlavha uslubi bittaga keltirildi;
  - tiplar, lint, testlar;
  - 13 ta sahifa skrinshoti.
- **Sinov sahifasi:** tekshirish uchun kirishsiz vaqtinchalik sahifa ishlatildi. U faqat dev rejimida ishlaydi va
  git'ga kiritilmagan.

## Oqibatlari

- **Yangi hisobot:** yuklovchi, ko'rinish fayli va `REPORT_VIEWS` ga bitta qator.
- **Cheklovlar:**
  - sinov bazasida chiqishlar, yo'qotilgan lidlar, xarajatlar va chegirmalar yo'q. Bu sahifalarning to'liq ko'rinishi
    vaqtinchalik soxta ma'lumotda tekshirildi, haqiqiy ma'lumotda esa bo'sh holat ko'rildi;
  - telefon kengligida 12 oy nomlari zich turadi, kam sonli grafikda o'q bo'linmalari kasr chiqadi. Ikkalasi ham
    umumiy `TrendChart` ga bog'liq.
