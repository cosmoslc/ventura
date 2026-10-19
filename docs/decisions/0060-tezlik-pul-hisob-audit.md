# 0060. Tezlik: mijoz bazasi puli, o'quvchi hisobi va audit zanjiri tekshiruvi

2026-10-19 · qabul qilingan · ADR 0002, 0007, 0015

## Vaziyat

Tahlilda uchta tezlik muammosi topildi. Har biri avval o'lchandi.

1. **Mijoz bazasi puli.** `createTenantDb` har mijozga alohida postgres.js puli ochadi (`max: 5`), bo'sh ulanish esa
   hech qachon yopilmaydi. `app.tenant_id` ulanish parametri, shuning uchun pullarni birlashtirib bo'lmaydi. Umumiy
   bazada (`max_connections = 100`) 18 mijoz sahifa ochsa 90 ulanish ochiladi va ular 35 soniyadan keyin ham ochiq
   turadi. 25 mijozda `too many clients already` xatosi chiqadi.
2. **O'quvchi hisobi (`loadAccounts`).** Bosh sahifa, O'quvchilar, Qarzdorlar, Bugun, Guruhlar va profillar har
   ochilishda barcha o'quvchilar hisobini qayta hisoblaydi. "sinov" markazida (170 o'quvchi, 18 oy) bu 114 ms
   (dars rejimida 137 ms) oladi. Bo'laklab o'lchanganda SQL so'rovlari ~19 ms, qolgan ~95 ms JavaScript'dagi hisobga
   ketgan. Har a'zolik-oy uchun oyning dars sanalari ikki marta noldan yasalgan: 31 ta `Date`, `toISOString` va hafta
   kuni hisobi.
3. **Audit zanjiri (`audit.verify`).** `/audit` sahifasi har ochilganda butun `audit_events` jadvalini xotiraga
   yuklab, har yozuvni qayta xeshlaydi. 50 000 yozuvda bu 1 062 ms oladi va o'sishda davom etadi.

## Qaror

**1. Pul chegaralari** (`packages/db/src/tenant.ts`, `TENANT_POOL`):

| Parametr | Qiymat | Izoh |
|---|---|---|
| `idle_timeout` | 30 s | Sahifa ochilmayotgan mijoz ulanish band qilmaydi |
| `max_lifetime` | 30 daqiqa | Ulanish umri cheklangan, server tomonida xotira yig'ilmaydi |
| `max` | 3 (oldin 5) | Bitta mijozga |

- Endi ulanishlar soni "so'nggi 30 soniyada faol bo'lgan mijozlar × 3" ga teng, barcha mijozlar soniga bog'liq emas.
- Qayta ochilgan ulanish ham `app.tenant_id` bilan ochiladi, shuning uchun RLS ajratish o'zgarmaydi.
- Skript va testlar chegaralarni `{ max, idleTimeoutSec, maxLifetimeSec }` bilan o'zgartira oladi.

**2. O'quvchi hisobi** (natija o'zgarmaydi):

- `scheduledDates(days, month)` keshlanadi (o'zgarmas ro'yxat). Kesh 5 000 yozuvga yetsa tozalanadi.
- So'rovlar faqat kerakli ustunlarni oladi. Sinovdagi (faollashtirilmagan) a'zolik bazadan olinmaydi.
  Dars rejimida sababli dars to'lovdan chiqsa, sababli belgilar o'qilmaydi.
- Guruh, narx, muzlatish, bayram va davomat so'rovlari endi ketma-ket emas, bir vaqtda yuboriladi.
- `loadAccountsCached` / `loadAccountCached` — React `cache` bilan so'rov keshi. Bitta render ichida bir o'quvchi bir
  marta hisoblanadi. Sahifa yuklovchilari shundan foydalanadi: bosh sahifa, O'quvchilar, Qarzdorlar (Bugun ham),
  Guruhlar, To'lovlar va moliya/o'quv hisobotlari.
- Server amallari, fon vazifalari va taxminiy hisob (`leaveOverride`) oddiy `loadAccounts` bilan qoladi. React
  `cache` render tashqarisida baribir keshlamaydi, shuning uchun yozuvdan keyin eskirgan qarz qaytmaydi.

**3. Audit zanjiri** — nazorat nuqtasi va kunlik to'liq tekshiruv (`packages/security/src/audit.ts`):

- `verify()` (sahifa) nazorat nuqtasidan keyingi yozuvlarnigina tekshiradi. Nuqta = oxirgi tekshirilgan `seq`, uning
  xeshi va shu joygacha yozuvlar soni; u panel `settings` jadvalida, `audit.checkpoint` kalitida turadi
  (migratsiya kerak emas).
- Nuqtaning o'zi ham tekshiriladi: o'sha yozuv qayta xeshlanadi va undan oldingi yozuvlar soni solishtiriladi.
  Mos kelmasa butun zanjir tekshiriladi va buzilgan joy ko'rsatiladi.
- `verifyFull()` butun zanjirni 1 000 tadan bo'laklab tekshiradi (butun jadval xotiraga yuklanmaydi). Ishchi jarayon
  uni ishga tushganda va keyin kuniga bir marta bajaradi. Uzilish topilsa, nuqta "uzilgan" belgisi bilan almashadi.
  Shundan keyin sahifa ham har safar to'liq tekshiradi va uzilishni ko'rsatadi.
- Nuqta faqat oldinga suriladi. Parallel sahifa tekshiruvi "uzilgan" belgisini ustidan yozmaydi.
- Nuqta ichki hisob, foydalanuvchi amali emas. Shuning uchun uni yozish `audit.record()` chaqirmaydi, aks holda har
  tekshiruv zanjirni o'stirardi.

## O'lchovlar

Mahalliy mashina, PostgreSQL 17, median.

| | Oldin | Keyin |
|---|---|---|
| `loadAccounts`, 170 o'quvchi × 18 oy, oylik rejim | 114 ms | 23–30 ms |
| — dars rejimi | 137 ms | 45–51 ms |
| — sababli darslar hisobga olinmaydi | 115 ms | 18–22 ms |
| 18 mijoz × 5 parallel so'rov: ochiq ulanishlar | 90, 35 s dan keyin ham 90 | 54, 35 s dan keyin 0 |
| 25 mijoz × 5 parallel so'rov | `too many clients` | 75, 35 s dan keyin 0 |
| `/audit` tekshiruvi, 50 000 yozuv | 1 062 ms | 12.5 ms (+20 yangi yozuv bilan 15.5 ms) |
| Kunlik to'liq tekshiruv, 50 000 yozuv (ishchi jarayonda) | — | 1 183 ms |

`loadAccounts` natijasi uchala rejimda ham oldingisi bilan bit-ma-bit solishtirildi: farq yo'q.

## Oqibatlari

- Sahifa tekshiruvi nazorat nuqtasidan oldingi o'rtadagi yozuvga superuser aralashganini darhol ko'rmaydi. Buni
  kunlik to'liq tekshiruv ko'pi bilan bir kun ichida topadi. Nazorat nuqtasidagi yozuv o'zgarsa yoki undan oldingi yozuv o'chirilsa (son
  kamaysa), sahifa buni darhol ko'radi. Butun jadvalni qayta yozgan superuser hamon aniqlanmaydi (ADR 0002).
- Bitta mijozga 3 ulanish bo'lgani uchun og'ir sahifadagi parallel so'rovlar navbatda kutishi mumkin. O'lchovda
  `loadAccounts` buning ta'sirini sezmadi.
- Barcha mijozlar bir vaqtda (30 soniya ichida) faol bo'lsa, 33 dan ortiq mijozda chegara yana yetiladi. Shunda
  PgBouncer (transaction rejimi, `set_config(..., true)` bilan) yoki `max_connections` ni oshirish kerak bo'ladi.
- Mijoz faoliyat jurnali (`tenantAudit.verify`, CRM'dagi "Tekshirish" tugmasi) hali butun zanjirni o'qiydi. Uni
  faqat tugma bosilganda chaqiradi, sahifa ochilganda emas.
