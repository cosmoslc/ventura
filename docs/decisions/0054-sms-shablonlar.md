# 0054. edu-crm: SMS shablonlari va Eskiz moderatsiyasi (S2)

2026-10-18 · qabul qilingan · ADR 0053, docs/EDU-CRM-SMS.md

## Vaziyat

Eskiz faqat moderatsiyadan o'tgan shablonga mos matnni yuboradi. Avto-SMS (S4) uchun tasdiqlangan matnlar kerak.
Eskiz API'si shablonni yuborganda id qaytarmaydi (`POST /user/template` javobi faqat matn), ro'yxatda esa
`id`, `original_text` va `status` beradi.

## Qaror

**Jadval** — `sms_templates` (migratsiya `0024`, RLS + FORCE): tur, nom, matn, qismlar soni, moderatsiya holati,
Eskiz'ga yuborilgan matn (`submitted_body`) va Eskiz id si. O'chirish — arxivlash (S3 da xabarlar shablonga bog'lanadi).

**Moderatsiya holatlari**

| Bizda | Eskiz | Ma'nosi |
| --- | --- | --- |
| `draft` | — | yuborilmagan yoki yuborilgandan keyin matn o'zgargan |
| `moderation` | `moderation`, `inproccess` | tekshirilmoqda |
| `approved` | `service` | avto-SMS'da ishlatiladi |
| `advert` | `reklama` | reklama deb belgilangan: kunduzi, qimmatroq; avto-SMS'da ishlatilmaydi |
| `rejected` | `rejected` | qayta yuborish kerak |

- Sinxronlash ("Eskiz bilan yangilash") Eskiz ro'yxatidagi matnni `submitted_body` bilan solishtiradi. Bir xil matn
  bir necha marta yuborilgan bo'lsa — eng katta id.
- Matn o'zgarsa holat `draft` ga qaytadi.

**Matn**

- O'zgaruvchilar: `{ism}`, `{familiya}`, `{guruh}`, `{kurs}`, `{summa}`, `{qarz}`, `{oy}`, `{sana}`, `{markaz}`,
  `{telefon}`, `{maosh}`. Har turda ruxsat etilganlari bor (`KIND_VARS`); boshqasi saqlashda xato.
- Saqlashda tipografik belgilar oddiyga almashadi (`ʻ` → `'`, `“` → `"`, `—` → `-`): aks holda butun xabar UCS-2
  bo'lib, qism 160 dan 70 belgiga tushadi.
- Qismlar: GSM-7 — 160 / 153, UCS-2 — 70 / 67; kengaytirilgan belgilar (`{}[]~^|€\`) 2 ta. Tahrirda jonli namuna va
  hisoblagich, ro'yxatda namunadagi qismlar soni.
- Tayyor andozalar (har avto-tur uchun bittadan) bitta qismga sig'adi — testda tekshiriladi.

**Sahifa** — `/sms/templates`, SMS bo'limidagi tablar orqali ("Umumiy", "Shablonlar").

## Ochiq savol

Eskiz moderatoriga o'zgaruvchili matn qanday ko'rinishda yuborilishi kerakligi hujjatda yo'q. Hozir `{ism}`
ko'rinishida yuboriladi (o'qishga tushunarli). Eskiz boshqa belgi talab qilsa (`%w` va h.k.), faqat yuborish
funksiyasidagi almashtirish o'zgaradi.
