# ADR 0073: Sawmill — Bosh sahifa, umumiy xarajatlar va hisobotlar (S5)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md), [ADR 0070](file:///home/warcassa/Projects/Ventura/docs/decisions/0070-sawmill-teraklar-ombor-xarajatlar.md), [ADR 0071](file:///home/warcassa/Projects/Ventura/docs/decisions/0071-sawmill-ishlar-va-ish-haqi.md), [ADR 0072](file:///home/warcassa/Projects/Ventura/docs/decisions/0072-sawmill-yuk-chiqarish-va-zakazlar.md)

---

## 1. Kontekst va Muammo

Eski Flutter ilovasida bosh sahifa, rentabellik va hisobotlar bo'yicha quyidagi jiddiy tizimli kamchiliklar mavjud edi:
1. **Umumiy xarajatlarning yo'qligi (K14):** Sex ijarasi, elektr energiyasi, soliqlar yoki terakka bog'lanmagan boshqa umumiy operatsion xarajatlar tizimda yuritilmagan. Natijada korxona haqiqiy sof foydasi sun'iy ravishda oshirib ko'rsatilgan.
2. **Foyda hisoblash usuli chalkashligi:** Faqat kassa tushumiga asoslangan (haqiqiy/real) foyda va hali sotilmagan ombordagi tayyor mahsulotlar qiymatini hisobga oluvchi (taxminiy/kutilayotgan) foyda o'rtasida aniq ajratish bo'lmagan.
3. **Haftalik sotuv grafigidagi nomuvofiqlik (K11):** Oxirgi 7 kunlik grafikda dona va summa bitta shkalada aralashib ketgan yoki sana bo'yicha noto'g'ri guruhlangan.
4. **Excel eksport va batafsil hisobotlarning yo'qligi:** Foyda, ish haqi yoki yuk chiqarish bo'yicha davr filtrlari va buxgalteriya talablariga mos chiroyli formatlangan Excel jadvallari mavjud emas edi.

---

## 2. Qabul qilingan qarorlar

### 2.1. Sof hisob-kitob moduli (`lib/calc/profit.ts`)
- `calculateTerakProfit`:
  - `totalCosts = purchasePrice + additionalCosts + workCosts`.
  - `profitEstimated = dispatchRevenue + stockValue - totalCosts`.
  - `profitReal = dispatchRevenue - totalCosts`.
  - `marginEstimated = totalCosts > 0 ? (profitEstimated / totalCosts) * 100 : 0`.
  - `marginReal = totalCosts > 0 ? (profitReal / totalCosts) * 100 : 0`.
- `calculateOverallProfit` (K14 qoidasi):
  - Alohida teraklar foydasi jamlanadi.
  - Davr bo'yicha kiritilgan barcha `generalExpenses` summasi umumiy foydadan chegiriladi:
    $$\text{Sof Foyda} = \sum \text{TerakFoydasi} - \sum \text{UmumiyXarajatlar}$$
  - Foydalanuvchi "Taxminiy (ombor qoldig'i bilan)" yoki "Haqiqiy (faqat sotuv tushumi)" usulini bitta tugma bilan almashtirishi mumkin.
- `calculateWeeklyChart` (K11 qoidasi):
  - Oxirgi 7 kunlik sotuvlar sana bo'yicha guruhlanadi.
  - Dona (`pieces`) va summa (`amount`) alohida hisoblanadi.
  - Bugungi kunga to'g'ri kelgan ustun `isToday: true` bilan ajratib ko'rsatiladi.

### 2.2. Umumiy xarajatlar sahifasi (`/expenses` — K14)
- Toifalar (`expenseCategories`): Ijara, Elektr energiyasi, Soliq, Boshqa. Arxivlash va boshqarish imkoniyati.
- Umumiy xarajatlar (`generalExpenses`): Sana, toifa, summa, izoh.
- Barcha summa inputlarida `@ventura/ui/money-input` ishlatildi (minglik ajratkich bilan).

### 2.3. Bosh sahifa (Dashboard — `/`)
- Terak tanlash selektori: "Barcha teraklar (Umumiy)" yoki alohida bir dona terak.
- 4 ta asosiy KPI kartalari:
  1. Sof foyda (taxminiy / haqiqiy rejimida almashadi).
  2. Sotuv daromadi (jami yuk chiqarish tushumi).
  3. Jami xarajatlar (teraklar xarajati + K14 umumiy xarajatlar).
  4. Ombor qiymati (ombordagi tayyor materiallar qiymati).
- Haftalik sotuv grafigi (K11 visual bar chart).
- Diqqat talab zakazlar (tayyor yoki topshirish muddati yaqinlashgan buyurtmalar).
- Ombordagi mahsulotlar qoldiqlari ro'yxati.

### 2.4. Hisobotlar va Excel eksport (`/reports` va `/api/reports/excel`)
- 3 ta to'liq tab:
  1. **Teraklar bo'yicha foyda:** Har bir terakning xarid narxi, qo'shimcha xarajatlari, ish haqi, jami xarajati, tushumi, ombor qiymati, taxminiy va haqiqiy foydasi, rentabelligi. Pastda K14 umumiy xarajatlari va umumiy yakuniy sof foyda.
  2. **Ishchilar ish haqi:** Davr filtri (boshlanish va tugash sanasi) bo'yicha jami ishlagan, to'langan va qoldiq balans.
  3. **Yuk chiqarish (Sotuv):** Davr va terak filtrlari bo'yicha sana, terak, material, dona, hajm (m³), jami summa, mijoz va transport.
- **ExcelJS eksport:** `/api/reports/excel?type=profit|wages|dispatch` orqali to'liq rangli sarlavha, ustun o'lchamlari va avtomatik yuklab olish imkoniyati.

---

## 3. Oqibatlar va Xulosa

- K14 talabi to'liq bajarildi: umumiy xarajatlar terak tannarxini buzmaydi, lekin korxonaning umumiy sof foydasidan to'g'ri ayriladi.
- Bosh sahifa barcha operatsion ko'rsatkichlarni bir joyda shaffof va tezkor ko'rsatadi.
- Barcha kiritish formalarida minglik ajratkichli `MoneyInput` qo'llanildi.
- Vitest testlari: 23 ta test fayli, 79 ta test 100% muvaffaqiyatli o'tdi.
- Next.js production build (`pnpm --filter @ventura/sawmill build`) 0 xato bilan yakunlandi.
