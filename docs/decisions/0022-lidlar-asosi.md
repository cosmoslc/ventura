# 0022. edu-crm E4a: lidlar asosi

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E4 (birinchi qism), docs/EDU-CRM-E4.md "E4a"

## Vaziyat

Eski tizimda (cosmoslc) lidlar `leads` jadvalida edi:

- izohlar `comments` JSON ichida turgan: kim va qachon yozgani yo'qolar edi;
- bosqich tarixi trigger orqali yozilgan va RLS ochiq (`dev_open_all`) edi;
- mas'ul xodim nomi matn sifatida saqlangan;
- telefon takrori tekshirilmagan.

Doska ustunlari markaz sozlamasida (JSON) edi. Ventura'da `/leads` sahifasi E0 dan beri "tez orada" bo'lib turardi.

## Qaror

### Ma'lumot (0013 migratsiyasi)

| Jadval | Mazmuni |
| --- | --- |
| `lead_stages` | nom, rang, tartib; turi `open` / `won` / `lost` |
| `leads` | filial, ism, telefon, ikkinchi telefon, manba, kurs, bosqich, mas'ul (`users`), keyingi aloqa sanasi, izoh, qo'shimcha maydonlar, bosqichga o'tgan vaqt; E4b uchun: o'quvchi, yo'qotish sababi va bosqichi; arxiv |
| `lead_events` | bosqich almashuvi: qaysidan (bo'sh — yaratildi), qaysiga, kim, qachon |
| `lead_notes` | izoh va qo'ng'iroq natijasi: turi, matn, muallif, vaqt |

Barcha jadvallarda RLS va FORCE. Havolalar kompozit kalit bilan (mijoz ichida). Bosqich almashuvi `lead_events` ga amal
ichida, bitta tranzaksiyada yoziladi — trigger yo'q.

### Bosqichlar

- Standart bosqichlar mijoz bazasida birinchi so'rovda yaratiladi:
  - ish bosqichlari: "Yangi", "Bog'lanildi", "Sinov darsi";
  - tizim bosqichlari: "O'quvchi bo'ldi" (`won`), "Yo'qotildi" (`lost`).

  Bir vaqtda kelgan so'rovlar ikki marta yaratmasligi uchun mijoz bo'yicha advisory qulf ishlatiladi.
- "Ustunlar" oynasi (`leads.edit`):
  - ish bosqichlarini qo'shish, nomlash, bo'yash va tartiblash mumkin;
  - tizim bosqichlarining nomi va rangi o'zgaradi, lekin ular o'chirilmaydi.
- Ustun o'chirilganda unda turgan lidlar (arxivdagilari ham) va tarixdagi havolalar tanlangan ustunga o'tadi.
- Bu qismda lid faqat ish bosqichlari orasida yuradi. "O'quvchi bo'ldi" va "Yo'qotildi" — E4b amallari bilan.

### Sahifalar

- **`/leads`**:
  - doska — ish bosqichlari ustunlarda; kartani sudrab boshqa ustunga o'tkazish mumkin, natija javobni kutmasdan
    ko'rsatiladi, xato bo'lsa qaytadi;
  - ro'yxat — jadval, tanlab mas'ul belgilash;
  - umumiy filtrlar: qidiruv, manba, kurs, mas'ul (shu jumladan "Biriktirilmagan").

  Kartada ko'rinadi: kurs, manba, mas'ul, bosqichda necha kun turgani yoki keyingi aloqa sanasi (bugun yoki o'tgan
  bo'lsa — ogohlantirish rangida).
- **`/leads/[id]`**:
  - chapda — ma'lumotlar va qo'shimcha maydonlar;
  - o'ngda — ish bosqichlari qatori, bosib o'tkaziladi;
  - tablar: "Izohlar" (oynada yoziladi) va "Bosqichlar tarixi".
- **Lid formasi:** asosiy maydonlar — ism, telefon, qo'shimcha telefon, jins (E4b da qo'shildi), manba, kurs
  (qidiruvli tanlov), mas'ul, keyingi aloqa sanasi va izoh. Qolganlari "Lid formasi" sozlamasidagi qo'shimcha maydonlar (`leads.form_fields`, guruh turisiz).

### Qoidalar

- **Telefon takrori.** Shu raqamli ochiq lid bo'lsa (arxivda emas, ish bosqichida), forma raqam kiritilishi bilan
  ogohlantiradi va o'sha lidga havola beradi. Server ham bunday lidni saqlamaydi.
- **Mas'ul xodim.** O'zgartirish `leads.reassign` ruxsati bilan. Yangi lid yaratuvchiga biriktiriladi yoki bo'sh
  qoladi.

  Mas'ul bo'la oladiganlar:
  - filialdagi xodimlar;
  - direktorlar (ular hamma filialda).
- **Filial** tahrirlashda o'zgarmaydi.
- **O'chirish** — arxivga, sababi bilan (`leads.delete`).
- **Jurnal:** `lead.create`, `lead.update`, `lead.stage`, `lead.assign`, `lead.note`, `lead.note.delete`,
  `lead.archive`; ustunlar va forma — `settings.update`.
- **"Tasdiq bilan" reyestri (ADR 0019):** `leads.save`, `leads.move`, `leads.assign`, `leads.archive`.

### Sinov

- **Vitest:** bosqichlar ro'yxati qoidalari, bosqichda turgan kunlar (Toshkent vaqti).
- **Haqiqiy PostgreSQL** (`leads.db.test.ts`, CI):
  - standart bosqichlar parallel so'rovlarda bir marta yaratiladi;
  - ro'yxat filial bo'yicha va arxivsiz chiqadi;
  - tarix va izohlar yoziladi;
  - mas'ullar ro'yxati filial va direktor bo'yicha to'g'ri;
  - lidi bor bosqichni o'chirib bo'lmaydi;
  - boshqa mijoz ma'lumoti ko'rinmaydi.

## Oqibatlari

- **E4b:**
  - o'quvchiga aylantirish va birinchi dars;
  - yo'qotish sabab bilan va tiklash;
  - "Ketgan lidlar" tabi;
  - arxivdan lidni tiklash.
- **E4c:** tashqi ariza sahifasi, shu qo'shimcha maydonlar bilan.
- **E4d:** bugungi ishlar (keyingi aloqa sanasi shu yerdan olinadi) va bosh paneldagi lid kartalari.
- **Excel import va eksport** (`leads.import_export`) hali yo'q. Uni E4c bilan qo'shish taklif qilinadi.
