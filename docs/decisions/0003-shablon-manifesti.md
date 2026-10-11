# 0003. Shablon manifesti kodda, bazaga CLI orqali ko'chiriladi

2026-10-11 · qabul qilingan · 1-bosqich

## Vaziyat

Panel shablonning bo'limlarini (nomi, turi, bog'liqliklari) bilishi kerak. Shablon kodi alohida ilova (`apps/edu-crm`), panel uni import qilmasligi kerak.

## Qaror

- Manifest shablonning o'zida: `apps/<shablon>/features.ts`. Manba — kod.
- Sxema va bog'liqlik mantiqi `packages/tenants`da (Zod): `parseManifest`, `withRequirements`, `dependentsOf`.
- `pnpm templates:sync` manifestni tekshirib, `templates` jadvaliga yozadi. Panel faqat bazadan o'qiydi.
- Loyihada yoqilgan bo'limlar `project_features`da; yoqishda bog'liqliklar avtomatik qo'shiladi, o'chirishda bog'liq bo'limlar ko'rsatiladi.

## Oqibatlari

- Manifest o'zgarsa, `templates:sync` qayta ishga tushiriladi. 2-bosqichda bu deploy vazifasining bir qadami bo'ladi.
- `edu-crm` hozircha faqat skelet: manifest bor, ilova kodi yo'q.
