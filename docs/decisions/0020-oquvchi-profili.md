# 0020. edu-crm: o'quvchi profili, o'quvchi formasi va boshqa filialga o'tkazish

2026-10-13 · qabul qilingan · Saidakbar so'rovi (E3 dan keyin, E4 dan oldin)

## Vaziyat

E3 dan keyin o'quvchi profilida pul bilan bog'liq hamma narsa "To'lovlar" tabi ichida edi: balans kartalari, to'lov,
qaytarish va tuzatish tugmalari, doimiy chegirmalar. Eski tizimda (cosmoslc) esa:

- balans, coin va o'tgan oy qarzi profil tepasida doim ko'rinadi;
- to'lov, qaytarish, balansni tahrirlash va boshqa filialga o'tkazish uch nuqta menyusida turadi;
- chegirma alohida tabda.

Boshqa farqlar:

- Guruh kartasidagi amallar ochiq tugmalar edi.
- Eslatma formasi sahifaning o'zida turar edi.
- O'quvchi formasini xodim formasidagidek kengaytirib bo'lmas edi.
- Filialni o'quvchini tahrirlash formasida o'zgartirish mumkin edi. Bunda guruh a'zoliklari eski filialda qolar edi,
  vaholanki a'zolik qoidasi o'quvchi va guruh filiali bir xil bo'lishini talab qiladi.

## Qaror

### Profil

- **Chap karta:**
  - rasm chapda; yonida ism, uning ostida telefon raqamlari va holat;
  - pastda tug'ilgan sana, qo'shilgan sana va filial;
  - "Qo'shimcha ma'lumotlar" ochiladigan qismida o'quvchi formasidagi qo'shimcha maydonlar ham chiqadi.
- **Doimiy kartalar** (tablar ustida, moliya ko'rinadigan xodimga):
  - **Balans** — to'lovlar minus hisoblar.
  - **Coin** — coin tizimi birinchi versiyaga kirmaydi (EDU-CRM-PLAN, 10-qaror). Karta joyida turadi, qiymati 0.
  - **O'tgan oydan qarz** — joriy oydan oldingi oylardagi to'lanmagan qoldiq (`pastDebt`, `lib/ledger.ts`) va o'sha
    oylar nomi.
- **Tablar:** Guruhlar · To'lovlar · Chegirmalar · Eslatma · Tarix.
  - "To'lovlar" — guruhlar bo'yicha oylik hisob va yozuvlar. Kartalar, amal tugmalari va chegirmalar bu yerdan
    olindi; har guruhning "To'lov" tugmasi qoldi.
  - "Chegirmalar" — doimiy chegirmalar ro'yxati, qo'shish, tahrirlash va o'chirish.
  - "Eslatma" — "Yangi eslatma" tugmasi oyna ochadi. Eslatmalar kattaroq kartalarda chiqadi.
- **Uch nuqta menyusi:**
  - tahrirlash, holat;
  - to'lov qabul qilish;
  - pul qaytarish (balans musbat bo'lsa);
  - balansni tuzatish;
  - boshqa filialga o'tkazish;
  - o'chirish.

  Har biri o'z ruxsati bilan ko'rinadi.
- **Guruhlar tabi:** kartadagi faollashtirish, muzlatish va guruhdan chiqarish uch nuqta menyusiga o'tdi.

### O'quvchi formasi

- Xodim formasidagi mexanizm umumiy qilindi:
  - `lib/form-fields.ts` (avval `staff-fields.ts`);
  - `app/(crm)/fields-modal.tsx`.
- Ro'yxat `settings` jadvalida `students.form_fields` kalitida turadi. Qiymatlar `students.custom_data` ustunida
  (0012 migratsiyasi).
- Standart ro'yxat bo'sh: asosiy maydonlar formaning o'zida bor.
- Sozlash — "O'quvchilar" sahifasidagi "O'quvchi formasi" tugmasi orqali (`students.edit`).
- Maydonlar o'quvchi qo'shish va tahrirlash formalarida chiqadi, guruh profilidan yangi o'quvchi qo'shishda ham.
  Majburiy maydon serverda ham tekshiriladi.

### Boshqa filialga o'tkazish

- `transferStudentAction` (`students.edit`, "tasdiq bilan" bo'la oladi — reyestrda `students.transfer`). Bitta
  tranzaksiyada:
  - o'quvchi filiali o'zgaradi;
  - ochiq a'zoliklar shu kun bilan yopiladi (muzlatish davrlari ham);
  - sabab yoziladi.
- Yangi filialdagi guruhga keyin "Guruhga qo'shish" orqali qo'shiladi.
- To'lovlar va chegirmalar o'quvchiniki bo'lib qoladi — balans o'zgarmaydi.
- Jurnalga `student.transfer` yoziladi (qaysi filialdan, qaysi filialga, nechta a'zolik yopildi).
- Tahrirlash formasida filial endi o'zgarmaydi. Server ham tahrirlashda filialni saqlangan qiymatda qoldiradi: tepada
  boshqa filial tanlangan bo'lsa ham o'quvchi u yerga o'tib ketmaydi.

## Oqibatlari

- Coin tizimi qo'shilganda "Coin" kartasi haqiqiy qiymatni oladi.
- To'lovlarda filial ustuni yo'q. O'tkazilgan o'quvchining oldingi to'lovlari hisobotlarda yangi filialda ko'rinadi —
  eski tizimdagidek.
