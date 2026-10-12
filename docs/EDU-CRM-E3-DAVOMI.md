# E3 (Moliya) davomi — keyingi qismlar uchun eslatma

2026-10-12 · E3a tayyor (ADR 0015, PR #20). E3b, E3c va E3d shu hujjat bo'yicha davom ettiriladi.

## Qabul qilingan qarorlar (Saidakbar, 2026-10-12)

1. **Qarz yig'ilib boradi.** O'quvchining bitta balansi bor, ortiqcha to'lov keyingi oyga o'tadi.
2. **Oylik to'lov usuli sozlamada tanlanadi.** Ikki usul bor: oylik (darsga mutanosib) va har dars uchun. Standart — oylik.
3. **Guruh narxi tanlangan oydan amal qiladi.** O'tgan oylar o'zgarmaydi.
4. **Menejer KPI shu oy bo'yicha hisoblanadi:**
   - oylik maosh;
   - shu oyda birinchi marta faollashtirilgan yangi o'quvchilar × o'quvchi summasi;
   - 1 oy o'qib, to'liq to'lagan o'quvchilar × bonus.

   O'quvchi uni qo'shgan menejerga yoziladi. Buning uchun `students.created_by` ustuni kerak.

Asosiy qoida: hisob faqat `lib/billing.ts` va `lib/ledger.ts` dan olinadi, boshqa joyda formula yozilmaydi.

## E3b. Xarajatlar va qo'shimcha daromad

**Eski tizimda nima bor edi:**
- `finance` jadvali (`type`, `amount`, `category` matni, `date`, `status`, `expense_type`, `payment_method`, `staff`), toifalar va oylik rejalar.
- Xarajatlar sahifasining tablari: o'zgaruvchi, o'zgarmas, toifalar, rejalashtirish.
- Filtrlar: sabab, xodim, toifa, to'lov usuli, sana. Bitta KPI: jami.
- Rejada sarf foizi: 80% dan oshsa sariq, 100% dan oshsa qizil.
- Qo'shimcha daromad sahifasi: nomi, toifa, to'lov turi, summa, to'lovchi.

**Eski tizimdagi xatolar — takrorlanmaydi:**
- Qo'shimcha daromad hech qaysi hisobotga kirmagan.
- Filialsiz xarajat bir sahifada hamma filialda ko'ringan, boshqasida esa umuman ko'rinmagan.
- Toifa matn sifatida saqlangan va hech qanday tekshiruvsiz o'chirilgan.
- Uchta har xil toifa ro'yxati bor edi.
- Rejalar va qo'shimcha daromad tarixsiz o'chirilgan.

**Ruxsatlar:**

| Amal | Ruxsat |
| --- | --- |
| Ko'rish | `expenses.view` |
| Qo'shish | `expenses.create` |
| Tahrirlash va o'chirish | `expenses.edit_delete` |
| Toifalar | `expenses.categories` |
| Qo'shimcha daromadni ko'rish | `additional_income.view` |
| Qo'shimcha daromad kiritish | `additional_income.create` |

## E3c. Ish haqi

**O'qituvchi maoshi:**
- Guruh sozlamasi bo'sh bo'lsa (`null`), o'qituvchining o'z sozlamasi ishlaydi. Eski tizimda 0% guruh sozlamasi ustun turar edi.
- **Foiz turi.** Asos — guruhga, shu oy belgisi bilan tushgan naqd pul (`payments.kind = payment`, qaytarish manfiy).
  - Har to'lov uchun `round(summa × koeffitsient × foiz / 100)`.
  - Koeffitsient = o'qituvchi narxi / to'langan narx. O'qituvchi narxi `discountedPrice(..., { teacherOnly: true })` bilan olinadi.
- **Har o'quvchi uchun turi.**
  - Chegara = `round(stavka × oylik hisob / to'liq narx)`.
  - Ulush = `round(chegara × min(1, to'langan / oylik hisob))`.
  - Oylik hisob 0 bo'lsa, ulush 0.
- **Belgilangan turi.**
  - Guruhdagi o'zgacha summa har guruh uchun alohida qo'shiladi.
  - O'qituvchining o'z oyligi oyiga bir marta beriladi, guruhlari bo'lmasa ham (support o'qituvchilar).

**Menejer maoshi:** 4-qarorga qarang.

**To'lovlar:**
- Turlar: maosh va avans; bonus va jarima — alohida.
- Har biri oy, to'lov usuli, sana va izoh bilan saqlanadi.
- Qoldiq = hisoblangan + bonus − jarima − to'langan. Qoldiq hamma ekranda bitta formula bilan hisoblanadi.

**Eski tizimdagi xatolar — takrorlanmaydi:**
- To'lov usuli va menejer to'lovining turi saqlanmagan.
- Tahrirlashda oy o'zgarmagan.
- "Mukofot" maosh sifatida saqlangan.
- Qoldiq 4 xil formula bilan hisoblangan.
- Menejer balansi qo'lda yuritilgan.
- Ortiqcha to'lov ikki marta sanalgan.

**Ruxsatlar:**

| Amal | Ruxsat |
| --- | --- |
| Ko'rish | `salaries.view` |
| To'lash | `salaries.pay` |
| Avans | `salaries.advance_manage` yoki `finance.advance_give` |
| Bonus va jarima | `salaries.kpi_edit` |

## E3d. Tasdiq so'rovlari va pul auditi

**Tasdiq so'rovlari:**
- Lavozimda har ruxsat uchun uch holat: "ruxsat", "tasdiq bilan" yoki "taqiq".
- Eski tizimda tasdiq qilinmaydigan ruxsatlar: `dashboard.*`, `*view`, `*export`, `*print`, `settings.roles_permissions`, `settings.logs`, `staff.roles_assign`.
- "Tasdiq bilan" amal bajarilmaydi, `approval_requests` jadvaliga yoziladi:
  - so'rov ma'lumotlari: ruxsat, amal, sarlavha, qisqa mazmun, Zod bilan tekshirilgan payload;
  - holatlar: kutilmoqda, tasdiqlandi, rad etildi, bekor qilindi.
- Direktor tasdiqlasa, amal server reyestridan, direktor nomidan bajariladi. Bajarilmasa, so'rov qayta ochiladi va sabab yoziladi.
- Menejer faqat o'zining kutilayotgan so'rovini bekor qila oladi.
- Menyuda: direktorga "Tasdiqlar (n)", menejerga "So'rovlarim (n)".

**Pul auditi:**
- Pul amallari allaqachon `tenantAudit` ga yoziladi.
- Direktor uchun pul amallari tarixi sahifasini qo'shish kerak. Eski tizimda bunday sahifa umuman yo'q edi.

## Muhit eslatmasi

- Deploydan keyin mijoz bazasi migratsiyasini ishga tushirish kerak: `pnpm db:migrate:tenant`. 0008 migratsiyasi moliya jadvallarini yaratadi.
- Moliya integratsiya testi CI'da "mijoz bazasi" vazifasida `TENANT_TEST_ADMIN_URL` bilan ishlaydi.
