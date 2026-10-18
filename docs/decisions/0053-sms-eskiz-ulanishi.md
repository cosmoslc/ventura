# 0053. edu-crm: SMS — Eskiz ulanishi va sirlarni saqlash (S1)

2026-10-18 · qabul qilingan · docs/EDU-CRM-SMS.md

## Vaziyat

SMS rejasining birinchi bosqichi (S1): markaz o'z Eskiz hisobini (A rejim) CRM'ga ulaydi va balansini ko'radi.
Bunda ikki narsani hal qilish kerak edi:

- Eskiz kaliti va tokeni tenant bazasida qanday saqlanadi;
- ma'lumotlar bazasining qaysi qismi hozir yaratiladi.

## Qaror

**Saqlash**

- Har mijozda bitta `sms_provider` qatori (migratsiya `0023`, RLS + FORCE). Unda email, shifrlangan kalit va token,
  token muddati, yuboruvchi nomi, tinch soatlar (standart 21–08) va avto-SMS kaliti (standart o'chiq) turadi.
- Kalit va token AES-256-GCM bilan shifrlanadi (`@ventura/security` `encrypt`). Shifr kaliti tenantning `authSecret`idan
  HKDF bilan olinadi (`lib/server/sms/secret.ts`), chunki panel asosiy kaliti tenant serverida yo'q.
- `authSecret` almashsa saqlangan kalit ochilmaydi: sahifa "qayta ulang" ogohlantirishini ko'rsatadi.
- Brauzerga faqat `connected`, `broken`, email, yuboruvchi nomi va soatlar boradi. Jurnalga email, soatlar va test
  raqami yoziladi, kalit va token hech qachon yozilmaydi.

**Eskiz klienti** (`packages/integrations/src/eskiz.ts`)

- Ulashda avval login qilib ko'riladi; o'tmasa hech narsa saqlanmaydi va Eskiz xabari ko'rsatiladi.
- Token 29 kun saqlanadi. 401 kelsa bir marta yangilanadi (refresh, bo'lmasa qayta login), yangi token bazaga yoziladi.
- So'rovlar `FormData` bilan (Eskiz hujjatidagidek), 15 soniya kutish.

**Sahifalar**

- `/sms` — balans, yuboruvchi nomi va hisob holati kartalari; ulanmagan bo'lsa ulashga yo'l.
- `/sms/settings` — sozlamalar bo'limida ("Aloqa" guruhi): ulash, kalitni almashtirish, uzish, yuboruvchi nomi
  (Eskiz nikneymlari ro'yxatidan), tinch soatlar, test SMS (Eskiz test matni).
- Ikkalasi `settings.sms_gateways` ruxsati bilan.

**Rejadan farqi**

- S1 migratsiyasida faqat `sms_provider` bor. `sms_templates`, `sms_rules`, `sms_messages`, `sms_dispatches` o'z
  bosqichida (S2–S4) qo'shiladi. Avto-qoidalar standarti (o'chiq, ota-onaga) o'sha jadval bilan keladi.
- "Qolgan SMS" kartasi S3 ga qoldi: Eskiz narx javobining shakli hujjatda aniq emas. Narx yuborilgan xabarlarning
  haqiqiy `sms_count` va xarajatidan hisoblanadi.

## Oqibatlar

- Markaz Eskiz'ni ulaydi va balansini CRM ichida ko'radi. SMS hali avtomatik yuborilmaydi (S3, S4).
- Har sahifa ochilganda Eskiz'ga jonli so'rov ketadi. Eskiz javob bermasa sahifa baribir ochiladi va xato ko'rsatiladi.
