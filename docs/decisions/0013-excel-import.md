# 0013. edu-crm E1e: Excel import va eksport

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E1 (beshinchi qism), 10-qaror (Excel import kiradi)

## Vaziyat

Eski tizimda (cosmoslc) import "Excel Boshqaruv Markazi" oynasida: fayl brauzerda o'qiladi (SheetJS 0.18.5 — npm
versiyasida ma'lum zaifliklar bor), ustunlar sarlavhadan taniladi, qatorlar bittadan saqlanadi. Muammolar:
xato yozilgan guruh va xona avtomatik yaratilar edi; guruh nomidagi vergul nomni bo'lar edi; o'qituvchi importi
mavjud guruhlarning o'qituvchisini almashtirar edi; "390000.50" narx 39000050 bo'lar edi; telefon 7 belgidan
qabul qilinar edi; o'rtada xato bo'lsa yarim import qolar edi; eksport sarlavhalari ("Cost", "Guruhlar soni")
qayta importda boshqa maydonga tushar edi; cheklov yo'q edi.

## Qaror

- **Kutubxona — exceljs (serverda).** Fayl server amaliga yuboriladi: faqat .xlsx va .csv, 2 MB va 2000 qator
  cheklovi, birinchi varaq. Kataklar matnga (sana — YYYY-MM-DD, UTC qismlaridan).
- **Oqim eski tizimdagidek:** fayl → filial → ustunlarni moslash (sarlavhadan avtomatik, "1-qator sarlavha",
  "Ustunlarni qayta aniqlash", qatorni olib tashlash) → "Tekshirish" (har qator holati) → "Bazaga qo'shish (N)".
  Moslash yoki qatorlar o'zgarsa qayta tekshiriladi.
- **Yozish — bitta tranzaksiyada:** to'g'ri qatorlar yo hammasi saqlanadi, yo hech biri. Har yaratilgan yozuv
  o'z tarixiga (`student.create` va h.k., `import: true`), umumiy natija — `import.<jadval>` jurnal yozuvi.
- **Qoidalar** (`lib/excel.ts`, Vitest bilan):
  - telefon: 9 raqam, +998…, 998…, 0… — boshqasi xato;
  - sana: YYYY-MM-DD, DD.MM.YYYY, DD/MM/YYYY, Excel seriya raqami; mavjud bo'lmagan sana xato;
  - pul: bo'shliq/vergul minglik, kasr qismi tashlanadi;
  - kunlar: "Du, Chor, Jum", "Toq/Juft", inglizcha; vaqt: "14:00 - 16:00" (tugash bo'lmasa +90 daqiqa).
- **Moslashtirish faqat aniq:** guruh, kurs, o'qituvchi, xona nomi bo'yicha (katta-kichik harf, apostrof va
  ism-familiya tartibidan qat'i nazar). Topilmasa — qator "topilmadi" xatosi bilan qoladi, hech narsa avtomatik
  yaratilmaydi. Takror telefon (bazada yoki faylda) — xato.
- **O'quvchi:** guruh ko'rsatilsa faol a'zolik, faollashtirish sanasi — "Qo'shilgan sana" (eski tizim har doim
  bugunni yozar edi). Balans ustuni olinmaydi — moliya E3 da.
- **Guruh:** kurs, o'qituvchi, kunlar va vaqt majburiy (jadval qoidasi); narx bo'lmasa kurs narxi; xona va
  o'qituvchi bandligi bazadagi va fayldagi oldingi qatorlar bilan tekshiriladi.
- **O'qituvchi:** maosh "40", "40 [Foiz]", "3 000 000 [Fiks]", "50 000 [O'quvchi]"; guruhlarga tegmaydi.
- **Eksport va namuna** (`/excel/<jadval>`, `?template=1`): sarlavhalar import bilan bir xil — eksport qilingan
  fayl qayta import qilinsa ustunlar o'zi taniladi (bir nechta guruh — nuqtali vergul bilan). Tepadagi filial
  tanlovi va ruxsat (ko'rish) amal qiladi. exceljs satrni har doim matn katagi qilib yozadi — formula yo'q.
- Ruxsat: import — yaratish ruxsati (`students.create`, `groups.create`, `staff.create`; o'quvchini guruhga
  yozish uchun `groups.add_student` ham), eksport — ko'rish ruxsati.

## Oqibatlari

- Lidlar, to'lovlar va boshqa jadvallar importi o'z bosqichlarida shu yordamchilardan foydalanadi.
