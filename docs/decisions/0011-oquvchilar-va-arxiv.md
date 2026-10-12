# 0011. edu-crm E1c: o'quvchilar va arxiv

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E1 (uchinchi qism)

## Vaziyat

Eski tizimda (cosmoslc) o'quvchi kartochkasida balans, coin, guruh a'zoligi, eslatmalar va parol bir joyda saqlanadi.
Balans "saqlangan son + joriy oy qayta hisobi" bilan ko'rsatilgani uchun qarz va ortiqcha to'lov ikki marta sanalar
edi; muzlatish hisobni to'xtatmas edi; profil va arxivda o'ylab topilgan qiymatlar bor edi (o'qituvchi
"Shaxzod Odilov", dars vaqti "13:30 - 15:30", demo imtihonlar, xaridlar va SMS, filial "Chilonzor").

## Qaror

### Ma'lumot

- `students`: filialga kompozit FK, ism, telefon (+998), ota-ona ismi va telefoni, tug'ilgan sana, jins, maktab,
  sinf, manzil, manba, qiziqqan kursi (kursga kompozit FK), izoh, holat va uning sababi, o'qishni boshlagan sana.
- **Holatlar** eski tizimdagidek: sinovda (yangi o'quvchi), faol, muzlatilgan, ketgan, qaytib kelgan, bitirgan.
  Muzlatish va undan chiqarish — `students.freeze` ruxsati, qolganlari — `students.edit`. Har o'zgarish sababi
  bilan jurnalga yoziladi.
- **Balans, coin va guruh a'zoligi bu jadvalda yo'q.** A'zolik davrlari (E1d) va to'lovlar (E3) o'z jadvallarida;
  balans ulardan hisoblanadi, shuning uchun ikki marta sanash bo'lmaydi. Ro'yxatdagi "Balansi" va profildagi
  "To'lovlar" hozircha "—" va izoh.
- **Parol yo'q:** o'quvchi portali rejaga kirmaydi (1-qaror). Eski tizim parolni ochiq matnda saqlar edi.
- Telefon faol o'quvchilar orasida takrorlanmaydi (arxivdagi bilan to'qnashmaydi; tiklashda tekshiriladi).
- `student_notes`: "Eslatma" tabi — izoh turi (qo'ng'iroq, SMS/Telegram, ota-ona bilan suhbat, natija, eslatma,
  ogohlantirish), matn, muallif (haqiqiy xodim, "Menejer" emas).
- **"Tarix" tabi faoliyat jurnalidan** (`audit_events`, nishon `student`): qo'shilgan, tahrirlangan, holat
  o'zgarishlari, eslatmalar, arxiv va tiklash — kim va qachon bilan.

### Arxiv

- "O'chirish" — arxivga (`archived_at`, sabab, kim). Eski tizimdagidek "Arxiv" sahifasi: o'quvchilar, kurslar
  (ADR 0008 dagi arxivlangan kurslar) va o'qituvchilar; qidiruv, tiklash (`archive.restore`).
- Butunlay o'chirish (`archive.permanent_delete`) faqat arxivdagi o'quvchi uchun; keyingi bo'limlarda bog'liq
  yozuv (a'zolik, to'lov) bo'lsa FK rad etadi va tarix yo'qolmaydi.

### Keyinga qoldi

- Guruhga qo'shish, guruhdan chiqarish, ommaviy amallar, guruh va o'qituvchi filtrlari — E1d.
- Balans, qarzdorlik filtri, to'lov, chegirma, qaytarish — E3. SMS, coin, imtihon, xaridlar — 10-qaror.
- Excel import va eksport — E1e. Rasm — fayl saqlash qo'shilganda (eski tizim base64 ni bazaga yozar edi).
