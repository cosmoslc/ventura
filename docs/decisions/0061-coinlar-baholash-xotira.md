# 0061. edu-crm: avtomatik coinlar, dars baholari va "Xotira" sahifasi

2026-10-19 · qabul qilingan · ADR 0014, 0015, 0036, 0051, 0056, 0059

## Vaziyat

Egasi edu-crm uchun uchta narsani so'radi:

1. **Coinlar** — bitta tur, faqat avtomatik: oldindan to'lov, davomatga kelish va uy vazifasini bajarish uchun.
   Qoidalar va har birining miqdori sozlamalarda.
2. **Baholash** — guruh ichida, davomat kabi, har dars uchun o'quvchiga baho va "uy vazifasi bajarildi" belgisi.
   Sozlamalarda shkala (5, 10 yoki 100).
3. **Xotira** — sozlamalarda markaz bazasi qancha joy egallagani va qancha qolgani.

Hozirgi holat:

- `coins` va `exams` bo'limlari manifestda bor, lekin `status: "soon"`. Sahifa, jadval va server kodi yo'q
  (EDU-CRM-PLAN qaror 10: birinchi versiyaga kirmagan). `/coins` → `bonuses.manage` ruxsati bor, xolos.
  O'quvchi moliya tabidagi "Coin" kartasi olib tashlangan (E6 3.2, 5-band).
- Baho tizimi umuman yo'q (E6: o'qituvchi reytingidagi "—").
- ADR 0059 "Xotira"ni keyinga qoldirgan. Panel joyni soatiga bir marta o'lchaydi (`servers.metrics.tenantUsage`,
  alohida bazada `databases[].sizeBytes`), limit — `projects.settings.dbQuotaGb`.

## Qaror

### 1. Coinlar (`coins` bo'limi, "soon" olinadi)

**Daftar** — `coin_entries` jadvali (yozuv o'chirilmaydi):

| ustun | ma'nosi |
|---|---|
| `student_id`, `group_id` | kimga, qaysi guruh bo'yicha (oldindan to'lovda ham guruh bor) |
| `rule` | `prepay` · `attendance` · `homework` |
| `source_key` | sababning kaliti: `prepay:<guruh>:<oy>`, `att:<guruh>:<sana>`, `hw:<guruh>:<sana>` |
| `amount` | berilgan paytdagi sozlama miqdori (keyin sozlama o'zgarsa, eski yozuv o'zgarmaydi) |
| `ref_date` | sabab sanasi (dars kuni yoki to'lov oyi boshi) |
| `revoked_at` | sabab bekor bo'ldi (belgi olindi, to'lov bekor qilindi) |

- Noyob kalit `(tenant_id, student_id, rule, source_key)` — **takror berilmaydi**. Har yozish
  `insert ... on conflict do update` orqali: sabab bor bo'lsa `revoked_at = null`, yo'q bo'lsa `revoked_at = now()`.
  Bir xil chaqiruv necha marta bajarilsa ham natija bir xil.
- Balans = bekor qilinmagan yozuvlar yig'indisi.
- Coin manba amal bilan **bitta tranzaksiyada** yoziladi. Shu amalning `ctx.audit` (tenantAudit.record) yozuviga
  `coin: { rule, amount, action: "award" | "revoke" }` qo'shiladi; "Hammasi bor" kabi ommaviy amalda bitta audit
  yozuvi soni bilan. Tasdiq so'rovi orqali o'tgan amalda coin amal tasdiqlanib bajarilganda beriladi.
- Bo'lim o'chiq yoki qoida o'chiq — yangi coin berilmaydi. Bekor qilish esa doim ishlaydi (oldin berilgan coin
  sababi yo'qolsa, olinadi). Qoida yoqilganda o'tgan amallar uchun orqaga qarab berilmaydi.

**Qoidalar** (`settings` jadvali, kalit `coins`, Zod bilan; standart — hammasi o'chiq):

| qoida | qachon beriladi | qachon olinadi |
|---|---|---|
| (a) oldindan to'lov | guruh va oyga bog'langan to'lov **shu oy boshlanishidan oldin** qilingan va shu oy uchun to'lovlar + chegirmalar oyning to'liq narxini (o'quvchi chegirmasi bilan) yopadi. Bir guruh-oy uchun bir marta | to'lov bekor qilinsa yoki tahrirlansa va shart endi bajarilmasa |
| (b) davomat | "Bor" (eski "Kech" ham) belgisi | belgi "Yo'q"/"Sababli"ga o'zgarsa yoki olib tashlansa |
| (c) uy vazifasi | baholashda "bajardi" belgisi | belgi "bajarmadi"ga o'zgarsa yoki olib tashlansa |

(c) qoidasi faqat `grades` bo'limi yoqilganda sozlamada yoqiladi.

Egasi tasdiqladi: oldindan to'lov — oy boshlanishidan oldin va to'liq narx yopilsa. Faqat `payment` va bir martalik
`discount` yozuvlari sanaladi (qaytarish va tuzatish emas). Doimiy chegirma keyin o'zgarsa, oldin berilgan coin qayta
ko'rilmaydi — shart faqat shu guruh-oyning pul yozuvi o'zgarganda tekshiriladi.

**Sahifalar:**

- `/coins` (menyuda, ruxsat `bonuses.manage`): o'quvchilar coin reytingi (filial va guruh filtri), "Tarix" tugmasi —
  o'quvchi coin tarixi (bekor qilinganlari ham). Qo'lda berish yoki ayirish yo'q.
- Faoliyat jurnalida coin amal jumlasining oxirida chiqadi ("+2 coin", "−10 coin").
- `/coin-settings` (Sozlamalar → O'quv jarayoni, yangi ruxsat `settings.coins`): uch qoida, yoqish va miqdor.
  `bonuses.manage` o'qituvchi lavozimida standart bor — sozlamani o'qituvchi o'zgartirmasligi uchun alohida ruxsat.
- O'quvchi profilida "Coin" kartasi qaytadi (faqat bo'lim yoqilganda).

### 2. Baholash (yangi `grades` bo'limi, "Baholash")

`exams` bilan aloqasi: **`exams` — alohida, keyingi ish.** Imtihon — rejalashtirilgan sinov (shablon, sana,
natija, sertifikat); dars bahosi — har dars uchun joriy baho. Ikkalasi bitta shkala sozlamasidan foydalanadi.
`exams` "soon" holatida qoladi; `exams` kalitini "Baholash"ga aylantirmaymiz — panelda yoqilgan bo'limlar kalit
bo'yicha saqlanadi, nomini almashtirish ma'nosini buzadi.

**Jadval** `lesson_grades` — bitta o'quvchining bitta darsdagi bahosi:

- `group_id`, `student_id`, `date`; noyob `(tenant_id, group_id, student_id, date)` (davomat kabi);
- `score` (`smallint`, ixtiyoriy) va `scale` (baho qo'yilgan paytdagi shkala: 5, 10 yoki 100), tekshiruv
  `0 < score <= scale`. Shkala keyin o'zgarsa, eski baholar o'z shkalasida qoladi ("4/5"); o'rtacha foizda;
- `homework` (`boolean`, ixtiyoriy: null — belgilanmagan);
- `marked_by`, vaqt ustunlari (izoh ustuni birinchi versiyada yo'q);
- baho ham, uy vazifasi ham bo'lmasa qator o'chiriladi (bo'sh qator saqlanmaydi).

**Qoidalar** (davomat bilan bir xil, `lessonContext` qayta ishlatiladi): faqat dars kuni, kelajak emas, guruh
a'zosi va muzlatilmagan. Bugun — `grades.mark`, o'tgan kun — `grades.edit_past` (yangi ruxsatlar; o'qituvchi
lavozimiga `grades.mark` standart qo'shiladi). Davomatda "Yo'q" yoki "Sababli" bo'lsa baho qo'yilmaydi, uy
vazifasi belgisi qo'yiladi.

Baho va uy vazifasi bitta amal (`saveGradeAction`, tasdiq kaliti `grades.mark`), uy vazifasi coini bilan bitta
tranzaksiyada. Audit — `grade.mark` (`from`/`to`: baho, shkala, uy vazifasi), sozlama — `grading_settings.update`.

**UI**: guruh profilida "Baholar" tabi — `attendance-tab.tsx` uslubida oy jadvali (o'quvchi × dars kuni).
Katakda baho va uy vazifasi belgisi; bosilganda kichik tanlov: shkala tugmalari (5/10 da raqamlar, 100 da maydon)
va "Uy vazifasi: bajardi / bajarmadi". Oxirgi ustunda o'rtacha (%) va uy vazifasi foizi. O'quvchi profilida guruhlar
bo'yicha o'rtacha baho.

**Sozlama** `/grading` (Sozlamalar → O'quv jarayoni, ruxsat `settings.courses`): shkala 5 / 10 / 100. Kalit
`grading` `settings` jadvalida.

### 3. Xotira (`/storage`, Sozlamalar → Markaz)

**Ma'lumot paneldan relay orqali keladi.** ADR 0056 dagi imzolangan relay (`packages/integrations/src/relay.ts`,
`tenant-secrets.json` → `smsRelay`) bu loyihaning yagona panel bilan aloqasi. Unga `storage` amali qo'shiladi:

- panel loyihani topadi va `projectUsage()` (server metrikasidan) bilan `quotaBytesOf(project.settings)` ni,
  o'lchov vaqti va baza turini (umumiy/alohida) qaytaradi. Javobda sir yo'q;
- edu-crm javobni 10 daqiqa xotirada saqlaydi (panel baribir soatiga bir marta o'lchaydi);
- relay sozlanmagan yoki javob bermasa — "Ma'lumot hozircha yo'q" (soxta raqam ko'rsatilmaydi).

Rad etilgan yo'llar:

- **Deploy maxfiy sozlamasiga yozish** — hajm har soat o'zgaradi, deploy esa kamdan-kam; limit o'zgarishi ham
  deploysiz ko'rinmaydi.
- **edu-crm o'zi o'lchashi** — umumiy bazada `pg_database_size` boshqa markazlarni ham sanaydi, o'z qatorlarini
  `pg_column_size` bilan sanash har ochilishda og'ir; limit baribir faqat panelda.

Sahifa: ishlatilgan / limit / qolgan, chiziq (80% dan sariq, oshsa qizil — panel bilan bir xil), o'lchangan vaqt.
Limit belgilanmagan bo'lsa — "Limit belgilanmagan". Oshganda: "Markaz ishlashda davom etadi, Ventura bilan
bog'laning". Qo'shimcha — asosiy yozuvlar soni (o'quvchilar, to'lovlar, davomat, audit), arzon `count`.
Ruxsat — `settings.branches` (Markaz ma'lumotlari bilan bir xil). Bo'lim — `students` (doim yoqilgan).

Relay yo'li `/api/sms/relay/<amal>` o'zgarmaydi (sirlar va deploy tegilmaydi); nomi tarixiy.

## Bosqichlar

Har biri alohida branch va PR (CI ishlamayotgani uchun tekshiruvlar lokal):

1. `edu/coinlar` — `coin_entries`, `coins` sozlamasi, (a) va (b) qoidalar, `/coins`, `/coin-settings`, profil kartasi.
2. `edu/baholash` — `grades` bo'limi, `lesson_grades`, "Baholar" tabi, `/grading`, (c) qoidasi.
3. `edu/xotira` — relay `storage` amali (panel), `/storage` sahifasi.

## Oqibatlar

- Ikkita yangi mijoz jadvali, ikkalasi `tenantId()`, `tenantPolicy()`, migratsiyada FORCE RLS; ajratish testi.
- Davomat va to'lov amallari tranzaksiyaga o'raladi (coin bilan birga). Coin xatosi asosiy amalni ham bekor qiladi —
  coin va manba bir-biridan ajralmaydi.
- Uchta yangi ruxsat: `settings.coins`, `grades.mark`, `grades.edit_past`. Mavjud lavozimlarga avtomatik
  qo'shilmaydi (faqat standart lavozim shablonlariga) — direktor lavozimlarda yoqadi.
- Shablon versiyasi 0.7.0, `pnpm templates:sync`.
- Xotira faqat `smsRelay` sozlangan markazlarda ishlaydi (deploy `VENTURA_PANEL_URL` bilan). Mahalliy "sinov"da
  tenant-secrets'ga mahalliy panel manzili va kalit yozilsa ko'rinadi.
- Coin sarflash (sovg'a almashish) bu ADR'ga kirmaydi.
