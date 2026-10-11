# 0006. edu-crm skeleti: mijozni ajratish, xodimlar kirishi, bo'limlar

2026-10-11 · qabul qilingan · EDU-CRM-PLAN E0

## Vaziyat

Eski Cosmos CRM'ning admin qismi `apps/edu-crm`da qayta yoziladi (EDU-CRM-PLAN). Birinchi qadam — skelet: mijoz domen bo'yicha aniqlanadi, o'z bazasiga ulanadi, xodimlar panel bilan bir xil mexanizmda kiradi, menyu bo'limlar va rollarga qarab quriladi. Bu qismdagi qarorlar keyingi har bir bo'limga (E1–E6) ta'sir qiladi.

## Qaror

### Mijozni ajratish

- **Har jadvalda `tenant_id`, qiymati ulanishdan.** `createTenantDb(url, tenantId)` har ulanishga `app.tenant_id` parametrini beradi (postgres.js `connection`), ustun standart qiymatni `current_setting('app.tenant_id')` dan oladi. Ilova kodi `tenant_id` ni yozmaydi va filtrlamaydi — unutib qo'yadigan joy yo'q.
- **RLS har jadvalda, egaga ham (`FORCE`).** Siyosat: `tenant_id = current_setting('app.tenant_id', true)`. Parametrsiz ulanish hech narsa ko'rmaydi va yoza olmaydi. Superuser va BYPASSRLS rollar ilovaga berilmaydi.
- **Uchala baza strategiyasida kod bir xil.** Farq faqat baza manzilida: umumiy baza — bir nechta mijozga bir URL, alohida baza — har biriga o'z URL. `db_per_tenant`da ham `tenant_id` va RLS turadi (SPEC 9): mijozni strategiyalar orasida ko'chirish oson, xato sozlangan ulanish ham boshqa ma'lumotni ko'rmaydi.
- **`tenant_id` = loyiha `slug`i.** Ro'yxatda allaqachon bor, o'qilishi oson. Slug o'zgarmaydi deb hisoblanadi; o'zgartirish kerak bo'lsa — migratsiya bilan.
- **Ajratish testi haqiqiy PostgreSQL'da** (`packages/db/src/tenant-isolation.test.ts`, CI `tenant-db` vazifasi): o'qish, o'zgartirish, o'chirish, boshqa mijoz nomidan yozish, parametrsiz ulanish, alohida bazalar va xato sozlangan ulanish. Test `tenant_id` li har jadvalda RLS va FORCE borligini, `tenant_id` siz jadval yo'qligini ham tekshiradi — yangi jadval qo'shilganda shart avtomatik.

### Ilova konfiguratsiyasi

- **Ikki fayl.** `tenants.json` — ochiq ro'yxat (domen, nom, brend, bo'limlar), avvalgidek (0005). `tenant-secrets.json` — maxfiy: baza manzili, sessiya kaliti (`authSecret`), Telegram bot tokeni. 0600 huquq, faqat server kodida o'qiladi, xato matnida qiymat ko'rsatilmaydi.
- **Har mijozning o'z sessiya kaliti.** Ilovaga umumiy `BETTER_AUTH_SECRET` kerak emas.
- **Fayllar ilovani qayta ishga tushirmasdan qayta o'qiladi**; maxfiy sozlama o'zgarsa, eski baza ulanishi yopilib yangisi ochiladi.
- **Hozircha fayllarni `pnpm edu:tenant` yozadi** (mahalliy ishlab chiqish va sinov). Serverda ularni deploy paytida panel yozishi — Ventura 2-bosqichining "Baza strategiyalari" bandi.

### Xodimlar kirishi

- **Panel bilan bir xil mexanizm** (`packages/auth/src/staff`): telefon + parol, Telegram kodi, 5 xatoda bloklash, yangi qurilma ogohlantirishi, sessiya muddati sozlamasi. Foydalanuvchilar mijoz bazasida; telefon mijoz ichida noyob.
- **Kodni mijozning o'z boti yuboradi** (8a-qaror). Bot ulanmagan bo'lsa, kirish sahifasi buni aytadi va forma ko'rsatilmaydi.
- **Birinchi direktor terminaldan** (`pnpm edu:staff`): vaqtinchalik parol, birinchi kirishda almashtiriladi, keyin bot ulanadi.
- **Server amallari ichida `redirect()` ishlatilmaydi.** Next yo'naltirilgan sahifani ichki so'rov bilan `localhost` nomidan chizadi va mijoz domeni yo'qoladi. Amal manzilni qaytaradi (`FormState.next`), forma o'zi o'tadi. Mijozni `X-Forwarded-Host` dan aniqlash rad etildi: bu sarlavhani brauzer ham yubora oladi.

### Rollar va bo'limlar

- **Tayyor rollar:** direktor, menejer, kassir, kuzatuvchi (EDU-CRM-PLAN 7-bo'limdagi ochiq savolga vaqtinchalik javob; Saidakbar bilan aniqlashtiriladi). Ruxsat bo'lim kalitiga bog'langan: `can(role, "payments.write")`. Yangi bo'lim uchun rollar jadvali o'zgarmaydi.
- **Filial bo'yicha cheklov:** direktor — hamma filial, qolganlar — `user_branches`dagi filiallar (`branchScope`, `inScope`). Ma'lumot so'rovlarida qo'llash E1 dan.
- **O'chirilgan bo'lim ikki joyda yopiladi:** proxy (sahifa — 404, API — 404 JSON, kirmagan foydalanuvchiga ham) va sahifa ichida `requireFeature()`. Ruxsatsiz bo'lim — bosh sahifaga, ogohlantirish bilan.
- **Menyu manifestdan** (`nav`): faqat yoqilgan va ko'rish ruxsati bor bo'limlar. Hali yozilmagan bo'lim umumiy "tayyorlanmoqda" sahifasini ko'rsatadi; E1 dan har bo'lim o'z papkasini oladi.

## Oqibatlari

- Har yangi jadval: `tenantId()` ustuni, `tenantPolicy()` va migratsiyada `FORCE ROW LEVEL SECURITY`. Ajratish testi buni eslatadi.
- Tashqi kalitlar (FK) RLS'ni chetlab o'tadi: boshqa mijoz qatorining `id`sini bilgan kod unga havola yozishi mumkin (o'qiy olmaydi). uuid taxmin qilinmaydi; muhim bog'lanishlarda keyin `(tenant_id, id)` kompozit kalitlariga o'tish mumkin.
- Panel tomonidagi ish qoldi: deploy paytida maxfiy fayl va mijoz bazasini yaratish, migratsiyani har bazada ishga tushirish, Yangi loyiha formasidagi bot tokenini shu faylga yetkazish.
- Tema skripti `packages/ui/src/lib/theme.ts`ga ko'chirildi: server komponent `"use client"` moduldan qiymat import qilsa, qiymat o'rniga client havolasi keladi (edu-crm'da qorong'i rejim shu sababli ishlamadi). Panel ham `themeInitScript`ni shu usulda olardi — endi yangi joydan.
