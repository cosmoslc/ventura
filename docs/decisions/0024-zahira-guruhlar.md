# 0024. edu-crm: zahira guruhlar (kutish ro'yxati)

2026-10-13 · qabul qilingan · Saidakbar taklifni tasdiqladi (E4b dan keyingi qadam), docs/EDU-CRM-E4.md

## Vaziyat

Eski tizimda (cosmoslc) "Zahira guruh" — kurs yoki vaqt bo'yicha guruh ochilishini kutayotgan lidlar ro'yxati edi.
Unda lidlar yig'ilardi va "Faollashtirish" bosilganda haqiqiy guruh ochilib, hammasi unga qo'shilardi.

Kamchiliklari:

- **Saqlanishi:** ro'yxatlar markaz sozlamasida JSON bo'lib turgan, lidda esa faqat matnli havola bor edi. Ro'yxat
  o'chirilsa, lidlar yo'q guruhga bog'langancha qolardi.
- **Faollashtirish bitta tranzaksiyada emas edi:** lidlar birma-bir qo'shilardi. O'rtada xato chiqsa, guruh ochilib
  qolar, lidlarning bir qismi esa qo'shilmay qolardi.
- **Jurnal yo'q edi:** kim va qachon qo'shgani yozilmagan.

## Qaror

### Ma'lumot (0016 migratsiyasi)

- **`lead_waitlists`**:
  - maydonlar: filial, nom, kurs (ixtiyoriy), izoh, kim ochgan;
  - faollashtirilsa — guruh (`group_id`), yopilganda — `closed_at` va `closed_by`;
  - yozuv o'chirilmaydi, yopiladi;
  - CHECK: guruhga faollashtirilgan ro'yxat yopiq bo'lishi shart;
  - RLS va FORCE.
- **`leads.waitlist_id`** — kompozit kalit bilan haqiqiy havola. Lid bog'langan ro'yxatni bazaning o'zi o'chirtirmaydi.

### Amallar

| Amal | Ruxsat | Mazmuni |
| --- | --- | --- |
| Ochish va tahrirlash | `leads.edit` | nom, kurs, izoh; filial yangi ro'yxatda tanlanadi |
| Lidni yozish yoki chiqarish | `leads.edit`, "tasdiq bilan" (`leads.waitlist`) | faqat ish bosqichidagi lid, ro'yxat bilan bitta filialda |
| Yopish | `leads.edit` | lidlar ro'yxatdan chiqadi va o'z bosqichida qoladi |
| Faollashtirish | `leads.convert_to_student`, "tasdiq bilan" (`leads.waitlistActivate`) | quyida |

**Faollashtirish.** Kutayotgan hamma lid tanlangan guruhga o'quvchi bo'lib sinovda qo'shiladi va ro'yxat yopiladi —
bitta tranzaksiyada. Biror lid mos kelmasa (ish bosqichida emas, boshqa filial), hech narsa yozilmaydi.

Guruh tanlashning ikki yo'li bor:

- **Mavjud guruhga** — ro'yxat filialidagi guruhlardan qidiruvli tanlov.
- **Yangi guruh ochish** — guruh ochish formasi (`GroupForm`) ro'yxat nomi, kursi va filiali bilan oldindan to'ldirilib
  ochiladi. Saqlangach o'sha guruhga faollashtiriladi.

  Guruh ochish o'zining amali va ruxsati (`groups.create`) bilan qoladi. Faollashtirish bajarilmasa, ochilgan guruh
  turadi va faollashtirishni "Mavjud guruhga" orqali qaytarish mumkin.

**O'quvchiga aylantirish mantiqi** bitta funksiyaga chiqarildi (`leads/convert.ts`) va bitta lid (ADR 0023) hamda zahira
guruh uchun umumiy. Bir xil telefonli ikki lid bitta o'quvchiga tushadi. Aylantirilgan lid zahira guruhdan chiqadi.

### Ko'rinish

- **Lidlar sahifasining "Zahira guruhlar" tabi** — har ro'yxat kartada: kurs, filial, izoh, kutayotganlar (lid
  profiliga havola, ro'yxatdan chiqarish), "Faollashtirish", "Tahrirlash" va "Yopish".
- **Lid menyusida** "Zahira guruhga" bandi. Oyna lid filialidagi ochiq ro'yxatlarni ko'rsatadi; lid ro'yxatda bo'lsa,
  "Zahira guruhdan chiqarish" ham chiqadi.
- **Doska kartasida** "Zahirada: …" belgisi, lid profilida — zahira guruh qatori.
- **Jurnal:** `lead.waitlist.create`, `lead.waitlist.update`, `lead.waitlist`, `lead.waitlist.close`,
  `lead.waitlist.activate`, shuningdek har lid uchun aylantirish yozuvlari.

### Sinov

Haqiqiy PostgreSQL'da (`leads.db.test.ts`):

- ochiq ro'yxatlar filial bo'yicha chiqadi, yopiqlari ko'rinmaydi;
- lid ro'yxatga bog'lanadi;
- lid bog'langan ro'yxat o'chirilmaydi;
- guruhga faollashtirilgan ro'yxat yopiq bo'lishi shart;
- boshqa mijozga ko'rinmaydi.

## Oqibatlari

- **E4d:** "Bugungi ishlar" da uzoq kutayotgan zahira guruhlar ko'rsatilishi mumkin.
- **E5:** zahira guruhdan o'quvchiga aylanganlar hisobotda alohida ko'rinishi mumkin — `lead.waitlist.activate`
  jurnalidan.
