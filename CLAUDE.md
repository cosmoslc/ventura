# CLAUDE.md — Ventura.uz

## Ishni boshlash

- Avval docs/SPEC.md ni o'qi. Faqat joriy bosqich ustida ishla (13-bo'lim).
- Har bosqich = alohida branch va PR. Qabul mezonlari bajarilmaguncha keyingisiga o'tma.
- Muhim qarorlarni docs/decisions/ ichiga qisqa ADR qilib yoz.

## Buyruqlar

- `pnpm dev` — panel (http://localhost:3000) va ishchi jarayon (navbatdagi deploylarni bajaradi)
- `pnpm worker` — faqat ishchi jarayon (production'da panel bilan yonma-yon ishlaydi)
- `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` — CI'dagi tekshiruvlar
- `pnpm e2e` — Playwright (alohida test bazasi kerak: apps/panel/e2e/README.md)
- `pnpm format` — Prettier (`pnpm format:check` — faqat tekshirish)
- `pnpm db:generate` · `pnpm db:migrate` — Drizzle migratsiyasini yaratish va qo'llash (`PANEL_MIGRATE_URL`)
- `pnpm templates:sync` — shablon manifestlarini (`apps/*/features.ts`) bazaga ko'chirish
- `pnpm admin:create` · `pnpm admin:unlock` · `pnpm admin:reset-2fa` — adminlar bilan ishlash, faqat server terminalida
- `pnpm server:add` · `pnpm server:check` — serverni ro'yxatga olish (SSH kalit yaratadi) va tekshirish; serverning o'zida bir marta `sudo bash tooling/server/setup.sh --key "..."`
- `pnpm deploy:run -- --project <slug>` — loyihani terminaldan deploy qilish (paneldagi tugma bilan bir xil yo'l)

## Kod

- TypeScript strict. `any` taqiqlangan.
- Har tashqi kirish (forma, API, webhook) Zod bilan tekshiriladi.
- Sirlar, kalitlar va baza faqat server kodida. Client komponentga hech qachon tushmaydi.
- Baza o'zgarishi faqat Drizzle migratsiyasi orqali (drizzle-kit generate). Bazani qo'lda o'zgartirma.
- Tashqi API'lar (GitHub, Vercel, Cloudflare, Telegram) faqat packages/integrations orqali chaqiriladi.
- Deploy, tekshiruv, zahira faqat pg-boss fon vazifasi sifatida. So'rov ichida uzoq ish qilma.
- Har o'zgartiruvchi amal audit.record() chaqiradi.
- Mijozga xos farq faqat bo'lim (hasFeature) yoki sozlama orqali. `if (tenant.slug === ...)` taqiqlangan.
- UI faqat packages/ui komponentlaridan. Interfeys matnlari o'zbekcha, bitta faylda.

## Test

- Mantiq: Vitest (tashqi API'lar mock qilinadi).
- Asosiy oqimlar (login + 2FA, Yangi loyiha formasi): Playwright.

## Xavfsizlik

- .env ni hech qachon commit qilma. Yangi o'zgaruvchi qo'shilsa, .env.example ni yangila.
- Sirni logga yozma, brauzerga qaytarma.
- Webhook imzosini har doim tekshir.
- SSH orqali faqat packages/deploy ichida oldindan belgilangan buyruqlar bajariladi. Foydalanuvchi kiritgan matn buyruqqa qo'shilmaydi.

## So'rab qil

- Ma'lumot o'chirish, force push, migratsiyada ustun o'chirish, serverda buyruq ishga tushirish — avval Saidakbardan tasdiq so'ra.

## Dizayn

- Uslub manbai: docs/design/STYLE.md. Token yoki komponent o'zgarsa, hujjatni ham yangila.
- Rang, radius, o'lcham, z-index faqat tokenlardan (packages/config/tokens/ventura.css). Komponentda #hex, text-[13px], rounded-[..], z-[..] yozma.
- Brendga bog'liq rang --primary dan hosil qilinadi (color-mix), qat'iy ko'k yozilmaydi.
