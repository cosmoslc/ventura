# 0055. edu-crm: SMS navbati, fon vazifasi va qo'lda yuborish (S3)

2026-10-18 · qabul qilingan · ADR 0053, 0054, docs/EDU-CRM-SMS.md

## Vaziyat

SMS'lar haqiqatda ketishi kerak: qo'lda (o'quvchilar, qarzdorlar, guruh) va keyin avtomatik (S5). Eskiz so'rovi
sekin yoki xato bo'lishi mumkin, shuning uchun foydalanuvchi amali uni kutmasligi kerak. Rejada alohida PM2
jarayoni (`edu-worker`) bor edi, lekin loyihada fon jarayoni umuman yo'q: u deploy paketiga yangi jarayon, TypeScript'ni
production'da ishga tushirish va alohida monitoringni talab qiladi.

Shu bilan birga egasi qaror qildi: **standart rejim — Ventura paketi** (Eskiz faqat yuridik shaxslarga xizmat
qiladi). Markazlar paketni CRM ichida sotib oladi; o'z Eskiz hisobini ulash — qo'shimcha imkoniyat.

## Qaror

**Navbat** — `sms_messages` (migratsiya `0025`, RLS + FORCE) ham navbat, ham tarix; `sms_dispatches` — qo'lda
ommaviy yuborishlar.

- `enqueue` raqamni `998XXXXXXXXX` ga keltiradi, noto'g'risini tashlaydi, `dedupe_key` takrorni to'xtatadi
  (`ON CONFLICT DO NOTHING`). Tashqi so'rov qilmaydi — biznes amal ichida chaqirsa bo'ladi.
- `flush` xabarlarni `FOR UPDATE SKIP LOCKED` bilan oladi (ko'pi bilan 60 ta), `sending` qiladi, yuboradi.
  - Natija: `sent` + provayder id.
  - Xato bo'lsa 1 / 5 / 15 daqiqadan keyin qayta urinadi, 3-xatodan keyin `failed`.
  - Jarayon yuborish o'rtasida to'xtasa, 10 daqiqadan keyin xabar navbatga qaytadi.
- Vaqt sharti bazaning `now()` i bilan: JS soati millisoniya, baza mikrosoniya. Aks holda hozirgina yozilgan xabar
  "kelajakda" ko'rinib, keyingi aylanishgacha qolib ketadi (testda topildi).

**Yetkazish** — Eskiz `callback_url` ga `POST /api/sms/eskiz/<token>` yuboradi.

- Token tenant `authSecret`idan HMAC; sessiyasiz (`proxy.ts` PUBLIC).
- Callback kelmasa (yoki mahalliy domen bo'lsa), fon vazifasi 5 daqiqadan oshgan, 3 kundan oshmagan `sent` xabarlar
  holatini `status_by_id` bilan so'raydi (`DELIVERED`, `REJECTED`...). Narx (`total_price`) va qismlar soni yoziladi.
- Yakuniy holat (`delivered`, `failed`) qayta yozilmaydi.

**Fon vazifasi — ilova jarayoni ichida** (`instrumentation.ts` → `lib/server/sms/scheduler.ts`).

- Har 60 soniyada `sms` bo'limi yoqilgan har markaz uchun `flush` + `poll`. Server amali yuborgandan keyin shu markaz
  uchun darhol `after()` bilan.
- Har ilova nusxasi o'z ro'yxatidagi markazlarga xizmat qiladi (shared va dedicated bir xil). Deploy o'zgarmaydi.
- `SMS_SCHEDULER=off` — o'chirish. Dev'da modul qayta yuklansa ham taymer eng so'nggi kodni chaqiradi.

**Yuboruvchi interfeysi** — `SmsSender` (`send`, `status`, `from`). Navbat provayderni bilmaydi.

- Hozir: markazning o'z Eskiz hisobi.
- Ventura paketi (S4) panel relay orqali shu interfeysni amalga oshiradi.

**Qo'lda yuborish** — umumiy `SendSmsModal`:

| Joy | Kimga | Ruxsat |
| --- | --- | --- |
| O'quvchilar ro'yxati (tanlanganlar) | tanlanganlar | `students.sms_send` |
| Qarzdorlar (qatordan yoki filtrdagi hammasi) | qarzdorlar, standart — qarz shabloni | `finance.debtors_remind` |
| Guruh profili (⋯ menyu) | guruhdagi faol a'zolar | `students.sms_send` |

- Shablon tanlanadi. Tasdiqlanmagan bo'lsa ogohlantirish chiqadi (Eskiz rad etishi mumkin). Rad etilgan shablon
  ro'yxatda yo'q.
- Kimga: ota-ona (raqami bo'lmasa — o'quvchi), o'quvchi yoki ikkalasi (bir xil raqamga ikki marta emas).
- Matn har o'quvchi uchun serverda to'ldiriladi: ism, familiya, guruh, kurs, qarz (faqat shablonda bo'lsa
  hisoblanadi), markaz telefoni, sana.
- Har yuborish — bitta `sms_dispatches` yozuvi va jurnalda `sms.send`.

## Oqibatlar

- SMS endi haqiqatda ketadi. Eskiz hisobi test holatida bo'lsa, faqat Eskiz test matnlari o'tadi.
- Ilova jarayoni bitta bo'lsa, u to'xtaganda navbat ham to'xtaydi — qayta ishga tushganda davom etadi (xabarlar
  bazada).
- Callback faqat haqiqiy domenda ishlaydi; mahalliy muhitda holat so'rov bilan olinadi.
