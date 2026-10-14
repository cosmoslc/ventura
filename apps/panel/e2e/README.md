# E2E testlar (Playwright)

Asosiy oqimlar: kirish + 2FA (`auth.spec.ts`), Yangi loyiha formasi (`wizard.spec.ts`) va deploy navbati (`deploy.spec.ts`).

- Panel production build'da `http://localhost:3100` da ishga tushadi.
- Telegram o'rnida soxta server (`tooling/e2e/telegram-mock.mjs`, edu-crm testlari bilan umumiy; port 3199): testlar kirish kodini shundan o'qiydi.
- Baza — **alohida test bazasi**. `E2E_DATABASE_URL` berilmasa testlar boshlanmaydi; `.env` dagi bazaga tegilmaydi.
- Har ishga tushishda migratsiyalar, `templates:sync` va test foydalanuvchisi (`e2e:seed`) tayyorlanadi, keyin ishchi jarayon (`apps/worker`) ishga tushadi.
- Deploy sinov drayveri (`DEPLOY_DRIVER=sim`) bilan ishlaydi: hech qaysi serverga ulanmaydi.

## Ishga tushirish

CI'da har PR'da o'zi ishlaydi (`.github/workflows/ci.yml`, `e2e` vazifasi).

Mahalliy kompyuterda test bazasi bir marta yaratiladi (PostgreSQL superuser nomidan):

```sql
CREATE ROLE ventura LOGIN PASSWORD 'e2e';  -- bor bo'lsa shart emas
CREATE DATABASE ventura_e2e OWNER ventura ENCODING 'UTF8' TEMPLATE template0;
\c ventura_e2e
\i apps/panel/e2e/roles.sql
```

Keyin:

```bash
pnpm --filter @ventura/panel build
E2E_DATABASE_URL=postgres://ventura_app:e2e@localhost:5432/ventura_e2e \
E2E_MIGRATE_URL=postgres://ventura:e2e@localhost:5432/ventura_e2e \
pnpm e2e
```

- Playwright brauzeri o'rnatilmagan bo'lsa: `pnpm --filter @ventura/panel exec playwright install chromium`, yoki o'rnatilgan Chrome bilan: `E2E_BROWSER_CHANNEL=chrome`.
- Yiqilgan test izlari `apps/panel/test-results/` da (`playwright show-trace <trace.zip>`).
- Audit jadvali o'chmas, shuning uchun test bazasi tozalanmaydi: har ishga tushish yangi loyiha nomi bilan ishlaydi.
