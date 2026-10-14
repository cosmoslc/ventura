# 0033. edu-crm: o'qituvchi samaradorlik reytingi (E5d)

2026-10-14 · qabul qilingan · docs/EDU-CRM-E5.md (E5d), EDU-CRM-PLAN E5

## Vaziyat

Eski tizimdagi "O'qituvchi samaradorlik reytingi" soxta sahifa edi: 4 ta o'ylab topilgan o'qituvchi va qo'lda
yozilgan raqamlar ("4.95 / 5", "128 soat", "18 400 000 UZS"). Bazadan hech narsa o'qilmasdi. "Davomat sifati",
"O'quvchi ushlab turish" (o'qituvchi kesimida) kabi bandlar "tez kunda" turardi.

## Qaror

Guruh "O'qituvchi hisoboti" (menyuda — Hisobotlar → O'qituvchi hisoboti). Ruxsat — `dashboard.view`, bo'lim —
`teachers`. Davr — oy, yil yoki barcha davr; filial — guruh filiali bo'yicha.

### Ko'rsatkichlar (har o'qituvchi, guruhlarning asosiy o'qituvchisi bo'yicha)

| Ustun | Hisob |
| --- | --- |
| Guruhlar, o'quvchilar | Hozirgi (arxivlanmagan) guruhlari va ulardagi faol va sinovdagi o'quvchilar (takrorsiz) |
| O'tilgan darslar, soat | Guruh jadvali bo'yicha (`lessonDates`, bayramlarsiz, bugungacha). Arxivlangan guruh — arxiv kunigacha. Soat — dars davomiyligidan |
| Davomat olingan | O'tilgan darslardan davomat belgisi borlari (eski "Davomat sifati — tez kunda") |
| O'quvchilar davomati | Belgilardan: (bor + kech) / jami belgilar — davomat hisoboti bilan bir xil |
| Ushlab turish, chiqqan | Davr boshida guruhlarida bo'lgan faollashtirilgan o'quvchilardan davrda chiqmaganlari. Barcha davrda — barcha faollashtirilganlar |
| Sinovdan o'tish | Davrda qo'shilganlardan faollashtirilganlari. Hali sinovda turganlar maxrajga kirmaydi |
| Birinchi darsdan o'quvchi | Lidlarning birinchi darsiga kelganlardan o'quvchi bo'lganlari (ADR 0023) |
| Hisoblangan maosh | Ish haqi hisobidan (ADR 0018), davrdagi o'tgan oylar yig'indisi. Faqat `dashboard.financial_stats` bilan |

- **Jami qator** — sanoqlar yig'indisidan hisoblanadi, o'rtachalar o'rtachasi emas.
- **Tartib** — ushlab turish, keyin davomat, keyin darslar soni. Ushlab turishi hisoblanmaganlar oxirida.
- **Umumiy ball yo'q.** Turli ko'rsatkichlarni bitta songa aralashtirish o'zboshimchalik bo'lardi.
- **Ro'yxatga kirmaydi:** davrda darsi, o'quvchisi va birinchi darsi bo'lmagan o'qituvchi.

### Maosh va qo'shilgan oy

- **Topilgan muammo:** ish haqi hisobi (ADR 0018) belgilangan oylikni o'qituvchi tizimga qo'shilishidan oldingi
  oylarga ham yozadi. Oktyabrda qo'shilgan o'qituvchi yil bo'yicha 10 oylik oladi.
- **Reytingdagi yechim:** o'qituvchi qo'shilgan oydan (`teachers.created_at`) oldingi oylar sanalmaydi.
- **Ish haqi bo'limining o'zi** alohida vazifa sifatida tuzatiladi. Reytingdagi yechim shundan keyin olib tashlanadi.

### Olinmadi

O'quvchilar bergan baho (eski "O'quvchilar reytingi 4.95 / 5"). Buning uchun avval o'quvchi o'qituvchini baholaydigan
tizim kerak — keyinga qoldirilgan ro'yxatda (docs/EDU-CRM-E5.md).

## Sinov

- **Vitest:** foizlar va nol maxraj, jami qator, tartib, dars davomiyligi.
- **Haqiqiy PostgreSQL** (`teacher-reports.db.test.ts`):
  - jadvaldan darslar va soat;
  - davomat belgilari;
  - ushlab turish va sinovdan o'tish;
  - birinchi darsdan o'quvchi;
  - maosh ustuni faqat moliyaviy ruxsat bilan;
  - boshqa mijoz ko'rmaydi.
- **Mahalliy sinov bazasi:** 10 o'qituvchi, oktyabrda 121 dars (182 soat), faqat o'qish. Yillik maosh
  qo'shilgan oydan boshlab sanaldi.

## Oqibatlari

- E5 ning asosiy qismlari tugadi; keyinga qoldirilgan hisobotlar ro'yxati oxirida qo'shiladi.
