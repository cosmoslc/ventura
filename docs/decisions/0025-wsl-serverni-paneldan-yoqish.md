# 0025. Uydagi WSL serverni paneldan yoqish va o'chirish

2026-10-14 · qabul qilingan · Saidakbar so'rovi

## Vaziyat

Uydagi server — shu Windows kompyuteridagi WSL (Ubuntu). Uni ishga tushirish uchun quyidagilar qo'lda qilinardi:

1. terminalda `wsl` ochiladi;
2. `sudo systemctl start ssh` beriladi;
3. oyna ochiq qoldiriladi. Barcha WSL oynalari yopilsa, Windows WSL'ni to'xtatadi va server "oflayn" bo'ladi.

Panel faqat holatni ko'rsatardi, yoqib-o'chira olmasdi.

## Qaror

### Ma'lumot

`servers.wsl_distro` — uydagi server distributivi nomi, masalan `Ubuntu-24.04` (panel 0009 migratsiyasi). Server
tahrirlash formasida turi "uy" bo'lsa ko'rinadi. Bo'sh qolsa, tugmalar chiqmaydi.

### Buyruqlar

- `power_on` va `power_off` — server buyruqlari qatoriga qo'shildi (`SERVER_ACTIONS`).
- Ruxsat — `servers.manage` (super admin), ilovani to'xtatish yoki ishga tushirish kabi. Bu amallar saytni o'chirib
  qo'yishi mumkin.
- Buyruq navbatga qo'yiladi va **ishchi jarayon** bajaradi.

**Qachon bajariladi** (`wslControlError`). Hamma shart bajarilishi kerak, aks holda buyruq aniq sabab bilan rad etiladi:

- server turi "uy";
- distributiv nomi to'g'ri;
- manzil `127.0.0.1` yoki `localhost`;
- ishchi Windows'da ishlayapti.

**Yoqish:** `wsl.exe -d <distributiv> -u root -- sh -c "<skript>"`.

- Skript SSH, nginx, PostgreSQL va PM2 xizmatini (`pm2-<foydalanuvchi>`) ishga tushiradi, keyin `sleep infinity` bo'lib
  qoladi. Bu jarayon WSL'ni yoniq ushlab turadi — Windows WSL'ni oxirgi jarayon tugagach to'xtatadi.
- Jarayon ishchidan ajratilgan (`detached`), shuning uchun ishchi qayta ishga tushsa ham yashaydi.
- Shundan keyin ishchi SSH porti javob berishini 90 soniyagacha kutadi va metrikani darhol yangilaydi.

**O'chirish:** `wsl.exe --terminate <distributiv>`.

**Xavfsizlik.** Distributiv va foydalanuvchi nomlari qat'iy qolipdan o'tadi; argumentlar shell'siz uzatiladi, ya'ni
foydalanuvchi matni buyruqqa qo'shilmaydi.

**Jurnal:** `server.power_on` va `server.power_off` (natija va xato bilan); oxirgi buyruq sahifada ko'rinadi.

### Ko'rinish

Server sahifasida, uy serverida distributiv ko'rsatilgan va xodimda `servers.manage` ruxsati bo'lsa:

- server onlayn bo'lmasa — **"Yoqish"**;
- onlayn bo'lsa — **"O'chirish"**. Tasdiq oynasida serverdagi loyihalar soni va saytlar ishlamay qolishi aytiladi.

### Sinov

Vitest:

- boshqaruv shartlari: Windows, uy serveri, mahalliy manzil, distributiv nomi;
- buyruqqa aralashadigan belgilar o'tmaydi;
- yoqish skriptining aniq ko'rinishi.

## Oqibatlari

- Bu imkoniyat faqat panel va ishchi shu Windows kompyuterida ishlaganda ishlaydi. VPS'dagi panel uy serverini
  yoqolmaydi — rad etish sababi ko'rsatiladi.
- Server o'chirilgach, monitoring uni "oflayn" deb ko'radi. Ketma-ket 3 so'rovdan keyin Telegram'ga "server o'chdi"
  xabari ketadi (odatdagi ogohlantirish).
