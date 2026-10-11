# 0002. Audit jurnali: xesh zanjiri, ikki baza roli va trigger

2026-10-11 · qabul qilingan · 1-bosqich

## Vaziyat

Audit jurnali o'chirib yoki o'zgartirib bo'lmaydigan bo'lishi kerak (SPEC 10 va 11-bo'limlar). Faqat ilova kodiga ishonish yetarli emas: panel buzilsa ham jurnal saqlanishi kerak.

## Qaror

Uch qatlamli himoya:

1. **Xesh zanjiri.** Har yozuv `hash = sha256(prevHash + "\n" + canonicalJson(payload))`. Yozish advisory lock ostida, `seq` bo'yicha tartibda. `audit.verify()` o'zgartirilgan, o'chirilgan yoki o'rtaga qo'shilgan yozuvni topadi; holat Audit sahifasida ko'rinadi.
2. **Ikki baza roli.** `ventura` — jadvallar egasi, faqat migratsiya uchun (`PANEL_MIGRATE_URL`). `ventura_app` — panel ishlaydigan rol (`PANEL_DATABASE_URL`); unda `audit_events` uchun `UPDATE`, `DELETE`, `TRUNCATE` huquqi yo'q.
3. **Trigger.** `audit_events`da `UPDATE`, `DELETE` va `TRUNCATE` har qanday rol uchun xato beradi, jadval egasi uchun ham.

Yozuvda sir saqlanmaydi: `metadata`ga faqat o'zgargan maydonlar nomi va oshkora qiymatlar tushadi.

## Oqibatlari

- Har o'zgartiruvchi server amali `audit.record()` chaqiradi (CLAUDE.md qoidasi).
- Jurnalni tozalash faqat PostgreSQL superuser qo'lida va triggerni o'chirishni talab qiladi. Bu zanjirni uzadi va `verify` buni ko'rsatadi.
- Mahalliy ishlab chiqishda ham ikkita rol kerak; `.env.example`da ikkala URL bor.
- Zanjirning oxirgi xeshini tashqi joyga (masalan Telegram'ga) muntazam yuborish hali yo'q. Busiz butun jadvalni qayta yozib chiqqan superuser aniqlanmaydi. 6-bosqichda ko'rib chiqiladi.
