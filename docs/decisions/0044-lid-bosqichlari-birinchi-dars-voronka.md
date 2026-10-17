# 0044. edu-crm: standart lid bosqichlari, birinchi dars kunlari va to'liq CRM voronka (EDU-CRM-FIXES 1.1–1.3)

2026-10-16 · qabul qilingan · docs/EDU-CRM-FIXES.md (1.1, 1.2, 1.3), ADR 0022, 0023, 0032

## Vaziyat

- **1.1.** Lidni birinchi darsga yozishda erkin sana inputi chiqardi: guruhning dars kuni bo'lmagan sanani ham
  yozish mumkin edi (serverda tekshiruv yo'q edi).
- **1.2.** Standart bosqichlar (Yangi, Bog'lanildi, Sinov darsi) markazning jarayoniga mos emas edi.
- **1.3.** Eski CRM voronka sahifasi (`CrmFunnelPage.jsx`) imkoniyatlarining bir qismi yangisiga o'tmagan edi.

## Qaror

### 1.1 Birinchi dars kunlari

- Guruh tanlanganda sana inputi o'rniga guruhning **bugundan boshlab 3 haftalik dars kunlari** ro'yxati chiqadi:
  sana, hafta kuni, dars vaqti; bugun ajratib ko'rsatiladi; bitta kun tanlanadi.
- Kunlar serverda hisoblanadi (`leadGroupOptions` → `firstLessonDays` → `lessonDates`): guruh jadvali, guruh
  boshlanish sanasi va dam olish kunlari (bayramlar) hisobga olinadi. Yangi so'rov yo'q — ro'yxat guruhlar bilan birga keladi.
- **Server tekshiruvi** (`scheduleFirstLessonAction`, `isFirstLessonDay`): sana shu guruhning haqiqiy dars kuni va
  bugundan oldin emas. Boshqa holatda "Tanlangan kun guruhning dars kuni emas yoki o'tib ketgan".
- Yozilgan kun 3 haftadan tashqarida bo'lsa, dialog tanlovsiz ochiladi (eski kun qayta saqlanmaydi).

### 1.2 Standart bosqichlar

`DEFAULT_LEAD_STAGES` (faqat **yangi mijozlar** uchun; mavjud mijozlarning bosqichlari o'zgarmaydi):

| # | Nom | Turi |
| --- | --- | --- |
| 1 | Yangi | ochiq |
| 2 | Ma'lumot berildi | ochiq |
| 3 | Sinov darsida | ochiq |
| 4 | Sinovda qatnashdi | ochiq |
| 5 | Guruhga qo'shildi | `won` (tizim) |
| — | Yo'qotildi | `lost` (tizim) |

**"Guruhga qo'shildi" — alohida ochiq bosqich emas, `won` bosqichining standart nomi.** Sabab: eski CRMda ham
"Guruhga qo'shildi" (`student`) o'quvchiga aylangan lidlarning yakuniy bosqichi edi; Ventura'da lid faqat
"O'quvchiga aylantirish" amali bilan `won` ga o'tadi, ochiq ustun esa qo'lda sudraladi va o'quvchi yaratmaydi — ikkita
o'xshash bosqich voronkada ham, hisobotlarda ham ikkilanish bo'lardi. Doskada `won` ustuni oxirida **faqat ko'rish**
sifatida chiqadi (eng yangi 20 ta, qolgani "O'quvchi bo'lganlar" tabida); unga sudrab bo'lmaydi.
Bosqichlar mijozda birinchi kirishda yaratiladi (`listStages`, advisory qulf bilan) — yangi mijoz/filial uchun
alohida amal kerak emas (bosqichlar mijoz bo'yicha, filialga bog'liq emas).

### 1.3 CRM voronka — eski sahifa bilan taqqoslash

| Eski CRM imkoniyati | Ventura |
| --- | --- |
| Davr (yaratilgan sana) | Yil / oy / barcha davr (umumiy filtr) — oldin ham bor |
| Kurs va manba filtri | **Qo'shildi** — umumiy filtr qatorida, manzilda `kurs`, `manba`; Excel ham shunga mos |
| Voronka: bosqichga yetganlar, ulush, o'tish, tushish, eng katta tushish | Oldin ham bor (tarixdan aniq hisob) |
| Bosqich tanlash (bossa ko'rsatkichlar va ro'yxat shu bosqich bo'yicha) | **Qo'shildi** — voronka qatori havola (`bosqich`) |
| 4 ta ko'rsatkich: konversiya, tanlangan bosqichga yetmagan (shundan yo'qotilgan), avvalgidan o'tmagan, eng katta tushish | **Qo'shildi** (oldin: lidlar, o'quvchi bo'ldi, yo'qotilgan, eng katta tushish — soni donut markazida) |
| Bosqichlarni voronkada yashirish/ko'rsatish (sozlamada saqlanadi) | **Qo'shildi** — `settings` kaliti `leads.funnel_hidden`, `leads.edit` ruxsati; yakuniy bosqich doim ko'rinadi |
| Mas'ul xodimlar matritsasi + "Konversiyani ko'rsatish" | Matritsa oldin ham bor; foiz almashtirgichi **qo'shildi** |
| Lid yo'l xaritasi (bosqichlar orasida konversiya, bosqichda o'rtacha turish) | Voronka qatorida oldin ham bor (alohida tab kerak emas) |
| Pastdagi lidlar jadvali: bosqich, mas'ul, qidiruv; ism, telefon, bo'lim, sanalar, oxirgi izoh, qo'ng'iroq | **Qo'shildi** — server filtr (`xodim`, `q`), ro'yxat Excel'da ham (2000 qatorgacha), sahifada 100 ta |
| "Yangilash" tugmasi | O'tkazilmadi: sahifa serverda hisoblanadi, har ochilishda yangi |
| Sana oralig'i (aniq kun) | O'tkazilmadi: butun hisobot yil/oy davri bilan ishlaydi (ADR 0030) |

Qoidalar:
- Ro'yxat — tanlangan bosqichda **to'xtagan** lidlar (eski sahifadagidek; yo'qotilgani "shu yerda yo'qotilgan" belgisi
  bilan); voronkadagi son esa shu bosqichga yetganlarning hammasi (kumulyativ) — izohda yozilgan.
- Yashirilgan bosqichda o'tish va tushish ko'rinadigan oldingi bosqichga nisbatan (`funnelSteps(..., visible)`).
- Yakuniy bosqich nomi `won` bosqichining haqiqiy nomi (markaz o'zgartirgan bo'lsa shu).
- Hisobot yuklovchisiga `query` va `manage` qo'shildi (`LoadArgs`); boshqa hisobotlar ularni e'tiborsiz qoldiradi.

## Oqibatlar

- Yangi: `lib/leads.ts` (`firstLessonDays`, `isFirstLessonDay`), `lib/lead-reports.ts` (`visibleIndexes`, `funnelKpis`,
  `parseHiddenStages`, `matchesFunnelFilter`), `reports/funnel-actions.ts`, `lead-parts/funnel-{filters,leads,settings}.tsx`,
  `lead-parts/staff-matrix.tsx`. Migratsiya yo'q (sozlama `settings` jadvalida).
- Mavjud mijozlar eski nomlarda qoladi; xohlasa "Sozlamalar → Doska ustunlari"da qo'lda o'zgartiradi.
- Mahalliy seed (`tooling/scripts/src/edu-seed-reports.ts`) o'z eski standartini saqlaydi.
