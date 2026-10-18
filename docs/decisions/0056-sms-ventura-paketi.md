# 0056. SMS: Ventura paketi — panel relay, SMS hisobi va paket sotish (S4)

2026-10-18 · qabul qilingan · ADR 0053–0055, docs/EDU-CRM-SMS.md

## Vaziyat

Eskiz faqat yuridik shaxslarga xizmat qiladi, ko'p o'quv markazlari esa YaTT yoki umuman ro'yxatdan o'tmagan.
Egasining qarori: **standart rejim — Ventura paketi**. Ventura o'z yuridik shaxsi nomidagi bitta Eskiz hisobidan
markazlar uchun SMS yuboradi, markazlar paketni CRM ichida sotib oladi. O'z Eskiz hisobini ulash qo'shimcha imkoniyat
bo'lib qoladi.

Cheklov: Ventura'ning Eskiz kaliti markaz serveriga, ayniqsa alohida (dedicated) serverga tushmasligi kerak. Panel
`https://admin.ventura.uz` da ochiq turadi.

## Qaror

**Relay** — markaz ilovasi panelga `POST /api/sms/relay/<amal>` yuboradi: `send`, `status`, `wallet`, `purchase`,
`template_submit`, `template_status`.

- So'rov HMAC-SHA256 bilan imzolanadi: `"<ts>.<body>"`, vaqt farqi 5 daqiqagacha. Kalit har loyihaga alohida: panel
  sirlarida `sms_relay_key`.
- Deploy panel manzilini (`VENTURA_PANEL_URL`, bo'lmasa `BETTER_AUTH_URL`) va kalitni markazning maxfiy sozlamasiga
  yozadi: `tenant-secrets.json` → `smsRelay: { url, key }`.
- Protokol bitta joyda: `packages/integrations/src/relay.ts`. Qismlar hisobi ham umumiy:
  `packages/integrations/src/sms-parts.ts`. Ikkala tomon bir xil sanaydi.
- Panel route sessiyasiz (`proxy.ts` PUBLIC), imzo route ichida tekshiriladi.

**SMS hisobi** (panel bazasi, migratsiya `0010`)

| Jadval | Vazifasi |
| --- | --- |
| `sms_wallets` | loyiha qoldig'i (qismlar, manfiy emas) |
| `sms_wallet_entries` | o'chirilmaydigan harakatlar jurnali (ilova rolidan UPDATE/DELETE olingan) |
| `sms_packages` | paketlar (nom, qismlar, narx, sotuvda) |
| `sms_purchase_requests` | markaz so'rovi; paket qiymatlari so'rov paytidagidek saqlanadi |
| `sms_relay_messages` | relay orqali ketgan xabar: band qilingan qism va yakuniy holat |

- Yuborishdan oldin qismlar tranzaksiyada band qilinadi (`balance >= parts` sharti). Qism yetmasa — `insufficient`
  (markazda `failed`, qayta urinishsiz).
- Eskiz qabul qilmasa — darhol qaytariladi. Yetkazilmasa — holat so'rovida bir marta qaytariladi (`FOR UPDATE` va
  holat sharti).
- Eskiz boshqa qism sonini aytsa, farqi tuzatiladi. Har o'zgarish — jurnal yozuvi.

**Sotib olish** — markaz CRM'da (`/sms`) paketni tanlaydi va `sms_purchase_requests` ga `pending` so'rov tushadi.
Panel admini to'lov kelganini tasdiqlaydi ("To'landi"), qismlar hisobga tushadi. Click/Payme keyingi bosqichda — shu
so'rov jadvali ustiga quriladi. Admin hisobni sabab bilan qo'lda tuzata oladi.

**Markaz tomoni**

- `sms_provider.mode` standarti `ventura` (migratsiya `0026`).
- Sozlamalarda rejim tanlanadi. Ventura rejimida Eskiz ulash bo'limi va yuboruvchi nomi ko'rinmaydi.
- Rejim almashsa shablonlar `draft` ga qaytadi: tasdiq boshqa hisobda edi.
- Shablon moderatsiyasi Ventura rejimida Ventura hisobida (relay orqali). `template_status` faqat markaz so'ragan
  matnlarni qaytaradi — boshqa markazlar shablonlari ko'rinmaydi.
- Navbat va fon vazifasi o'zgarmadi: `SmsSender` interfeysining relay amalga oshirilishi qo'shildi.

**Panel** — "SMS paketi" sahifasi (Nazorat bo'limi):

- kutilayotgan to'lovlar ("To'landi" / "Bekor qilish");
- markazlar qoldig'i va qo'lda tuzatish;
- paketlar;
- Ventura Eskiz hisobi (email, maxfiy kalit, yuboruvchi nomi).

Yozish — "Sozlamalar" ruxsati bilan, hammasi audit jurnaliga.

## Oqibatlar

- Yuridik shaxsi yo'q markaz ham SMS yubora oladi.
- Ventura'ning Eskiz kaliti faqat panelda.
- Markaz SMS yuborishi panel ishlashiga bog'liq: panel o'chsa, navbatdagi xabarlar qayta urinish bilan kutadi.
- Narx qismlarda: Eskiz so'mdagi narxi Ventura hisobida qoladi, markaz paket narxini to'laydi.
- Eskiz callback'i Ventura rejimida yo'q: holat markaz fon vazifasi so'raganda olinadi va o'sha paytda hisob-kitob
  qilinadi.
