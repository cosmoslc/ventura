# ADR 0069: Sawmill — Ma'lumotnomalar va sozlamalar (S1)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md)

---

## 1. Kontekst va Muammo

Pilorama (Sawmill) ilovasining S1 bosqichida tizimning poydevori hisoblangan ma'lumotnomalar va hisoblash sozlamalarini yaratish talab etiladi:
1. Yog'och o'lchamlari va kub metri hisob-kitoblari (Flutter ilovasida uchragan birliklar va yaxlitlash xatolarini bartaraf etish).
2. Ishchilar ro'yxati, maosh turlari (dona, kunlik, haftalik, oylik) va stavkalar.
3. Materiallar katalogi, birliklar, hisoblash turlari (dona/qator) va o'lcham variantlari (`material_sizes`).
4. Yuk mashinalari katalogi va reys narxlari.
5. Sex sozlamalari va ish turlari boshqaruvi.

---

## 2. Qabul qilingan qarorlar

### 2.1. O'lcham va hajm hisob-kitobi (`lib/calc/units.ts`)
- **Yagona saqlash birligi:** Bazada barcha o'lchamlar qat'iy ravishda **santimetr** (`numeric(8, 2)` sm) bo'lib saqlanadi.
- **Foydalanuvchi birligi:** Sozlamadagi o'lcham birligi (`dimensionUnit: "mm" | "sm" | "m"`) faqat kiritish va ko'rsatish qatlamida konvertatsiya qilinadi:
  - $\text{sm} = \text{qiymat} \times \{\text{mm}: 0.1,\ \text{sm}: 1,\ \text{m}: 100\}$.
- **1 dona hajmi:** $V = \frac{q}{100} \times \frac{e}{100} \times \frac{u}{100}\ \text{m}^3$ (uchala o'lcham ham musbat bo'lsa; aks holda `null`).
- **Dona $\leftrightarrow$ Kub:** $\text{kub} = \text{dona} \times V$, $\text{dona} = \frac{\text{kub}}{V}$.

### 2.2. Ishchilar va arxivlash (K7 qarori)
- Ishchini butunlay o'chirib yuborish o'rniga arxivlash (`archivedAt`) joriy etildi. Bu ishchining o'tmishdagi barcha ishlari, berilgan avanslari va balansini xavfsiz saqlab qoladi.
- Maosh turlari: `piecework` (ishiga qarab), `daily` (kunlik), `weekly` (haftalik), `monthly` (oylik). Kunlik/haftalik/oylik ishchilar uchun stavka summasi saqlanadi.

### 2.3. Materiallar katalogi va o'lchamlar
- Materiallar nomlanishi va birligi bilan birga hisoblash usuli (`pricingMode: "piece" | "row"`) belgilanadi.
- Asosiy o'lchamlardan tashqari har bir materialga `material_sizes` jadvali orqali istalgancha variant o'lchamlar qo'shilishi mumkin. Har bir variantning hajmi avtomatik hisoblanadi.

### 2.4. Yuk mashinalari (K5 qarori)
- Yuk mashinasining 1 reysi narxi saqlanadi. K5 qaroriga muvofiq, keyingi bosqichlarda yuk chiqarishda mashina tanlansa, transport summasi terak xarajatiga qo'shiladi va ishchi balansiga aralashmaydi.

### 2.5. Sex sozlamalari (`settings`)
- Sozlamalar `settings` jadvalida JSONB formatida `key = "general"` kaliti bilan saqlanadi:
  - `profitMode`: `"estimated"` (taxminiy) yoki `"actual"` (haqiqiy sotuv bo'yicha).
  - `qtyDisplay`: `"piece"`, `"cube"` yoki `"both"`.
  - `cubeInputMode`: `"direct"` (m³ kiritish) yoki `"calculated"` (donadan hisoblash).
  - `dimensionUnit`: `"mm"`, `"sm"` yoki `"m"`.
- Standart ish turlari ("Sartirofka", "Terak kesish") `isSystem = true` sifatida belgilanib, tasodifiy o'chirishdan himoyalangan.

### 2.6. UI va xavfsizlik
- Barcha shakllar `@ventura/ui` komponentlari (`Modal`, `ConfirmModal`, `Card`, `Badge`, `Button`, `Input`, `Label`, `PhoneInput`) va Ventura dizayn tokenlariga tayanadi.
- Barcha o'zgartirishlar `tenantAudit.record` orqali faoliyat jurnaliga qayd etiladi.
- Amallar `can(user.role, permission)` orqali tekshiriladi.

---

## 3. Oqibatlar va Natijalar

- Ishchilar, materiallar, o'lchamlar, yuk mashinalari va sozlamalar to'liq ishga tushirildi.
- Barcha sahifalar ikki tilda (UZ / RU) to'liq qo'llab-quvvatlanadi.
- Barcha testlar (`typecheck`, `eslint`, `vitest`) 100% yashil o'tdi.
- Keyingi bosqich: **S2 (Teraklar, ombor va xarajatlar)**.
