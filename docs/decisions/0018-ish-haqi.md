# 0018. edu-crm E3c: ish haqi (o'qituvchi va xodim maoshi)

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E3 (uchinchi qism), EDU-CRM-E3-DAVOMI "E3c"

## Vaziyat

Eski tizimda (cosmoslc) maosh `teacher_payments` va `manager_payments` jadvallarida yuritilar edi. Muammolar:

- Qoldiq to'rt xil formula bilan hisoblanar edi.
- To'lov usuli va menejer to'lovining turi saqlanmas edi.
- Tahrirlashda oy o'zgarmas edi.
- "Mukofot" maosh sifatida yozilar edi.
- Menejer balansi qo'lda yuritilar edi.
- Ortiqcha to'lov ikki marta sanalar edi.
- Guruhdagi 0% sozlama o'qituvchining o'z foizidan ustun turar edi.
- Menejer KPI o'quvchining filiali yoki guruhi bo'yicha taxminan olinar edi (kim qo'shgani saqlanmas edi).

Saidakbar qarorlari (2026-10-12, EDU-CRM-E3-DAVOMI): menejer KPI shu oy bo'yicha hisoblanadi, o'quvchi uni qo'shgan
menejerga yoziladi.

## Qaror

### Ma'lumot (0010 migratsiyasi)

- **`salary_entries`** — xodim (`user_id`) **yoki** o'qituvchi (`teacher_id`) uchun yozuv:

  | Tur | Ma'nosi | To'lov usuli |
  | --- | --- | --- |
  | `salary` | Maosh — kassadan chiqadi | bor |
  | `advance` | Avans — kassadan chiqadi | bor |
  | `bonus` | Hisoblanganga qo'shiladi, pul emas | yo'q |
  | `penalty` | Hisoblangandan ayiriladi, pul emas | yo'q |

  - Har yozuvda oy (qaysi oy hisobi uchun), sana va izoh saqlanadi.
  - To'lov usuli o'quvchi to'lovlaridagi bitta ro'yxatdan olinadi.
  - Bu qoidalar CHECK bilan himoyalangan.
  - Yozuv o'chirilmaydi — bekor qilinadi (sabab bilan), keyin tiklanadi.
- **`students.created_by`** — o'quvchini qo'shgan xodim. O'quvchi qo'shish formasi va Excel import yozadi; eski
  yozuvlarda bo'sh qoladi.

### Hisob (`lib/payroll.ts`, toza funksiyalar, Vitest)

Hisoblangan maosh saqlanmaydi — har safar o'quvchi hisobi (ADR 0015) va kassa yozuvlaridan olinadi.

**O'qituvchi.** Guruh sozlamasi bo'sh (`null`) bo'lsa — o'qituvchining o'z sozlamasi ishlaydi. Guruhda aniq yozilgan
0% — 0.

- **Foiz turi:**
  - asos — guruhga shu oy belgisi bilan tushgan naqd pul: to'lov +, qaytarish −;
  - har to'lov uchun ulush = `round(summa × koeffitsient × foiz / 100)`;
  - koeffitsient = o'qituvchi narxi / to'langan narx, ya'ni "o'qituvchiga ta'sir qilmaydigan" chegirma o'qituvchi
    ulushini kamaytirmaydi.
- **Har o'quvchi uchun turi:**
  - chegara = `round(stavka × oylik hisob × koeffitsient / guruh narxi)`;
  - ulush = `round(chegara × min(1, to'langan / oylik hisob))`;
  - oylik hisob 0 bo'lsa — 0;
  - EDU-CRM-E3-DAVOMI formulasidan farqi: maxraj — guruh narxi, koeffitsient esa chegirmani hisobga oladi.
    Chegirmasiz holatda natija bir xil.
- **Belgilangan turi:**
  - o'qituvchining o'z oyligi oyiga bir marta beriladi, guruhlari bo'lmasa ham (support o'qituvchilar);
  - guruhda o'zgacha belgilangan summa har guruh uchun alohida qo'shiladi.
- O'qituvchi deganda guruhning hozirgi o'qituvchisi olinadi. O'qituvchi almashish tarixi hali saqlanmaydi.

**Menejer** (4-qaror):

- `fixed` — faqat oklad.
- `kpi` — oklad + yangi o'quvchilar × summa + 1 oylik o'quvchilar × bonus.
  - **Yangi o'quvchi** — o'zi qo'shgan (`created_by`), birinchi marta shu oyda faollashtirilgan o'quvchi.
  - **1 oylik o'quvchi** — o'zi qo'shgan, o'tgan oyda birinchi marta faollashgan va o'sha oyni to'liq to'lagan
    o'quvchi. To'liq to'lagani o'quvchi hisobidan olinadi: shu oydagi barcha guruh oylari "to'langan" yoki "bepul".

**Qoldiq** — hamma joyda bitta formula: hisoblangan + bonus − jarima − (maosh + avans). Manfiy bo'lsa — ortiqcha
berilgan, bu summa ikki marta sanalmaydi.

### Ko'rinish (`/salaries`, eski tizimdagi ikki tab)

- **Ish haqi ro'yxati:**
  - KPI: jami berilgan (maosh + avans), yozuvlar soni, o'rtacha to'lov;
  - filtrlar: ism yoki telefon, sana oralig'i, tur, bekor qilinganlar;
  - amallar: tahrirlash, bekor qilish, tiklash.
- **Maosh hisob-kitobi** — tanlangan oy bo'yicha:
  - KPI: jami tushum, o'qituvchilar ulushi, markazga qoladi (eski tizimdagidek);
  - jadval ustunlari: hisoblash turi, hisoblangan, bonus/jarima, avans, jami berilgan, qoldiq;
  - "To'lash" tugmasi formani shu xodim va oy bilan, qoldiq summasi yozilgan holda ochadi.
- **"Maosh berish" formasi:**
  - turlar ruxsatga qarab ko'rinadi;
  - tanlangan oy uchun hisoblangan, berilgan va qoldiq ko'rsatiladi;
  - to'lov usuli faqat maosh va avansda so'raladi.
- Ro'yxatda direktor yo'q. Filial cheklovi bor xodim faqat o'z filiallaridagi xodim va o'qituvchilarni ko'radi.
- **O'qituvchi profili, "Maosh" bo'limi:**
  - tanlangan oy bo'yicha kartalar: hisoblangan, bonus/jarima, berilgan, qoldiq;
  - guruhlar bo'yicha ulush (o'z oyligi alohida qatorda) va shu oy yozuvlari;
  - "Maosh berish" tugmasi.
  - Ma'lumot Ish haqi sahifasidagi bilan bir manbadan (`loadTeacherPayroll`). Eski profildagi balans kartalari o'rnida.

### Ruxsatlar (eski katalog)

| Amal | Ruxsat |
| --- | --- |
| Sahifa | `salaries.view` / `calculate` / `pay` / `advance_manage` / `kpi_edit` |
| Maosh | `salaries.pay` |
| Avans | `salaries.advance_manage` yoki `finance.advance_give` |
| Bonus va jarima | `salaries.kpi_edit` |

Tahrirlash, bekor qilish va tiklash — o'sha turdagi yozuvning ruxsati bilan. Har amal jurnalga yoziladi
(`salary_entry.*`).

### Sinov

- Vitest:
  - foiz (qaytarish, koeffitsient, null va 0% farqi);
  - har o'quvchi uchun (qisman to'lov, oy o'rtasi, chegirma);
  - belgilangan (oyiga bir marta, guruh summasi);
  - menejer KPI va qoldiq.
- Haqiqiy PostgreSQL (`payroll.db.test.ts`, CI):
  - o'qituvchi ulushi va qoldiq bazadagi yozuvlardan hisoblanadi;
  - menejer KPI;
  - CHECK himoyasi;
  - boshqa mijoz ma'lumoti ko'rinmaydi.

## Oqibatlari

- Bosh panel (ADR 0017): maosh va avans chiqimga qo'shiladi, "Avans" KPI to'ladi. Bu bosh panel bilan ish haqi
  birlashtirilgach qilinadi.
- E3d tasdiq so'rovlari shu server amallarini o'raydi.

