# ADR 0070: Sawmill — Teraklar, ombor va xarajatlar (S2)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md), [ADR 0069](file:///home/warcassa/Projects/Ventura/docs/decisions/0069-sawmill-malumotnomalar-va-sozlamalar.md)

---

## 1. Kontekst va Muammo

Sawmill (Pilorama) tizimida asosiy operatsion birlik bu **Terak** (yog'och xaridi partiyasi) hisoblanadi. Flutter ilovasida:
1. Terak o'chirilganda daromadlar o'chib ketar, ish haqlari esa qolib foyda hisobi buzilar edi (K8).
2. Materiallar terakka qo'shilishi va ularning narxlari noaniq boshqarilgan.
3. Res olib kelish xarajatlari va sartirofka reslari o'rtasida qolgan reslar soni chalkashliklarga sabab bo'lgan.
4. Til almashtirilganda sahifa yangilanishida sozlama yo'qolib qolishi foydalanuvchi tomonidan bildirildi.

---

## 2. Qabul qilingan qarorlar

### 2.1. Til barqarorligi (Cookie va foydalanuvchi profili)
- Foydalanuvchi yuqori paneldan tilni (UZ yoki RU) o'zgartirganda `setLocaleAction` server amali chaqiriladi:
  - `sawmill_locale` cookie'si 1 yil muddatga o'rnatiladi.
  - Tizimga kirgan foydalanuvchining `users.locale` ustuni bazada yangilanadi.
  - Natijada sahifa yangilanganda (refresh) yoki qayta kirilganda tanlangan til saqlanib qoladi.

### 2.2. Terak boshqaruvi va Savat tizimi (K8 qarori)
- Nom berish: Agar foydalanuvchi nom kiritmasa, tizim avtomatik "Terak N" deb nomlaydi.
- Avtomatik ombor: Terak yaratilganda katalogdagi barcha faol materiallar ushbu terakka `quantity = 0` bilan bog'lanadi.
- Savat (Trash): O'chirish amali terakni savatga (`deletedAt = now()`) o'tkazadi. Savatdagi teraklar ro'yxatida ularni qayta tiklash (`restore`) yoki faqat egasi (`owner`) tomonidan butunlay o'chirish (`permanentDelete`) mumkin.
- Savatdagi teraklar bosh sahifa va kelgusi hisobotlarga kirmaydi.

### 2.3. Terak ichidagi Ombor va Narxlash
- Har bir terak uchun materiallarning narxlari mustaqil ravishda belgilanadi:
  - `workerPrice`: ishchi dona narxi.
  - `sellingPrice`: sotish dona narxi.
  - `cubeWorkerPrice`: ishchi kub narxi (material kubga aylansa).
  - `cubePrice`: sotish kub narxi.
  - `goal`: partiya bo'yicha maqsad qilingan miqdor.
- **Ombor qiymati:** `sellingPrice > 0 ? quantity * sellingPrice : (cubePrice > 0 && vol ? quantity * vol * cubePrice : 0)`.
- **Maqsad progressi:** `min(1, quantity / goal)` vizual progress bar bilan ifodalanadi.

### 2.4. Qo'shimcha xarajatlar va Res hisobi (SAWMILL-TAHLIL 8-qism)
- Xarajat turlari: `transport` (tashish), `res` (res olib kelish), `truck` (yuk mashinasi), `other` (boshqa).
- "Res olib kelish" xarajati: `trips` (reys soni) $\times$ `pricePerTrip` = `amount`.
- Jami reslar soni: $\Sigma\ \text{trips}$ (`kind = 'res'`).
- Qolgan reslar: $\max(0, \text{jamiRes} - \text{sartirofkaSoni})$.

---

## 3. Natijalar

- `/teraks` (partiyalar ro'yxati va savat) va `/teraks/[id]` (terak paneli, ombor va xarajatlar) to'liq ishga tushirildi.
- Barcha amallar `tenantAudit.record` orqali auditga olindi.
- Barcha testlar (`typecheck`, `eslint`, `vitest` — 30 ta test) 100% yashil holatda.
- Keyingi bosqich: **S3 (Kunlik ishlar, sartirofka va hisob-kitoblar)**.
