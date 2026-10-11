# edu-crm: eski CRM'ni Ventura qolipiga ko'chirish rejasi

2026-10-11 · holat: reja, ish boshlanmagan · Ventura bosqichlaridan (SPEC 13-bo'lim) alohida yo'nalish

## 1. Maqsad

Mavjud o'quv markaz CRM'ining **admin qismi** `apps/edu-crm` ichida qaytadan yoziladi: Next.js, TypeScript strict, Drizzle + PostgreSQL, ko'rinish faqat `packages/ui` va dizayn tokenlaridan. Natija SPEC kutgan shablon bo'ladi: serverda PM2 bilan ishlaydi, har mijozga alohida baza, bo'limlar `hasFeature` orqali yoqiladi.

Eski kod **o'qish uchun namuna**: nima qilishi va qanday ko'rinishi undan olinadi, lekin fayllar ko'chirilmaydi. Eski loyihaga yozilmaydi, u o'z joyida ishlab turaveradi.

## 2. Qarorlar (Saidakbar, 2026-10-11)

| # | Qaror |
| --- | --- |
| 1 | Faqat admin portali. O'qituvchi va o'quvchi portallari bu rejaga kirmaydi (8-bo'lim). |
| 2 | Sahifalar ko'chirilayotganda bir yo'la TypeScript, `packages/ui` va tokenlar bilan qayta yoziladi. "Avval JSX'ni olib o'tib, keyin tozalash" yo'li tanlanmadi. |
| 3 | Eski bazadagi ma'lumot kerak emas: ma'lumot ko'chirish bosqichi yo'q, sxema toza boshlanadi. |
| 4 | Markazning reklama sayti (landing) hozircha kirmaydi. |
| 5 | Stack SPEC bo'yicha: Next.js (server), Drizzle, PostgreSQL, PM2. Supabase ishlatilmaydi. |
| 6 | Eski CRM muzlatiladi: yangi imkoniyat qo'shilmaydi, faqat xato tuzatiladi. U hozir sinovda, markaz to'liq o'tmagan. |
| 7 | Birinchi foydalanuvchi — o'z markazimiz, toza bazadan boshlaydi. |
| 8 | Kirish Ventura panelidagi bilan bir xil mexanizm: `packages/auth` (telefon + parol, Telegram kodi, bloklash, sessiya muddati). Alohida auth yozilmaydi. Foydalanuvchilar bazasi umumiy emas: har mijozning xodimlari o'z bazasida, panel adminlari alohida. |
| 8a | Kirish kodini har mijozning o'z Telegram boti yuboradi. Token Yangi loyiha formasida kiritiladi va shifrlangan holda saqlanadi; botsiz loyihada xodimlar kira olmaydi. |
| 9 | Ruxsatlar tayyor rollar orqali (direktor, menejer va boshqalar) va filial bo'yicha cheklov. Eski tizimdagi har menejerga alohida sozlash birinchi versiyada yo'q. |
| 10 | Birinchi versiyaga kirmaydi: coin va ball tizimi, SMS yuborish, imtihonlar va sertifikatlar. Excel import kiradi. |
| 11 | Interfeys faqat o'zbekcha; matnlar bitta faylda. |
| 12 | Tartib: avval Ventura 2-bosqichi (deploy), keyin E0. |

## 3. Eski tizim: nima bor

Manba: eski CRM repozitoriysi, faqat o'qish. Sanoq 2026-10-11 holatiga.

| | Eski tizim |
| --- | --- |
| Til va ilova | JavaScript (JSX), React 18, Vite SPA; server tomoni yo'q |
| Ma'lumot | Supabase (PostgreSQL), brauzerdan to'g'ridan-to'g'ri |
| Ruxsatlar | Bazaning o'zida: RLS qoidalari, triggerlar va yordamchi SQL funksiyalar |
| Admin kodi | ~87 000 qator: 54 sahifa fayli (56 500), 25 modal (8 000), 19 komponent (7 500), qobiq va holat (4 800), ma'lumot qatlami (5 200), umumiy qismlar (4 900) |
| Ko'rinishlar | 78 ta (menyu bandi yoki ichki sahifa) |
| Baza | 46 jadval, ~84 SQL funksiya, 37 trigger |
| Rollar | direktor, menejer (ruxsatlari sozlanadi), o'qituvchi, yordamchi |
| Testlar | 3 ta SQL test (pul, ruxsatlar, RLS); frontend testi yo'q |

Ishni yengillashtiradigan narsa: Supabase'ga 125 murojaatning 123 tasi bitta papkada (`shared/api`, 44 modul). Har modul nima so'rashi va nima qaytarishi aniq ko'rinadi, bu yangi server qatlami uchun tayyor ro'yxat.

### Tuzilishdagi farqlar

| | Eski | Yangi |
| --- | --- | --- |
| Ma'lumot yuklash | Kirganda asosiy ma'lumot bir yo'la brauzerga yuklanadi va o'zgarishdan keyin qayta yuklanadi | Har sahifa o'ziga keragini serverdan oladi; ro'yxatlar sahifalanadi |
| Navigatsiya | Bitta `view` holati, manzil o'zgarmaydi | Har sahifaning o'z manzili (App Router) |
| Ruxsat tekshiruvi | Bazada (RLS) | Server kodida, bitta joyda (`can(role, permission)`) |
| Pul amallari | SQL funksiyalar (`record_payment`, `money_write`) | Server kodida tranzaksiya ichida, Vitest bilan |
| Jonli yangilanish | Supabase Realtime (admin qismida 4 joy) | Avval davriy so'rov; kerak bo'lsa keyin SSE |
| Fayl hajmi | Bitta sahifa 4 000 qatorgacha | Sahifa bo'laklarga ajratiladi |

## 4. Tamoyillar

1. **Vertikal bo'laklar.** Har modul to'liq yoziladi: sxema, server amallari, ruxsatlar, sahifa, testlar. "Avval hamma sxema, keyin hamma sahifa" emas.
2. **Xatti-harakat eski tizimdan, ko'rinish tokenlardan.** Maydonlar, hisob-kitob va oqimlar eski sahifadan o'qib olinadi; rang, o'lcham va komponentlar `docs/design/STYLE.md` bo'yicha.
3. **Yetishmagan komponent avval `packages/ui`ga.** Sahifa ichida bir martalik komponent yozilmaydi; katalog (`/ui-preview`) va STYLE.md yangilanadi.
4. **Ruxsat serverda.** Har server amali boshida rol va ruxsat tekshiriladi. Brauzerdagi yashirish faqat qulaylik uchun.
5. **Pul bilan bog'liq hamma narsa testda.** To'lov, qaytarish, qarz, chegirma, ish haqi hisobi uchun Vitest; asosiy oqimlar uchun Playwright.
6. **Mijozga xos farq faqat bo'lim yoki sozlama orqali** (CLAUDE.md). Markaz nomi, logotipi, aloqa ma'lumotlari kodda yozilmaydi.
7. **Har o'zgartiruvchi amal jurnalga yoziladi** (eski tizimdagi "faoliyat jurnali" o'rniga).
8. **Kod uchala joylashtirish variantida bitta** (SPEC 3- va 4-bo'limlar). Bazaga ulanish faqat `getTenantDb(tenant)` orqali olinadi; sahifa va server amallari qaysi variantda ishlayotganini bilmaydi.
9. **Har jadvalda `tenant_id`**, har so'rov shu bo'yicha filtrlanadi. Umumiy bazada (`shared_db`) ikkinchi qavat — PostgreSQL RLS: filtr unutilsa ham baza boshqa mijoz qatorini bermaydi.

### Joylashtirish variantlari

| Variant | SPEC'dagi nomi | Qachon |
| --- | --- | --- |
| Bitta ilova, har mijozga o'z bazasi (standart) | `shared` + `db_per_tenant` | Ventura 2-bosqichi |
| Bitta ilova, bitta umumiy baza | `shared` + `shared_db` | Ventura 2-bosqichi |
| Har mijozga alohida ilova va baza | `dedicated` | Ventura 3-bosqichi |

## 5. Bosqichlar

Har bosqich alohida branch va PR. Qabul mezoni bajarilmaguncha keyingisiga o'tilmaydi.

### E0. Skelet

- [ ] `apps/edu-crm`: Next.js, TypeScript strict, `packages/ui`, tema va tokenlar, o'zbekcha matnlar bitta faylda
- [ ] `packages/db/schema/tenant`: boshlang'ich sxema (foydalanuvchilar, rollar, sozlamalar) va migratsiyalar
- [ ] Kirish: `packages/auth` (panel bilan bir xil mexanizm); foydalanuvchilar mijoz bazasida
- [ ] Tayyor rollar va `can(role, permission)`; filial bo'yicha cheklov
- [ ] Qobiq: sidebar, topbar, light/dark, bo'sh bosh sahifa
- [ ] `hasFeature()` va brend sozlamasini (rang, nom, logotip) o'qish
- [ ] Mijozni domen bo'yicha aniqlash, `getTenantDb()`, `tenant_id` va RLS; ajratish testi (A mijoz B mijoz ma'lumotini ololmaydi)
- [ ] CI'ga qo'shish; `/health` manzili (deploy tekshiruvi uchun)

**Qabul:** ilova mahalliy va PM2 ostida ochiladi; direktor kiradi; o'chirilgan bo'lim menyuda ko'rinmaydi va manziliga kirib bo'lmaydi; ajratish testi umumiy bazada ham, alohida bazalarda ham o'tadi. Ventura 2-bosqichi shu skeletni deploy qilib sinaydi.

### E1. Asos: o'quv jarayoni

Bo'limlar: `students`, `courses`, `teachers`, `groups`, `branches`.

- [ ] Kurslar, xonalar, filiallar (ma'lumotnomalar)
- [ ] O'qituvchilar va xodimlar: ro'yxat, kartochka, lavozimlar
- [ ] O'quvchilar: ro'yxat, qo'shish, profil, holatlar, arxiv
- [ ] Guruhlar: ro'yxat, profil, o'quvchini qo'shish va chiqarish, a'zolik davrlari
- [ ] Excel'dan import (o'quvchi, guruh, o'qituvchi)

**Qabul:** markaz o'quvchi va guruhlarini to'liq yurita oladi; menejer faqat o'z filialini ko'radi.

### E2. Davomat

Bo'limlar: `attendance`, `holidays`.

- [ ] Dam olish kunlari, dars jadvali
- [ ] Davomat kiritish va tahrirlash, sababli qoldirish
- [ ] Xodimlar davomati

**Qabul:** bir oylik davomat kiritiladi va hisobotda to'g'ri chiqadi.

### E3. Moliya

Bo'limlar: `payments`, `debtors`, `expenses`, `salaries`.

- [ ] To'lov qabul qilish, to'lov turlari, chek
- [ ] Qaytarish, chegirmalar, qarzdorlar
- [ ] Xarajatlar va toifalari, qo'shimcha daromad
- [ ] Ish haqi: o'qituvchi va xodimlar
- [ ] Pul amallari auditi, tasdiqlash so'rovlari

**Qabul:** to'lov, qaytarish va qarz hisobi eski tizimdagi SQL testlar ssenariylari bilan bir xil natija beradi (testlar Vitest'ga ko'chirilgan).

### E4. Sotuv

Bo'lim: `leads`.

- [ ] Lidlar doskasi, lid profili, bosqichlar tarixi
- [ ] Birinchi dars, yo'qotilgan lidlar va sabablari
- [ ] Lid formasi sozlamalari
- [ ] Bugungi ishlar (workbench)

**Qabul:** lid yaratilishidan o'quvchiga aylanishigacha oqim Playwright testida o'tadi.

### E5. Hisobotlar va tahlil

Bo'lim: `reports`.

- [ ] Bosh sahifa ko'rsatkichlari
- [ ] Moliyaviy hisobotlar: pul oqimi, kurs daromadi, xarajatlar, chegirmalar
- [ ] O'quv hisobotlari: davomat, guruhdan chiqqanlar, xavf ostidagi o'quvchilar, saqlab qolish
- [ ] Excel'ga eksport

**Qabul:** har hisobot raqami tegishli ro'yxat sahifasidagi yig'indi bilan mos keladi.

### E6. Sozlamalar va yakun

- [ ] Xodimlar hisoblari va rollari, markaz sozlamalari
- [ ] Bildirishnomalar, faoliyat jurnali, arxiv va tiklash
- [ ] Rang kontrasti va mobil ko'rinish tekshiruvi

**Qabul:** eski admin qismidagi har ko'rinish yo yangi tizimda bor, yo "olinmaydi" ro'yxatiga sabab bilan yozilgan (7-bo'lim).

## 6. Ventura bosqichlari bilan bog'liqligi

| Ventura bosqichi | edu-crm'dan nima kerak |
| --- | --- |
| 2. Uydagi serverga deploy | Hech narsa: 2-bosqich avval boshlanadi va vaqtincha bo'sh ilovani deploy qiladi; E0 tayyor bo'lgach, o'rniga skelet qo'yiladi |
| 3. VPS va domenlar | Qo'shimcha talab yo'q |
| 5. Moslash (brend, bo'limlar) | E0'dagi `hasFeature` va brend o'qish; mazmunli sinov uchun kamida E1 |
| 7. Zahira | Mijoz bazasi sxemasi barqaror bo'lishi (E3 dan keyin) |

E1–E6 Ventura bosqichlari bilan yonma-yon boradi va ularni to'xtatib turmaydi.

## 7. Ochiq savollar

Tegishli bosqich boshlanishidan oldin hal qilinadi.

- **Ko'rinishlar ro'yxati.** 78 ta ko'rinishning qaysilari olinadi, qaysilari tashlanadi? Har bosqich boshida shu bosqich sahifalari Saidakbar bilan ko'rib chiqiladi.
- **Rollar ro'yxati.** Direktor va menejerdan tashqari qaysi tayyor rollar kerak: kassir, administrator, faqat ko'ruvchi (E0)?
- **Manifest.** `apps/edu-crm/features.ts` hozir 17 bo'lim. Ko'chirish davomida haqiqiy sahifalarga qarab aniqlashtiriladi.

## 8. Bu rejaga kirmaydi

- O'qituvchi va o'quvchi portallari. Admin qismi tugagach alohida reja; server amallari va sxema ularni hisobga olib yoziladi (rollar va o'qituvchiga tegishli guruhlar).
- Landing sahifa.
- Eski bazadan ma'lumot ko'chirish.
- Ovozli (ElevenLabs) va boshqa AI imkoniyatlari.
- Coin va ball tizimi, SMS yuborish, imtihonlar va sertifikatlar. Manifestda bo'lim sifatida qoladi, lekin birinchi versiyada yozilmaydi.

## 9. Xavflar

| Xavf | Chora |
| --- | --- |
| Hajm katta (~87 000 qator), ish cho'zilib ketadi | Vertikal bo'laklar: har bosqich oxirida ishlatsa bo'ladigan natija; keraksiz ko'rinishlar boshida tashlanadi |
| Pul hisobida eski tizimdan farq | Eski SQL testlar ssenariylari Vitest'ga ko'chiriladi; E3 qabuli shunga bog'langan |
| Umumiy bazada bir mijoz boshqasining ma'lumotini ko'rib qoladi | `tenant_id` filtri bitta o'ramda (qo'lda yozilmaydi) va RLS; ajratish testi har yangi jadval uchun majburiy |
| Ruxsat tekshiruvi biror amalda unutiladi | Server amallari bitta o'ram orqali yoziladi (ruxsatsiz amal yozib bo'lmaydi); har rol uchun Playwright testi |
| Eski tizim o'zgarishda davom etadi | Har bosqich boshida eski repozitoriyning o'sha modul qismi qayta ko'riladi |
| `packages/ui`da komponent yetishmaydi (sana tanlash, qidiruvli select, grafik) | Kerak bo'lgan bosqichda avval komponent qo'shiladi; STYLE.md 15-bo'limidagi ro'yxat |
