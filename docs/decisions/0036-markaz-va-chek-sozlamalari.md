# 0036. edu-crm: markaz sozlamalari va chek sozlamalari

2026-10-15 · qabul qilingan · E6a, E6b (docs/EDU-CRM-E6.md 3.1)

## Vaziyat

Eski CRM'da "Markaz sozlamalari" sahifasi bor edi: telefonlar, manzil, ijtimoiy tarmoqlar, ish kunlari va vaqti. Bu
maydonlar faqat saqlanardi, hech joyda ishlatilmasdi. "Chek sozlamalari" sahifasida QR kod faqat kulrang
to'rtburchak edi. Ventura'da `/settings` yo'q edi, chek esa sozlanmasdi: sarlavha, qog'oz hajmi va pastki matn
kodda qotirilgan.

## Qaror

- **Markaz sozlamalari** — yangi `/settings` sahifasi, `settings` jadvalida kalit `center`. Maydonlar: ikki telefon,
  manzil, xaritadagi havola, Telegram, Instagram, veb-sayt, ish kunlari (Du–Yak tugmalari) va ish vaqti.
  Standart — bo'sh (eskidagidek "Du–Shan 09:00–21:00" tayyor yozilmaydi: markaz o'zi kiritmaguncha hech narsa
  ko'rinmasin). Zod sxemasi `lib/center-settings.ts` da; havola `@nom`, `t.me/nom` yoki protokolsiz saytdan to'liq
  https havolaga keltiriladi, `javascript:` va boshqa protokollar rad etiladi.
- **Ruxsat.** Yangi ruxsat qo'shilmadi: `settings.branches` ("Filiallarni boshqarish") — markaz tuzilmasi bilan bir
  qator (filiallar, bayramlar). Sahifa menyuda "Ofis" bo'limida, `students` bo'limi ostida (u doim yoqilgan).
- **Markaz nomi va logotipi** bu sahifada o'zgarmaydi (Ventura paneli, `tenant.name`). Sahifada faqat o'qish uchun
  ko'rsatiladi va "Ventura bilan bog'laning" deyiladi. Hisoblash usuli va sababli kelmaslik `/payment-settings` da
  qoladi, sahifada havola bor. "Xavfli zona" olinmadi (ADR 0028, arxiv).
- **Ishlatilishi.** Ariza sahifasi (`/ariza`) pastida ish vaqti, manzil, telefonlar va havolalar chiqadi (iframe
  rejimida — yo'q: saytning o'z aloqasi bor; hech narsa kiritilmagan bo'lsa blok chizilmaydi). Chekda sarlavha
  ostida telefon, filialda manzil bo'lmasa markaz manzili chiqadi. Chek QR kodi sayt, bo'lmasa Telegram, bo'lmasa
  Instagram havolasiga olib boradi.
- **Chek sozlamalari** — `settings` kaliti `receipt` (`lib/receipt-config.ts`): sarlavha (bo'sh bo'lsa markaz nomi),
  pastki matn (bo'sh bo'lsa "To'lovingiz uchun rahmat!"), qog'oz hajmi (80 mm, 58 mm, A4), QR kod, avto chop.
  Manzil va telefon bu yerda takrorlanmaydi — bitta joy, "Markaz sozlamalari". Sozlash joyi — `/payment-settings`
  ichidagi "Chek" kartasi (`settings.receipt` ruxsati; sahifa to'lov turlari uchun ham shu ruxsatni ishlatardi),
  yonida jonli ko'rinish.
- **Chek sahifasi.** Chek varag'ini bitta komponent chizadi (`receipt-sheet.tsx`): haqiqiy chek va sozlamalardagi
  jonli ko'rinish bir xil chiqadi. Qog'oz hajmi `@page` qoidasini (`size: 80mm auto; margin: 0`, A4 — `A4`) va varaq
  kengligini belgilaydi; 58 mm da matn bir pog'ona kichik. Avto chop — `print-button.tsx` ochilganda bir marta.
- **QR kod.** Haqiqiy QR hosil qilish uchun `qrcode-generator` kutubxonasi qo'shildi (kichik, bog'liqliksiz); varaq
  SVG yo'li sifatida chiziladi (`lib/qr.ts`), oq fonda qora kataklar — qorong'i temada ham skanerlanadi. Havola
  kiritilmagan bo'lsa QR chiqmaydi, sozlamada shu haqda izoh va "Markaz sozlamalari"ga havola turadi.
- **Jurnal.** Har saqlash `settings.update` (`type: "setting"`, id `center` yoki `receipt`) bilan oldingi va yangi
  qiymatni yozadi. Yozish `lib/server/center.ts` dagi `putSetting` orqali: o'qish va yozish bitta so'rovlar
  ketma-ketligi, ko'p jadvalli amal emas, shuning uchun RPC kerak emas.

## Qanday tekshirildi

- Vitest: sxema, havolalarni to'g'rilash, ish kunlari yozuvi, aloqa ko'rinishi, QR manzili, `@page` qoidasi, QR yo'li.
- `center.db.test.ts`: saqlanmagan bo'lsa standart, saqlash va qayta saqlashda oldingi qiymat, boshqa mijoz ko'rmaydi
  (`TENANT_TEST_ADMIN_URL` bo'lmasa o'tkaziladi).
- Skrinshotlar: `/settings` light, dark va 390 px; chek kartasi 80 mm, 58 mm va A4.

## Oqibatlari

- **Yangi bog'liqlik:** `qrcode-generator` (`apps/edu-crm`).
- **Cheklov:** `@page { size: 80mm auto }` ni brauzerlar turlicha qo'llaydi; to'g'ri chiqmasa printer drayverida
  qog'oz hajmini tanlash kerak. Chop etish haqiqiy termoprinterda sinalmagan.
- **QR mazmuni:** hozir faqat markaz havolasi. Chekni tekshirish sahifasi (QR orqali chek haqiqiyligini ko'rish)
  qurilmadi — kerak bo'lsa alohida paket.
- **Dars jadvali tekshiruvi** (ish vaqtidan tashqari dars qo'yilganda ogohlantirish) hali yo'q; ish vaqti
  `CenterSettings` da tayyor turibdi.
