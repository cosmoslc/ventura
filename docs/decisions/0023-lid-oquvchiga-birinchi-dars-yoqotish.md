# 0023. edu-crm E4b: o'quvchiga aylantirish, birinchi dars, yo'qotilgan lidlar

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E4 (ikkinchi qism), docs/EDU-CRM-E4.md "E4b"

## Vaziyat

E4a (ADR 0022) dan keyin lid faqat ish bosqichlari orasida yurardi. Eski tizimda (cosmoslc):

- **Guruhga qo'shish:** lid ma'lumoti qo'lda o'quvchiga ko'chirilardi. Telefon takrori tekshirilmas edi, natijada bir
  odam ikki o'quvchi bo'lib qolardi.
- **Birinchi dars:** `lead_first_lessons` jadvalida yuritilardi (lid o'quvchi emas, hisobga tegmaydi), lekin RLS ochiq
  edi.
- **Yo'qotish:** sabab bilan, "Ketgan lidlar" tabida ko'rinardi. Sabablar alohida sahifada sozlanardi.

Saidakbar tasdiqlagan qarorlar (2026-10-13, docs/EDU-CRM-E4.md):

1. Shu telefonli o'quvchi bo'lsa, yangisi yaratilmaydi — lid o'shanga bog'lanadi.
2. Birinchi dars lid uchun: o'quvchi yaratilmaydi; to'lov, davomat va maoshga tegmaydi.
3. Tashqi arizada (E4c) shu telefonli ochiq lid bo'lsa, ariza mavjud lidga izoh bo'lib qo'shiladi.

## Qaror

### O'quvchiga aylantirish (`leads.convert_to_student`)

Faqat ish bosqichidagi lid aylantiriladi. Bitta tranzaksiyada:

- **O'quvchi:**
  - shu telefonli (arxivda bo'lmagan) o'quvchi bo'lsa — o'shanga bog'lanadi; u boshqa filialda va xodimga u filial
    ruxsat etilmagan bo'lsa — rad etiladi;
  - bo'lmasa — yangisi yaratiladi: ism, telefon, ikkinchi telefon, jins (oynada tanlanadi), manba, qiziqqan kurs va
    o'quvchi formasida id si bir xil qo'shimcha maydonlar.

    `created_by` — aylantirgan xodim. Bu menejer KPI uchun kerak (EDU-CRM-E3-DAVOMI, 4-qaror).
- **Guruh** (ixtiyoriy):
  - o'quvchi bilan bir filialdagi guruh tanlanadi;
  - o'quvchi unga sinovda qo'shiladi;
  - u o'sha guruhda allaqachon bo'lsa, qayta qo'shilmaydi.

  Birinchi darsi bo'lgan lidda oynada shu guruh oldindan tanlangan.
- **Lid** "O'quvchi bo'ldi" bosqichiga o'tadi va o'quvchiga bog'lanadi (`student_id`); bosqich tarixi yoziladi.
- **Jurnal:** `lead.convert`; yangi o'quvchi uchun `student.create` (`fromLead`); qo'shilganda `group.enroll` va
  `student.enroll` (o'quvchi tarixida ko'rinadi).
- Aylantirilgach o'quvchi profili ochiladi.

### Birinchi (sinov) dars

- **Jadval `lead_first_lessons`** (0014 migratsiyasi): guruh, kun, holat (`scheduled` / `came` / `absent`), kim
  belgilagan.
  - Bitta lidga bitta yozuv: boshqa kunga ko'chirilsa, shu qator o'zgaradi.
  - CHECK: belgilangan bo'lsa, vaqt majburiy.
  - RLS va FORCE.
- **Yozish va ko'chirish** — `leads.edit`. Lid ish bosqichida bo'lishi kerak, guruh lid filialida.
- **Guruh davomati:** tanlangan kunda alohida qatorlarda "Birinchi darsga kelganlar — lidlar" chiqadi. O'qituvchi
  "Keldi" yoki "Kelmadi" ni belgilaydi; qayta bosilsa, belgi bekor bo'ladi.

  Qoidalar davomatdagidek:
  - kelajakdagi kun belgilanmaydi;
  - bugun — `attendance.student_mark`;
  - o'tgan kun — `attendance.student_edit_past`;
  - `leads.edit` ikkalasiga ham yetadi.

  Lid davomat, a'zolar, belgilar, to'lov va maoshga kirmaydi.
- **Lid profili va doska:** profilda birinchi dars kartasi (shu yerdan ham belgilanadi), doska kartasida kun va holat
  ko'rinadi.

### Yo'qotish va tiklash (`leads.status_change`)

- **Yo'qotildi** — sababi (ro'yxatdan) va izoh bilan. Qaysi bosqichdan yo'qotilgani saqlanadi (`lost_from_stage_id`).
- **Sabablar** sozlamada (`leads.lost_reasons`, `leads.edit`). Standart ro'yxat eski tizimdagidek.
- **Tiklash:**
  - lid oldingi bosqichiga qaytadi; u bosqich o'chirilgan bo'lsa — birinchi ish bosqichiga;
  - shu telefonli ochiq lid bo'lsa, tiklanmaydi (takror).
- **Lidlar sahifasidagi yangi tablar:**
  - "Ketgan lidlar" — sabab, izoh, qaysi bosqichdan, sana, tiklash;
  - "O'quvchi bo'lganlar" — o'quvchi profiliga havola.

  Filtrlar hamma tabga umumiy.

### Arxiv

- O'chirilgan lidlar Arxiv sahifasining "Lidlar" tabida ko'rinadi va tiklanadi (`archive.restore`).
- Shu telefonli ochiq lid bo'lsa, tiklanmaydi.

### "Tasdiq bilan" reyestri (ADR 0019)

`leads.convert`, `leads.firstLesson`, `leads.lose`, `leads.restore`.

### Sinov

- **Vitest:** yo'qotish sabablari ro'yxatini o'qish (takror, bo'sh, buzilgan qiymat).
- **Haqiqiy PostgreSQL** (`leads.db.test.ts`):
  - birinchi dars lidga bitta yozuv bo'ladi;
  - "Keldi" vaqtsiz yozilmaydi;
  - guruh davomatida mehmon sifatida chiqadi va a'zolar hamda belgilarga kirmaydi;
  - ro'yxatda birinchi dars ko'rinadi;
  - boshqa mijozga ko'rinmaydi.

## Oqibatlari

- **E4c:** tashqi ariza sahifasi (3-qaror), lid formasi sozlamalari, Excel.
- **E4d:** "Bugungi ishlar" — bugungi birinchi darslar shu jadvaldan olinadi. Playwright: lid → birinchi dars →
  o'quvchi.
- Konversiya hisobotlari (E5) bosqich tarixi (`lead_events`) va `lead.convert` jurnalidan olinadi.
