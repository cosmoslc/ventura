# E4 (Sotuv) — reja

2026-10-13 · E4a tayyor (ADR 0022) · bo'lim: `leads` · EDU-CRM-PLAN E4

E3 dagidek to'rt qismga bo'linadi. Har qism — alohida branch, PR va ADR.

| Qism | Mazmuni | Holati |
| --- | --- | --- |
| E4a | Lidlar asosi: doska, ro'yxat, lid profili, bosqichlar tarixi, izoh va qo'ng'iroqlar, mas'ul xodim | tayyor (ADR 0022) |
| E4b | Birinchi dars, o'quvchiga aylantirish, yo'qotilgan lidlar va sabablari | — |
| E4c | Lid formasi sozlamalari va tashqi ariza sahifasi (havola va sayt uchun iframe) | — |
| E4d | Bugungi ishlar, bosh paneldagi lid kartalari, Playwright testi | — |

Lid analitikasi, CRM voronkasi va mavsumiy oqim — E5 (Hisobotlar).

## Eski tizimda nima bor edi

- `leads` jadvali:
  - ism, telefon, ikkinchi telefon, sinf, manba, kurs, holat (`new`, `contacted`, `trial`, `student`, `lost`);
  - izohlar `comments` JSON ichida;
  - rad etish sababi va izohi, maqsadli sana;
  - mas'ul xodim, yo'qotilgan bosqich, bosqichga o'tgan vaqt, aylangan o'quvchi.
- `lead_stage_events` — bosqich almashuvlari (trigger yozadi).
- `lead_first_lessons` — birinchi (sinov) dars: guruh, sana, holat (`scheduled`, `came`, `absent`). Lid o'quvchi emas:
  to'lov, davomat va maoshga ta'sir qilmaydi.
- Doska ustunlari markaz sozlamasida (nom, rang, tartib), "O'quvchi bo'ldi" va "Yo'qotildi" alohida.
- Lid kartasi menyusi:
  - SMS, guruhga qo'shish, birinchi darsga yozish, test olish;
  - filialga ko'chirish, zaxira guruhiga, mas'ul xodim;
  - tahrirlash, o'chirish.
- Tablar: "Lidlar bo'limi", "Ketgan lidlar", "Lidlar analitikasi".
- Lid formasi quruvchisi:
  - maydon turlari — matn, raqam, tanlov, ko'p tanlov, belgilash, guruh, kurs, sana;
  - sarlavha, havola va iframe kodi.
  - `/apply-form` sahifasi esa yozilmagan — havola ishlamas edi.
- Sabablar sahifasi: o'chirish, muzlatish va lid yo'qotilganda tanlanadigan sabablar ro'yxati.
- "Bugungi ishlar":
  - qarzdorlar, bugun kelmaganlar;
  - bugun qarzini to'laydiganlar, tugayotgan guruhlar, bugungi davomat.

## Eski tizimdagi xatolar — takrorlanmaydi

- Izohlar JSON ichida edi: kim va qachon yozgani yo'qolar, qidirib bo'lmas edi. Bu yerda `lead_notes` jadvali bo'ladi.
- Bosqich tarixi faqat trigger orqali yozilgan, RLS ochiq (`dev_open_all`) edi. Bu yerda tarix amal ichida yoziladi va
  RLS mijoz bo'yicha bo'ladi.
- Ariza havolasi ishlamas edi.
- Telefon takrori tekshirilmas edi: bir odam bir necha lid bo'lib qolar edi.
- Mas'ul xodim nomi matn sifatida saqlanar edi; xodim nomi o'zgarsa, eski nom qolib ketar edi.

## Qarorlar (taklif — Saidakbar tasdiqlaydi)

1. **Bosqichlar markaz sozlamasida:** nom, rang, tartib.
   - "O'quvchi bo'ldi" va "Yo'qotildi" — tizim bosqichlari: o'chirilmaydi, doskada alohida.
   - Bosqich o'chirilsa, undagi lidlar tanlangan boshqa bosqichga o'tadi.
2. **Telefon bir xil bo'lsa:** shu telefonli ochiq lid bo'lsa, xodim formasi ogohlantiradi va o'sha lidni ochishni taklif
   qiladi. Tashqi arizada yangi lid yaratilmaydi — mavjud lidga izoh qo'shiladi.
3. **Lid o'quvchiga aylanganda** (E4b):
   - o'quvchi yaratiladi (ism, telefon, jins, lid formasidagi mos maydonlar);
   - tanlangan guruhga sinovda qo'shiladi;
   - lid "O'quvchi bo'ldi" bosqichiga o'tadi va o'quvchiga bog'lanadi.

   Shu telefonli o'quvchi bo'lsa, yangisi yaratilmaydi — mavjudiga bog'lanadi.
4. **Birinchi dars lid uchun** (E4b): o'quvchi yaratilmaydi, to'lov, davomat va maoshga tegmaydi. Guruh davomatida
   alohida qatorda ko'rinadi, o'qituvchi "keldi / kelmadi" belgilaydi.
5. **Yo'qotish sabab bilan** (E4b): sabablar ro'yxati sozlamada. Yo'qotilgan lid tiklanadi va oldingi bosqichiga
   qaytadi.
6. **Tashqi ariza** (E4c): ochiq sahifa (kirishsiz). Himoya:
   - IP bo'yicha so'rovlar soni cheklanadi;
   - yashirin "tuzoq" maydon (honeypot);
   - telefon tekshiriladi.

   Manba — "Veb-sayt forma".
7. **Ruxsatlar** (`packages/auth`, mavjud):

   | Amal | Ruxsat |
   | --- | --- |
   | Ko'rish | `leads.view` |
   | Qo'shish | `leads.create` |
   | Tahrirlash | `leads.edit` |
   | O'chirish (arxivga) | `leads.delete` |
   | Izoh va qo'ng'iroq yozish | `leads.call_log` |
   | Bosqichni o'zgartirish | `leads.status_change` |
   | O'quvchiga aylantirish | `leads.convert_to_student` |
   | Mas'ul xodimni almashtirish | `leads.reassign` |
   | Excel | `leads.import_export` |

## E4a. Lidlar asosi — tayyor (ADR 0022)

- **Jadvallar:**

  | Jadval | Mazmuni |
  | --- | --- |
  | `lead_stages` | nom, rang, tartib; tizim bosqichlari `kind = won / lost` |
  | `leads` | filial, ism, telefon, ikkinchi telefon, manba, kurs, bosqich, mas'ul xodim, maqsadli sana, qo'shimcha maydonlar (`custom_data`), aylangan o'quvchi, yo'qotish sababi, arxiv |
  | `lead_events` | bosqich almashuvi: qaysidan, qaysiga, kim, qachon |
  | `lead_notes` | izoh va qo'ng'iroq natijasi: turi, matn, muallif, vaqt |

  Barcha jadvallarda RLS va FORCE.
- **Sahifa `/leads`:**
  - doska — ustunlar bo'yicha, kartani sudrab yoki menyudan bosqichga o'tkazish;
  - ro'yxat ko'rinishi;
  - filtrlar: qidiruv, manba, kurs, mas'ul, sana.
- **Lid profili `/leads/[id]`:** ma'lumotlar, bosqichlar tarixi, izoh va qo'ng'iroqlar (oynada yoziladi), uch nuqta
  amallari.
- **Lid formasi:** asosiy maydonlar — ism, telefon, manba, kurs, mas'ul, izoh. Qolganlari — qo'shimcha maydonlar
  (`lib/form-fields.ts`, o'quvchi formasidagidek).
- **Bosqichlar sozlamasi:** doskada "Ustunlar" oynasi — nom, rang, tartib, qo'shish va o'chirish.
- Jurnal (`lead.create`, `lead.update`, `lead.stage`, `lead.note`, `lead.assign`, `lead.archive`). "Tasdiq bilan"
  reyestriga qo'shiladi.
- **Sinov:**
  - bosqichlar va telefon takrori uchun Vitest;
  - haqiqiy PostgreSQL'da mijozlar ajratilishi.
