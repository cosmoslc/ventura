# 0009. Serverlar sahifasi: monitoring va boshqaruv paneldan

2026-10-12 · qabul qilingan · SPEC 3-bosqich (Serverlar sahifasi)

## Vaziyat

Serverlar terminaldan qo'shilardi (`pnpm server:add`, `server:check`). Panelda ularning holati ko'rinmasdi: qaysi biri ishlayapti, yuklamasi qancha, qaysi loyiha qayerda. Talab (Saidakbar): panelda Serverlar bo'limi bo'lsin. Unda yoniq/o'chiqligi, ulanish, boshqaruv, loyihalar soni, CPU, RAM va disk ko'rinsin.

## Qaror

### Ma'lumot olish

- **Har daqiqa, ishchi jarayonda** (`apps/worker`, `monitorServers`). Hamma serverga parallel ulanadi va bitta qat'iy buyruq bajaradi (`METRICS_SCRIPT`). Buyruq quyidagilarni qaytaradi:
  - CPU — 1 soniya oralig'idagi `/proc/stat` farqi;
  - yuklama, xotira (`MemAvailable`), ildiz disk, ishlash vaqti;
  - PM2 jarayonlari.

  So'rov ichida SSH yo'q (CLAUDE.md: tekshiruv faqat fon vazifasi).
- **PM2 ro'yxati serverning o'zida qisqartiriladi.** `pm2 jlist` har jarayonning muhit o'zgaruvchilarini (baza paroli va boshqa sirlar) ham beradi. Shuning uchun natija serverda `node -e` bilan nom, holat, CPU, xotira, qayta ishga tushishlar soni va boshlangan vaqtga qisqartiriladi; sirlar panelga umuman kelmaydi.
- **Holat:**
  - "onlayn" — oxirgi so'rov muvaffaqiyatli va 3 daqiqadan yangi;
  - "oflayn" — oxirgi so'rov yiqilgan yoki javob eskirgan;
  - "tekshirilmagan" — hali urinilmagan.

  Bu tarmoqqa ulanish holati. O'rnatish holati (`status`: new/ready/error, `server:check`) undan alohida saqlanadi.
- **Joriy holat `servers` qatorida** (`metrics`, `metrics_at`, `probe_at`, `probe_error`).
- **Tarix `server_metrics` jadvalida:** har daqiqa bitta qator, 7 kun saqlanadi. Sahifadagi 24 soatlik grafik shu jadvaldan chiziladi.

### Ogohlantirishlar (SPEC 10)

Super adminlarga Telegram'ga quyidagi hollarda xabar ketadi:
- server ketma-ket 3 marta javob bermasa;
- server qayta javob bera boshlasa;
- disk 85% dan, xotira 90% dan oshsa.

Xabar faqat holat o'zgarganda yuboriladi (`alerts` ustuni), bir xil muammo har daqiqa takrorlanmaydi.

### Boshqaruv

- **Panel faqat buyruqni navbatga qo'yadi** (`server` navbati), ishchi jarayon bajaradi. Natija `last_action` da saqlanadi va sahifada ko'rinadi (navbatda → bajarilmoqda → bajarildi/xato). Har buyruq audit jurnaliga yoziladi.
- **Buyruqlar:**
  - "Tekshirish" — dasturlar va metrika;
  - ilovani "Qayta yuklash" (`pm2 reload`);
  - "To'xtatish" va "Ishga tushirish".
- **Ilova nomi `apps` jadvalidan olinadi:** faqat shu serverga panel deploy qilgan ilovalarni boshqarish mumkin. Foydalanuvchi matni buyruqqa qo'shilmaydi.
- **Ruxsatlar:**
  - ko'rish — hamma;
  - tekshirish va qayta yuklash — `projects.deploy` (admin);
  - qo'shish, o'chirish, to'xtatish va ishga tushirish — yangi `servers.manage` (faqat super admin). To'xtatish shu serverdagi hamma mijoz saytini o'chiradi, shuning uchun alohida tasdiq so'raladi.

### Qo'shish va o'rnatish

- **Paneldan qo'shish:** nom, turi (uydagi / online VPS), IP, port, foydalanuvchi. Panel alohida SSH kalit yaratadi; yopiq kalit shifrlangan holda faqat panelda turadi.
- **O'rnatish — bitta nusxalanadigan buyruq.** U `setup.sh` mazmunini va panel kalitini o'z ichiga oladi; foydalanuvchi uni serverda bir marta root sifatida qo'yadi. Panel serverga root paroli bilan kirmaydi: kalit qo'yilmaguncha uning serverga kirish yo'li yo'q va bo'lmasligi kerak.
- **O'chirish:** faqat loyiha va ilova bo'lmasa, nomini yozib tasdiqlash bilan. SSH kalit (sir) ham o'chadi; serverning o'zidagi fayllarga tegilmaydi.

### Deploy serverni tanlashi

Loyiha manzili (`target`) bo'yicha: "uydagi server" → `home`, "online VPS" → `online` turidagi birinchi tayyor server. Avval birinchi tayyor server olinardi; ikkala turdagi server qo'shilganda loyiha noto'g'ri joyga ketishi mumkin edi. Avval deploy qilingan loyiha (`server_id` bor) o'z serverida qoladi.

## Oqibatlari

- Ishchi jarayon har daqiqa har serverga bitta SSH ulanish ochadi (taxminan 1–2 soniya). Ko'p server bo'lsa, oraliq yoki parallellik soni sozlanadi.
- `server:add` / `server:check` buyruqlari qoladi (zaxira yo'l), lekin asosiy yo'l — panel.
- Ochiq qolganlar (3-bosqich): domen va SSL (certbot), `dedicated` rejim, loyihani bir serverdan boshqasiga ko'chirish.
