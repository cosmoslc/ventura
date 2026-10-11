# 0001. Panelga kirish: telefon + parol, Telegram orqali 2FA

2026-10-11 · qabul qilingan (Saidakbar) · 1-bosqich

## Vaziyat

SPEC 11-bo'limida "2FA (TOTP) majburiy" deb yozilgan edi. Amalda panelga bir necha kishi kiradi, hammasi Telegram'dan foydalanadi, ogohlantirishlar ham shu bot orqali boradi. Authenticator ilovasi va zaxira kodlar ortiqcha qadam bo'lardi.

## Qaror

- **Kirish:** telefon raqam (faqat `+998`) va parol (kamida 8 belgi). Better Auth `phoneNumber` plagini; ro'yxatdan o'tish yopiq.
- **2FA:** har kirishda Telegram bot 6 xonali raqamli kod yuboradi. Kod 5 daqiqa yashaydi, 5 ta urinish, bazada xeshlangan holda saqlanadi. TOTP va zaxira kodlar yo'q.
- **2FA'siz kirib bo'lmaydi:** parol o'zgartirilmagan, Telegram ulanmagan yoki 2FA yoqilmagan foydalanuvchi panel sahifalariga o'tkazilmaydi (`accessState`, `requireViewer`).
- **Bloklash:** 5 ta xato urinishdan keyin hisob bloklanadi va o'zi ochilmaydi. Super admin panelda yoki serverda `pnpm admin:unlock` bilan ochadi.
- **Telegram yo'qolsa:** faqat serverda `pnpm admin:reset-2fa`. Panel ichida aylanib o'tish yo'li yo'q.
- **Birinchi super admin** serverda `pnpm admin:create` bilan yaratiladi. Qolganlarini super admin vaqtinchalik parol bilan qo'shadi: birinchi kirishda parol almashtiriladi, keyin Telegram ulanadi.
- **Sessiya muddati** bitta umumiy sozlama (`browser`, `1m`, `1h`, `3h`, `1d`, `7d`), super admin o'zgartiradi. Muddat oxirgi harakatdan emas, **kirgan paytdan** hisoblanadi. `browser` rejimida cookie brauzer yopilganda o'chadi, server tomonda esa 1 kundan oshmaydi.
- **Ogohlantirishlar:** kirish, xato urinishlar va bloklash, yangi qurilma, xavfli amallar Telegram'ga yuboriladi.

## Oqibatlari

- Telegram ishlamasa, panelga kirib bo'lmaydi. Bu ataylab qabul qilingan: zaxira yo'l faqat server terminali.
- Bot tokeni o'g'irlansa, hujumchi kodni o'qiy olmaydi (kod foydalanuvchining chatiga boradi), lekin soxta xabar yubora oladi. Token `.env`da, keyin `secrets` jadvaliga ko'chiriladi.
- SPEC 11-bo'limidagi "vaqtinchalik bloklanadi" va "TOTP" shu qarorga moslab yangilandi.
- Xavfli amallar uchun "parol + 2FA qayta so'raladi" talabi hali bajarilmagan; hozircha nomini yozib tasdiqlash bor. 7-bosqichda (Xavfli hudud) qo'shiladi.
