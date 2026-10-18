# SMS (Eskiz) — to'liq reja

2026-10-17 · holat: **S1–S3 bajarildi** (ADR 0053–0055), keyingisi — Ventura paketi · bo'lim: `sms` (`apps/edu-crm/features.ts`, menyu `/sms`) · ruxsatlar:
`settings.sms_gateways`, `students.sms_send`, `finance.debtors_remind` (bor)

Maqsad: markaz o'z Eskiz hisobini ulaydi, CRM o'zi kerakli paytda SMS yuboradi (to'lov qabul qilindi, to'lov eslatmasi,
qarz ogohlantirishi, darsga kelmadi, maosh berildi), qo'lda ham yuborsa bo'ladi. Balans, yuborilgan va qolgan SMS
soni, hisobot va shablonlar CRM ichida ko'rinadi.

## 1. Eskiz API (manba: rasmiy Postman hujjati)

Hujjat: <https://documenter.getpostman.com/view/663428/RzfmES4z>. Asosiy manzil `https://notify.eskiz.uz/api`.

| Ish | So'rov | Izoh |
| --- | --- | --- |
| Kirish | `POST /auth/login` (`email`, `password`) | `password` — kabinetdagi **maxfiy kalit**. Javob: `data.token` (bearer) |
| Tokenni yangilash | `PATCH /auth/refresh` | muddati o'tsa yoki 401 kelsa |
| Hisob ma'lumoti | `GET /auth/user` | ulanishni tekshirish |
| Balans | `GET /user/get-limit` | `data.balance` (so'm) |
| Narxlar | `GET /user/prices` | 1 SMS narxi operatorlar bo'yicha → "qolgan SMS ≈ balans / narx" |
| Nikneymlar | `GET /nick/me` | `from` maydoni; standart `4546` |
| Bitta SMS | `POST /message/sms/send` (`mobile_phone`, `message`, `from`, `callback_url`) | javob `id` (UUID, `request_id`), `status: waiting` |
| Ommaviy | `POST /message/sms/send-batch` (`messages[{user_sms_id,to,text}]`, `from`, `dispatch_id`, `callback_url`) | `user_sms_id` ≤ 12 belgi |
| Holat | `GET /message/sms/status_by_id/:id` | UUID bo'yicha 30 kun ichida |
| Callback | Eskiz → bizga `POST` | `{request_id, message_id, user_sms_id, phone_number, sms_count, status, status_date}`; `status`: `DELIVRD` va h.k. |
| SMS tekshiruvi | `GET /message/sms/check` (`message`) | nechta qism, qora ro'yxat, narx |
| Arzonlashtirish | `POST /message/sms/normalizer` | maxsus belgilarni almashtirish (kirill → lotin qismlari kamayadi) |
| Shablon yuborish | `POST /user/template` (`template`) | moderatsiyaga |
| Shablonlar | `GET /user/templates` | `status`: `moderation`, `inproccess`, `service`, `reklama`, `rejected` |
| Hisobotlar | `POST /user/totals`, `GET /report/total-by-month`, `POST /report/total-by-range` | Eskiz tomonidagi xarajat |

Muhim cheklovlar:

- **Test holati:** hisob faollashguncha faqat uchta matn yuboriladi ("Bu Eskiz dan test", "Это тест от Eskiz",
  "This is test from Eskiz"). Ulanishni tekshirish shu matn bilan qilinadi.
- **Shablon moderatsiyasi:** matnlar Eskiz'da tasdiqlangan shablonga mos bo'lishi kerak (`service` holati). Shuning
  uchun CRM shablonini saqlaganda Eskiz'ga ham yuboramiz va holatini kuzatamiz; tasdiqlanmagan shablon avto-SMS'da
  ishlatilmaydi.
- **Uzunlik:** lotin 160 belgi = 1 qism, kirill (UCS-2) 70 belgi. Shablon tahririda qismlar soni ko'rinadi.

## 2. Qarorlar (2026-10-17, Alsiher)

| # | Savol | Qaror |
| --- | --- | --- |
| Q1 | Kimning Eskiz hisobi | **Ikkalasi ham, standart — Ventura paketi (B).** Eskiz faqat yuridik shaxslarga xizmat qiladi, shuning uchun markazlar paketni CRM ichida (o'z hisobi bilan kirib) sotib oladi. O'z Eskiz hisobini ulash (A) — qo'shimcha imkoniyat (2026-10-18) |
| Q2 | Avto-SMS boshlang'ich holati | **O'chiq** — markaz o'zi yoqadi |
| Q3 | Kimga | **Har qoidada tanlov**: o'quvchi / ota-ona / ikkalasi. Standart — ota-ona, raqami bo'lmasa o'quvchi |
| Q4 | Tinch soatlar | **21:00–08:00** (sozlamada o'zgaradi); bu oraliqdagi avto-SMS 08:00 da ketadi. Qo'lda yuborish cheklanmaydi |

### Ikki rejim qanday ishlaydi

| | A. O'z hisobi | B. Ventura paketi |
| --- | --- | --- |
| Eskiz hisobi | markazniki | Ventura'niki (panelda, shifrlangan sir) |
| Kim yuboradi | tenant ilova to'g'ridan-to'g'ri Eskiz'ga | tenant ilova → **panel relay** (`POST /api/sms/relay`, tenant imzosi bilan) → Eskiz |
| Balans | Eskiz balansi (so'm) | panelda markazning **SMS qismlari** qoldig'i |
| To'ldirish | markaz Eskiz'da to'laydi | markaz paket sotib oladi; 1-navbatda panel admini qo'lda qo'shadi (hisob-faktura), keyin Click/Payme |
| Yuboruvchi nomi | markazning nikneymi | Ventura nikneymi yoki standart `4546` |
| Shablon moderatsiyasi | markaz hisobida | Ventura hisobida (panel relay orqali) |

Ventura'ning Eskiz kaliti tenant serverlariga (ayniqsa dedicated) hech qachon tushmaydi — shuning uchun B rejimda
yuborish faqat panel orqali. Tenant kodida provayder interfeysi bitta (`SmsProvider`): `EskizDirect` (A) va
`VenturaRelay` (B); sahifalar ikkalasida bir xil, faqat balans kartasi "so'm" yoki "SMS" ko'rsatadi.

Panel tomoni (B): `sms_wallets` (tenant, qoldiq qismlar), `sms_wallet_entries` (paket qo'shildi / yechildi,
kim, qachon — o'chirilmaydigan jurnal), `sms_packages` (nom, qismlar, narx). Relay yuborishdan oldin qoldiqni
tranzaksiyada band qiladi, callback `failed` bo'lsa qaytaradi. Panelda "SMS" sahifasi: markazlar qoldig'i, paket
qo'shish, Ventura Eskiz balansi va ulanish.

### Markaz o'z Eskiz'ini qanday ulaydi (A rejim, foydalanuvchi uchun qadamlar)

1. `my.eskiz.uz` da ro'yxatdan o'tish (yuridik shaxs yoki YaTT ma'lumotlari), shartnoma va balansni to'ldirish.
2. Kabinetdan **email** va **maxfiy kalit**ni (API paroli) olish. Kerak bo'lsa o'z nikneymini (masalan `MARKAZ`)
   so'rash — tasdiqlanguncha standart `4546` dan ketadi.
3. CRM → Sozlamalar → **SMS / Telegram** → "Eskiz" kartasi: email va kalitni kiritish → "Ulanishni tekshirish".
   CRM token oladi, balans va nikneymlarni ko'rsatadi.
4. Shablonlar sahifasida shablonlarni yozish → Eskiz moderatsiyasiga ketadi → tasdiqlangach avto-SMS yoqiladi.

## 3. Ma'lumotlar bazasi (tenant sxemasi, yangi migratsiya)

| Jadval | Ustunlar | Izoh |
| --- | --- | --- |
| `sms_provider` (bitta qator) | `mode` (`own`/`ventura`), `provider` (`eskiz`), `email`, `secret_enc`, `token_enc`, `token_expires_at`, `sender`, `enabled`, `quiet_from`, `quiet_to`, `updated_by` | sir va token shifrlangan; brauzerga faqat "ulangan / ulanmagan" va email qaytadi |
| `sms_templates` | `id`, `kind`, `name`, `body`, `parts`, `provider_template_id`, `moderation` (`draft`/`moderation`/`approved`/`rejected`), `active`, `created_by`, `archived_at` | `kind`: `payment_received`, `payment_reminder`, `debt_warning`, `absence`, `salary_paid`, `birthday`, `custom` |
| `sms_rules` | `kind` (PK), `enabled`, `template_id`, `audience` (`student`/`parent`/`both`), `offset_days`, `repeat_days`, `send_at` (soat), `delay_minutes` | avto-SMS sozlamalari |
| `sms_messages` (outbox + tarix) | `id`, `kind`, `template_id`, `dispatch_id`, `student_id`, `staff_id`, `group_id`, `branch_id`, `phone`, `text`, `parts`, `cost`, `status` (`queued`/`sending`/`sent`/`delivered`/`failed`/`cancelled`), `provider_id` (UUID), `user_sms_id`, `error`, `attempts`, `send_after`, `sent_at`, `delivered_at`, `created_by`, `dedupe_key` (unique) | bitta jadval ham navbat, ham hisobot |
| `sms_dispatches` | `id`, `title`, `kind`, `total`, `created_by`, `created_at` | qo'lda ommaviy yuborishlar guruhi |

- `dedupe_key` takrorni to'xtatadi: `reminder:<student>:<oy>`, `debt:<student>:<sana>`, `absence:<attendance_id>`.
- Indekslar: `(status, send_after)`, `(created_at)`, `(group_id, created_at)`, `(student_id)`.
- Arxiv va o'chirish: xabarlar o'chirilmaydi (hisobot), shablon arxivlanadi.

## 4. Backend

### 4.1 Eskiz klienti — `packages/integrations/src/eskiz.ts`

`createEskiz({ email, secret, api })` → `login`, `refresh`, `balance`, `prices`, `nicks`, `send`, `sendBatch`,
`status`, `templates`, `submitTemplate`, `check`. Telegram klienti uslubida: `AbortSignal.timeout`, `EskizError`
(xato matnida token va kalit bo'lmaydi), 401 → bir marta `refresh`/`login` → qayta urinish. Telefon `998XXXXXXXXX`
ko'rinishiga keltiriladi. `ESKIZ_API_URL` — e2e soxta server uchun.

### 4.2 Sirlar

`secret` va `token` tenant bazasida shifrlangan (AES-GCM). Kalit — tenantning `authSecret`idan HKDF bilan olinadi
(panel `VENTURA_MASTER_KEY_FILE` tenant ilovasida yo'q). Logga, audit `diff`iga va brauzerga hech qachon tushmaydi;
sahifaga faqat `connected: boolean`, `email`, `sender` qaytadi.

### 4.3 Yuborish qatlami — `apps/edu-crm/lib/server/sms/`

- `render(template, vars)` — o'zgaruvchilar: `{ism}`, `{familiya}`, `{guruh}`, `{kurs}`, `{summa}`, `{qarz}`,
  `{oy}`, `{sana}`, `{markaz}`, `{telefon}`, `{maosh}`. Noma'lum o'zgaruvchi — saqlashda xato.
- `enqueue(db, items)` — `sms_messages` ga `queued` qator (dedupe bilan, `ON CONFLICT DO NOTHING`). Biznes amal bilan
  **bir tranzaksiyada** (to'lov saqlandi → SMS navbatga), tashqi so'rov tranzaksiya ichida qilinmaydi.
- `flush(db)` — `queued` va `send_after <= now` qatorlarni `FOR UPDATE SKIP LOCKED` bilan oladi, `send-batch` bilan
  yuboradi, `provider_id` va `sending` holatini yozadi. Xato: `attempts++`, 1/5/15 daqiqa kechikish, 3 urinishdan keyin
  `failed`. Tinch soatlarda (`quiet_from`–`quiet_to`, standart 21:00–08:00) avto-SMS ertalabga suriladi.

### 4.4 Rejalashtiruvchi (fon vazifasi)

Alohida PM2 jarayoni o'rniga ilova jarayoni ichida (`instrumentation.ts` → `lib/server/sms/scheduler.ts`, ADR 0055):

- har 60 soniyada: `sms` bo'limi yoqilgan har markaz uchun `flush` va `poll`;
- server amali yuborgandan keyin shu markaz uchun darhol (`after()`);
- avto-qoidalar (`payment_reminder`, `debt_warning`, `birthday`) shu aylanishga qo'shiladi;
- shared va dedicated rejimda bir xil; ikki nusxa bo'lsa ham `FOR UPDATE SKIP LOCKED` takror yubormaydi.

### 4.5 Callback — `POST /api/sms/eskiz/[token]`

`tenantToken` — tenant `authSecret`idan HMAC (taxmin qilib bo'lmaydi). `request_id` bo'yicha qatorni topadi, `status`
(`DELIVRD` → `delivered`, `REJECTD`/`UNDELIV`/`EXPIRED` → `failed`), `sms_count`, `status_date` ni yozadi. Callback
kelmasa, worker `sending` holatidagi 30 daqiqadan eski qatorlarni `status_by_id` bilan tekshiradi.

### 4.6 Avto-SMS manbalari

| `kind` | Qachon | Kimga | Qayerdan |
| --- | --- | --- | --- |
| `payment_received` | to'lov saqlanganda | o'quvchi / ota-ona | to'lov action (bir tranzaksiyada `enqueue`) |
| `payment_reminder` | to'lov kunidan `offset_days` oldin | o'quvchi / ota-ona | worker, `lib/ledger` hisobi |
| `debt_warning` | muddati o'tgan qarz, har `repeat_days` da | o'quvchi / ota-ona | worker, `listDebtors` mantig'i |
| `absence` | "kelmadi" belgilanganda, `delay_minutes` keyin | ota-ona | davomat action; belgi o'zgarsa `cancelled` |
| `salary_paid` | maosh berilganda | xodim | maosh action |
| `birthday` | tug'ilgan kun ertalabi | o'quvchi | worker |

Qo'lda: o'quvchilar ro'yxatidagi "SMS yuborish" (hozir o'chirilgan tugma, `students.sms_send`), qarzdorlardan
"Eslatma yuborish" (`finance.debtors_remind`), guruh profilidan butun guruhga. Har biri `sms_dispatches` + audit.

### 4.7 Server actions

`saveSmsProviderAction`, `testSmsConnectionAction`, `saveTemplateAction`, `archiveTemplateAction`,
`syncTemplatesAction`, `saveRuleAction`, `sendSmsAction` (qo'lda; oldindan qismlar va taxminiy narx), `resendAction`.
Har biri ruxsatni tekshiradi va `tenant-audit` ga yozadi (matn yoziladi, sir yozilmaydi).

## 5. Frontend (menyu "SMS", sahifalar ichida)

| Sahifa | Manzil | Tarkibi |
| --- | --- | --- |
| **SMS** (bosh) | `/sms` | 4 karta: Balans (so'm), Shu oy yuborilgan, Yetkazilgan %, Qolgan SMS (≈ balans / narx). Ostida **Avto-SMS** qoidalari: har tur uchun yoqish/o'chirish, shablon tanlash, kimga, necha kun oldin, soat. Ulanmagan bo'lsa — "Eskiz'ni ulash" bo'sh holati |
| **Hisobot** | `/sms/report` | Filtr qatori: sana oralig'i, guruh, tur, holat. Kartalar: jami SMS, qismlar, xarajat, xato. Guruhlar bo'yicha jadval (guruh · SMS soni · qism · xarajat). Pastda xabarlar jadvali (№ · O'quvchi · Telefon · Guruh qutichasi · Tur · Matn · Holat · Sana), ⋯ menyuda "Qayta yuborish" |
| **Shablonlar** | `/sms/templates` | Kartochkalar: nom, tur, matn, qismlar soni, moderatsiya holati. Tahrir oynasi: o'zgaruvchi tugmalari (`{ism}` …), jonli namuna, belgi/qism hisoblagichi, "Eskiz'ga moderatsiyaga yuborish". Tayyor andozalar: to'lov qabul qilindi, to'lov eslatmasi, qarz ogohlantirishi, darsga kelmadi, maosh berildi |
| **Sozlamalar** | `/sms/settings` (sozlamalar navbaridagi "SMS / Telegram" ham shu yerga) | Eskiz ulash (email, maxfiy kalit, "Tekshirish"), yuboruvchi nomi (nikneymlar ro'yxatidan), tinch soatlar, test SMS yuborish |

Qo'shimcha: o'quvchi profilida "SMS" tabi (shu o'quvchiga ketganlar), qarzdorlarda ⋯ menyuda "SMS eslatma".
Komponentlar: mavjud `StatCard`, `FilterBar`, `StudentsTable`, `GroupChip`, `DropdownMenu`, `ViewSwitch`.

## 6. Bosqichlar

| # | Ish | Natija |
| --- | --- | --- |
| S1 ✓ | `sms_provider` migratsiyasi (tinch soatlar 21–08, avto-SMS o'chiq), Eskiz klienti (+ soxta fetch bilan testlar), sirlarni shifrlash, `/sms/settings`, `/sms` balans kartalari. Qolgan jadvallar va "Qolgan SMS" kartasi o'z bosqichida (ADR 0053) | markaz ulanadi, balans ko'rinadi |
| S2 ✓ | Shablonlar: CRUD, `render`, qism hisoblagich, Eskiz moderatsiyasi va sinxron, tayyor andozalar (ADR 0054) | shablonlar tayyor |
| S3 ✓ | Outbox, fon vazifasi (ilova ichida), callback, qo'lda yuborish (o'quvchilar, qarzdorlar, guruh) (ADR 0055) | SMS haqiqatda ketadi |
| S4 | **Ventura paketi (standart)**: panel relay, `sms_wallets` va paketlar, CRM ichida paket sotib olish, panel "SMS" sahifasi, rejim tanlash | Ventura SMS sotadi |
| S5 | Avto-qoidalar: to'lov qabul qilindi, eslatma, qarz, kelmadi, maosh, tug'ilgan kun | avto-SMS |
| S6 | `/sms/report` hisobot sahifasi, o'quvchi profilidagi SMS tabi | hisobot |

Har bosqich — alohida PR va ADR. Testlar: klient (soxta Eskiz), `render`, dedupe, worker qayta urinishi, callback
imzosi, tinch soatlar, ruxsatlar.

## 7. Ochiq savollar

Yo'q — §2 dagi qarorlar bilan yopildi. B rejimdagi paket narxlari S6 boshida kelishiladi.
