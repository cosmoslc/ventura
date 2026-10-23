# 0067. Ventura CRM Landing sahifasi (crm.ventura.uz) va 7 kunlik Bepul Sinov (Self-Service)

2026-10-22 · qabul qilingan · ADR 0048, 0049, 0050, 0058, 0066  
**Muallif / Agent:** Google Gemini

## Vaziyat

Ventura EDU CRM mahsulotini o'quv markazlariga taqdim etish, funksiyalarni ko'rsatish va mijozlarga o'z o'quv markazlarini 7 kunlik to'liq bepul sinov davri bilan mustaqil ravishda (self-service) ochish imkoniyatini berish zarur edi.

### Asosiy talablar va cheklovlar:
1. **Domen marshrutlash:** Yangi landing sahifasi **`crm.ventura.uz`** (va `crm.localhost`) subdomenida ishlashi shart.
2. **Qat'iy cheklov:** Asosiy **`ventura.uz`** domeni hech qachon `crm.ventura.uz` ga yo'naltirilmasligi kerak (`ventura.uz` kelgusida umuman boshqa loyiha uchun ajratilgan).
3. **7 kunlik bepul sinov:** Mijoz markaz nomi, subdomen (`<slug>.ventura.uz`), rahbar ismi, telefon raqami va parolini kiritganda, tizim avtomatik ravishda mijoz va loyihani yaratib, 7 kunlik sinov sozlamalari, 10 GB xotira limiti, barcha funksiyalari yoqilgan holda proviziyani amalga oshirishi va markazga yo'naltirishi kerak.
4. **Qidiruv tizimlari (SEO):** Google Search uchun boy metadata, OpenGraph, canonical va Schema.org `SoftwareApplication` JSON-LD tuzilmaviy ma'lumotlari kiritilishi lozim.

---

## Qaror

### 1. Arxitektura va Marshrutlash (Nginx & Cloudflare)
- Cloudflare Tunnel `*.ventura.uz` orqali Nginx port 80 ga keladigan trafigi ichidan `crm.ventura.uz` va `crm.localhost` virtual xosti ajratildi (`/etc/nginx/conf.d/ventura-crm.conf`).
- `ventura-site set crm 3000 crm.ventura.uz,crm.localhost` buyrug'i orqali Nginx 80-portdan so'rovlarni boshqaruv paneliga (`apps/panel`, port 3000) uzatadi.
- Asosiy domen `ventura.uz` esa o'zining mustaqil 404/alohida blokida qoldirildi va unga hech qanday yo'naltirish qo'yilmadi.

### 2. Next.js Proxy Middleware optimizatsiyasi (`apps/panel/proxy.ts`)
- `proxy.ts` middleware'da `host.startsWith("crm.")` tekshiruvi kiritildi:
  - Agar so'rov `crm.ventura.uz` yoki `crm.localhost` orqali kelsa va yo'l `/` bo'lsa, ichki Next.js rewrite orqali `/crm` landing sahifasiga uzatiladi (brauzer URL'i esa `https://crm.ventura.uz/` holatida qoladi).
  - Landing sahifasi va sinov formasi ommaviy (`PUBLIC`) hisoblanib, admin login cookie'si talab qilinmaydi.
  - Boshqaruv paneli (`admin.ventura.uz`) esa to'liq xavfsiz himoyada qoladi.

### 3. CRM Landing Sahifasi (`apps/panel/app/crm/`)
- **Header:** Ventura EDU CRM logotipi, v2.0 nishoni, navigatsiya havolalari va "7 kunlik bepul sinov" tezkor tugmasi.
- **Hero:** "O'quv markazingizni 100% avtomatlashtiring" sarlavhasi, jonli subdomen tekshirgich va tanlagich (`https://[ ... ].ventura.uz`).
- **Interaktiv ko'rgazma (Showcase tabs):**
  - O'quvchi kabineti (`/student`);
  - O'qituvchi kabineti va uy vazifalarini tekshirish (`/teacher`);
  - Moliya va Kassa nazorati;
  - Shaxsiy Telegram bot ekotizimi;
  - 10 GB xotira va fayllar ombori (`/storage`).
- **Taqqoslov jadvali:** An'anaviy umumiy bazali CRMlar va Ventura EDU CRM ning mustaqil bazali, barcha kabinetlari ichida bo'lgan farqlari.
- **Tariflar:** Start, Pro (Eng ommabop), Enterprise — barchasida 7 kunlik to'liq bepul sinov ko'zda tutilgan.
- **FAQ:** 6 ta eng dolzarb savol-javoblar (karta talab etilmasligi, ma'lumotlar xavfsizligi, Telegram bot, sinov muddati).
- **SEO & JSON-LD:** `SoftwareApplication` Schema.org mikroformati bilan qidiruv tizimlariga indeksatsiya uchun to'liq tayyorlangan.

### 4. 7 Kunlik Bepul Sinov Ro'yxatdan O'tish Mexanizmi (`actions.ts`)
1. **Jonli subdomen tekshiruvi (`checkCrmSlugAvailability`):**
   - 3-40 belgi oralig'idagi kichik lotin harflari, raqamlar va chiziqcha;
   - Tizim zaxiralagan nomlar ro'yxati (reserved: `admin`, `crm`, `panel`, `api`, `auth`, `storage` va h.k.);
   - Mavjud loyihalar va domenlar bazasi bilan ziddiyatni tekshirish.
2. **Loyihani avtomatik proviziya qilish (`startFreeTrialAction`):**
   - Kiritilgan telefon raqamini `+998...` formatiga standartlashtirish;
   - `clients` jadvaliga mijozni qo'shish;
   - `projects` jadvaliga `mode: "shared"`, `dbStrategy: "shared_db"`, `status: "draft"` va 7 kunlik sinov muddati (`trial.startedAt`, `trial.expiresAt`, `storageLimitMb: 10240`) bilan kiritish;
   - `domains` jadvaliga `${slug}.ventura.uz` va `${slug}.localhost` domenlarini ulash;
   - Shablonning barcha tayyor imkoniyatlarini (`projectFeatures`) yoqish;
   - `putSecret` orqali direktorning xavfsiz shifrlangan vaqtinchalik parolini saqlash;
   - `requestDeployment` orqali yangi markazni deploy va proviziya navbatiga qo'yish;
   - Audit jurnaliga yozish va SuperAdminlarga Telegram orqali yangi markaz haqida xabarnoma jo'natish.

### 5. Aloqa va Manzil bo'limi hamda Panel orqali Dinamik Boshqaruv
- **Dinamik Aloqa Sozlamalari (`apps/panel/lib/server/crm-contacts.ts`):**
  - Asosiy telefon, qo'shimcha telefon, Telegram qo'llab-quvvatlash (`@ventura_support`), Telegram kanal (`@ventura_uz`), email, ofis manzili, ish tartibi va xarita havolasi (Google/Yandex Maps) `settings` jadvalida JSON formatida saqlanadi (`key: "crm_contacts"`).
  - Ventura Panel boshqaruvida yangi **"Sozlamalar → Aloqa va Manzil"** (`/settings/contacts`) bo'limi yaratildi. Admin xohlagan paytda raqamlar yoki manzilni o'zgartirishi mumkin va o'zgarishlar darhol `crm.ventura.uz` sahifasida revalidatsiya qilinadi.
- **Landingdagi "Aloqa va Manzil" bo'limi:**
  - Landing sahifasining pastki qismida (`#contacts`) chiroyli kartochkalar shaklida telefonlar, Telegram havolalari, ofis joylashuvi va ish vaqtlari ko'rsatiladi.

### 6. Light / Dark Mode va Premium Animatsiyalar
- **Mavzu almashtirgich (Theme Toggle):**
  - Tizim foydalanuvchining afzal ko'rgan mavzusini (`next-themes`) qo'llab-quvvatlaydi. Navbar va Footer qismida Quyosh/Oy tugmasi orqali Dark va Light mode o'rtasida silliq almashish imkoniyati yaratildi.
  - Tailwind `dark:` variantlari va Ventura dizayn tokenlari bilan uyg'unlashtirildi.
- **Silliq va Premium Animatsiyalar:**
  - Orqa fonda erkin harakatlanuvchi gradient nurlar (`float-slow`, `float-reverse`, `pulse-glow`), silliq kartochka elevatsiyasi, interaktiv tab o'tishlari va jonli subdomen tekshirgich effektlari qo'shildi.
- **Tipografiya:**
  - Loyihaning asosiy tizim shriftlari bo'lgan `Quicksand` (barcha matnlar va sarlavhalar uchun) hamda `JetBrains Mono` (subdomen va kod elementlari uchun) to'liq saqlanib qolindi.

---

## Oqibatlar

- Yangi o'quv markazlari hech kimning aralashuvisiz, 30 soniyada o'z subdomenlarini band qilib 7 kunlik sinovni boshlay oladi.
- Adminlar `admin.ventura.uz/settings/contacts` orqali aloqa ma'lumotlarini istalgan payt o'zgartira oladi, landing sahifasi avtomatik yangilanadi.
- `crm.ventura.uz` endi ham yorug' (Light), ham tungi (Dark) rejimda zamonaviy, premium va qisqa lirik matnlar bilan taqdim etiladi.
- `ventura.uz` mutlaqo tegilmagan holda saqlanib qoladi.
- Barcha markazlar to'liq izolyatsiyalangan arxitektura, o'quvchi/o'qituvchi kabinetlari va 10 GB disk xotirasiga ega bo'ladi.
