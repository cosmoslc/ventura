# 0040. edu-crm: qurilmalar, bloklash va xodim profili

2026-10-15 · qabul qilingan · E6g paketi, ADR 0002 (jurnal) va 0019 (tasdiqlar) bilan bog'liq

## Vaziyat

Xodim yangi qurilmadan kirsa unga Telegram'da ogohlantirish borardi va `known_devices` ga qator yozilardi, lekin
direktor qurilmalarni ko'ra olmasdi, shubhali qurilmani to'xtata olmasdi. Xodimning o'z profili ham yo'q edi: menyuda
faqat "Parolni almashtirish" turardi.

## Qaror

### Qurilmalar sahifasi (`/devices`)

- **Faqat direktor.** Sahifa manzili `lib/access.ts` da yo'q (ro'yxatda yo'q manzil faqat direktorga ochiq), bloklash
  amali ichida ham `staff.director` tekshiriladi. Sabab: bloklash boshqa xodimning kirishini to'xtatadi, shuning
  uchun "Lavozim va ruxsatlar" kabi lavozimga berib bo'lmaydi. Yangi ruxsat katalogga qo'shilmadi (katalog 69 ta).
- **Ro'yxat:** qurilma (brauzer · OT), xodim, IP, birinchi va oxirgi kirish, kirishlar soni, holat (faol / bloklangan,
  kim va qachon blokladi). Filtr: xodim, holat; qidiruv: xodim nomi, qurilma, IP. Eng ko'pi 300 qator (oxirgi
  faolligi bo'yicha), ko'p bo'lsa ogohlantirish. Bloklash va blokdan chiqarish tasdiqlash oynasi bilan.
- **Jadval `known_devices`** (migratsiya `0020_e6_devices.sql`, yangi jadval yo'q, RLS o'zgarmadi): `device_name`
  (kirishda user-agent'dan: "Chrome · Windows"), `login_count` (≥ 0, mavjud qatorlar uchun 1), `blocked_at`,
  `blocked_by` (xodim o'chsa `set null`). `last_seen_at` va `last_ip` avvaldan bor edi. Qurilma cookie'ining o'zi
  saqlanmaydi, faqat sha256 xeshi.
- **Jurnal:** `device.block`, `device.unblock` (nishon — qurilma egasi, metadata — qurilma nomi va yopilgan sessiyalar
  soni), `auth.login_blocked` (bloklangan qurilmadan kirish urinishi), `user.sessions_ended`. Hammasi
  `lib/activity-log.ts` reyestrida.

### Bloklangan qurilmadan kirishni rad etish (xavfsizlik kodi)

Qurilma cookie'si (`edu.device`) bo'yicha uch joyda tekshiriladi:

1. **Parol bosqichida** (`signInAction`): xodim topilgan va qurilma bloklangan bo'lsa, parol so'ralmasdan rad etiladi.
2. **Kod bosqichida** (`verifyCodeAction` → `onStaffLoginSuccess`): funksiya endi `{ blocked }` qaytaradi. Bloklangan
   bo'lsa hech narsa yozilmaydi (kirishlar soni oshmaydi, xato urinishlar nolga tushmaydi, yangi qurilma xabari
   yuborilmaydi), `auth.login_blocked` jurnalga yoziladi, chaqiruvchi shu so'rov ochgan sessiyani yopadi.
3. **Har so'rovda** (`getStaff`): ochiq sessiya bilan ishlab turgan bo'lsa ham, qurilmasi bloklangan bo'lsa sessiya
   bekor qilinadi va xodim `/login` ga tushadi. Qo'shimcha xarajat — indeksli bitta so'rov (so'rov ichida keshlanadi).

Bloklash paytida xodimning **shu brauzer belgisi (user-agent) bilan ochilgan sessiyalari** ham o'chiriladi:
sessiya jadvalida qurilma ustuni yo'q, shuning uchun cookie'ni o'chirib sessiyani saqlab qolishning oldi olinadi.
Oqibati: bir xil brauzer belgili boshqa qurilma sessiyasi ham yopilishi mumkin (u qayta kiradi).

**Cheklov (qabul qilingan):** qurilma shaxsiyati — brauzer cookie'si. Bloklangan odam cookie'ni o'chirib, yangi qurilma
sifatida parol va Telegram kodi bilan kira oladi. Bu to'liq himoya emas, yo'qotilgan/ishonchsiz brauzerni to'xtatish
vositasi; hisobning o'zini to'xtatish uchun "Xodimlar" dagi bloklash va parolni almashtirish bor.

### O'zini qulflab qo'ymaslik

Direktor **o'zi hozir ishlayotgan qurilmani bloklay olmaydi** (`self` rad etish). Joriy qurilma aniqlanmasa (cookie
yo'q) — o'z hisobining hech bir qurilmasi bloklanmaydi. Boshqa direktorning qurilmasini bloklasa bo'ladi: bloklayotgan
direktor har doim kirishda qoladi, shuning uchun oxirgi direktor qulflanmaydi. O'z hisobining *boshqa* qurilmasini
bloklash mumkin, shunda o'z sessiyasi (user-agent mos kelsa ham) saqlanadi.

### Profil (`/account`)

- Har xodimga ochiq, alohida ruxsat kerak emas (bo'lim emas, menyudagi foydalanuvchi ro'yxatidan "Profil"). Ism,
  telefon (faqat ko'rish), lavozimlar, Telegram holati, "Parolni almashtirish" havolasi (mavjud
  `/account/password`, o'zgarmadi).
- **"Mening ruxsatlarim":** katalog toifalari bo'yicha, xodimda borlari; "tasdiq bilan" ruxsat shunday belgilanadi.
  Direktorga ro'yxat o'rniga "barcha ruxsatlar berilgan" yoziladi.
- **O'z qurilmalari** (bloklanmaganlari) va ochiq sessiyalar soni; **"Boshqa seanslarni yopish"** (`endOtherSessions`
  — joriy sessiyadan boshqa hammasini o'chiradi, jurnalga `user.sessions_ended`). Sessiya muddati markaz siyosatida
  (`getStaffSessionPolicy`), bu yerda o'zgarmaydi.
- `crmAction` ga `permission = null` qo'shildi: "faqat to'liq kirgan xodim" (o'z profili ustidagi amallar).

## Olinmaydi

Tezkor PIN va avto-qulf. Qurilmaga qo'lda nom berish. Qurilmani butunlay o'chirish (faqat bloklash — tarix qoladi).
Xodimning o'z qurilmasini o'zi bloklashi.

## Oqibatlar

- Migratsiya `0020` markaz bazalariga qo'llanishi kerak (ilova roli qo'llay olmaydi): shundan keyin `/devices` va
  kirish oqimi yangi ustunlarsiz ishlamaydi.
- Testlar: `packages/auth/src/staff/devices.test.ts` (brauzer nomi, xesh), `lib/devices.test.ts`,
  `lib/server/devices.db.test.ts` (bloklangan qurilma kira olmaydi, ochilgach kiradi, boshqa xodim va boshqa mijozga
  ta'sir yo'q, o'zini bloklash rad etiladi, sessiyalar yopiladi).
