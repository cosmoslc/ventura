# ADR 0071: Sawmill — Kunlik ishlar va ish haqi (S3)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md), [ADR 0069](file:///home/warcassa/Projects/Ventura/docs/decisions/0069-sawmill-malumotnomalar-va-sozlamalar.md), [ADR 0070](file:///home/warcassa/Projects/Ventura/docs/decisions/0070-sawmill-teraklar-ombor-xarajatlar.md)

---

## 1. Kontekst va Muammo

Flutter ilovasida kunlik ishlar va ish haqi hisob-kitoblarida jiddiy kamchiliklar mavjud bo'lgan:
1. **Maosh hisoblanmasligi (K1):** Kunlik, haftalik yoki oylik belgilangan maoshli ishchilarning ish haqi avtomatik hisoblanmagan va terak xarajatiga kirmagan.
2. **Guruh ishida maxsus narxlar va guruh ID yo'qligi (K2, K3):** Guruh ishlari bitta umumiy guruh identifikatorisiz saqlanib, bir xil sana va izoh bo'yicha birlashtirilgan, bo'linishdagi qoldiq so'mlar yo'qolgan (K15). Eng muhimi, omborga har bir ishchi soni bo'yicha qayta-qayta zaxira qo'shilib ketgan!
3. **Sartirofka qattiq matn bo'lgani (K4):** "Sartirofka" nomi o'zgartirilsa yoki boshqa tilda bo'lsa res nazorati ishlamagan.
4. **To'lov sanasi va boshqaruvi (K6):** To'lov sanasi har doim "hozirgi vaqt" bo'lgan, tahrirlash yoki o'chirish imkoni bo'lmagan.
5. **Ish o'chirilganda ombor buzilishi (K13):** Ish o'chirilganda qo'shilgan material ombordan qaytarilmagan.

---

## 2. Qabul qilingan qarorlar

### 2.1. Sof hisob-kitob modullari (`lib/calc/pay.ts` va `lib/calc/balance.ts`)
- `resolveWorkerPrice`: Maoshli ishchilarga ish bo'yicha narx 0 beriladi. Ishbay ishchilarga esa maxsus narx (`worker_material_prices`) bo'lsa u ustun turadi, aks holda terakdagi bazaviy narx olinadi.
- `calculateSingleWork`: Yakka ish uchun ish haqi va omborga qo'shiladigan zaxira (dona, qator, kub bo'yicha) hisoblanadi.
- `calculateGroupWork`:
  - `payFullToEach = true`: Har bir ishbay ishchiga to'liq summa beriladi.
  - `payFullToEach = false`: Jami summa ishbay ishchilar orasida teng bo'linadi. **K15 qarori bo'yicha** bo'lishdan qolgan qoldiq so'm birinchi ishchiga beriladi va yig'indi doim jami summaga teng bo'ladi.
  - **Ombor zaxirasi FAQAT BIR MARTA** qo'shiladi (ishchilar soniga ko'paytirilmaydi).
- `calculateWorkerBalance`: Ishchining balansi = `totalEarned - totalPaid`. Musbat balans korxonaning ishchiga qarzdorligini, manfiy balans ishchi avans olganligini bildiradi.

### 2.2. Kunlik ishlar sahifasi (`/work`)
- Yakka ish dialogi (`SingleWorkDialog`): Oddiy ish (qo'lda summa) va Material ishlab chiqarish (dona, qator, kub) turlari, jonli summa va ombor kiritilishi oldindan ko'rinishi.
- Guruh ishi dialogi (`GroupWorkDialog`): Bir nechta ishchini tanlash, har biriga to'liq yoki teng taqsimlash, har bir ishchining ulushi va omborga 1 marta qo'shilishi oldindan ko'rinishi.
- Sartirofka va Res nazorati (K4): `workTypes.kind = 'sorting'` bo'lgan ishlarda terakdagi `remainingRes` tekshiriladi. Agar `remainingRes <= 0` bo'lsa, xatolik beriladi va ruxsat berilmaydi.
- Ish o'chirilganda (`deleteWorkAction`):
  - Yakka ish o'chirilganda bog'liq ombor harakati va terakdagi qoldiq qaytariladi.
  - Guruh ishi o'chirilganda `work_groups` o'chiriladi (barcha ishchilarning `work_entries` yozuvlari kaskad o'chadi) va guruh bo'yicha 1 marta qo'shilgan ombor zaxirasi to'liq qaytariladi.

### 2.3. Ishchi profili (`/workers/[id]`)
- Ishchi kartasi va 3 ta asosiy ko'rsatkichli balans paneli: Jami ishlagan, To'langan, Hozirgi balans (holatiga ko'ra yashil/sariq belgi).
- To'lov berish (`PaymentDialog` — K6): Summa > 0, sana tanlash, izoh. O'chirish va tahrir auditga yoziladi.
- Maosh hisoblash (`WageAccrualDialog` — K1):
  - Belgilangan maoshli ishchilar uchun davr (boshlanish, tugash sanasi), birliklar soni (kun/hafta/oy) va stavka.
  - Natijada bitta companion `work_entries` (tizim turi "Maosh") va `wage_accruals` yozuvi yaratiladi.
  - Ixtiyoriy terak tanlansa, terakning ish haqi xarajatiga kiritiladi.
  - Bitta davr uchun ikki marta maosh hisoblash rad etiladi (`wage_accruals_period_uq`).
- Maxsus narxlar (`SpecialPriceDialog` — K2): Ishchiga har bir material bo'yicha terakdan mustaqil maxsus dona/qator narxi belgilash va o'chirish.

### 2.4. Terak sahifasidagi Ishlar tabi (`/teraks/[id]`)
- Terakka biriktirilgan barcha yakka va guruh ishlari ro'yxati, sana, ishchi, miqdor va hisoblangan summa jadvali.
- Terak bo'yicha jami to'langan ish haqi xarajati hisobi.

---

## 3. Natijalar

- S3 to'liq yakunlandi va qabul qilindi.
- Barcha amallar `tenantAudit.record` orqali qayd etiladi.
- `apps/sawmill`:
  - `pnpm --filter @ventura/sawmill typecheck` — 0 xato.
  - `pnpm --filter @ventura/sawmill lint` — 0 ogohlantirish, 0 xato.
  - `pnpm --filter @ventura/sawmill test` — 16 ta test fayli, 47 ta test 100% yashil.
  - `pnpm --filter @ventura/sawmill build` — Next.js Turbopack muvaffaqiyatli qurildi.
- Keyingi bosqich: **S4 (Yuk chiqarish, yuk mashinalari, zakazlar va eslatmalar)**.
