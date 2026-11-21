# ADR 0074: Sawmill — Yakun, Inventarizatsiya va Qabul (S6)

- **Holat:** Qabul qilindi
- **Sana:** 2026-10-24
- **Muallif:** Ventura jamoasi
- **Bog'liq hujjatlar:** [docs/SAWMILL-PLAN.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-PLAN.md), [docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md), [ADR 0068](file:///home/warcassa/Projects/Ventura/docs/decisions/0068-sawmill-shabloni-va-arxitekturasi.md), [ADR 0069](file:///home/warcassa/Projects/Ventura/docs/decisions/0069-sawmill-malumotnomalar-sozlamalar.md), [ADR 0070](file:///home/warcassa/Projects/Ventura/docs/decisions/0070-sawmill-teraklar-ombor-xarajatlar.md), [ADR 0071](file:///home/warcassa/Projects/Ventura/docs/decisions/0071-sawmill-ishlar-va-ish-haqi.md), [ADR 0072](file:///home/warcassa/Projects/Ventura/docs/decisions/0072-sawmill-yuk-chiqarish-va-zakazlar.md), [ADR 0073](file:///home/warcassa/Projects/Ventura/docs/decisions/0073-sawmill-bosh-sahifa-va-hisobotlar.md)

---

## 1. Kontekst va Maqsad

Ventura monoreposida ikkinchi to'liq biznes shabloni — **Pilorama Boshqaruvi (`apps/sawmill`)** yaratildi. Eski Flutter (Android SQLite) ilovasi tahlil qilinib ([docs/SAWMILL-TAHLIL.md](file:///home/warcassa/Projects/Ventura/docs/SAWMILL-TAHLIL.md)), uning barcha 20 ta tizimli kamchiligi bartaraf etildi va zamonaviy web platforma (Next.js 16 + React 19 + Drizzle ORM + PostgreSQL RLS + Better Auth) sifatida noldan ketma-ket (S0 $\to$ S6) bosqichlarda barpo etildi.

S6 bosqichining maqsadi — tizimni yakunlash:
1. Ruscha matnlar va ikki tilli (UZ/RU) rejimning to'liq ishlashi;
2. Faoliyat jurnali (`/audit`) va xesh zanjiri butunligini tekshirish;
3. Xodimlar va tizim rollari (`/users`) boshqaruvi;
4. PWA (Web App Manifest, standalone rejim, mobil moslashuv);
5. Playwright e2e testlari;
6. Eski ilova ekranlarining to'liq inventarizatsiyasi va qabul mezonlari tekshiruvi.

---

## 2. Eski Ilova Ekranlari Inventarizatsiyasi

| # | Eski Ekran (Flutter) | Yangi Tizimdagi Holati (Ventura) | Holat | Izoh / Yaxshilanish |
|---|---|---|---|---|
| 1 | Ro'yxatdan o'tish | `/login` (Better Auth) | **Bajarildi** | Telefon va parol orqali xavfsiz sessiya, SMS/2FA qo'llab-quvvatlash. |
| 2 | Bloklangan / sinov tugagan | `/bolim-yopiq`, `lockedAt` nazorati | **Bajarildi** | Panel orqali ruxsat va blokirovka avtomatlashtirilgan. |
| 3 | **Bosh sahifa** | `/` (Dashboard) | **Bajarildi** | Terak selektori, 4 ta asosiy KPI, taxminiy va haqiqiy sof foyda almashuvi, K14 umumiy xarajatlar ayrilishi, K11 haftalik grafik, ombor qoldiqlari, diqqat talab zakazlar. |
| 4 | Sozlamalar | `/settings` | **Bajarildi** | O'lcham birliklari, kub kiritish usuli, foyda rejimi, sex ish turlari boshqaruvi. |
| 5 | **Kunlik ishlar** | `/work` | **Bajarildi** | Yakka va guruh ishlari, K1 maosh hisoblash tugmasi, ishbay va oylik ishchilarni to'g'ri qo'llab-quvvatlash. |
| 6 | Terak ishlari | `/teraks/[id]` (Ishlar tabi) | **Bajarildi** | Terak bo'yicha sarflangan ish haqi va ishchilar yozuvlari ro'yxati. |
| 7 | Ish qo'shish oynasi | `/work` va `/teraks/[id]` modali | **Bajarildi** | Guruh ishlari uchun K6/K7 avtomatik taqsimlash va qoldiqni saqlash. |
| 8 | **Ishchilar** | `/workers` | **Bajarildi** | Ishchilar ro'yxati, ish shakli (ishbay/oylik), balans (musbat/manfiy), arxivlash. |
| 9 | Ishchi formasi | `worker-dialog.tsx` | **Bajarildi** | Ism, telefon, stavka, ish shakli. |
| 10 | Ishchi profili | `/workers/[id]` | **Bajarildi** | Balans kartasi, ish tarixi, to'lovlar (avans berish) va materiallarga maxsus narxlar belgilash. |
| 11 | **Teraklar** | `/teraks` | **Bajarildi** | Teraklar ro'yxati, "Terak N" avtomatik nomlash, xarid narxi, sotuv daromadi, ombor qiymati, sof foyda nishoni, savat (trash) va tiklash. |
| 12 | Terak tafsilotlari | `/teraks/[id]` | **Bajarildi** | 5 ta tab: Ombor, Qo'shimcha xarajatlar, Ishlar, Yuk chiqarish, Zakazlar. |
| 13 | Material formasi | `/materials` | **Bajarildi** | Birlik (dona/kub/qator), hisoblash usuli, o'lchamlar ($q \times e \times u$) va hajm ($m^3$). |
| 14 | Yuk chiqarish oynasi | `/dispatch` va `dispatch-dialog.tsx` | **Bajarildi** | Epsilon tekshiruvi ($\varepsilon = 0.000001$), K5 yuk mashinasi xarajatining terak xarajatiga yozilishi. |
| 15 | Yuk mashinalari | `/trucks` | **Bajarildi** | Mashinalar katalogi, narxlar va reyslar hisobi. |
| 16 | Zakaz oynasi | `/orders` va `order-dialog.tsx` | **Bajarildi** | K20 eslatma bayroqlari saqlanishi, tayyor va muddati yaqinlashgan buyurtmalar nazorati. |
| 17 | Qo'shimcha xarajatlar | `cost-dialog.tsx` | **Bajarildi** | Tashish, res va boshqa xarajatlar. |
| 18 | Umumiy xarajatlar | `/expenses` (K14) | **Yangi** | Eski ilovada yo'q edi! Sex ijarasi, elektr, soliqlar kabi korxona xarajatlari sof foydadan chegiriladi. |
| 19 | Tahlil va Hisobotlar | `/reports` va `/api/reports/excel` | **Yangi** | Eski ilovada yo'q edi! Teraklar rentabelligi, ish haqi va yuk chiqarish hisobotlari, ExcelJS eksport. |
| 20 | Faoliyat jurnali | `/audit` | **Yangi** | Kriptografik xesh zanjirli o'chmas xavfsizlik jurnali va zanjir butunligini tekshirish. |
| 21 | Foydalanuvchilar va rollar | `/users` | **Yangi** | Egasi (`owner`), buxgalter (`accountant`), kuzatuvchi (`viewer`) rollari boshqaruvi. |
| 22 | PWA va Mobil moslashuv | `manifest.ts`, `icon.svg` | **Yangi** | Mobil brauzerlarda va kompyuterda ilova sifatida o'rnatish (PWA). |

---

## 3. Qabul Mezonlari Tekshiruvi

1. **Hisob-kitoblar aniqligi:** Barcha mantiq sof funksiyalarga ajratilgan (`lib/calc/units.ts`, `pay.ts`, `balance.ts`, `dispatch.ts`, `orders.ts`, `profit.ts`) va Vitest orqali 100% qamrab olingan.
2. **K1–K20 kamchiliklari bartaraf etildi:**
   - K1: Maoshli ishchilarga hisoblash tugmasi kiritildi.
   - K5: Yuk mashinasi xarajati ishchilarga to'lov bo'lib ketishi to'xtatildi, terak xarajatiga kiritildi.
   - K6/K7: Guruh ishlari teng bo'linib, yaxlitlash qoldig'i yo'qotilmaydi.
   - K11: Haftalik sotuv grafigida dona va summa ajratildi.
   - K14: Umumiy xarajatlar sahifasi ochildi va umumiy foydadan ayrildi.
   - K20: Zakaz tahrirlanganda eslatma bayroqlari tushib qolmaydi.
3. **Minglik ajratkich:** Barcha summa va narx kiritish maydonlarida `@ventura/ui/money-input` qo'llanildi.
4. **Ikki tillilik (i18n):** O'zbek va rus tillari to'liq paritetda (har ikkala tilda 380+ kalitlar mavjud, cookie va foydalanuvchi profilida saqlanadi).
5. **Playwright E2E:** Kirish $\to$ Bosh sahifa $\to$ Bo'limlar $\to$ Audit $\to$ Hisobotlar $\to$ Til almashtirish to'liq avtomatlashgan testdan o'tdi.
6. **Next.js Production Build:** Barcha 19 ta marshrut va API yo'llari xatosiz build bo'ldi.
