# 0029. edu-crm: E2E testlar (Playwright) va lid → o'quvchi oqimi (E4e)

2026-10-14 · qabul qilingan · EDU-CRM-PLAN E4 qabul sharti, docs/EDU-CRM-E4.md (E4e)

## Vaziyat

E4 qabul sharti — lid yaratilishidan o'quvchiga aylanishigacha bo'lgan oqim Playwright testida o'tishi. Panelda E2E
muhit bor edi (soxta Telegram, alohida baza, test foydalanuvchisi). edu-crm'da esa yo'q edi, va bu yerda vazifa
qiyinroq:

- ilova mijozni domen bo'yicha aniqlaydi — mijoz ro'yxati va maxfiy sozlamalar fayli kerak;
- mijoz bazasi alohida;
- xodim markaz boti orqali 2FA bilan kiradi.

## Qaror

### Muhit (`apps/edu-crm/e2e`)

- **Sinov markazi `e2e`** (`localhost`, `127.0.0.1`). Ro'yxat va maxfiy sozlamalar fayli `e2e/.tmp/` da yaratiladi
  (`VENTURA_TENANTS_FILE`, `VENTURA_TENANT_SECRETS_FILE`). Muhit qiymatlari `.env` dan ustun turadi, shuning uchun
  test `.env` dagi bazaga va `.secrets/` ga hech qachon tegmaydi.
- **Baza:** faqat `E2E_EDU_DATABASE_URL`. Berilmasa testlar boshlanmaydi. Migratsiya egasi — `E2E_EDU_MIGRATE_URL`.
  Ilova roli RLS'ni chetlab o'tolmaydi.
- **Tayyorlash** (`global-setup.ts`):
  - mavjud `edu:tenant` buyrug'i — ro'yxat, migratsiya, birinchi filial;
  - yangi `edu:e2e-seed` — direktor (ma'lum parol, Telegram ulangan, 2FA), kurs, o'qituvchi va "E2E guruh".
- **`edu:e2e-seed` himoyasi:** markaz bazasi `E2E_EDU_DATABASE_URL` bilan bir xil bo'lmasa ishlamaydi. Qayta ishga
  tushirilsa, yozuvlarni qayta yaratmaydi va direktorning blokini tozalaydi.
- **Soxta Telegram** endi `tooling/e2e/telegram-mock.mjs` da — panel va edu-crm testlari uchun bitta. Portlar
  alohida: panel 3100/3199, edu-crm 3101/3198.
- **Ilova** production build'da ishga tushadi. Tayyorligi `/health` bo'yicha tekshiriladi — bu manzil mijoz ro'yxati
  hali yozilmagan bo'lsa ham 200 qaytaradi.
- Vitest `e2e/**` ni ishga tushirmaydi.

### Test (`leads.spec.ts`)

1. Kirish: telefon va parol, soxta Telegram'dan olingan kod, bosh sahifa.
2. Yangi lid (nomi va telefoni har ishga tushishda yangi — baza tozalanmaydi).
3. Doskadagi kartaning menyusidan "O'quvchiga aylantirish", "E2E guruh" tanlanadi.
4. O'quvchi profili ochiladi, guruh ko'rinadi.
5. "O'quvchi bo'lganlar"da lid bor. Lid profilida "O'quvchi bo'ldi" yozuvi va shu o'quvchi profiliga havola bor.

### CI

Yangi `e2e-edu` vazifasi:

- o'z PostgreSQL xizmati va ilova roli;
- Playwright brauzeri;
- edu-crm build;
- `pnpm e2e:edu`;
- yiqilsa — test izlari artefakt sifatida saqlanadi.

## Oqibatlari

- Keyingi bo'limlarning asosiy oqimlari (to'lov, davomat, hisobotlar) shu muhitga test qo'shib qamraladi.
  Ma'lumot kerak bo'lsa — `edu:e2e-seed` ga qo'shiladi.
- E4 (Sotuv) bo'limi shu bilan yopiladi.
