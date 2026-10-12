# 0010. edu-crm: lavozimlar, ruxsatlar va xodimlar

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E1 (ikkinchi qism), 14-qaror

## Vaziyat

9-qaror tayyor rollarni (direktor, menejer, kassir, kuzatuvchi) nazarda tutgan edi. Eski tizimda (cosmoslc) esa direktor
lavozim yaratadi va har ruxsatni alohida yoqadi; markaz shunga o'rgangan. 13-qaror (bir xil bo'lsin) bilan birga
Saidakbar 14-qarorni qabul qildi: ruxsatlar lavozimlar orqali, eski tizimdagidek.

## Qaror

### Ruxsatlar katalogi

- `packages/auth/src/staff/permissions.ts` — eski tizimdagi 11 toifa va 69 ruxsat (id va nomlari bir xil) hamda 7 ta
  shablon (Bosh Direktor, Filial Menejeri, Katta Administrator, O'qituvchi, Buxgalter, Sotuv, HR).
- Tekshiruv bitta: `can(access, "staff.edit")`. `StaffAccess` = direktor belgisi + ruxsatlar to'plami.
- Sahifa qaysi ruxsat bilan ochilishi — `apps/edu-crm/lib/access.ts` (eski `PAGE_PERMISSION_MAP` mantiqi: birortasi
  yetadi). Menyu ham shu ro'yxat bo'yicha qisqaradi; ro'yxatda yo'q sahifa faqat direktorga.
- Server amali `crmAction(feature, permission | permission[], ...)` — ruxsatsiz amal yozib bo'lmaydi.

### Ma'lumot

- `positions` (nom, rang, `permissions text[]`, `system`) va `user_positions` (ko'p-ko'pga, kompozit FK). Xodimning
  ruxsatlari — lavozimlari ruxsatlarining birlashmasi. Ruxsat har so'rovda bazadan o'qiladi: lavozim o'zgarsa, keyingi
  so'rovdan kuchga kiradi.
- `users.role`: `director` (hammasi, panel deployda yaratadi) yoki `staff` (ruxsat lavozimdan). Eski `manager`,
  `cashier`, `viewer` birinchi so'rovda mos lavozimga ko'chiriladi (`ensurePositions`): Filial Menejeri, Buxgalter,
  "Kuzatuvchi" (faqat ko'rish ruxsatlari).
- Xodim kartochkasi `users` da: jins, tug'ilgan sana, manzil, maosh turi (`fixed` / `kpi`) va summalar, izoh,
  qo'shimcha maydonlar (`custom_data`), `archived_at` (bo'shatilgan — kira olmaydi, tarixi qoladi).
- "Xodim formasi" maydonlari — `settings` jadvalida `staff.form_fields` kaliti; qiymatlar xodimning `custom_data` sida.

### Ruxsat oshirishga yo'l yo'q

- Direktor bo'lmagan xodim lavozimga o'zida yo'q ruxsatni qo'sha olmaydi va bunday lavozimni xodimga bera olmaydi.
- O'zidan kuchliroq (ruxsatlari ko'proq) xodimni tahrirlay, bloklay, parolini tiklay olmaydi — hisobni egallab
  olishning oldi olinadi.
- Lavozim, filial va maoshni faqat "Lavozim va ruxsatlarni biriktirish" ruxsati bilan, o'zinikini hech qachon.
- Filial cheklovi bor xodim faqat o'z filiallaridagi xodimlarni ko'radi va faqat o'z filiallarini beradi.
- "Bosh Direktor" lavozimi (tizim) o'zgarmaydi va o'chmaydi; xodimi bor lavozim o'chmaydi.

### Eski tizimdan farqlar

- **Parol formada yozilmaydi.** Yangi xodimga va "Parolni tiklash" da vaqtinchalik parol yaratiladi va bir marta
  ko'rsatiladi; xodim birinchi kirishda almashtiradi va Telegramni ulaydi (panel bilan bir xil).
- **Soxta raqam yo'q.** Eski tizim jinsni ismdan taxmin qilar edi va KPI fondini o'quvchi soniga qarab hisoblar edi.
  Yangi tizim faqat kiritilgan jinsni sanaydi; "KPI asosiy oklad fondi" — KPI xodimlarining asosiy okladi. KPI va
  bonus hisobi, balans va maosh to'lovlari — E3 (Moliya) bilan.
- Bloklash, Telegramni qayta ulash va bo'shatish — xodim menyusida; har biri jurnalga yoziladi, xavfli amallar
  haqida direktorlarga Telegram xabari boradi.

### O'qituvchilar (ustozlar)

- Alohida `teachers` jadvali: o'qituvchi tizimga kirmaydi (o'qituvchi portali rejaga kirmaydi, 1-qaror), shuning
  uchun parol va rasm yo'q. Filialga kompozit FK bilan bog'lanadi, `kind`: `teacher` yoki `support`.
- Maosh turi eski tizimdagidek: tushumdan foiz, har o'quvchi uchun summa yoki oylik; faqat tanlangan turning summasi
  saqlanadi. Support o'qituvchi — oylik, ish kunlari va vaqti, biriktirilgan ustoz (o'z jadvaliga kompozit FK).
- Ruxsatlar "Xodimlar va O'qituvchilar (HR)" toifasidan: qo'shish `staff.create`, tahrirlash `staff.edit`,
  o'chirish `staff.delete`. O'chirish — arxiv (`archived_at`); support biriktirilgan ustoz o'chmaydi.
- Eski tizimdagi soxta qiymatlar ko'chirilmadi: "O'rtacha retention" formulasi (reytingdan o'ylab topilgan), reyting
  5.0 standarti, ish vaqti bo'lmasa "09:00 - 18:00", ismida "assistent" bo'lsa support deb sanash, ishlamaydigan
  "SMS yuborish". Ma'lumot bo'lmagan ustunlar "—" ko'rsatadi.
- Guruhlar, o'quvchilar, "Jami ulush" va maosh to'lovlari (Ish haqi va to'lovlar tabi, Maosh berish) guruhlar (E1d)
  va moliya (E3) bilan; Excel import va eksport — E1e.

## Oqibatlari

- Keyingi bo'limlar o'z sahifa ruxsatini `lib/access.ts` ga qo'shadi va amallarini katalogdagi ruxsat bilan yopadi.
- "Tasdiq" (ruxsat so'rash) oqimi E3 da; hozir ruxsat yo'q bo'lsa amal shunchaki rad etiladi.
