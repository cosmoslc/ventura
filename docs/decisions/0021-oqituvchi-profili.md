# 0021. edu-crm: o'qituvchi profili

2026-10-13 · qabul qilingan · Saidakbar so'rovi (eski tizimdagi o'qituvchi profili ko'rinishi)

## Vaziyat

E3c dan keyin (ADR 0018) o'qituvchi profilida quyidagilar bor edi:

- uchta umumiy karta (maosh, guruhlar, o'quvchilar);
- "Maosh" bo'limi: o'z oy tanlovi, to'rtta karta, "Guruhlar bo'yicha ulush" va "Shu oy yozuvlari";
- asosiy ma'lumotlar.

Guruhlar va o'quvchilar ro'yxati profilda yo'q edi ("keyin chiqadi" degan eslatma turardi).

Eski tizimda (cosmoslc) profil boshqacha tuzilgan:

- tepada oltita ko'rsatkich: balans, retention, davomat, aktiv guruhlar, faol o'quvchilar, sinovdagilar;
- chapda shaxsiy ma'lumotlar va ish shartlari;
- o'ngda tablar.

Eski tizimdagi "Retention" haqiqiy ko'rsatkich emas edi: u reyting va o'quvchilar sonidan o'ylab topilgan formula
bilan doim 65–99% oralig'ida chiqardi.

## Qaror

### Ko'rinish

- **Sarlavha:**
  - chapda — rasm, ism, turi va telefon;
  - o'ngda — oy tanlovi (butun profil uchun, `?oy=`), "Tahrirlash", o'chirish va "Maosh / Avans berish".
- **Ko'rsatkichlar** — yangi `MetricCard` komponenti (STYLE.md 11.34):

  | Karta | Qiymat | Izoh qatori |
  | --- | --- | --- |
  | Balansi | qoldiq (Ish haqi bilan bir manba) | Kirim (hisoblangan + bonus − jarima) · Chiqim (berilgan) |
  | Retention | tanlangan oy, % | — |
  | Davomat | tanlangan oy, % | — |
  | Aktiv guruhlar | soni | guruhlarga tushgan pul |
  | Faol o'quvchilar | `active` a'zolikdagi o'quvchilar | jami biriktirilgan |
  | Sinovdagilar | `trial` a'zolikdagi o'quvchilar | — |

  Balans kartasi faqat maosh ko'rinadigan xodimga chiqadi. Belgisi — "Qoldiq", "Qarz" yoki "Teng", qarz va qoldiqda
  karta rangga bo'yaladi.
- **Chap blok:** "Shaxsiy ma'lumotlar" (telefon, jins, tug'ilgan sana, support uchun biriktirilgan ustoz), "Ish va
  maosh shartlari" (filial, maosh turi, ish kunlari, ish vaqti) va izoh. Rasm va ism bu yerda takrorlanmaydi —
  sarlavhada bor.
- **Tablar:**
  - "Tranzaksiyalar" — shu oydagi maosh, avans, bonus va jarima. Ish haqi sahifasidagi amallar shu yerda ham bor:
    tahrirlash, bekor qilish, tiklash.
  - "To'lovlardan hisoblangan ulush" — guruhlar bo'yicha tushum va ulush, jami qatori bilan.
  - "Faol guruhlar".
  - "O'quvchilar" — qidiruv va holat filtri bilan.
  - "Yordamchi ustozlar".

  Maosh tablari faqat Ish haqi bo'limi yoqilgan va ruxsat bo'lsa chiqadi.

### Hisob

- **Retention** (`lib/teacher-stats.ts`) — haqiqiy a'zolik davrlaridan hisoblanadi:
  - asos — oy boshida o'qituvchi guruhlarida bo'lgan a'zoliklar;
  - ulardan oy oxirigacha (joriy oyda — bugungacha) chiqmaganlar ulushi olinadi;
  - oy boshida a'zolik bo'lmasa, "—" chiqadi.
- **Davomat** — kelgan va kechikkanlar barcha belgilarga nisbatan, bosh paneldagidek; belgi bo'lmasa "—".
- Hisoblar guruhning **hozirgi** o'qituvchisi bo'yicha qilinadi: o'qituvchi almashish tarixi saqlanmaydi (ADR 0018).
  Arxivdagi guruhlar retention'ga kiradi.

## Oqibatlari

- O'qituvchilar ro'yxatidagi "O'rtacha retention" kartasi hali "—". Uni shu hisob bilan to'ldirish — alohida ish.
