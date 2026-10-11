# 0005. SSH orqali deploy: bitta ilova, ko'p mijoz

2026-10-11 · qabul qilingan · 2-bosqich, 2-qism

## Vaziyat

Navbat va jonli log tayyor (0004). Endi haqiqiy deploy kerak. Sinov serveri — shu kompyuterdagi WSL (Ubuntu 24.04), keyin xuddi shu yo'l bilan VPS. GitHub App hali yo'q (4-bosqich), mijoz bazalari — keyingi qism.

## Qaror

### Server

- **Bir martalik tayyorlash — `tooling/server/setup.sh`** (root nomidan). Node 24, pnpm, PM2, nginx, PostgreSQL 17 va `deploy` foydalanuvchisini o'rnatadi. Mavjud foydalanuvchilar, ularning SSH kirishi va firewall'ga tegmaydi. Skript CI'da toza Ubuntu'da to'liq ishga tushirib sinaladi (`server-setup` vazifasi).
- **Panel serverga faqat kalit bilan kiradi.** Har serverga alohida ed25519 juft; yopiq qismi `secrets` jadvalida shifrlangan. Serverda kalit `restrict` bilan qo'yiladi: terminal ochib bo'lmaydi, port yo'naltirilmaydi.
- **Server kaliti izi eslab qolinadi.** Birinchi ulanishda saqlanadi, keyin o'zgarsa ulanish rad etiladi.
- **Root huquqi bitta yordamchi orqali.** `deploy` foydalanuvchisi `sudo` bilan faqat `/usr/local/sbin/ventura-site` ni ishlata oladi. U nom, port va domenni qat'iy tekshiradi, nginx sozlamasini qat'iy qolipdan yozadi va tekshiruvdan o'tmasa avvalgisini tiklaydi.
- **Buyruqlar qat'iy qoliplardan** (CLAUDE.md). O'zgaruvchi qismlar (slug, port, yo'l, commit) avval tekshiriladi va har doim qo'shtirnoqlanadi (`sh()`).

### Ilova

- **`shared` rejimda serverda shablonning bitta ilovasi ishlaydi** (`<deployRoot>/edu-crm`, PM2 jarayoni, bitta port) va shu serverdagi hamma mijozga xizmat qiladi. Bu `apps` jadvalida saqlanadi.
- **Mijoz domen bo'yicha aniqlanadi.** Ro'yxat — serverdagi `shared/tenants.json` (domenlar, nom, brend, yoqilgan bo'limlar; sirlar yo'q). Deploy uni yangilaydi, ilova fayl o'zgarganini o'zi sezadi va qayta ishga tushirilmaydi.
- **Loyihani deploy qilish = mijozni ilovaga ulash.** Server allaqachon kerakli commit'da bo'lsa, kod va build qayta bajarilmaydi: faqat ro'yxat, tekshiruv va nginx. Ikkinchi mijoz bir necha soniyada ulanadi.
- **Kod manbai — ishchi jarayon turgan repozitoriy.** `git archive HEAD` arxivi SFTP orqali yuboriladi. Faqat commit qilingan holat ketadi. GitHub'ga serverdan kirish kerak emas; `fork` rejimi uchun GitHub App 4-bosqichda.
- **Qadamlar:** `prepare` → `fetch` → `env` → `build` → `migrate` (hozircha bo'sh) → `release` → `health` → `route` (nginx) → `cleanup` (oxirgi 5 reliz qoladi).
- **Tekshiruv qat'iy:** `/health` shu domen uchun kutilgan mijoz va commit'ni qaytarmasa, deploy yiqiladi va oldingi relizga qaytariladi.

## Oqibatlari

- Umumiy ilovani yangilash hamma mijozga birdan ta'sir qiladi. Hozir bu istalgan loyihani yangi commit bilan deploy qilganda yuz beradi; alohida "shablonni yangilash" amali va ogohlantirish 4-qismda.
- `dedicated` rejim (har loyihaga alohida ilova) shu drayverga 3-bosqichda qo'shiladi; hozir bunday loyihada deploy tushunarli xato bilan to'xtaydi.
- Uydagi serverda sinash uchun har loyihaga `<slug>.localhost` manzili ham qo'shiladi. Haqiqiy domen va SSL — keyingi qismlarda.
- nginx'da noma'lum domen hozircha standart sahifani ko'rsatadi; "bunday sayt yo'q" sahifasi qo'shilishi kerak.
- PgBouncer va firewall sozlamasi skriptga hali kirmagan (VPS ulanganda).
- Haqiqiy deploy hozircha qo'lda sinalgan (WSL: birinchi deploy, ikkinchi mijoz). CI'da avtomatik sinov — keyingi ish.
