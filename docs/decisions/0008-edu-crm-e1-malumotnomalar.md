# 0008. edu-crm E1: ma'lumotnomalar (filiallar, kurslar, xonalar) va filial tanlovi

2026-10-12 · qabul qilingan · EDU-CRM-PLAN E1 (birinchi qism)

## Vaziyat

E1 eski tizimning (cosmoslc) o'quv jarayoni bo'limlarini ko'chiradi; 13-qaror — ko'rinish, maydonlar, hisob-kitob va oqim bir xil.
Birinchi qism — boshqa bo'limlar tayanadigan ma'lumotnomalar: filiallar, kurslar, xonalar va tepadagi filial tanlovi.
Eski kodni o'rganganda bir nechta xato va soxta ko'rsatkich topildi: ular "bir xil" talabiga kirmaydi.

## Qaror

### Ko'chirish tamoyili

- **Bir xil:** sahifa tuzilishi, maydonlar, ustunlar, tugmalar, matnlar, hisob formulalari, saralash, bo'sh holatlar.
- **Ko'chirilmaydi:**
  - eski xatolar;
  - ma'lumot bo'lmaganda o'ylab topilgan raqamlar. Masalan "guruh narxi × 3" tushum, "+998 90 000-00-00" telefon, to'ldirish uchun qo'shilgan qarzdorlar. Yangi tizim faqat haqiqiy ma'lumotni ko'rsatadi, yo'q bo'lsa — 0 yoki bo'sh holat.
- **Tuzatilgan xatolar:**
  - filialni tahrirlash yangi filial yaratar edi;
  - filial telefoni va menejer biriktirish saqlanmas edi;
  - kursni o'chirish uning guruhlarini arxivsiz yo'q qilar edi;
  - filial o'chirilganda unga bog'langan yozuvlar "egasiz" qolar edi.
- **Hali ko'rsatilmaydi:** keyingi bosqich jadvallariga tayanadigan ko'rsatkichlar (guruh, o'quvchi, tushum) hozir 0. Ular o'sha jadvallar bilan to'ladi (E1c, E1d, E3). Filialning batafsil sahifasi (oylik grafiklar, qarzdorlar, muzlatilganlar) — E5 hisobotlari bilan.

### Ma'lumot

- **Kurs va xonaning `branch_id` si bo'sh bo'lishi mumkin:** bu markaz bo'yicha umumiy yozuv, hamma filialda ko'rinadi (eski tizimdagidek). Yangi yozuv har doim filialga tushadi.
- **Filialga havola `(tenant_id, branch_id)` kompozit kaliti bilan** (`branches_tenant_id_uq`):
  - oddiy FK RLS'ni chetlab o'tardi (0006, "Oqibatlari");
  - endi boshqa mijoz filialiga bog'lashni bazaning o'zi rad etadi;
  - ajratish testi buni tekshiradi;
  - keyingi bo'lim jadvallari (guruh, o'quvchi, to'lov) ham shu usulda bog'lanadi.
- **Filial `ON DELETE RESTRICT`.** Kursi yoki xonasi bor filialni o'chirib bo'lmaydi: amal nimalar borligini aytadi. Oxirgi filial ham o'chmaydi.
- **Kursni o'chirish — `archived_at`** (eski tizimda "arxivga ko'chirish"). Arxiv bo'limi (E1c) uni tiklaydi.
- **Xona butunlay o'chadi** (eski tizimdagidek arxivsiz). Guruhlar paydo bo'lgach ular xonasiz qoladi.
- **Pul so'mda, butun son** (`bigint`).
- **Rang `#rrggbb` ko'rinishida saqlanadi** (CHECK bilan). Bu foydalanuvchi ma'lumoti: palitralar `apps/edu-crm/lib/palette.ts` da, komponent esa faqat tokenlardan foydalanadi.

### Ruxsat va filial

- **Filiallarni faqat direktor o'zgartiradi** (`branches.write`, policy.ts). Boshqalar o'z filiallarini ko'radi.
- **Kurs va xonani menejer ham o'zgartiradi**, lekin faqat o'z filiallari va umumiy yozuvlarni. Xonalar `groups` bo'limiga tegishli: menyuda "Ofis" ostida, ruxsati `groups.write`.
- **Menejer biriktirish — `user_branches`** (filial formasida). Xodimning filial cheklovi har so'rovda shu jadvaldan olinadi, shuning uchun sessiyani yopish shart emas.
- **Tepadagi filial tanlovi** ("Barcha filiallar" yoki bitta filial):
  - qiymat cookie'da (`edu.branch`) saqlanadi;
  - har so'rovda xodimning cheklovi bilan qayta tekshiriladi, cookie'ni o'zgartirib boshqa filialni ko'rib bo'lmaydi;
  - faqat ko'p filialli rejimda (`branches` bo'limi) va xodimga bittadan ortiq filial ochiq bo'lsa ko'rinadi;
  - so'rovlar `getBranchContext().filter` bo'yicha cheklanadi;
  - yangi yozuv tanlangan filialga tushadi (`resolveBranch`).
- **Bo'sh ro'yxatli menejer hech narsa ko'rmaydi.** Eski tizimda u hamma filialni ko'rar edi; bu yerda direktor filial biriktirishi kerak.
- **Har server amali `crmAction()` orqali yoziladi.** U bo'lim yoqilganini, sessiyani va `<bo'lim>.write` ruxsatini tekshiradi va `tenantAudit` yozadi.

### Menyu

- **Manifest `nav` bandida ixtiyoriy `section` maydoni bor.** Bitta bo'limning bandlari menyuning turli joyida turishi mumkin (Xonalar — guruhlar bo'limidan, "Ofis" ostida).
- **Bo'limlar tartibi eski tizimdagidek:** asosiy bandlar, Moliya, Hisobotlar, Ofis, O'quv.
  - 2026-10-19: yangi tartib — Asosiy, O'quv jarayoni, Moliya, Tahlil, Jamoa, Tizim. Ichki tartib
    `crm-shell.tsx` dagi `ITEM_ORDER` da; "Sozlamalar" Tizim bo'limining boshida. Yangi sahifa qo'shilmadi.
- **Panelda bo'limlar hali `group` bo'yicha tanlanadi.**

## Oqibatlari

- Har yangi mijoz jadvali filialga kompozit kalit bilan bog'lanadi va `tenantPolicy()` oladi, migratsiyasi esa `FORCE ROW LEVEL SECURITY` qiladi.
- Ro'yxat so'rovlari tepadagi tanlovni `getBranchContext()` dan oladi; umumiy (filialsiz) yozuvlar hamma joyda ko'rinadi.
- `packages/ui` ga `MoneyInput` va `ColorSwatches` qo'shildi; `Topbar` endi `leading` blokini qabul qiladi (STYLE.md 11.19, 11.27, 11.28).
