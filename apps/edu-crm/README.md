# edu-crm — o'quv markaz tizimi (1-shablon)

Hozircha boshlang'ich ilova: deploy ishlashini va mijoz domen bo'yicha to'g'ri aniqlanishini ko'rsatadi.
Haqiqiy bo'limlar `docs/EDU-CRM-PLAN.md` bo'yicha (E0 dan) yoziladi.

- `features.ts` — bo'limlar manifesti; panel uni `pnpm templates:sync` orqali bazaga yozadi.
- `lib/tenant.ts` — mijozni `Host` bo'yicha aniqlash. Ro'yxat `VENTURA_TENANTS_FILE` faylida, uni panel deploy paytida yozadi.
- `/health` — deploy tekshiruvi: `{ ok, tenant, commit }`.

Mahalliy ishga tushirish: `pnpm --filter @ventura/edu-crm dev` (http://localhost:3001). Ro'yxat fayli berilmasa, har manzilda "Bunday tizim topilmadi" chiqadi.
