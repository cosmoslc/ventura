# 0016. edu-crm E3b: xarajatlar, toifalar, oylik rejalar va qo'shimcha daromad

2026-10-13 · qabul qilingan · EDU-CRM-PLAN E3 (ikkinchi qism), EDU-CRM-E3-DAVOMI "E3b"

## Vaziyat

Eski tizimda (cosmoslc) xarajatlar `finance` jadvalida matnli toifa bilan saqlanar edi. Asosiy muammolar:

- Toifa matn edi va tekshiruvsiz o'chirilar edi. Uchta har xil standart ro'yxat bor edi (sahifada, API'da, hisobotda).
- Filialsiz xarajat bir sahifada hamma filialda ko'rinar, boshqasida umuman ko'rinmas edi.
- Rejalar va qo'shimcha daromad tarixsiz o'chirilar edi.
- Reja xodim nomi bo'yicha solishtirilar edi; foiz yaxlitlangach solishtirilar edi (100,4% "100%" bo'lib sariq ko'rinar edi).
- Qo'shimcha daromad hech qaysi hisobotga kirmas edi.
- Xarajat va qo'shimcha daromadning to'lov usullari o'quvchi to'lovlaridagi ro'yxatdan alohida, qattiq yozilgan edi.

## Qaror

### Jadvallar (0009 migratsiyasi, hammasida FORCE RLS)

| Jadval | Mazmuni |
| --- | --- |
| `finance_categories` | Xarajat va qo'shimcha daromad toifalari (`kind`), bitta ro'yxat. Nomi tur ichida noyob. `active` — faolsiz toifa yangi yozuvda tanlanmaydi |
| `finance_category_branches` | Toifa qaysi filiallarda tanlanadi; qator yo'q — barcha filiallarda (eski tizimdagi "Barcha filiallar / Tanlangan") |
| `expenses` | Filial, tur (o'zgaruvchi / o'zgarmas), toifa, sabab, summa, sana, to'lov usuli, pulni olgan xodim **yoki** o'qituvchi (ixtiyoriy), bekor qilish ustunlari |
| `additional_incomes` | Filial, toifa, nomi, summa, sana, to'lov usuli, to'lovchi (matn), bekor qilish ustunlari |
| `expense_plans` | Filial + toifa + oy limiti; ixtiyoriy to'lov usuli va xodim bo'yicha toraytiriladi |

- **Har yozuv bitta filialga tegishli** (`branch_id NOT NULL`). Markazda doim kamida bitta filial bor. Pul yozuvi bor filial o'chirilmaydi (FK `restrict` va Filiallar sahifasidagi tekshiruv); reja filial bilan birga o'chadi.
- **To'lov usuli** — `payment_methods` (o'quvchi to'lovlaridagi ro'yxat, To'lov sozlamalarida boshqariladi).
- **Toifalar** mijozda birinchi ochilganda eski tizimdagi standart ro'yxatdan yaratiladi (10 ta xarajat, 5 ta daromad). Ishlatilgan toifa o'chirilmaydi — faolsizlantiriladi; ishlatilmagani o'chiriladi (FK ham himoya qiladi).
- **Pul yozuvlari o'chirilmaydi** — bekor qilinadi (kim, qachon, sabab), tiklash mumkin. Bekor qilingan yozuv jami va rejaga kirmaydi.
- **Reja** pul yozuvi emas: o'chiriladi, lekin to'liq nusxasi faoliyat jurnalida qoladi.
- Sana: kelajakda emas va bir yildan eski emas (to'lovlardagidek). Tahrirlashda sana o'zgarmasa tekshirilmaydi.

### Reja bajarilishi (`lib/expense-plans.ts`, toza funksiyalar, Vitest)

- Rejaga tushadigan xarajat: o'sha filial, o'sha toifa, sanasi rejaning oyida, bekor qilinmagan. Rejada to'lov usuli yoki xodim tanlangan bo'lsa — faqat shular (id bo'yicha).
- Haqiqiy sarf saqlanmaydi, har safar hisoblanadi.
- Holat: sarf ≥ limitning 80% — sariq; sarf > limit — qizil. Solishtirish yaxlitlashdan oldin.
- `Meter` komponentiga `state` (holatni chaqiruvchi beradi) va `overflow` (100% dan oshgan foiz matnda haqiqiy) qo'shildi (STYLE.md 11.29).

### Ko'rinish

- **Xarajatlar** (`/expenses`), tablar eski tizimdagidek:
  - O'zgaruvchi va O'zgarmas xarajatlar: sana oralig'i (standart — joriy oy), xodim, toifa, to'lov usuli, sabab bo'yicha qidiruv, bekor qilinganlar. Jami summa, 20 tadan sahifalash. Tahrirlash, bekor qilish, tiklash.
  - Toifalar: xarajat va daromad toifalari yonma-yon; filiallar, ishlatilishi, faollik, tahrirlash, o'chirish.
  - Rejalashtirish: oy, toifa, xodim va to'lov usuli filtrlari; jami limit, haqiqiy xarajat va bajarilish; har reja uchun sarf chizig'i va qoldiq.
- **Qo'shimcha daromadlar** (`/additional-income`, menyuda Xarajatlar ostida): Jami, yozuvlar soni, asosiy manba; sana, toifa, to'lov turi filtrlari; tahrirlash, bekor qilish, tiklash.
- Eski tizimdagi "Boshqa xodimlar" tabi u yerda ham bo'sh ("tayyorlanmoqda") edi — olinmadi.

### Ruxsatlar (eski katalog va eski tizimdagi tekshiruvlar)

| Amal | Ruxsat |
| --- | --- |
| Xarajatlar va rejalarni ko'rish | `expenses.view` / `expenses.create` / `expenses.edit_delete` |
| Xarajat kiritish, rejalar | `expenses.create` |
| Xarajatni tahrirlash, bekor qilish, tiklash | `expenses.edit_delete` |
| Toifalar (ikkala tur) | `expenses.categories` |
| Qo'shimcha daromadni ko'rish | `additional_income.view` / `additional_income.create` |
| Qo'shimcha daromad: kiritish, tahrirlash, bekor qilish, tiklash | `additional_income.create` |

Filial cheklovi bor xodim faqat o'z filiallaridagi yozuv va toifani boshqaradi; "barcha filiallar" toifasi — cheklovsiz xodim.
Har o'zgartiruvchi amal jurnalga yoziladi (`expense.*`, `additional_income.*`, `finance_category.*`, `expense_plan.*`).

### Sinov

- Vitest: reja mosligi (filial, toifa, oy chegaralari, bekor qilingan, to'lov usuli, xodim va o'qituvchi), 80%/limit chegaralari, 100,4% holati, jami.
- Haqiqiy PostgreSQL (`expenses.db.test.ts`, CI'dagi "mijoz bazasi" vazifasi): standart toifalar, filial cheklovi, bazadagi xarajatlardan reja bajarilishi, CHECK va FK himoyasi (summa, bitta shaxs, bekor qilish, ishlatilgan toifa, filial), boshqa mijoz ma'lumoti ko'rinmasligi.

## Oqibatlari

- E3d tasdiq so'rovlari shu server amallarini o'raydi (eski tizimdagi `status = pending` xarajatlar).
- E5 pul oqimi hisoboti xarajat va qo'shimcha daromadni shu jadvallardan oladi: **qo'shimcha daromad tushumga kiradi** (eski tizimda kirmas edi), bekor qilinganlar kirmaydi.
- E3c maosh to'lovlari `expenses` ga yozilmaydi — alohida jadval bo'ladi; pul oqimi hisoboti ikkalasini qo'shadi.
