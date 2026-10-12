# 0015. edu-crm E3a: o'quvchi hisobi, to'lovlar, chegirma va qarzdorlar

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E3 (birinchi qism)

## Vaziyat

Eski tizimda (cosmoslc) oylik to'lov va qarz brauzerda har sahifa ochilganda qayta hisoblanar edi. Bir xil qarz
12 xil formula bilan hisoblanar edi (Qarzdorlar, o'quvchi profili, ro'yxat, bosh sahifa, to'lov oynasi...).

To'lovlar bilan bog'liq muammolar:

- `payments.amount` ba'zan naqd pul, ba'zan balansdan olingan qism edi.
- Ortiqcha to'lov balansga tushmas, o'tgan oy qarzi yo'qolar edi.
- Qaytarish balansdan oshishi mumkin edi.
- To'lovni o'chirish va tahrirlash balansni to'g'irlamas edi.

Muzlatish va narx bilan bog'liq muammolar:

- Muzlatish butun oyni bekor qilar edi.
- Muzlatishdan chiqqanda o'tgan oylar qayta hisoblanar edi.
- Narx o'zgarsa butun tarix yangi narxda qayta hisoblanar edi.
- Bayram darsi oylik to'lovdan chiqmas edi, holbuki ekranda "chiqadi" deb yozilgan edi.

Sana va boshqa muammolar:

- Oy UTC bo'yicha olinar edi: Toshkentda soat 00:00–05:00 oralig'ida o'tgan oy chiqar edi, "o'tgan oy" esa ikki oy
  orqaga ketar edi.
- Chek ma'lumotlari bo'sh chiqar edi.

Saidakbar qarorlari (2026-10-12):

- **Qarz yig'iladi.** O'quvchining bitta balansi bor, ortiqcha to'lov keyingi oyga o'tadi.
- **Hisoblash usuli sozlamada tanlanadi.** Standart — oylik.
- **Narx tanlangan oydan amal qiladi.**
- **Menejer KPI** shu oydagi yangi o'quvchilar bo'yicha hisoblanadi (E3c).

## Qaror

### Bitta formula (`lib/billing.ts`, toza funksiyalar, Vitest)

**Oylik rejim:** summa = round(chegirmali narx × (hisobdagi darslar − sababli) / oydagi darslar).

- "Oydagi darslar" — guruh kunlariga tushgan barcha sanalar, bayramlar ham kiradi.
- "Hisobdagi darslar" — quyidagi shartlarga mos darslar:
  - guruh boshlangan va a'zo faollashtirilgan kundan;
  - chiqqan kungacha (chiqqan kun kirmaydi);
  - muzlatilgan oraliqlarsiz;
  - "darslarga ta'sir qiladigan" bayramlarsiz.
- Natijada bayram darsi to'lovdan chiqadi.
- Sababli dars chiqarilishi sozlamada o'chiriladi.
- Hisob faqat bitta yaxlitlash bilan qilinadi. Eski tizim dars narxini alohida yaxlitlab xato yig'ar edi.

**Dars rejimi:** summa = round(chegirmali narx × to'lanadigan darslar / oydagi darslar).

- To'lanadigan darslar — davomatda "bor", "kech" yoki "sababsiz yo'q" deb belgilangan darslar.
- Belgilanmagan dars to'lanmaydi.

**Hisoblanadigan oylar:** faollashtirilgan oydan chiqqan oygacha, ko'pi bilan joriy oygacha. Joriy oy to'liq
hisoblanadi, chunki to'lov oy boshida olinadi. Sinovdagi a'zo hisoblanmaydi.

**Chegirma:**

- Chegirmalar asosiy narxdan qo'shilib ayiriladi, so'ng yaxlitlanadi, natija 0 dan pastga tushmaydi (eski tizimdagidek).
- Oylar oralig'i va guruhi bilan beriladi.
- "O'qituvchi ulushiga ta'sir qilmaydi" belgisi E3c'da ishlatiladi.

### Tarixni barqaror saqlash

Oylik hisoblar bazada saqlanmaydi: har safar bitta funksiya kirishlardan hisoblaydi. Hisobga kiradigan har narsa
saqlanadi:

- **`group_prices`** — narx tarixi.
  - Narx o'zgarsa guruh formasida "qaysi oydan" so'raladi: joriy oy yoki guruh boshlangan oydan keyingi o'tgan oy.
  - Shu oydan keyingi qadamlar almashtiriladi.
  - Tarix yo'q (eski) guruh uchun guruhning narxi "boshidan" (`0000-01`) amal qiladi.
- **`membership_pauses`** — muzlatish oraliqlari [boshlanish, tugash).
  - Ular guruh, o'quvchi holati va guruhdan chiqish oqimlarida yoziladi.
  - Oraliq yozuvi bo'lmagan eski muzlatish `paused_at` dan hisoblanadi.
- **`student_discounts`** — chegirma oylari.
- Bayramlar va davomat (E2).

### Hisob (`lib/ledger.ts`)

**Yozuvlar** (`payments`):

| Tur | Ta'siri | Izoh |
| --- | --- | --- |
| to'lov | + | chek raqami mijoz bo'yicha ketma-ket (qulf bilan) |
| qaytarish | − | |
| bir martalik chegirma | + | pul emas |
| tuzatish | ± | `students.balance_edit`, sabab bilan |

**Balans** = yozuvlar − oylik hisoblar. Manfiy balans — qarz.

**Oylar holati** eng eski oydan to'ldiriladi:

1. Guruhga belgilangan pul avval shu guruh oylarini yopadi.
2. Ortiqcha pul va guruhsiz pul qolgan oylarni oy tartibida yopadi.

Yopilmagan oylar + "boshqa qarz" har doim −balansga teng. Bu 5000 ta tasodifiy holatda tekshirilgan.

**Yozuv o'chirilmaydi, bekor qilinadi** (kim, qachon, sabab). Bekor qilingan yozuv tiklanadi. Tahrirlash va bekor
qilish balansni o'zi to'g'rilaydi, chunki hisob yozuvlardan olinadi. Ikkala amal tarixga yoziladi.

**Pul amallari** o'quvchi bo'yicha qulf ostida tranzaksiyada bajariladi.

- Qaytarish faqat ortiqcha pul doirasida qilinadi. Bu tekshiruv qulf ichida, shuning uchun parallel qaytarish balansdan
  oshmaydi.
- Tiklangan qaytarish ham balansdan oshmaydi.

### Ko'rinish

- **To'lovlar** (`/payments`):
  - KPI: tushum, qaytarilgan, sof tushum, bugun.
  - To'lov turlari bo'yicha summa.
  - Filtrlar: sana, tur, to'lov turi, guruh, qidiruv, bekor qilinganlar.
- **To'lov oynasi:**
  - O'quvchi va uning hozirgi hamda keyingi balansi ko'rinadi.
  - Guruh tanlanganda yopilmagan oylar ko'rinadi, eng eski oy va guruh qarzi taklif qilinadi.
  - Bir martalik chegirma beriladi; chegaradan oshsa ogohlantiriladi.
  - Saqlangach chek chiqadi.
- **O'quvchi profili, "To'lovlar" tabi:**
  - Balans, guruhlar bo'yicha oylar jadvali: darslar, narx, hisoblandi, yopildi, qoldiq, holat.
  - Doimiy chegirmalar va pul yozuvlari.
  - Amallar: to'lov, qaytarish, chegirma, tuzatish, tahrirlash, bekor qilish, tiklash, chek.
- **Qarzdorlar** (`/debtors`):
  - Barcha oylar bo'yicha qarz, yopilmagan oylar, kechikkan kunlar. To'lov muddati sozlamada, standart — 10-sana.
  - KPI kartalari, guruh va o'qituvchi filtri, saralash, "To'lash".
- **Boshqa joylar:**
  - O'quvchilar ro'yxatida balans.
  - Guruh profilida shu oy hisoblangan, shu oy uchun to'langan va guruh qarzi.
  - Guruhdan chiqarish oynasida chiqqandan keyingi balans: ortiqcha pulni qaytarish mumkin, qarz qoladi.
- **Chek:**
  - Markaz va filial nomi, chek raqami, o'quvchi, guruh, kurs, oy, to'lov turi, qabul qilgan xodim.
  - Menyusiz sahifa (`/payments/<id>/receipt`).
- **To'lov sozlamalari** (`/payment-settings`):
  - To'lov turlari (faolsizlantiriladi, o'chirilmaydi).
  - Hisoblash usuli, sababli dars, to'lov muddati, chegirma chegarasi.

### Ruxsatlar (eski katalog)

| Amal | Ruxsat |
| --- | --- |
| Qabul qilish va qaytarish | `finance.payment_create` |
| Tahrirlash va doimiy chegirma | `finance.payment_edit` |
| Bekor qilish | `finance.payment_delete` |
| Tiklash | `finance.payment_delete` yoki `archive.restore` |
| Tuzatish | `students.balance_edit` |
| Chek | `finance.payment_receipt_print` |
| To'lov turlari | `settings.receipt` |
| Hisoblash usuli | `settings.courses` |

### Sinov

- **Vitest, toza funksiyalar:** qo'lda hisoblangan misollar.
  - Oylar: kech faollashish, bayram, sababli, muzlatish, chiqish, guruh oy o'rtasida boshlanishi, uch oylik hisob.
  - Narx tarixi, chegirmalar, dars rejimi.
  - Hisob: yig'ilish, ortiqcha pul, guruhlararo, guruhsiz to'lov, qaytarish, tuzatish.
  - 5000 holatli tasodifiy sinov.
- **Haqiqiy PostgreSQL** (`finance.db.test.ts`; CI'dagi "mijoz bazasi" vazifasi):
  - Bazadagi yozuvlardan shu natijalar chiqadi.
  - Muzlatish tarixi muzlatishdan chiqqandan keyin ham saqlanadi.
  - Bekor qilish CHECK bilan himoyalangan.
  - Boshqa mijoz ma'lumoti ko'rinmaydi.

## Oqibatlari

- E3c (maosh) o'qituvchi ulushini shu yozuvlar va `discountedPrice(..., { teacherOnly })` dan hisoblaydi.
- E3d tasdiq so'rovlari shu server amallarini o'raydi.
- Moliyaviy hisobotlar (E5) shu hisob funksiyalaridan foydalanadi, alohida formula yozilmaydi.
- Eski tizimdagi "Balansdan to'lash" tugmasi kerak emas: balansdagi pul eng eski oyni o'zi yopadi.
