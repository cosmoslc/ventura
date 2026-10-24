# sawmill: eski Pilorama ilovasini (Flutter) Ventura qolipiga ko'chirish rejasi

2026-10-17 · holat: **reja**; ochiq savollar hal qilindi (K1, K5, K14, til, import — 2026-10-17), qolgan qarorlar tasdiq kutmoqda · tahlil: [SAWMILL-TAHLIL.md](SAWMILL-TAHLIL.md) · SPEC 13-bo'lim, 8-bosqich ("Ikkinchi shablon")

## 1. Maqsad

Pilorama egasi uchun telefon ilovasi (Flutter, telefonning o'zidagi SQLite) `apps/sawmill` ichida **veb-tizim** sifatida qaytadan yoziladi: Next.js, TypeScript strict, Drizzle + PostgreSQL, ko'rinish faqat `packages/ui` va dizayn tokenlaridan. Natija SPEC kutgan 2-shablon bo'ladi: panel orqali yaratiladi, serverda PM2 bilan ishlaydi, har mijozga alohida baza, bo'limlar `hasFeature` orqali yoqiladi.

Eski kod **o'qish uchun namuna**: nima qilishi, qanday hisoblashi va qanday ko'rinishi undan olinadi (tahlil hujjati), lekin fayllar ko'chirilmaydi. Eski ilovaga yozilmaydi.

SPEC 8-bosqich qabul sharti shu rejaning ham asosiy sharti: **panel kodiga o'zgartirish kiritmasdan** yangi shablon qo'shiladi va ishga tushadi.

## 2. Qarorlar (taklif — tasdiq kutilmoqda)

Har band S0 boshlanishidan oldin tasdiqlanadi yoki o'zgartiriladi. Tasdiqlangach shu jadval "Qarorlar (… tasdiqladi, sana)" bo'ladi.

| # | Taklif |
| --- | --- |
| 1 | Stack SPEC 2-bo'limi bo'yicha, edu-crm bilan bir xil: TypeScript strict, Next.js App Router (server amallari), Tailwind + `packages/ui`, PostgreSQL + Drizzle, Zod, Vitest + Playwright, PM2. Flutter, Dart, SQLite va `shared_preferences` ishlatilmaydi. |
| 2 | Hisob-kitob eski ilovadagidek (tahlil 5–10-qismlar). Kamchiliklar bo'yicha qaror — 9-bo'lim: tasdiqlangan tuzatishlardan boshqa farq bo'lmaydi. |
| 3 | Kirish `packages/auth` orqali (telefon + parol, Telegram kodi, bloklash) — edu-crm bilan bir xil mexanizm. Eski "ro'yxatdan o'tish + 7 kunlik sinov + qurilma ID" o'rniga obuna Ventura panelidagi `subscriptions` orqali. |
| 4 | Rollar birinchi versiyada tayyor: **egasi** (hammasi), **hisobchi** (kiritish va tahrirlash, o'chirish va sozlamalarsiz), **ko'ruvchi** (faqat ko'rish). Lavozimlar quruvchisi (edu-crm ADR 0010) keyinroq, kerak bo'lsa. |
| 5 | **Hal qilindi (2026-10-17):** birinchi versiyadan ikki til — o'zbekcha va ruscha, eski ilovadagidek. Matnlar `apps/sawmill/lib/i18n/uz.ts` va `ru.ts` da, kalitlar bir xil (TypeScript ikkala faylda kalit to'liqligini tekshiradi). Til har xodimning profilida saqlanadi, standart — o'zbekcha. Bu CLAUDE.md dagi "interfeys matnlari o'zbekcha" qoidasidan farq: S0 da ADR yoziladi va CLAUDE.md ga sawmill istisnosi qo'shiladi. |
| 6 | Telefon birinchi o'rinda: ilova asosan telefondan ochiladi. Mobilda pastki navbar + "tezkor amallar" tugmasi (eski `ZumradNavBar` vazifasi), kompyuterda chap sidebar. PWA (bosh ekranga qo'shish) — S6 da. |
| 7 | Pul — butun so'm (`bigint`), miqdor va hajm — `numeric` (kasr kubdan aylanishda kerak). Float va `ε` yamog'i yo'q (K15). |
| 8 | Ombor **harakatlar jurnali** orqali: har ish, yuk chiqarish, tuzatish `stock_movements` qatori yozadi; `terak_materials.quantity` shu tranzaksiya ichida yangilanadigan kesh. O'chirish = teskari harakat. |
| 9 | Eski ilovaning o'zi kerak bo'lmaydigan qismlari ko'chirilmaydi: APK yangilash, demo karta to'lovi, ro'yxatdan o'tish ekrani, `backend/` (reklama sayti), o'lik ekranlar (`WorkersScreen`, `ExpensesScreen`). |
| 10 | **Hal qilindi (2026-10-17):** eski ma'lumot import qilinmaydi. Har mijoz toza bazadan boshlaydi (edu-crm kabi). |

## 3. Eski tizim: nima bor

To'liq tahlil — [SAWMILL-TAHLIL.md](SAWMILL-TAHLIL.md). Qisqacha:

| | Eski tizim |
| --- | --- |
| Til va ilova | Dart, Flutter 3.10, Android |
| Ma'lumot | Telefondagi SQLite, 15 jadval, server yo'q |
| Holat va mantiq | `provider`; hisob-kitobning hammasi bitta `AppDataProvider` faylida (1 628 qator) |
| Ko'rinishlar | 4 tab, 3 ichki sahifa, ~15 pastki oyna va dialog (tahlil 3-qism) |
| Kod | 13 191 qator Dart |
| Testlar | 17 ta hisob-kitob testi (`test/calculations_test.dart`) — Vitest'ga ko'chiriladi |
| Kamchiliklar | 20 ta (K1–K20, tahlil 12-qism) |

### Tuzilishdagi farqlar

| | Eski | Yangi |
| --- | --- | --- |
| Ma'lumot joyi | Bitta telefon | Server, mijozning o'z bazasi; bir nechta xodim bir vaqtda |
| Hisob-kitob | UI ichida va provider'da aralash, ikki joyda takrorlangan (forma oldindan ko'rsatadi, provider qayta hisoblaydi) | Bitta sof modul `apps/sawmill/lib/calc/*`: forma ham, server amali ham shu funksiyani chaqiradi; server natijasi asosiy |
| Ombor | `quantity` maydoni qo'lda oshirib-kamaytiriladi | Harakatlar jurnali + kesh (2-bo'lim, 8-qaror) |
| Guruh ishi | Izoh + sana bo'yicha taniladi | `work_groups` jadvali, aniq ID (K3) |
| Ish turi, xarajat turi | Matn (interfeys tilida) | Ma'lumotnoma ID va tizim turi (`kind`) (K4, K19) |
| Navigatsiya | Ekranlar steki | Har sahifaning o'z manzili (App Router) |
| Zaxira | Qo'lda JSON | Ventura panelining avtomatik zaxirasi (SPEC 12) + Excel eksport; eski JSON import qilinmaydi |
| Yuk mashinasi | Ishchilarga to'lov bo'lib bo'linadi | Terak xarajati (K5) |
| Maoshli ishchi | Maosh hisoblanmaydi | "Maosh hisoblash" tugmasi (K1) |
| Umumiy xarajatlar | Jadval bor, foydaga kirmaydi, ekrani o'lik | Alohida sahifa, umumiy foydaga kiradi (K14) |
| Bildirishnoma | Telefon ichida, ilova ochilganda | Tizim ichidagi bildirishnomalar + ixtiyoriy Telegram; tekshiruv fon vazifasida |
| O'chirish | Darhol va butunlay | Muhim yozuvlar arxiv/savat orqali, har amal jurnalda |

## 4. Tamoyillar

1. **Vertikal bo'laklar.** Har bosqich to'liq: sxema, server amallari, ruxsatlar, sahifa, testlar.
2. **Xatti-harakat eski ilovadan, ko'rinish tokenlardan.** Maydon va formulalar tahlil hujjatidan; rang, o'lcham, komponent — `docs/design/STYLE.md`.
3. **Hisob-kitob bitta joyda va testda.** `lib/calc/` — sof funksiyalar (bazasiz). Har formula uchun Vitest; eski 17 test ssenariysi birinchi navbatda ko'chiriladi.
4. **Pul va ombor tranzaksiya ichida.** Ish + ombor harakati + guruh yozuvlari bitta tranzaksiyada; yarim saqlangan holat bo'lmaydi.
5. **Ruxsat serverda.** Har server amali boshida rol tekshiriladi.
6. **Mijozga xos farq faqat bo'lim yoki sozlama orqali** (CLAUDE.md). `if (tenant.slug === ...)` yo'q.
7. **Har o'zgartiruvchi amal `tenantAudit.record()` chaqiradi**, eski va yangi qiymat bilan.
8. **Bazaga faqat `getTenantDb()`**; har jadvalda `tenant_id`, `tenantPolicy()` va migratsiyada `FORCE ROW LEVEL SECURITY`.
9. **Yetishmagan komponent avval `packages/ui`ga** (masalan pastki navbar, raqam/kub almashtirgich, kichik ustunli grafik).

## 5. Texnologiyalar

SPEC 2-bo'limidagi stack o'zgarmaydi. Eski → yangi moslik:

| Vazifa | Eski (Flutter) | Yangi (`apps/sawmill`) |
| --- | --- | --- |
| Til | Dart | TypeScript (strict, `any` taqiqlangan) |
| UI | `forui` + Material, `ZumradNavBar` | Next.js App Router, Tailwind, `packages/ui` (shadcn), tokenlar |
| Holat | `provider` (`ChangeNotifier`) | Server komponentlar + server amallari; mijoz tomonda faqat forma holati |
| Baza | `sqflite` (SQLite, `REAL`) | PostgreSQL + Drizzle (`bigint` pul, `numeric` miqdor), migratsiyalar `drizzle-kit` |
| Sozlamalar | `shared_preferences` | `tenant` sozlamasi (jsonb, Zod sxema) — hamma xodim uchun bir xil; til — xodim profilida |
| Tarjimalar | `app_text.dart` (uz/ru, 327 kalit) | `lib/i18n/uz.ts` + `ru.ts`, bir xil kalitlar, tur tekshiruvi |
| Validatsiya | Forma validatorlari | Zod (forma va server amali bir sxema) |
| Kirish | Yo'q (qurilma ID) | `packages/auth`: telefon + parol + Telegram kodi |
| Bildirishnoma | `flutter_local_notifications` | Tizim ichidagi bildirishnomalar, Telegram (`packages/integrations`), tekshiruv — pg-boss vazifasi |
| Zaxira | JSON fayl, `share_plus` | Panel zaxirasi (SPEC 12) + Excel eksport |
| Testlar | `flutter_test` | Vitest (hisob-kitob, server amallari), Playwright (asosiy oqimlar) |
| Deploy | APK, GitHub Releases | Ventura panel: SSH drayveri, PM2, nginx, `<slug>.ventura.uz` |

## 6. Sahifalar xaritasi

Eski ekran raqamlari — tahlil 3-qismidan.

| Sahifa | Manzil | Eski ekran | Bosqich |
| --- | --- | --- | --- |
| Bosh sahifa | `/` (`?terak=`) | 3 | S5 |
| Teraklar | `/teraks` | 11 | S2 |
| Terak sahifasi | `/teraks/[id]` — tablar: Ombor · Ishlar · Yuk chiqarish · Zakazlar · Xarajatlar | 12, 12a–12d, 6 | S2–S4 |
| Kunlik ishlar | `/work` — "Umumiy ishlar" va teraklar bo'yicha, filtr: ishchi, sana | 5, 6 | S3 |
| Ishchilar | `/workers` | 8 | S1 |
| Ishchi profili | `/workers/[id]` — tablar: Ishlar · To'lovlar · Material narxlari | 10 | S3 |
| Materiallar katalogi | `/materials` — nom, birlik, hisoblash turi, o'lchamlar | 13 (eski: terak ichida) | S1 |
| Yuk mashinalari | `/trucks` | 15 | S4 |
| Zakazlar (hamma teraklar) | `/orders` | yangi (eski: faqat terak ichida) | S4 |
| Umumiy xarajatlar | `/expenses` — turi, summa, sana, izoh; davr filtri | eski o'lik `ExpensesScreen` (K14) | S5 |
| Hisobotlar | `/reports` | yangi | S5 |
| Bildirishnomalar | `/notifications` | yangi (eski: telefon bildirishnomasi) | S4 |
| Sozlamalar | `/settings` — birliklar, foyda usuli, kub usuli, ish turlari | 4 | S1 |
| Xodimlar va faoliyat jurnali | `/staff`, `/activity` | yangi | S0, S6 |

Formalar (ish qo'shish, yuk chiqarish, zakaz, xarajat, to'lov) — eski pastki oynalar kabi: mobilda pastki oyna (sheet), kompyuterda modal. "Tezkor amallar" tugmasi: ish, yuk, xarajat (tanlangan terakka), ishchi, terak.

## 7. Ma'lumotlar sxemasi

Mijoz bazasi (`db_per_tenant` yoki `shared_db`). Hamma jadvalda `id` (uuid), `tenant_id`, `created_at`, `updated_at`. Pul — `bigint` (so'm), miqdor — `numeric(14,4)`, o'lcham — `numeric(8,2)` sm.

| Jadval | Asosiy maydonlar | Eski jadval / izoh |
| --- | --- | --- |
| `workers` | name, phone, salary\_type (`piecework` / `daily` / `weekly` / `monthly`), wage\_amount, archived\_at | `workers`; o'chirish o'rniga arxiv (K7) |
| `wage_accruals` | worker\_id, period\_start, period\_end, units (kun/hafta/oy soni), rate, amount, terak\_id?, work\_entry\_id; unique(worker, period) | yangi (K1): "Maosh hisoblash" natijasi |
| `work_types` | name, kind (`regular` / `sorting`), is\_system | `work_types`; "Sartirofka" = `kind: sorting` (K4) |
| `materials` | name, unit, pricing\_mode (`piece` / `row`), thickness\_cm, width\_cm, length\_cm, archived\_at | `materials`; `perCube`, `unitVolumeM3` yo'q (K18) |
| `material_sizes` | material\_id, thickness\_cm, width\_cm, length\_cm | `material_sizes` |
| `teraks` | name, purchase\_date, purchase\_price, note, deleted\_at | `teraks`; `resCount` yo'q, o'chirish — savat (K8) |
| `terak_materials` | terak\_id, material\_id, quantity (kesh), worker\_price, selling\_price, cube\_worker\_price, cube\_price, goal, archived\_at; unique(terak, material) | `terak_materials`; olib tashlash — arxiv (K9) |
| `stock_movements` | terak\_id, material\_id, size\_id?, delta, source (`work` / `dispatch` / `adjust`), source\_id, at | yangi (2-bo'lim, 8-qaror) |
| `worker_material_prices` | worker\_id, material\_id, price | `worker_material_prices` |
| `work_groups` | terak\_id?, work\_type\_id, date, total\_amount, pay\_full\_to\_each, material\_id?, quantity?, rows?, pay\_unit | yangi (K3) |
| `work_entries` | worker\_id, terak\_id?, work\_type\_id?, kind (`regular` / `material`), group\_id?, date, amount, material\_id?, size\_id?, quantity?, rows?, pay\_unit (`piece` / `row` / `cube`), note | `work_entries`; matnli tur o'rniga ID (K19) |
| `payments` | worker\_id, amount, date, note | `payments`; sana tanlanadi, tahrir va o'chirish jurnal bilan (K6). Yuk mashinasi endi bu yerga yozilmaydi (K5) |
| `terak_costs` | terak\_id, kind (`transport` / `res` / `truck` / `other`), title, amount, date, trips?, price\_per\_trip?, dispatch\_id?, truck\_id? | `terak_costs` (K19); `truck` — yuk chiqarishdagi mashina summasi (K5) |
| `trucks` | name, amount, archived\_at | `trucks` |
| `dispatches` | terak\_id, material\_id, quantity (dona), entered\_unit (`piece` / `cube`), entered\_qty, total\_amount, date, recipient\_name, address, phone, truck\_id? | `dispatches`; `unitPrice` o'rniga jami summa saqlanadi |
| `orders` | terak\_id, material\_id, quantity, customer\_name, phone, address, due\_date, completed\_at, ready\_notified\_at, due\_notified\_at | `orders` (K20) |
| `expense_categories` | name, archived\_at | yangi (K14): ijara, svet, soliq va h.k. — sozlamada |
| `general_expenses` | category\_id, amount, date, note | `expenses` (K14) |
| sozlamalar | `tenant` sozlamasi (jsonb, Zod): profit\_mode, qty\_display, cube\_input\_mode, dimension\_unit | `shared_preferences` |
| xodim tili | umumiy xodimlar jadvalida `locale` (`uz` / `ru`) | `shared_preferences` dagi til |

Kirish, xodimlar, bildirishnomalar va faoliyat jurnali — `packages/db` umumiy tenant jadvallaridan (edu-crm bilan bir xil). Sxema qayerda turishi (umumiy `schema/tenant` yoki alohida `schema/sawmill` va alohida migratsiya papkasi) — S0 ADR'ida hal qilinadi.

**Boshlang'ich ma'lumot** (tenant yaratilganda): materiallar — Vassa (dona), Kvadrat (qator), Dona (dona), Bay (bay, dona hisobida); ish turlari — Sartirofka (`sorting`, tizim), Terak kesish. Yangi terakka faol materiallar 0 narx bilan biriktiriladi.

## 8. Bo'limlar manifesti (`apps/sawmill/features.ts`)

| Kalit | Nomi | Tur | Talab qiladi |
| --- | --- | --- | --- |
| `teraks` | Teraklar | `permanent` | — |
| `workers` | Ishchilar va ish haqi | `permanent` | — |
| `work` | Kunlik ishlar | `core` | `teraks`, `workers` |
| `stock` | Ombor | `core` | `teraks` |
| `dispatch` | Yuk chiqarish | `regular` | `stock` |
| `trucks` | Yuk mashinalari | `regular` | `dispatch` |
| `general_expenses` | Umumiy xarajatlar | `regular` | — |
| `orders` | Zakazlar | `regular` | `stock` |
| `material_sizes` | O'lchamlar ("chuqur hisob-kitob") | `regular` | `stock` |
| `cube` | Kub (m³) hisobi | `regular` | `stock` |
| `reports` | Hisobotlar | `regular` | `teraks` |

Eski ilovadagi "O'lchamlar funksiyasi" sozlamasi `material_sizes` bo'limiga aylanadi: o'chirilganda ma'lumot o'chmaydi (SPEC 8), eski "birlashtirish / birinchisini qoldirish" oynasi kerak bo'lmaydi.

## 9. Kamchiliklar bo'yicha qarorlar (taklif)

`eskicha` — eski ilovadagidek qoldiriladi; `tuzatish` — yangi tizimda boshqacha. Tasdiqlanmagan band `eskicha` hisoblanadi.

| # | Taklif | Izoh |
| --- | --- | --- |
| K1 | tuzatish (hal qilindi) | "Maosh hisoblash" tugmasi: ishchi profilida davr (sana oralig'i) va soni (kun / hafta / oy, standart — davrdan hisoblanadi, qo'lda o'zgartiriladi) tanlanadi; `summa = soni × wage_amount`. Natija bitta `work_entries` (oddiy tur "Maosh") + `wage_accruals` yozuvi; terak tanlansa terak xarajatiga ham kiradi. Bir davr ikki marta hisoblanmaydi. S3 |
| K2 | tuzatish | Guruh ishida ham ishchining maxsus narxi; jami = har ishchi ulushining yig'indisi |
| K3 | tuzatish | `work_groups` |
| K4 | tuzatish | `work_types.kind = sorting` |
| K5 | tuzatish (hal qilindi) | Yuk chiqarishda mashina tanlansa, uning summasi shu terakning qo'shimcha xarajati bo'ladi (`terak_costs.kind = truck`, `dispatch_id`) va foydani kamaytiradi. Ishchi balansiga tegmaydi; yuk formasidagi ishchilarni tanlash olib tashlanadi. Yuk chiqarish o'chirilsa, mashina xarajati ham o'chadi |
| K6 | tuzatish | To'lov sanasi tanlanadi; tahrir va o'chirish — egasi, jurnalga yoziladi |
| K7 | tuzatish | Ishchi arxivi; tarix va balans saqlanadi |
| K8 | tuzatish | Terak savatga tushadi (30 kun), hamma bog'liq yozuv bilan birga tiklanadi; savatdagi terak hisobga kirmaydi |
| K9 | tuzatish | Qoldig'i bor material terakdan olib tashlanmaydi, faqat arxivlanadi |
| K10 | tuzatish | Yuk chiqarishda o'lcham tanlanadi (bo'lim yoqilgan bo'lsa), o'lcham qoldig'i ham kamayadi |
| K11 | tuzatish | Haftalik grafik pul (yuk summasi) bo'yicha; miqdor — material tanlanganda |
| K12 | eskicha | Tayyorlik = qoldiq ≥ miqdor. Zakazlar orasida taqsimlash keyinroq |
| K13 | tuzatish | Ish tahrirlansa miqdor ham o'zgaradi, summa formuladan qayta hisoblanadi, ombor harakati tuzatiladi; qo'lda summa faqat `regular` ishda |
| K14 | tuzatish (hal qilindi) | "Umumiy xarajatlar" sahifasi (toifa, summa, sana). Terak foydasiga tegmaydi; "barcha teraklar" umumiy foydasidan va davr hisobotlaridan ayiriladi: `umumiyFoyda = Σ terak foydasi − Σ umumiy xarajatlar (davr)`. S5 |
| K15 | tuzatish | `bigint` / `numeric`; guruhda bo'lishdan qolgan so'm birinchi ishchiga, yig'indi jamiga teng |
| K16, K17 | tuzatish | Server, kirish, rollar (stack o'zi hal qiladi) |
| K18 | — | Ko'chirilmaydi |
| K19 | tuzatish | Turlar ID va `kind` orqali |
| K20 | tuzatish | Eslatma vaqtlari tahrirda saqlanadi; miqdor yoki muddat o'zgarsa qayta hisoblanadi |

## 10. Bosqichlar

Har bosqich alohida branch va PR, muhim qarorlar ADR'da. Qabul mezoni bajarilmaguncha keyingisiga o'tilmaydi.

### S0. Skelet

- [x] `apps/sawmill`: Next.js, TypeScript strict, `packages/ui`, tema, `/health`
- [x] Ikki til: `lib/i18n/uz.ts` va `ru.ts`, `t()` yordamchisi, xodim profilida til almashtirgich; ADR va CLAUDE.md ga istisno (2-bo'lim, 5-qaror). `packages/ui` dagi ichki matnlar (tasdiq oynasi, bo'sh holat) ham tarjima qilinadigan bo'lishi tekshiriladi
- [x] `features.ts` (8-bo'lim) va `template` ma'lumoti; `pnpm templates:sync` uni panelga ko'chiradi
- [x] Tenant sxemasi asosi, migratsiyalar, boshlang'ich ma'lumot; sxema joyi bo'yicha ADR (ADR 0068)
- [x] Kirish (`packages/auth`), 3 rol va `can(role, permission)`
- [x] Qobiq: kompyuterda sidebar, mobilda pastki navbar va tezkor amallar tugmasi (`packages/ui`ga), light/dark
- [x] `getTenantDb()`, RLS, ajratish testi
- [x] CI (lint, typecheck, test, build) va PM2 konfiguratsiyasi

**Qabul:** panel kodiga tegmasdan "Yangi loyiha → Pilorama" orqali `<slug>.ventura.uz` ochiladi; egasi kiradi; o'chirilgan bo'lim menyuda yo'q va 404; ajratish testi o'tadi; tilni ruschaga almashtirganda qobiqda o'zbekcha matn qolmaydi.

### S1. Ma'lumotnomalar va sozlamalar

- [x] Ishchilar: ro'yxat (balans ustuni keyin to'ladi), qo'shish, tahrirlash, arxiv
- [x] Materiallar katalogi: nom, birlik, hisoblash turi, o'lchamlar (q × e × u) va 1 dona hajmi; o'lcham variantlari (`material_sizes`)
- [x] Ish turlari (sozlamada), yuk mashinalari
- [x] Sozlamalar: foyda usuli, miqdor ko'rinishi, kub usuli, o'lcham birligi (mm/sm/m)
- [x] `lib/calc/units.ts`: birlik aylantirish, 1 dona hajmi, dona ↔ kub, pul formati — Vitest (ADR 0069)

**Qabul:** tahlil 5-qismidagi hamma formula testda; mm/sm/m da kiritilgan o'lcham bazada sm bo'lib turadi.

### S2. Teraklar, ombor, xarajatlar

- [x] Teraklar: ro'yxat (foyda ustuni S5 da to'ladi), qo'shish (standart nom "Terak N"), tahrirlash, savat
- [x] Terak sahifasi, Ombor tabi: material kartalari, narxlar (ishchi/sotish × dona/kub), maqsad va progress, material qo'shish (hamma teraklarga), arxiv
- [x] `stock_movements` va kesh; qo'lda tuzatish (`adjust`) — faqat egasi, sabab bilan
- [x] Xarajatlar tabi: Tashish / Res olib kelish (reys × narx) / Boshqa; res soni
- [x] `lib/calc/stock.ts`: ombor qiymati, maqsad progressi, res soni — Vitest (ADR 0070)

**Qabul:** ombor qoldig'i har doim harakatlar yig'indisiga teng (test); terak savatdan to'liq tiklanadi.

### S3. Kunlik ishlar va ish haqi

- [x] Ish qo'shish — yakka: oddiy tur (qo'lda summa) va material (dona / qator / kub, ikki kub usuli), o'lcham tanlash; summa oldindan ko'rinadi
- [x] Ish qo'shish — guruh: ishchilar, "har biriga to'liq", `work_groups`, ombor bir marta
- [x] Sartirofka va res tekshiruvi (`kind = sorting`)
- [x] Ishlar ro'yxati: umumiy va terak bo'yicha, filtr (ishchi, sana), tahrirlash (K13), o'chirish (ombor qaytadi)
- [x] Ishchi profili: balans, ishlar, to'lovlar, maxsus material narxlari
- [x] To'lov ("Pul berish"): summa, sana, izoh; tahrir va o'chirish (K6)
- [x] "Maosh hisoblash" (K1): davr, soni, summa oldindan ko'rinadi; takror davr rad etiladi; bekor qilish — egasi
- [x] `lib/calc/pay.ts`, `balance.ts`: ishchi narxi, yakka va guruh summasi, balans, terak bo'yicha mutanosib balans — Vitest (ADR 0071)

**Qabul:** tahlil 6–7-qismlaridagi har jadval qatori testda; bir xil ish forma ko'rsatgan va bazaga yozilgan summa bilan teng; ishchi balansi = ishlar − to'lovlar.

### S4. Yuk chiqarish, yuk mashinalari, zakazlar

- [x] Yuk chiqarish: material (qoldig'i bilan), dona/kub, narx avtomatik to'lishi va birlik almashganda aylanishi, jami summa, qabul qiluvchi; qoldiq tekshiruvi; tahrirlash va o'chirish
- [x] Yuk mashinasi: summa terak xarajatiga (`terak_costs.kind = truck`), yuk bilan birga o'chadi (K5)
- [x] Zakazlar: terak tabi va `/orders`, holat (bajarilgan / tayyor / kutilmoqda), bajarildi belgisi, tahrirda bayroqlar saqlanishi (K20)
- [x] Eslatmalar: "material tayyor", "muddat yaqin" (≤ 2 kun) — diqqat talab zakazlar paneli va holatlar
- [x] Barcha summa inputlarida minglik ajratkich (`MoneyInput`)
- [x] `lib/calc/dispatch.ts`, `orders.ts` — Vitest (ADR 0072)

**Qabul:** tahlil 9–10-qismlari testda; kubda kiritilgan yuk jami summasi saqlangandan keyin ham aynan shu summa; omborda yo'q miqdorni chiqarib bo'lmaydi.

### S5. Bosh sahifa va hisobotlar

- [x] Bosh sahifa: terak tanlash, sof foyda (taxminiy / haqiqiy), 4 ko'rsatkich, ombor kartalari, haftalik grafik (K11), qo'shimcha xarajatlar, diqqat talab zakazlar
- [x] Teraklar ro'yxatida foyda; "barcha teraklar" umumiy ko'rinishi (umumiy xarajatlar ayrilgan holda)
- [x] Umumiy xarajatlar sahifasi va toifalari (K14)
- [x] Hisobotlar: terak bo'yicha foyda tafsiloti, ishchilar ish haqi davr bo'yicha, yuk chiqarish davr bo'yicha
- [x] Excel eksport (har hisobot)
- [x] `lib/calc/profit.ts` — Vitest

**Qabul:** har ko'rsatkich tegishli ro'yxat sahifasidagi yig'indi bilan mos keladi (test); foyda usuli almashganda faqat ombor qiymati qo'shiladi/olinadi.

### S6. Yakun

- [ ] Ruscha matnlar to'liqligi: har sahifa ikkala tilda ko'rib chiqiladi, Playwright testi ruscha ham o'tadi
- [ ] Faoliyat jurnali sahifasi, xodimlar va rollar sahifasi
- [ ] Mobil ko'rinish va kontrast tekshiruvi; PWA
- [ ] Playwright: kirish → terak → material ishi → yuk chiqarish → bosh sahifadagi foyda
- [ ] Inventarizatsiya: eski ilovaning har ekrani (tahlil 3-qism) yo yangi tizimda bor, yo "olinmaydi" ro'yxatida sababi bilan

**Qabul:** inventarizatsiya to'liq; e2e test CI'da o'tadi; haqiqiy pilorama ma'lumoti bilan bir hafta sinovdan o'tadi.

## 11. Ochiq savollar

Hal qilinganlar (2026-10-17): K1 — maosh hisoblash tugmasi; K5 — terak xarajati; K14 — umumiy xarajatlar umumiy foydaga kiradi; til — birinchi versiyadan uz + ru; eski ma'lumot import qilinmaydi.

Qolganlari:

- **Maoshli ishchining davr soni:** kun soni kalendar bo'yicha avtomatik (dam olish kunlarisiz?) yoki har safar qo'lda — S3 boshida.
- **Ruscha ma'lumotnomalar:** standart materiallar va ish turlari nomlari (Vassa, Sartirofka) tarjima qilinadimi yoki ikkala tilda bir xil qoladimi.
- **Bir nechta pilorama (sex) bitta mijozda** — filial rejimi kerakmi? Hozircha yo'q.
- **Obuna narxi va sinov muddati** panelda qanday belgilanadi (eski: 7 kun sinov).
- **Ishchi o'z balansini ko'rishi** (ishchi portali) — birinchi versiyada yo'q.

## 12. Ventura bosqichlari bilan bog'liqligi

| Ventura bosqichi | sawmill'dan nima kerak |
| --- | --- |
| 2. Uydagi serverga deploy | S0 skeleti shu yo'l bilan deploy qilib sinaladi |
| 5. Moslash (brend, bo'limlar) | S0 dagi `hasFeature` va brend o'qish; mazmunli sinov uchun kamida S2 |
| 7. Zahira | Sxema barqaror bo'lishi (S4 dan keyin) |
| 8. Ikkinchi shablon | Shu reja. Qabul — S0 qabuli |

## 13. Bu rejaga kirmaydi

- Telefon ilovasi (Flutter) ni yangilash yoki saqlab qolish — u muzlatiladi.
- APK yangilash, demo karta to'lovi, ro'yxatdan o'tish va qurilma bo'yicha bloklash (panel obunasi o'rnini bosadi).
- `backend/` papkasidagi reklama sayti (landing).
- Eski telefon ilovasidagi ma'lumotni (JSON zaxira) import qilish.
- Ishchi portali, Click/Payme orqali to'lov, oflayn rejim.
- Zakazlar orasida ombor taqsimlash (K12).

## 14. Xavflar

| Xavf | Chora |
| --- | --- |
| Hisob-kitob eski ilovadan jimgina farq qiladi | `lib/calc` testlari tahlil jadvallaridan yoziladi; eski 17 test ssenariysi birinchi; farq faqat 9-bo'limdagi tasdiqlangan "tuzatish" |
| Ombor qoldig'i va harakatlar ajralib ketadi | Harakat va kesh bitta tranzaksiyada; "qoldiq = harakatlar yig'indisi" testi va tekshiruv vazifasi |
| Telefondan foydalanish noqulay (eski ilova mobil edi) | Mobil birinchi; har bosqich qabulida telefon o'lchamida tekshiruv; tezkor amallar tugmasi |
| Internet yo'q joyda ishlab bo'lmaydi | Ochiq savol sifatida qayd; birinchi versiyada oflayn yo'q |
| Bir vaqtda ikki xodim bir qoldiqni chiqaradi | Yuk chiqarish tranzaksiyada qatorni qulflab (`SELECT … FOR UPDATE`) tekshiradi |
| Ruscha matn yetishmay qoladi yoki eskiradi | Kalitlar ikkala faylda majburiy (typecheck yiqiladi); `packages/ui` dagi matnlar prop orqali |
| `packages/ui`da komponent yetishmaydi (pastki navbar, grafik, sheet) | Kerakli bosqichda avval `packages/ui`ga, STYLE.md yangilanadi |
