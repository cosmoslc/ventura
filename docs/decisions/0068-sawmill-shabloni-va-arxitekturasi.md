# 0068. Sawmill (Pilorama) shabloni va uning skelet arxitekturasi

2026-10-24 · qabul qilingan · S0 bosqichi

## Vaziyat

Ventura platformasida 2-rasmiy shablon sifatida yog'och tilish sexi tizimi — Sawmill (`apps/sawmill`) talab etildi. SPEC 8-bosqich qoidasiga ko'ra, panel kodiga tegmasdan yangi shablon monorepoga qo'shilishi, o'zining mustaqil sxemasiga ega bo'lishi, ko'p tilli (o'zbekcha va ruscha) interfeysni qo'llab-quvvatlashi va ko'p ijarachili (multi-tenant) RLS xavfsizlik standartlariga to'liq rioya qilishi lozim.

## Qaror

1. **Ilova**: `apps/sawmill` monorepoga yangi Next.js App Router ilovasi sifatida qo'shildi (`@ventura/sawmill`, port 3003).
2. **Shablon manifesti**: `apps/sawmill/features.ts` orqali 11 ta bo'lim (`teraks`, `workers`, `work`, `stock`, `dispatch`, `trucks`, `general_expenses`, `orders`, `material_sizes`, `cube`, `reports`) e'lon qilindi. Panel kodiga tegmasdan `pnpm templates:sync` orqali bazaga sinxronlandi.
3. **Sxema va migratsiyalar**: Sawmill sxemasi va migratsiyalari edu-crm'dan mustaqil ravishda `packages/db/src/schema/sawmill/` va `packages/db/migrations/sawmill/` papkalarida ajratildi. Har bir jadvalda `tenant_id`, `tenantPolicy()` va `FORCE ROW LEVEL SECURITY` majburiy qilindi.
4. **Deploy va provisioning**: `apps/sawmill/scripts/provision.ts` orqali server deploy paytida migratsiyalar avtomatik qo'llanadi, standart sex ("Asosiy sex"), boshlang'ich ish turlari ("Sartirofka", "Terak kesish"), materiallar ("Vassa", "Kvadrat", "Dona", "Bay") va birinchi ega (`owner`) foydalanuvchisi yaratiladi.
5. **Rollar modeli**: 3 ta qat'iy rol belgilandi: `owner` (to'liq boshqaruv), `accountant` (kiritish va tahrirlash), `viewer` (faqat ko'rish). Ruxsatlar `can(role, permission)` orqali tekshiriladi.
6. **Ko'p tillilik (i18n)**: Birinchi kundan boshlab o'zbekcha va ruscha lug'atlar (`lib/i18n/uz.ts` va `ru.ts`) kiritildi. Kalitlar to'liqligi TypeScript tipi orqali tekshiriladi. Foydalanuvchi profilida va interfeysda til almashtirgich mavjud.
7. **Qobiq (Shell)**: Kompyuterda chap sidebar, mobilda esa eski ZumradNavBar o'rniga pastki navbar va markaziy tezkor amallar ("+") tugmasi joriy etildi.

## Oqibatlari

- Panel kodi o'zgartirilmasdan yangi shablon monorepoga ulandi.
- Edu-CRM bazasi va fayllariga tegilmadi; Sawmill bazasi to'liq mustaqil sxemada ishlaydi.
- CI tekshiruvlari (lint, typecheck, test, build) Sawmill ilovasi bilan birga muvaffaqiyatli o'tadi.
