# 0004. Deploy navbati, ishchi jarayon va qadamli drayver

2026-10-11 · qabul qilingan · 2-bosqich, 1-qism

## Vaziyat

SPEC 6-bo'lim: har deploy fon vazifasi sifatida bajariladi, har buyruq va natijasi panelda jonli ko'rinadi, yiqilgan deploy oldingi versiyani buzmasligi kerak. 2-bosqich katta, shuning uchun to'rt qismga bo'lindi (Saidakbar, 2026-10-11):

1. Navbat, ishchi jarayon, jonli log — **shu qaror**
2. Serverni tayyorlash va SSH drayveri (haqiqiy deploy)
3. Mijoz bazalari (`shared_db`, `db_per_tenant`, `getTenantDb`)
4. Deploylar tabi: qayta deploy, rollback, bekor qilish

Sinov maydoni — shu kompyuterdagi WSL (Ubuntu 24.04). Kompyuterda 8 GB xotira, shuning uchun u haqiqiy mijozlar uchun emas; VPS keyin qo'shiladi.

## Qaror

- **Navbat — pg-boss**, panel bazasining alohida `pgboss` sxemasida. Panel faqat vazifa qo'shadi.
- **Ishchi jarayon alohida** (`apps/worker`, `pnpm worker`). Panel qayta ishga tushsa ham boshlangan deploy uzilmaydi. `pnpm dev` ikkalasini birga yoqadi.
- **Ishchi "tirikman" belgisi.** Har 15 soniyada `settings` jadvaliga yozadi; belgi 60 soniyadan eski bo'lsa, panel ogohlantiradi (aks holda deploy sababsiz "Navbatda" turib qolgandek ko'rinadi).
- **Avtomatik qayta urinish yo'q.** Yarim bajarilgan deploy'ni takrorlash xavfli. Ishchi deploy o'rtasida o'chib qolsa, keyingi ishga tushishda o'sha deploy "yiqilgan" deb yopiladi.
- **Bir loyihada bir vaqtda bitta deploy.** Bazadagi shartli unikal indeks kafolatlaydi (`deployments_one_active_uq`).
- **Drayver qadamlarga bo'lingan.** SPEC'dagi `DeployDriver` (`deploy()`, `streamLogs()`) o'rniga drayver har qadamni alohida bajaradi: `run(step, ctx, log)` va `rollback(ctx, log)`. Tartib, holatlar, log yozish, xatoda to'xtash va orqaga qaytish bitta joyda — `runDeployment`. Shu tufayli bu mantiq bazasiz va serversiz test qilinadi. Vercel drayveri (4-bosqich) shu interfeysga moslanadi.
- **Qadamlar:** `prepare` → `fetch` → `env` → `build` → `migrate` → `release` → `health` → `cleanup`. `release` dan oldingi xato saytga tegmaydi; `release` dan keyingi xatoda `rollback` chaqiriladi. `cleanup` yiqilsa ham deploy muvaffaqiyatli.
- **Log alohida jadvalda** (`deployment_logs`), SPEC'dagi `deployment_steps.output` ustuni o'rniga. Jonli ko'rsatish "shu `id` dan keyingi qatorlar" deb so'raydi; butun matn har soniyada qayta yuborilmaydi.
- **Jonli yangilanish — har soniyada so'rov** (polling), SSE emas. Sodda va Cloudflare Tunnel orqali ham ishlaydi; kerak bo'lsa keyin almashtiriladi.
- **Sirlar logga tushmaydi.** Har qator saqlanishidan oldin `redact()` dan o'tadi: loyihaning ma'lum sirlari va tanish ko'rinishlar (ulanish satridagi parol, GitHub tokeni, `Bearer`, `*_SECRET=`).
- **Sinov drayveri (`sim`).** Hech qayerga ulanmaydi, qadamlarni vaqt va namunaviy log bilan taqlid qiladi. Panel buni har doim "Sinov rejimi" xabari bilan ko'rsatadi. 2-qismda SSH drayveri qo'shilgach, `sim` faqat testlar uchun qoladi.

## Baza huquqi

pg-boss navbat yaratilganda yangi jadval ochadi, shuning uchun panel foydalanuvchisiga (`ventura_app`) **bazada sxema yaratish** huquqi berildi (`0003` migratsiya). U `pgboss` sxemasini o'zi yaratadi va unga egalik qiladi. `public` sxemasidagi huquqlar o'zgarmadi: `ventura_app` u yerda jadval yarata olmaydi, `audit_events` avvalgidek himoyalangan (0002-qaror).

## Oqibatlari

- Production'da ikkita jarayon ishlaydi: panel va ishchi. Server tayyorlash skripti (2-qism) ikkalasini PM2 ga qo'shadi.
- Har holat o'zgarishi (`queued`, `building`, `deploying`, `ready`, `failed`) audit jurnaliga yoziladi; yiqilgan deploy super adminlarga Telegram orqali xabar qilinadi.
- Birinchi muvaffaqiyatli deploy loyihani `draft` dan `active` ga o'tkazadi. Sinov drayveri bilan ham shunday — bu 2-qismgacha vaqtinchalik holat: "Faol" hozircha "jarayon o'tdi" degani, "sayt ochilyapti" emas.
- Ishga tushib ketgan deploy'ni bekor qilish hali yo'q (4-qism).
