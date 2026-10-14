# edu-crm E2E testlari (Playwright)

Asosiy oqim — lid yaratilishidan o'quvchiga aylanishigacha (`leads.spec.ts`, ADR 0029):

1. kirish — telefon, parol va Telegram kodi;
2. yangi lid qo'shiladi;
3. doskadagi kartadan "O'quvchiga aylantirish", guruh tanlanadi;
4. o'quvchi profili ochiladi va guruhda turadi;
5. lid "O'quvchi bo'lganlar"da, profilida o'quvchiga havola bor.

## Muhit

- Ilova production build'da `http://localhost:3101` da ishga tushadi.
- Telegram o'rnida soxta server (`tooling/e2e/telegram-mock.mjs`, port 3198): test kirish kodini shundan o'qiydi.
- **Sinov markazi** `e2e` (`localhost`, `127.0.0.1`):
  - ro'yxat va maxfiy sozlamalar fayli `e2e/.tmp/` da yaratiladi — `.env` dagi va `.secrets/` dagi fayllarga tegilmaydi;
  - baza — **alohida test bazasi**. `E2E_EDU_DATABASE_URL` berilmasa, testlar boshlanmaydi.
- **Har ishga tushishda** (`global-setup.ts`):
  - `edu:tenant` — markaz, baza migratsiyasi va birinchi filial;
  - `edu:e2e-seed` — direktor (ma'lum parol, Telegram ulangan), kurs, o'qituvchi va "E2E guruh".
  - Ikkalasi qayta ishga tushirishga chidamli. Baza tozalanmaydi: har ishga tushish yangi lid nomi va telefoni bilan
    ishlaydi.

## Ishga tushirish

CI'da har PR'da o'zi ishlaydi (`.github/workflows/ci.yml`, `e2e-edu` vazifasi).

**Mahalliy kompyuterda** test bazasi bir marta yaratiladi (PostgreSQL superuser nomidan):

```sql
CREATE ROLE edu_e2e_app LOGIN PASSWORD 'e2e' NOSUPERUSER NOBYPASSRLS;
CREATE DATABASE edu_e2e OWNER ventura ENCODING 'UTF8' TEMPLATE template0;
```

Keyin:

```bash
pnpm --filter @ventura/edu-crm build
E2E_EDU_DATABASE_URL=postgres://edu_e2e_app:e2e@localhost:5432/edu_e2e \
E2E_EDU_MIGRATE_URL=postgres://ventura:<parol>@localhost:5432/edu_e2e \
pnpm e2e:edu
```

- Playwright brauzeri o'rnatilmagan bo'lsa: `pnpm --filter @ventura/edu-crm exec playwright install chromium`.
  O'rnatilgan Chrome bilan ham ishlaydi: `E2E_BROWSER_CHANNEL=chrome`.
- Yiqilgan test izlari `apps/edu-crm/test-results/` da: `playwright show-trace <trace.zip>`.
