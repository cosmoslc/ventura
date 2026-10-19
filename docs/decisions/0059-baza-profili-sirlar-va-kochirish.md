# 0059. Panel: baza profili, joy limiti, loyiha sirlari va bazalar orasida ko'chirish

2026-10-18 · qabul qilingan · ADR 0057, 0058

## Vaziyat

Egasi "Bazalar" sahifasidan keyin quyidagilarni so'radi:

- bazani bosganda profil: unda nechta va qaysi loyihalar, har biri qancha joy egallaydi, joy limiti;
- markazni umumiy bazadan alohida bazaga va aksincha ko'chirish;
- loyiha menyusida super adminga ko'rinadigan va tahrirlanadigan "Sirlar".

## Qaror

**Baza profili** — `/databases/<server>/<baza>`.

- Kartalar: hajm, loyihalar soni, ulanishlar, limitdan oshganlar soni.
- Jadval: loyiha, egallagan joy va limit (chiziq: 80% dan sariq, oshsa qizil), holat.
- Alohida bazada egallagan joy — butun baza hajmi.
- Umumiy bazada — markaz qatorlari hajmi: `ventura-db tenant-sizes`, `pg_column_size`, indekslarsiz, taxminiy.
  Og'ir so'rov bo'lgani uchun metrika so'rovida soatiga bir marta yangilanadi (`servers.metrics.tenantUsage`).

**Joy limiti** — loyiha sozlamasida (`projects.settings.dbQuotaGb`), migratsiyasiz.

- Oshsa super adminlarga Telegram xabari keladi, faqat yangi oshganda (`servers.alerts.quotas`).
- PostgreSQL'da bazaga yoki mijozga qat'iy limit yo'q, shuning uchun markaz ishlashda davom etadi.
- Markazga ham ko'rsatish CRM'dagi "Xotira" bo'limi bilan birga keyin qilinadi.

**Ko'chirish** (faqat super admin, slug'ni yozib tasdiqlash; ishchi jarayonda `db_move`):

1. Maqsad baza va rol (`ventura-db ensure`). Sxema shablonning `provision.ts` skripti bilan, direktor yaratilmaydi.
2. Sayt yopiladi (`ventura-site remove`) — ko'chirish paytida yozuv yo'qolmasin. Egasi qisqa to'xtashga rozi.
3. `ventura-db copy-tenant <manba> <maqsad> <mijoz>`:
   - maqsad bazada bitta tranzaksiya: avval maqsaddagi shu mijoz qatorlari o'chadi (provision qoldiqlari), keyin
     har jadval CSV orqali nusxalanadi;
   - har jadvalda soni manba bilan solishtiriladi, mos kelmasa hammasi bekor qilinadi;
   - ustunlar maqsad bazasi tartibida nomi bilan olinadi;
   - ketma-ket raqamli ustun (audit `seq`): boshqa mijozlar bor bazada tartibni saqlab qaytadan beriladi (xesh
     zanjiriga `seq` kirmaydi, faqat tartib); bo'sh bazada saqlanadi va ketma-ketlik suriladi.
4. Ilova yangi bazaga ulanadi (`tenant-secrets.json` → `databaseUrl`, ilova faylni o'zi qayta o'qiydi). Panelda
   `dbStrategy` o'zgaradi.
5. Sayt qayta ochiladi. Manba tozalanadi: umumiy bazadan — shu mijoz qatorlari, alohida baza — butunlay.

2–4 da xato bo'lsa sayt qayta ochiladi, ilova eski bazada qoladi, manbaga tegilmaydi. Alohida bazaga ko'chirishda
shu nomdagi baza allaqachon bo'lsa, xavfsizlik uchun to'xtatiladi.

`copy-tenant` haqiqiy PostgreSQL 17 da sinaldi:

- boshqa mijoz bor bazaga (raqamlar qaytadan beriladi, maqsaddagi eski qoldiq o'chadi);
- bo'sh bazaga (raqamlar saqlanadi);
- vergul va qo'shtirnoqli matnlar buzilmaydi;
- sxemasi yo'q maqsad rad etiladi.

CI server testi ham shuni tekshiradi.

**Loyiha sirlari** — "Sirlar" tabi, faqat super admin.

> 2026-10-19: alohida "Sirlar" tabi olib tashlandi — sirlar boshqaruvi "Ega va sirlar" tabida (super adminga; boshqalarga faqat bor/yo'qligi).

- Sirlar: Telegram bot tokeni, ega paroli, baza paroli (alohida bazada), sessiya kaliti, SMS relay kaliti.
- Ko'rish va o'zgartirish audit jurnaliga yoziladi (qiymat yozilmaydi). Kalitlar uchun tasodifiy qiymat yaratish bor.
- Xavfli sirlarda (baza paroli, sessiya kaliti, SMS kaliti) alohida tasdiq va oqibati yoziladi.
- Yangi qiymat serverga keyingi deploy'da yetadi (deploy baza rolining parolini ham paneldagi qiymatga tenglaydi).
- Umumiy baza paroli serverga tegishli — Bazalar sahifasida.

## Oqibatlar

- Serverda `setup.sh` qayta ishga tushirilishi kerak (yangi `tenant-sizes` va `copy-tenant` buyruqlari).
- Ko'chirish paytida markaz sayti bir necha daqiqa yopiq turadi (katta bazada uzoqroq).
- Ko'chirishdan keyin manbadagi eski ma'lumot avtomatik tozalanadi. Nusxa bitta tranzaksiyada tekshirilgani uchun
  shunday tanlandi.
