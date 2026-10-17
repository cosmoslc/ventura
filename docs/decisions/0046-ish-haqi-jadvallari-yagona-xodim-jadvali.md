# 0046. edu-crm: Ish haqi va Maosh hisob-kitob jadvallari — yagona xodim jadvali

2026-10-16 · qabul qilingan · EDU-CRM-FIXES 5.3

## Vaziyat

"Ish haqi" sahifasining ikkala jadvali (Ish haqi ro'yxati, Maosh hisob-kitobi) oddiy `Table` bilan yozilgan edi: ism
avatarsiz, ustunlar zich, harakatlar alohida ikonka tugmalar, jami qatori yo'q. "O'qituvchilar" sahifasi jadvali esa
avatar, ism havolasi va ikkinchi qator bilan ancha toza. Eski tizimda (SalariesPage.jsx) ham ism profilga olib borardi.

## Qaror

- **Yangi umumiy komponent:** `app/(crm)/people-table.tsx` — `PeopleTable` (karta ichida jadval, avatar + ism + qisqa
  qator birinchi ustunda, qolgan ustunlar `columns` bilan, ixtiyoriy `total` jami qatori, `header`/`footer`/`empty`,
  tor ekranda karta ichida gorizontal siljish) va `PersonCell`; `NUM` — pul ustuni klassi (o'ngda, tabular raqamlar).
  `student-table.tsx` ga tegilmadi (boshqa ish); `teachers-view.tsx` ham o'zgarmadi: uning ism katagi filial belgisi
  va telefon ikonkasi bilan, ikki xil jadvali bor — ko'rinishni bir xil saqlab ko'chirish foyda bermaydi.
- **Ish haqi ro'yxati:** ustunlar — Xodim, Sana, Turi (ostida oy), Summa (o'ngda, jarima qizil "−", bekor qilingani
  chizilgan), To'lov usuli (ostida kim kiritgani), Izoh, amallar. "Oy" va "Kiritgan" alohida ustunlar emas, ikkinchi
  qatorga ko'chdi; turi uchun rangli badge o'rniga oddiy matn. Tahrirlash / bekor qilish / tiklash — qatordagi uch nuqta
  menyusida (O'qituvchilar sahifasidagidek).
- **Maosh hisob-kitobi:** Xodim (ostida lavozim · telefon; lavozim alohida ustun emas), Hisoblash turi, Hisoblangan,
  Bonus/jarima, Avans, Jami berilgan, Qoldiq — hammasi o'ngda, nol qiymatlar "—". Qoldiq rangi: qarz — qizil, ortiqcha
  berilgan — sariq, yopilgan — yashil. Pastda **"Jami" qatori** (yangi): ustunlar yig'indisi (bir nechta qator bo'lsa).
  "To'lash" tugmasi saqlandi.
- **Profilga havola (eski tizimdan):** ism o'qituvchi uchun `/teachers/<id>` (hisob-kitobda tanlangan oy bilan
  `?oy=`), xodim uchun `/staff/<id>`. Havola faqat o'qituvchilar bo'limi yoqilgan va xodimda tegishli sahifa ruxsati
  (`PAGE_ACCESS`) bo'lsa chiqadi, aks holda ism oddiy matn.
- **Tablardagi sanoq:** ro'yxatda bekor qilinmagan yozuvlar, hisob-kitobda xodimlar soni (eski tizimdagidek).
- Toza yordamchilar `salaries/helpers.ts` da (`personHref`, `remainingState`, `signedAmount`, `sumBalances`),
  testlari `helpers.test.ts`.

## Eski tizimdan olinmaganlar

- "Tr" tartib raqami ustuni — umumiy jadvalda yo'q (ADR 0042 bilan bir xil qaror).
- Chek chop etish (kassa chiqim orderi) — alohida vazifa; hozirgi ish haqi yozuvlari uchun chek shabloni yo'q.
- Maosh turi filtrida to'lov usullari aralash — bu yerda "Turi" filtri faqat yozuv turlarini ajratadi.

## Hisob-kitobga tegilmadi

`lib/payroll.ts`, `lib/server/payroll.ts`, amallar va ruxsatlar o'zgarmadi — faqat ko'rinish.
