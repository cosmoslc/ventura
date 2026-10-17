# 0047. edu-crm: guruh profili — eski CRMdan o'tkazildi va yaxshilandi (EDU-CRM-FIXES 3.1)

2026-10-16 · qabul qilingan · docs/EDU-CRM-FIXES.md (3.1), ADR 0014, 0015, 0028, 0031, 0042

## Vaziyat

Eski CRM guruh profili (`GroupProfilePage.jsx`) quyidagilarni bergan: sarlavha (guruh rangi, nomi, kursi, "Faol guruh"
va hisob rejimi belgilari, "To'lov qabul qilish" va "Guruhni tahrirlash"), 7 ta kartochka (o'qituvchi, xona va sig'im,
dars vaqti, kunlari, kutilayotgan va yig'ilgan pul, o'quvchilar soni), ikki tab (O'quvchilar, Davomat), o'quvchilar
jadvali (qidiruv, "to'langan/qarzdor" filtri, tanlab guruhdan chiqarish, shu oy to'lovi va "To'lab qo'yish", sinovdan
faollashtirish, chiqarish), Telegram kanal maydoni va kunma-kun davomat. Kamchiliklari: kartochkalarda qattiq yozilgan
qiymatlar ("90 daqiqa", "Haftada 3 kun", sig'im 20), qarz faqat joriy oy bo'yicha, ortiqcha to'lov ko'rinmasdi,
davomat foizi a'zo qatorida yo'q edi, chiqqanlar tarixi yo'q edi, jadval va tugmalar bezakli belgilarga to'la edi.

Yangi CRMdagi profil allaqachon a'zolik (sinov/faol/muzlatilgan), chiqarish sababi, davomat jurnali va guruh
moliyasini bergan, lekin 9 ta bir xil kartochka, o'quvchilar jadvali (ism, telefon, jins, sana) va a'zo bo'yicha pul
yoki davomat ma'lumoti yo'q edi.

## Qaror

**Joylashuv (yuqoridan pastga):**

1. Sarlavha: orqaga, guruh rangi, nom, ostida kurs nomi. O'ngda: "To'lov qabul qilish" (to'lov yozish ruxsati va
   to'lovlar bo'limi bo'lsa), "Guruhni tahrirlash", guruhni o'chirish (arxivga; `groups.delete`, sabab ro'yxati bilan).
2. Bitta karta, ikki qator, bezaksiz yorliq + qiymat + bitta xira qator: **ma'lumot** (o'qituvchi — profilga havola,
   xona, dars kunlari, vaqti va daqiqasi, kurs davri `boshlanish — tugash` va oylari, oylik narx) va **ko'rsatkichlar**
   (o'quvchilar `n / sig'im` va to'lish chizig'i, faol/sinov/muzlatilgan taqsimoti; shu oy yig'ilgan va hisoblangan
   bilan foizi; guruh bo'yicha qarz va nechta o'quvchida; so'nggi 30 kun davomati). Moliya yoki davomat bo'limi
   o'chiq bo'lsa tegishli ko'rsatkich chiqmaydi. Izoh bo'lsa — karta ostida.
3. Tablar: **O'quvchilar** (soni bilan), **Chiqqanlar**, **Davomat**.

**O'quvchilar tabi** — `student-table.tsx` dagi umumiy `StudentsTable` (ADR 0042), ya'ni "O'quvchilar" sahifasi uslubi:
avatar, ism (profilga havola), telefon va ota-ona; ustunlar: **Holat** (sinov/faol/muzlatilgan va shu holat sanasi),
**Qo'shilgan**, **Shu oy** (to'langan / qisman, qancha qolgani / to'lanmagan — rangli matn, bezaksiz), **Qarz**
(yopilmagan oylar qoldig'i va oylar soni), **Davomat** (so'nggi 30 kunda foiz va `kelgan/belgilangan`), **Amallar**.
Ustun ochilmagan holatlar: moliya ko'rinmasa pul ustunlari, Davomat o'chiq bo'lsa davomat ustuni yo'q.
Filtr qatori — umumiy `FilterBar`: qidiruv (ism, ota-ona, telefon), holat filtri (barchasi, faol, sinovda,
muzlatilgan, qarzdorlar), saralash (ism, qo'shilgan sana, qarz, davomat — pasti birinchi), natija soni.

**Qator amallari** (mavjud amallar, o'zgarishsiz): sinovdagiga "Faollashtirish" (sana bilan), qarzi borga "To'lov"
(mavjud `PaymentDialog`, o'quvchi va guruh oldindan tanlangan), uch nuqta menyusi — profil, to'lov, muzlatish va
muzlatishdan chiqarish, guruhdan chiqarish (sana va sabab bilan, balans oldindan ko'rinadi). **Tanlab guruhdan
chiqarish** (eski profildagidek) — mavjud `leaveStudentsAction` (bitta tranzaksiya, bir sana va sabab); pastdagi
`SelectionBar` va yangi `BulkLeaveDialog`.

**Chiqqanlar tabi** — shu `StudentsTable`: qo'shilgan, chiqqan sana, necha kun o'qigani, sabab va izoh. **Davomat
tabi** — oldingi jurnal; o'quvchi katagi ham umumiy `StudentCell` (avatar, ism, telefon), "№" va "Telefon" ustunlari
olib tashlandi.

**Ma'lumot (faqat o'qish):** `groupProfileStats` (`groups/data.ts`) guruh a'zolarining hisobini `loadAccounts` bilan
**bir marta** yuklaydi; kartalar ham, qatorlar ham shundan hisoblanadi (oldin `groupFinance` alohida yuklardi). Sof
hisoblar `lib/group-profile.ts` da (testlari bilan): a'zoning guruh bo'yicha puli (`memberMoney`), shu oy holati,
davomat foizi (belgilangan darslardan, jurnal qoidasi bilan bir xil), filtr/saralash, kurs tugash sanasi. Sahifa
ma'lumotini yig'ish `groups/profile-data.ts` ga ko'chirildi (sahifa va dev ko'rinishi uchun bitta joy).
Yozuvlar faqat mavjud amallar orqali; yangi pul qoidasi, RPC yoki migratsiya yo'q.

## O'tkazildi

Sarlavha ma'lumoti (o'qituvchi, xona, vaqt, kunlar), "To'lov qabul qilish", tahrirlash, o'quvchilar jadvali, qidiruv,
to'langan/qarzdor filtri (endi qarzdorlar), o'quvchi qo'shish (mavjud va yangi), sinovdan faollashtirish, guruhdan
chiqarish, tanlab chiqarish, kutilayotgan/yig'ilgan pul (endi shu oy hisoblangan/yig'ilgan va jami qarz), o'quvchilar
soni va sig'im, davomat tabi (kunlar, holatlar, sabab, "hammasini Bor qilish").

## O'tkazilmadi

- **Telegram kanal va bot maydoni** — Telegram/SMS tizimi qurilmaydi (EDU-CRM-PLAN 8); jadvalda ustuni ham yo'q.
- **"Faol guruh" va hisob rejimi belgilari** — bezak edi; hisob rejimi butun markaz sozlamasi (Moliya), guruhniki emas.
- **Jins ustuni** — foydasiz; kerak bo'lsa o'quvchi profilida. Ota-ona ismi telefon qatorida.
- **Guruhdan guruhga ko'chirish** — hozir alohida amal yo'q (chiqarish va boshqasiga qo'shish ikki bosqich); bitta
  tranzaksiyali amal alohida topshiriq (migratsiya shart emas, lekin pul/hisob qoidalarini ko'rib chiqish kerak).
- **Guruhga bir nechtasini birdan qo'shish** — `enrollStudentsAction` bor, lekin profildagi qidiruvli oyna hozircha
  bittalab qo'shadi.

## Oqibatlari

- Guruh profili yangi o'quvchilar jadvalini ishlatadi; ustun qo'shish `group-members.tsx` ning `columns` ro'yxatiga.
- Qator pulidagi "Qarz" — yopilmagan oylar yig'indisi (umumiy balansdagi guruhsiz to'lovlar hisobga olingan), shuning
  uchun u "Qarzdorlar" sahifasidagi shu guruh qutisi bilan bir xil son beradi.
- Davomat foizi 30 kun bilan cheklangan (`ATTENDANCE_DAYS`): eski, uzoq vaqt oldingi yo'qlik hozirgi holatni
  yashirmasin. To'liq tarix — Davomat tabidagi oylik jurnalda.
- Profil har ochilganda bir marta hamma a'zolarning hisobi yuklanadi (chiqqanlar ham — ularning qarzi guruh qarziga
  kiradi); juda katta guruhlarda sekinlashsa, hisobni keshlash alohida masala.
