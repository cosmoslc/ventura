# edu-crm — o'quv markaz tizimi (1-shablon)

Eski Cosmos CRM'ning admin qismi shu yerda qayta yoziladi: `docs/EDU-CRM-PLAN.md`. Hozir E0 — skelet:
mijozni domen bo'yicha aniqlash, mijoz bazasi (RLS bilan), xodimlar kirishi (telefon + parol + Telegram kodi),
rollar va filial bo'yicha cheklov, bo'limlarga qarab menyu. Qarorlar: `docs/decisions/0006-edu-crm-skelet.md`.

## Tuzilishi

| Joy                     | Nima                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `features.ts`           | Bo'limlar manifesti (menyu manzillari bilan); panel uni `pnpm templates:sync` orqali o'qiydi             |
| `proxy.ts`              | O'chirilgan bo'lim manzili va API'si — 404; sessiyasiz — `/login`                                        |
| `lib/server/tenant.ts`  | Mijoz `Host` bo'yicha (`VENTURA_TENANTS_FILE`) va uning maxfiy sozlamasi (`VENTURA_TENANT_SECRETS_FILE`) |
| `lib/server/deps.ts`    | `getTenantDb()`, mijoz boti va Better Auth — mijoz bo'yicha keshlangan                                   |
| `lib/server/session.ts` | `requireStaff(permission)`, `requireFeature(key)` — har sahifa va server amali boshida                   |
| `app/(auth)`            | Kirish, kod, Telegram'ni ulash, parolni almashtirish                                                     |
| `app/(crm)`             | Qobiq (sidebar, topbar), bosh sahifa, hali yozilmagan bo'limlar uchun vaqtinchalik sahifa                |
| `lib/uz.ts`             | Interfeys matnlari                                                                                       |
| `/health`               | Deploy tekshiruvi: `{ ok, tenant, commit, configured }`                                                  |

Mijoz bazasi sxemasi — `packages/db/src/schema/tenant`, xodimlar kirishi va rollar — `packages/auth/src/staff`.

## Serverda (panel orqali)

Panelda Yangi loyiha → ega (ism, telefon, vaqtinchalik parol) va Telegram bot tokeni → "Deploy". Deploy markaz bazasini,
maxfiy faylni va birinchi direktorni o'zi yaratadi (`scripts/provision.ts`, ADR 0007). Direktor formadagi telefon va
vaqtinchalik parol bilan kiradi, parolni almashtiradi va markaz botini ulaydi. Serverda `setup.sh` ning yangi versiyasi
ishga tushirilgan bo'lishi kerak (`ventura-db` yordamchisi).

## Mahalliy ishga tushirish (faqat ishlab chiqish uchun)

PostgreSQL va `.env` (namunasi `.env.example`da: `VENTURA_TENANTS_FILE`, `VENTURA_TENANT_SECRETS_FILE`) kerak.

```bash
# 1. Mijoz: ro'yxat va maxfiy fayl, migratsiya, birinchi filial
pnpm edu:tenant -- --slug bilim --name "Bilim markazi" --host bilim.localhost --color "#16a34a" \
  --database-url postgres://edu_app:PAROL@localhost:5432/edu_shared \
  --migrate-url postgres://ventura:PAROL@localhost:5432/edu_shared \
  --bot-token 123456:ABC...

# 2. Birinchi direktor (vaqtinchalik parol ekranga chiqadi)
pnpm edu:staff -- --tenant bilim --phone "90 123 45 67" --name "Ali Valiyev"

# 3. Ilova: http://bilim.localhost:3001
pnpm --filter @ventura/edu-crm dev
```

- Umumiy baza (`shared_db`): bir nechta mijozga bir xil `--database-url`. Alohida baza (`db_per_tenant`): har biriga o'z bazasi; `--migrate-url` kerak emas, agar ilova foydalanuvchisi bazaning egasi bo'lsa.
- Bo'limlarni cheklash: `--features students,groups,payments` (kerakli bog'liqlar o'zi qo'shiladi).
- Xodim rollari: `--role director|manager|cashier|viewer`, filial: `--branch "Asosiy filial"`.
- Bot tokenisiz loyihada xodimlar kira olmaydi (kod yuborilmaydi) — kirish sahifasi shuni aytadi.
