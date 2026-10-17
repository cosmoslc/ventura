# 0050. edu-crm: qarzi bor o'quvchini guruhdan chiqarish — qarz bilan yoki qarzdan kechib

2026-10-17 · qabul qilingan · ADR 0012, 0015, 0031

## Vaziyat

Qarzi bor o'quvchi guruhdan chiqarilganda a'zolik yopilardi, qarz esa hisobda qolardi. Natijada:

- dashboard va qarzdorlar sahifasida endi o'qimayotgan o'quvchining qarzi turar edi;
- qarzni undirish yoki kechish bo'yicha aniq qaror yozilmasdi.

Egasining talabi: guruhdan chiqarishda ikki variant bo'lsin.

1. **Qarzdan kechib chiqarish.** O'tgan darslar uchun yozilgan summa kechiladi va arxivda qoladi.
2. **Qarz bilan chiqarish.** Qarz to'lanmaguncha chiqarib bo'lmaydi: o'quvchi muzlatiladi va balans 0 ga
   yetganda guruhdan chiqadi.

## Qaror

**Qarz** — shu sana bilan chiqarilsa shu guruh bo'yicha qoladigan qarz (`groupDebt`).

- Bu guruh oylarining yopilmagan qismi.
- Lekin u umumiy qarzdan ko'p emas: boshqa guruhdagi ortiqcha pul avval shu qarzni yopgan bo'ladi.
- Hisob a'zolik shu sanada chiqqan deb qayta hisoblanadi; oynadagi oldindan ko'rish bilan bir xil.

**Chiqarish rejimi** (`mode`, server amali va oyna):

| Qarz | Rejim | Natija |
|---|---|---|
| yo'q | har qanday | Oddiy chiqarish (avvalgidek) |
| bor | `auto` | Chiqarilmaydi: oyna variant so'raydi; bir nechtasini chiqarishda qarzi borlar guruhda qoladi |
| bor | `forgive` | Qarz `writeoff` yozuvi bilan yopiladi, a'zolik darhol yopiladi |
| bor | `pending` | A'zolik chiqish sanasidan muzlatiladi, `leave_pending_at` belgilanadi |

**Kechilgan qarz — `payments.kind = 'writeoff'`.**

- Bu pul emas: kassa, pul oqimi va daromad hisobotlari faqat `payment`/`refund` ni oladi.
- Balansda u chegirma kabi `+` bo'ladi.
- Hisob-kitoblar o'chirilmaydi. O'quvchi hisobida "Kechilgan qarz" yozuvi qoladi va harakatlar jurnalida
  `payment.writeoff` bo'ladi.
- Kechish uchun guruhdan chiqarish ruxsatidan tashqari **balansni tahrirlash** ruxsati (`students.balance_edit`)
  kerak, yoki direktor tasdig'i.
- Yozuvni bekor qilish ham shu ruxsat bilan.
- Bazada `payments_kind` cheklovi bor.

**Qarz bilan chiqarish (kutish).**

- `status = paused`, `paused_at` = chiqish sanasi (muzlatish oralig'i ochiladi): yangi oylik hisob yozilmaydi.
- `leave_pending_at` = chiqish sanasi; sabab va izoh `left_reason` / `left_note` da.
- Bazada cheklov bor: kutish belgisi faqat muzlatilgan va yopilmagan a'zolikda bo'lishi mumkin.

**Avtomatik chiqish.**

- Har pul amalidan keyin `settlePendingLeaves` qisqa tranzaksiyada o'quvchi qulfi bilan chaqiriladi.
- Bu amallar: to'lov, tuzatish, tahrirlash, tiklash, bekor qilish, chegirma saqlash va o'chirish.
- Shu guruh qarzi 0 bo'lgan kutayotgan a'zoliklar `left_at = leave_pending_at` bilan yopiladi.
- Jurnalda `group.leave` / `student.leave` "qarzi to'langach" bo'lib yoziladi.
- Funksiyani qayta chaqirish natijani o'zgartirmaydi.

**Boshqa yo'llar.**

- **Kutayotgan a'zolikda "Qarzdan kechish".** O'sha chiqarish oynasi ochiladi, sana va sabab o'zgarmaydi.
- **"Muzlatishdan chiqarish".** Kutish bekor bo'ladi va o'quvchi guruhda qoladi.
- **O'quvchining o'zi faol holatga qaytarilganda.** Kutayotgan a'zoliklar muzlatilganicha qoladi.
- **O'quvchi ketgan yoki bitirgan bo'lsa, arxivlanganda, filial almashganda yoki guruh arxivlanganda.** Kutish
  belgisi tozalanadi. Qarz esa avvalgidek hisobda qoladi.

**Sinov.**

- `ledger.test.ts`: `writeoff` balansga ta'siri, kassaga ta'siri yo'qligi, `groupDebt`.
- `leave-debt.db.test.ts` (haqiqiy PostgreSQL):
  - qarz bo'lsa va variant tanlanmasa, o'quvchi chiqarilmaydi;
  - qarz bo'lmasa, oddiy chiqarish;
  - qarzdan kechish;
  - qarz bilan chiqarish: qisman to'lovda kutish davom etadi, to'liq to'lovda chiqadi;
  - kutayotganni keyin qarzdan kechish;
  - baza cheklovi.

## Oqibatlar

- Qarzdorlar va dashboard faqat haqiqiy undiriladigan qarzni ko'rsatadi. Kechilgan qarz hisobotlarda
  "Kechilgan qarz" yozuvi sifatida ko'rinadi.
- "Qarz bilan" chiqarilgan o'quvchi qarzi to'languncha guruh ro'yxatida "Qarz to'languncha" holatida turadi.
  Davomatda u muzlatilgan sifatida ko'rinadi.
- Guruhga bog'lanmagan qarz (masalan, manfiy tuzatish) guruhdan chiqarishda kechilmaydi.
