# 0052. edu-crm: kartochka, jadval va filtrlar uchun yagona uslub

2026-10-17 · qabul qilingan · ADR 0047, 0051

## Vaziyat

Egasi sahifalarni birma-bir ko'rib chiqib, quyidagilarni so'radi:

- kartochkalarni soddalashtirish;
- amallarni bir joyga yig'ish;
- bo'shliqlarni kichraytirish.

Bir xil ko'rinadigan narsalar har sahifada boshqacha yozilgan edi:

- guruh nomi qutichasi;
- ro'yxat/kadrlar almashtirgichi;
- 3 nuqtali menyu;
- ko'rsatkich kartalaridagi qo'shimcha yozuvlar.

## Qaror

**Kartalar**

- `StatCard` va `MetricCard` da faqat asosiy yozuv va qiymat qoladi.
  - Pastdagi yordamchi yozuvlar (`hint`) sahifalardan olib tashlandi.
  - Yorliq 13px.
- Kartochkalardagi amallar (tahrirlash, o'chirish va boshqalar) **⋯ menyuda** (`DropdownMenu`) turadi.
  - Ular: kurslar, guruhlar, xonalar, to'lovlar jadvali.
  - Xavfli amal menyu oxirida, ajratgichdan keyin.
- Kurs kartochkasi: ikonka kurs rangida, foni shu rangning 14% i. Narx kichik, "Ko'rish" guruhlarga `?kurs=` bilan
  o'tadi.
- Xona kartochkasi va ro'yxati: faqat nom, sig'im va biriktirilgan guruhlar soni.

**Umumiy komponentlar**

- `GroupChip` (`app/(crm)/student-table.tsx`) — guruh qutichasi: o'quvchilar, to'lovlar, qarzdorlar.
- `ViewSwitch` / `ListGridSwitch` (`packages/ui/view-switch.tsx`):
  - aktiv tanlov ostida oq "tabletka" sirpanadi;
  - aktiv yozuv brend rangida (`text-primary`) — brend almashsa o'zi moslashadi;
  - ro'yxat/kadrlar ko'rinishi bor har sahifa shuni ishlatadi.

**To'lovlar va qarzdorlar**

- Guruh bo'yicha qutilar o'rniga **bitta jadval**: № ustuni, "Yana 30 ta".
- To'lovlarda:
  - saralash: sana yangi/eski, summa ko'p/kam;
  - "Chek" ustuni yo'q (chek raqami bo'yicha qidiruv qoladi).
- Qarzdorlarda o'quvchi ostida bitta raqam (o'quvchi, bo'lmasa ota-ona).
- Guruh filtri tanlansa, qarz va oylar shu guruh bo'yicha chiqadi.

**Filtrlar va dropdown**

- `Select` / `FilterSelect` da 12 tadan ko'p qiymat bo'lsa ichki qidiruv chiqadi.
- Dropdown pastga ochiladi, ichki aylantirish orqadagi sahifaga o'tmaydi, bandlar ixchamroq.

**Bo'shliqlar**

- Asosiy maydon `p-4 sm:p-5 lg:p-6`.
- Bo'limlar orasidagi oraliqlar bir pog'ona kichraytirildi (`space-y-6 → 4`, `gap-6 → 4`).
- `PageHeader` pastidan `mb-5`.

**Guruh profili**

- Chapda yopishqoq karta, o'ngda KPI kartalar.
- Davomat bitta jadvalda: hover/bosish bilan kengayadi; ✓ / ✕ / "S" (sababli, sariq) va sabab.
- Filial qatori faqat "Barcha filiallar" tanlanganda ko'rinadi.
- Lavozimlar sahifasida chap ro'yxat ham yopishqoq.

## Oqibat

- Yangi sahifa shu komponentlarni olishi kerak, o'zinikini yozmaydi.
- Ishlatilmay qolgan `GroupBoxHeader` va matn kalitlari o'chirildi.
- Bo'shliqlar hali sahifalarda klass sifatida yozilgan. Ularni bitta tokenga (`--page-gap`) o'tkazish — keyingi qadam.
