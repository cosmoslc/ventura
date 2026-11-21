# Onlayn do'kon platformasi: TO'LIQ QO'LLANMA (GUIDE)

> Bitta hujjat: user tomon + admin tomon + arxitektura + qurish tartibi.
> Stack: Next.js full-stack + PostgreSQL + Drizzle. Har mijozga alohida ilova va baza.

## Mundarija

1. **Loyiha va qabul qilingan qarorlar**
2. **Arxitektura va texnologiya** (stack, ko'p mijoz modeli, papka tuzilmasi, dizayn tizimi)
3. **User tomon** (layout, sahifalar, to'lov arxitekturasi, konfigurator)
4. **Admin tomon** (sahifalar, hisob-kitob qoidalari, moliya/ERP tayyorgarligi)
5. **Ma'lumotlar modeli, API va biznes qoidalar**
6. **Qurish tartibi, muddat va tayyor mezonlari**

---

# 1-QISM. Loyiha va qarorlar

**Loyiha**: kompyuter va elektronika sotuvchi onlayn do'kon (mahsulotlar + tayyor/buyurtma PC'lar), admin panel bilan ombor, kirim, sotuv va foyda hisobi. Platforma biznes egalariga oddiy sayt sifatida sotiladi, moliya/ERP moduli esa ixtiyoriy qo'shimcha.

| # | Mavzu | Qaror |
|---|-------|-------|
| 1 | Stack | Next.js full-stack + PostgreSQL + Drizzle ORM |
| 2 | Login | Telefon + SMS OTP, keyin Google orqali kirish |
| 3 | To'lov | Hozir operator orqali (Telegram). Click/Payme keyinroq, yuridik shaxs ochilganda adapter sifatida ulanadi |
| 4 | USD/UZS kursi | Admin panelda bir marta kiritiladi |
| 5 | Soliq (QQS) | Admin sozlaydi, foiz o'zgaruvchan, narx ustiga qo'shiladi |
| 6 | Yetkazib berish | Viloyat bo'yicha narx + belgilangan summadan yuqorida bepul |
| 7 | Mehmon savatcha | Ha (localStorage), checkout'da login talab qilinadi, login'dan keyin birlashadi |
| 8 | Tillar | uz + ru + en |
| 9 | Kompyuterlar | Alohida `PcBuild` entity: komponentlar ombordagi mahsulotlardan yig'iladi, tannarx yig'indisi. Tayyor PC yo'q bo'lsa user konfiguratordan zakaz beradi (PC zakazlar) |
| 10 | PC komponentlari ombori | PC yaratilganda komponentlar zaxiraga olinadi, sotilganda ombordan chiqadi |
| 11 | Foyda hisobi | Mahsulotning o'z tannarxi bo'yicha; sotuv paytida tannarx snapshot qilinadi |
| 12 | Sotuv manbalari | Sayt buyurtmalari (`delivered`) + admin qo'lda kiritgan oflayn sotuvlar |
| 13 | Kirim | Dona yoki optom; optomda dona tannarxi = umumiy summa / soni |
| 14 | Ko'p mijoz | Bitta kod bazasi, har mijozga alohida ilova + alohida baza (`tenantId` kerak emas) |
| 15 | Valyuta | Hamma narx UZS da saqlanadi, USD ko'rinish kurs bo'yicha |
| 16 | Foyda tarkibi | Sof daromad = (sotilgan narx − tannarx) × soni; soliq va yetkazib berish foydaga kirmaydi |

**Default qabul qilingan, tasdiqlanmagan (o'zgartirmoqchi bo'lsangiz ayting):**
- Kirimda mahsulot tannarxi oxirgi kirim tannarxiga yangilanadi (admin xohlasa o'zgartirmaydi)
- Rang varianti: har rangning o'z rasmi va qoldig'i bor
- Sharh: faqat `delivered` buyurtmasi bor user, mahsulotga 1 ta
- Qidiruvdagi mashhur kategoriyalar: admin pin qiladi + qidiruv statistikasidan avtomatik
- Figma yo'q: UI shadcn/ui asosida hal qilinadi
- Rollar: hozircha bitta `admin`; `role` maydoni keyin `seller`, `accountant` uchun tayyor
- PC konfiguratorda komponent mosligi (socket va h.k.) tekshiruvi hozircha yo'q, operator tekshiradi

---

# 2-QISM. Arxitektura va texnologiya

## Texnologiya stacki

**Frontend**
- Next.js 15 (App Router, Server Components, ISR) — tezlik va SEO uchun
- TypeScript (strict), Tailwind CSS, shadcn/ui + Radix, lucide-react
- `next-intl` (til), `next-themes` (dark/light)
- TanStack Query (server state), Zustand (cart, currency, UI state)
- React Hook Form + Zod (forma va validatsiya)
- Embla Carousel (hero slider, kartochka galereyasi)
- `next/image` (WebP/AVIF, lazy)
- Yandex Maps JS API v3 (iframe o'rniga ham mumkin; iframe yetarli bo'lsa iframe)

**Backend (Next.js full-stack)**
- Route Handlers + Server Actions (REST faqat tashqi webhooklar uchun)
- PostgreSQL + **Drizzle ORM** (+ drizzle-kit migratsiyalar), Zod validatsiya
- Redis (cache, qidiruv statistikasi, rate limit, OTP kodlari TTL bilan)
- Auth: **Better Auth** (phone-number OTP plugin + Google OAuth), sessiya httpOnly cookie
- SMS provayder abstraksiyasi (`SmsProvider` interfeys; Eskiz yoki boshqasi, shartlarini tekshirish kerak)
- S3-mos storage (MinIO / Cloudflare R2) rasm uchun
- Telegram Bot API (yangi buyurtma operatorga xabar)

**Sifat va tezlik**
- ESLint + Prettier + Husky, Vitest/Playwright (asosiy oqimlar)
- Lighthouse maqsadi: Performance ≥ 90, LCP < 2.5s
- Docker Compose (dev), CI (lint + typecheck + test)

## Ko'p mijoz arxitekturasi (har mijozga alohida ilova + baza)

Terminologiya: bu "instance-per-client" (silo) modeli. Ma'lumotlar mijozlar orasida to'liq ajralgan, kod bitta. Kodda `tenantId` kerak emas, bu sxemani va so'rovlarni soddalashtiradi va xavfsizroq.

**Har mijoz uchun alohida**
- PostgreSQL baza (alohida DB yoki alohida server)
- Ilova instansi (Docker konteyner) va domen/subdomen
- `.env` (DB URL, auth secret, SMS provayder, Google OAuth, Telegram bot token, storage kaliti)
- Rasm storage (alohida bucket yoki prefix), Redis namespace
- Branding: nom, logo, ranglar (CSS tokenlar) `Setting` jadvalidan; boshlang'ich qiymat `tenant.config` dan
- Yoqilgan modullar: `site`, `pc`, `reviews`, `payments`, `finance/erp` (flag orqali, shu mijoz sotib olgan moduli ishlaydi)

**Bitta umumiy**
- Kod bazasi (bitta repo), versiyalangan Docker image
- Drizzle migratsiyalari va seed skriptlari
- Tenant tooling (1-bosqich, "Poydevor")

**Tooling (1-bosqich)**
- `pnpm tenant:create <slug>`: DB yaratadi, migratsiya, seed (birinchi admin, default sozlamalar, kategoriyalar), `.env` generatsiya, deploy
- `pnpm tenant:migrate --all` (yoki `--tenant=<slug>`): migratsiyalarni hamma mijoz bazalarida ketma-ket ishga tushiradi, xatoda to'xtaydi va hisobot beradi
- `tenant:backup`: har baza uchun kunlik `pg_dump`, tashqi storage'ga, tiklash skripti
- Tenant ro'yxati (`tenants.json` yoki kichik control DB): slug, domen, versiya, modullar, holat

**Release jarayoni**
- Migratsiyalar **orqaga mos** (expand/contract): avval ustun qo'shiladi, keyin kod o'tadi, keyin eski ustun olib tashlanadi. Shunda yangi versiya hamma mijozga birdan chiqmasa ham ishlaydi
- Avval test mijozga (canary), keyin boshqalarga; xato bo'lsa oldingi image'ga rollback
- Har mijozning versiyasi tenant ro'yxatida ko'rinadi

**Hosting (taklif)**
- Kichik mijozlar: bitta VPS da Docker bilan (Coolify yoki Dokploy), har mijoz o'z konteyner va DB si bilan
- Katta mijoz: alohida VPS
- Monitoring: Sentry (mijoz bo'yicha tag) + uptime tekshiruv

**Keyinroq (ixtiyoriy)**: markaziy "Control panel" (sizning ichki panelingiz): mijozlar ro'yxati, versiya, modul yoqish/o'chirish, litsenziya muddati, backup holati.

## Papka tuzilmasi

```
src/
  app/[locale]/
    (shop)/    page.tsx, products/, products/[slug]/, computers/, computers/[slug]/, computers/custom/,
               faq/, about/, cart/, checkout/
    (account)/ profile/, profile/orders/, profile/settings/, profile/liked/
  app/admin/   dashboard, products/, purchases/, sales/, pcs/, pc-orders/, orders/, users/, settings/
  components/  ui/, layout/ (Navbar, Footer, SearchBox, CartDrawer, NotifDrawer), product/, home/, checkout/, admin/
  features/    cart/, favorites/, search/, auth/, reviews/, inventory/, sales/, pc/
  db/          schema/ (Drizzle), migrations/, seed/
  lib/         api.ts, format.ts (money, date), i18n/, validators/, payments/ (provider adapterlar), sms/
  store/       cart.ts, currency.ts, ui.ts
  styles/      globals.css (tokenlar)
tools/         tenant-create, tenant-migrate, tenant-backup
```

## Dizayn tizimi (1-o'rinda STYLE)

- **Tokenlar**: ranglar CSS variable'larda (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--accent`), light va dark uchun alohida
- **Tipografiya**: 1 ta sans-serif (Inter yoki Manrope), o'lchamlar: 12/14/16/20/24/32/48
- **Radius/soya**: 12px karta, 8px input, yengil soya
- **Spacing**: 4px grid
- **Komponentlar**: Button, Input, Select, Dropdown, Modal, Drawer (o'ngdan), Tabs, Badge, Rating, Skeleton, Toast, Breadcrumb, Accordion
- **Responsive**: mobile-first; breakpoint'lar 640/768/1024/1280
  - Karta grid: mobile 1–2, tablet 2–3, desktop 4 ustun
- **A11y**: klaviatura navigatsiya, focus ring, alt matnlar, kontrast AA
- Kartochkada asosiy rasm foni **oq** (dark rejimda ham), brend nomi rasm ustida yarim shaffof `span`

---

# 3-QISM. User tomon

## Umumiy layout

### Navbar (sticky)
Chapdan o'ngga:
1. Logo (bosilsa `/`)
2. Qidiruv input (markazda, keng)
3. Menyu: Mahsulotlar · Kompyuterlar · FAQ · Biz haqimizda
4. Til tanlash (dropdown: UZ/RU/EN)
5. Valyuta tanlash (UZS/USD)
6. Dark/Light toggle
7. Bildirishnomalar ikonkasi (soni badge)
8. Savatcha ikonkasi (soni badge)
9. Profil ikonkasi (dropdown yoki login'ga yo'naltiradi)

Mobile: logo + qidiruv ikonka + burger (drawer); pastda bottom-nav ixtiyoriy (Asosiy, Katalog, Savatcha, Profil).

### Qidiruv
- Input fokus olganda **dropdown modal**: "Mashhur kategoriyalar" (admin tanlagan + eng ko'p qidirilganlar avtomatik)
- Yozganda debounce (300ms) bilan natija: **mahsulot, kategoriya, brend** guruhlangan
- Enter → `/products?q=...`
- Qidiruv so'rovlari Redis'da hisoblanadi → mashhur kategoriyalar avtomatik yangilanadi

### Footer
Logo, tezkor havolalar, manzil, telefon, ijtimoiy tarmoqlar, til/valyuta.

## Sahifalar

### Bosh sahifa `/` (landing)
Tartib bilan:
1. **Hero slider** — rasmlar avto almashadi (autoplay 5s, pauza hover'da), ustida sarlavha + tugma, nuqtali pagination
2. **Kategoriyalar** — 1 qatorli gorizontal ro'yxat (ikonka/rasm + nom)
3. **Yangi kelganlar** — 1 qator karusel (mahsulot kartalari)
4. **Eng ko'p sotilganlar** — 1 qator karusel
5. **Dizayn bloki** — kartada sarlavha + rasm (promo kartalar, 2–3 dona)
6. **Nega bizni tanlashadi** — afzalliklar (4–6 blok: kafolat, tez yetkazish, original, qo'llab-quvvatlash...) va kompaniyani maqtovchi matn
7. **Banner** (dizayn, sarlavha)
8. **Hit mahsulotlar** — 1 qator (admin "hit" belgilagan)
9. **Banner** (2-chi)
10. **Brendlar** — logotiplar qatori (bosilsa `/products?brand=...`)
11. **CTA** — "Mutaxassis bilan bog'laning" (forma yoki Telegram tugma)
12. **Manzil bo'limi** — xarita + manzil + ish vaqti + aloqa

Barcha bloklar adminda yoqish/o'chirish va tartiblash uchun `HomeSection` jadvalidan keladi (keyinroq).

### Mahsulotlar `/products`
- Sarlavha (title) + qisqa tavsif (p)
- **Kategoriya select** (default: "Barchasi"; kategoriyalar admin'dan)
- **Filterlar**: narx oralig'i (slider + input), chegirmadagilar, narx arzon→qimmat, qimmat→arzon, (qo'shimcha: brend, reyting, mavjud)
- **Grid**: 4 ustun × 4 qator (sahifa = 16 ta), pagination yoki "Yana yuklash"
- Filter holati URL query'da (`?category=&min=&max=&sort=&discount=1&page=`) — havola ulashiladi

**Mahsulot kartasi**
- Asosiy rasm (oq fon), ustida brend nomi (`span`, yarim shaffof)
- **Rang tanlagich** — rang bosilsa rasm shu rang rasmiga almashadi
- Rasm ustiga bosilganda (hover/click) pastda **4 ta thumbnail** chiqadi; pastda navigatsiya: **slide tugmalari** va **Tezkor ko'rish** tugmasi
- Ombordagi qoldiq (masalan "Omborda: 12 dona")
- Narx (chegirma bo'lsa eski narx chiziqli + yangi narx + foiz badge)
- Reyting (0–5 yulduz, baholar soni)
- Tugmalar: **Batafsil**, **Hozir sotib olish**, yurakcha (liked)
- **Tezkor ko'rish** — modal: rasm, nom, narx, rang, miqdor, "Savatga" / "Batafsil"

### Mahsulot batafsil `/products/[slug]`
**Chap tomon (galereya)**
- Katta asosiy rasm; hover'da kursor tomon 10% zoom (`scale(1.1)` + `transform-origin` kursor pozitsiyasida)
- Pastda 3–4+ ta thumbnail (admin yuklagan), tanlansa asosiy rasm almashadi
- Rang tanlansa galereya shu rang rasmlariga o'tadi

**O'ng tomon (ma'lumot)**
- Brend nomi, ombordagi qoldiq
- Mahsulot nomi, tavsif
- Rang tanlagich
- Narx (chegirma bilan)
- Miqdor (+/−), ombordan oshib ketmaydi
- Tugmalar: **Hozir sotib olish**, **Savatga**, **Liked**
- **Texnik xususiyatlar** — admin ixtiyoriy qo'shadi (nom: qiymat). Har bir xususiyat yonida **"?" havola**: bosilsa modal ochiladi — bu xususiyat nima degani (masalan "Refresh rate nima?")

**Pastda**
- **Sharhlar bo'limi**: chap — sharh qo'shish formasi (faqat sotib olgan user): ism, 5 yulduzgacha baho, fikr; o'ng — sharhlar ro'yxati (ism, baho, matn, sana), o'rtacha reyting va taqsimot
- O'xshash mahsulotlar karuseli

### Hozir sotib olish → Savat modal (o'ngdan drawer)
Sarlavha: "Xarid savatchasi"
- Har element: rasm, nom, brend, miqdor (+/−), **o'chirish**, narx (o'ng tomonda)
- Pastda: **Jami narx**, **Yetkazib berish** (admin belgilagan), **Chegirma** (bo'lsa), **Umumiy summa**
- Tugmalar: **Xarid savatchasiga** (→ `/cart`) va **To'lovga o'tish** (→ `/checkout`)
- "Savatga" tugmasi ham elementni shu savatga qo'shadi va drawer'ni ochadi

### Savat `/cart`
**Chap**: savatdagi barcha mahsulotlar — brend, nom, miqdor, o'chirish, rasm; mahsulot selektori (checkbox — qaysilarini buyurtma qilish)
**O'ng — "Buyurtma tafsilotlari"**: jami, yetkazib berish, chegirma, soliq, **umumiy summa**; **To'lovga o'tish** tugmasi

### Checkout `/checkout`
**Chap — Yetkazib berish manzili**
- Ism, familiya, telefon (`+998` mask), viloyat (select), 
- **Yandex xarita** — xaritadan nuqta tanlash (marker, reverse geocoding bilan manzil matni avtomatik to'ladi)
- To'liq manzil (textarea)
- Agar profil sozlamalarida to'ldirilgan bo'lsa — har safar **avto to'ldiriladi** (o'zgartirish mumkin)

**O'ng — Buyurtma tavsilotlari**
- Mahsulot nomlari, soni, o'chirish tugmasi, narx (UZS)
- Oraliq summa, yetkazib berish, chegirma, **Jami**
- **Buyurtmani tasdiqlash** tugmasi

**Muvaffaqiyat holati (modal yoki sahifa)**
- Muvaffaqiyat belgisi (✓)
- Buyurtma ID raqami
- "Operator bilan bog'lanish" — Telegram havola
- "Bosh sahifaga" tugmasi

### Kompyuterlar `/computers`
- Sarlavha + p, qidiruv input
- Filterlar: **CPU**, **GPU**, narx, baho (reyting), sharhlar soni
- **Grid: 4 ustun × 5 qator** (20 ta), `PcBuild` kartalari: rasm, nom, CPU/GPU/RAM/SSD qisqa ma'lumot, narx (chegirma bilan), reyting, tugmalar (Batafsil, Hozir sotib olish, Liked)
- Faqat `available` holatdagi PC'lar ko'rinadi, sotilganlari yashiriladi
- Ma'lumotlar adminda (PClar sahifasi) kiritiladi

### Kompyuter batafsil `/computers/[slug]`
- Mahsulot batafsil sahifasi bilan bir xil tuzilma: galereya, narx, chegirma, "Hozir sotib olish", "Savatga", Liked
- To'liq **texnik xususiyatlar** ("?" izoh modali bilan) va komponentlar ro'yxati (CPU, GPU, RAM, ...)
- Sharhlar mahsulotdagi kabi

### Buyurtma PC (konfigurator) `/computers/custom`
Tayyor PC yo'q yoki user o'ziga kerakli konfiguratsiyani xohlasa:
- Bosqichma-bosqich tanlash: CPU, Motherboard, GPU, RAM, SSD, PSU, Case, Cooler (har bosqichda ombordagi mahsulotlar, qidiruv va narx bilan)
- Jonli jami narx va mavjudlik belgisi
- Login talab qilinadi; ism, telefon, manzil, izoh
- "Zakaz berish" → `PcOrder` yaratiladi, admin "PC zakazlar" sahifasida ko'radi, operator Telegram orqali bog'lanadi
- Profil → Mening buyurtmalarim → "PC zakazlarim" tabida status ko'rinadi
- Komponent mosligi tekshiruvi hozircha yo'q (keyingi versiya)

### FAQ `/faq`
- **Chap**: kategoriyalar (tab ro'yxat)
- **O'ng**: tanlangan kategoriya savollari (accordion: savol → javob)
- Pastda: **"Mutaxassislar bilan bog'lanish"** tugmasi (Telegram/telefon)
- Hammasi admin'dan: title, savol, javob, kategoriya

### Biz haqimizda `/about`
1. Katta rasm + banner (hero)
2. Chapda sarlavha + tavsif, o'ngda rasm; joylar/manzillar bloklarda (filiallar kartalari)
3. Asosiy jamoa — to'liq ism, lavozim, rasm, telefon/aloqa
4. Loyiha bo'yicha batafsil ma'lumotlar (missiya, raqamlar, yutuqlar)

### Bildirishnomalar (modal, o'ngdan)
- Navbar ikonkasi bosilsa o'ngdan panel ochiladi
- Admin'dan kelgan **bildirishnomalar**, **chegirmalar**, brend/mahsulot yangiliklari (turi bo'yicha ikonka)
- O'qilmaganlar soni badge; "Hammasini o'qilgan qilish"
- Bildirishnoma bosilsa tegishli mahsulot/brendga o'tadi

### Profil `/profile/*`
Chap menyu (har biri link):
- **Umumiy ko'rinish** `/profile` — ism, menyular, qisqa statistika (buyurtmalar, liked)
- **Mening buyurtmalarim** `/profile/orders` — tablar: *Jarayonda* (savatdagi/qabul qilingan) va *Yetkazib berilgan*; har buyurtma: ID, sana, status, mahsulotlar, summa; yetkazilgan mahsulotga "Sharh qoldirish"
- **Profil sozlamalari** `/profile/settings` — "Tahrirlash" tugmasi bosilsa forma ochiladi: ism, familiya, telefon, manzil (textarea), xarita (Yandex iframe) orqali joy tanlash; **Parolni o'zgartirish** tugmasi (modal); o'ng tomonda **profil rasmi** (yuklash/o'chirish)
- **Saralanganlar** `/profile/liked` — yoqtirilgan mahsulotlar kartalari

## To'lov arxitekturasi (hozir operator, keyin Click/Payme)

Savol: Click/Payme API siz backend va frontendni qurib, keyin ulash mumkinmi? **Ha.** Yechim: to'lov qatlamini provayderdan ajratib qurish.

- `PaymentProvider` interfeysi: `createPayment()`, `handleCallback()`, `getStatus()`, `cancel()`
- Hozirgi provayderlar: `cod_operator` (operator orqali, qo'lda tasdiqlanadi) va `mock` (dev/test uchun, Click/Payme oqimini taqlid qiladi)
- Keyin qo'shiladi: `click`, `payme` adapterlari. Faqat adapter yoziladi, boshqa kod o'zgarmaydi
- Jadval: `Payment(id, orderId, provider, status, amount, currency, externalId, rawPayload, createdAt, paidAt)`; statuslar: `pending → paid | failed | cancelled | refunded`
- Webhook endpointlar tayyor turadi: `/api/payments/click/*`, `/api/payments/payme` (hozircha o'chiq, feature flag bilan)
- `Order.paymentMethod` maydoni, checkout'da to'lov usuli tanlash komponenti (hozir bitta variant: "Operator orqali"; Click/Payme tugmalari yashirin)
- Idempotentlik: callback qayta kelsa ikki marta to'lanmaydi (`externalId` unique)
- Click/Payme ulanish uchun odatda yuridik shaxs/YaTT va shartnoma kerak bo'ladi; sandbox/test muhitini shunda olasiz. Shuning uchun hozir mock bilan to'liq oqimni sinab qo'yamiz

---

# 4-QISM. Admin tomon

## Admin layout

- Chap **sidebar**: Dashboard · Mahsulotlar · Kirimlar · Sotuvlar · PClar · PC zakazlar · Buyurtmalar · Foydalanuvchilar · Sozlamalar
- Tepada: qidiruv, dark/light, til (uz/ru/en), profil dropdown (parolni o'zgartirish, chiqish)
- Mobile: sidebar drawer
- Jadvallar: TanStack Table (server-side pagination, sort, filter), CSV eksport
- Formalar: React Hook Form + Zod, server action'lar, optimistik yangilash
- Hamma narx maydonlari: raqam formati (`1 250 000`), manfiy qiymat taqiqlangan
- `/admin` faqat `admin` roli uchun (middleware + server tekshiruv)


## Mahsulotlar `/admin/products`

**Statistik kartalar (tepada, filterga bog'liq)**
- Jami mahsulot turlari soni
- Omborda jami dona
- Ombor qiymati (tannarx bo'yicha)
- Ombor qiymati (sotuv narxi bo'yicha)
- Kutilayotgan foyda (sotuv − tannarx)
- Kam qolgan mahsulotlar soni (`stock <= minStock`)
- Tugagan mahsulotlar soni

**Filterlar**: kategoriya, brend, holat (faol/nofaol), omborda bor/yo'q, kam qolgan, narx oralig'i, qidiruv (nom/SKU)

**Karta/jadval ko'rinishi** (toggle): rasm, nom, kategoriya, brend, stock, tannarx, sotuv narxi, foyda %, holat

**Mahsulot formasi (yaratish/tahrirlash)**
- Nom (uz/ru/en), tavsif (uz/ru/en), kategoriya, brend, SKU
- Rasmlar: asosiy + galereya (drag-drop tartib), rang bo'yicha rasmlar
- **Rang variantlari**: rang nomi, hex, har rangning o'z rasmi va o'z qoldig'i
- **Texnik xususiyatlar**: admin xohlaganicha qator qo'shadi: `nom`, `qiymat`, `filtrda ko'rsatilsin` (checkbox), **"?" izoh**: sarlavha + matn (user tomonda modal ochiladi, masalan "Refresh rate nima?")
- **Narx bloki**: tannarx, sotish narxi (yoki "foiz qo'shish" kalkulyatori: tannarx + 20% → narx), chegirma foizi (ixtiyoriy), yakuniy narx avtomatik
- Belgilar: yangi, hit, faol
- `minStock` (kam qolgan ogohlantirish)
- Saqlashda user tomon keshi yangilanadi (`revalidateTag`)

**Mahsulot sahifasida (tafsilot)**: kirimlar tarixi, sotuvlar tarixi, jami sotilgan, jami foyda.


## Kirimlar `/admin/purchases`

Mahsulot qancha va qanday narxda olib kelingani.

**Forma**
- Mahsulot (+ rang varianti), sana
- Turi: **Dona** yoki **Optom**
  - Dona: soni × dona tannarxi
  - Optom: soni + umumiy summa → dona tannarxi avtomatik
- Yetkazib beruvchi (ixtiyoriy matn), izoh
- Sotish narxi (ixtiyoriy yangilash) va "mahsulot tannarxi yangilansin" checkbox (default yoqilgan)

**Natija**: ombor qoldig'i oshadi, kirim yozuvi saqlanadi (o'chirilmaydi, faqat bekor qilinadi va teskari yozuv bilan).
**Jadval**: sana, mahsulot, soni, tur, umumiy summa, dona tannarxi, yetkazib beruvchi. Filter: sana oralig'i, mahsulot, kategoriya.
**Kartalar**: shu davrdagi jami kirim summasi, jami dona.


## Sotuvlar `/admin/sales` (sotilgan mahsulotlar)

**Manbalar**: sayt buyurtmasi (`delivered`) + qo'lda kiritilgan sotuv. Jadvalda `source` belgisi: `Sayt` / `Oflayn`.

**Qo'lda sotuv formasi**
- Mahsulot (dropdown, qidiruv bilan), rang, soni
- Sotilgan narx (default: joriy sotuv narxi, o'zgartirish mumkin)
- Xaridor ismi, telefoni, sana (sana majburiy)
- Saqlanganda ombor kamayadi, tannarx snapshot olinadi

**Mahsulot tanlanganda chiqadigan hisob-kitob** (dropdown'dan mahsulot tanlanganda):
- Tannarx
- Sotuvga qo'yilgan narx
- Haqiqiy sotilgan narx
- **Sof daromad** = (sotilgan − tannarx) × soni; foiz bilan

**Filterlar**: sana oralig'i (kun dan kungacha), tez tanlov (bugun / hafta / oy / yil), kategoriya, brend, manba (sayt/oflayn), mahsulot
**Kartalar**: jami tushum, jami tannarx, jami sof daromad, sotilgan dona, o'rtacha marja %
**Grafik**: kunlik/oylik tushum va foyda (line/bar)
**Eksport**: CSV/XLSX

**Qaytarish (return)**: sotuvni bekor qilish → stock qaytadi, foyda hisobidan chiqadi (teskari yozuv).


## PClar `/admin/pcs`

Tayyor kompyuterlar: komponentlar mahsulotlardan yig'iladi. Boshqa mahsulotlar ro'yxatiga **aralashmaydi**.

**PC yaratish formasi**
1. Nom (uz/ru/en), rasmlar
2. **Komponentlar** (qatorlar): rol (CPU, GPU, RAM, SSD, Motherboard, PSU, Case, Cooler, boshqa) → mahsulot tanlash (ombordan) → soni
   - Har komponent tannarxi avtomatik olinadi
   - **PC tannarxi = komponentlar tannarxi yig'indisi** (jonli hisob)
   - Ombor yetmasa qizil ogohlantirish, saqlashga yo'l qo'yilmaydi
3. **Sotish narxi** (admin kiritadi) → kutilayotgan foyda va marja avtomatik
4. **Chegirma** (ixtiyoriy, foiz yoki summa)
5. **Texnik xususiyatlar** (user tomon uchun): nom/qiymat, "?" izoh, CPU va GPU `filterable`
6. Holat: `available` / `sold` / `hidden`

**Zaxira qoidasi**: PC yaratilganda komponentlar `reserved` bo'ladi (mahsulotning `available = stock − reserved`). PC o'chirilsa yoki komponent almashsa zaxira yangilanadi.

**PC sotish** (user buyurtmasi yoki qo'lda)
- Majburiy: xaridor ismi, telefon, sana
- Sotilganda komponentlar ombordan chiqadi (`stock` va `reserved` kamayadi), `Sale` yozuvi yaratiladi: tannarx = komponentlar tannarxi snapshot, foyda = sotilgan − tannarx
- Sotilgan PC'lar ham `/admin/sales` da ko'rinadi (`type = pc`)

**Jadval**: rasm, nom, tannarx, sotuv narxi, foyda, holat. Filter: holat, narx, CPU/GPU, qidiruv.
**Kartalar**: mavjud PC'lar, sotilganlar, jami foyda.


## PC zakazlar `/admin/pc-orders`

User tomonda tayyor PC yo'q bo'lsa, user konfiguratordan komponent tanlab zakaz beradi.

- Ro'yxat statuslari: `new → reviewing → quoted → confirmed → assembling → ready → delivered | cancelled`
- Zakaz kartasi: xaridor (ism, telefon, manzil), tanlangan komponentlar (mavjudlik belgisi bilan), izoh
- Admin amallari: komponentni almashtirish, **yakuniy narx** belgilash (tannarx yig'indisi va marja ko'rinadi), operator izohi, Telegram orqali xaridorga bog'lanish tugmasi
- **"PC ga aylantirish"**: tasdiqlangan zakazdan `PcBuild` yaratadi (komponentlar zaxiraga olinadi) va keyin sotiladi
- Filterlar: status, sana, narx; kartalar: yangi zakazlar, jarayonda, bajarilgan


## Buyurtmalar `/admin/orders` (sayt buyurtmalari)

Aytilmagan, lekin zarur: saytdan kelgan oddiy buyurtmalar.

- Ro'yxat: ID, xaridor, summa, status, sana. Filter: status, sana, viloyat
- Status: `new → confirmed → shipping → delivered | cancelled`
- Tafsilot: mahsulotlar, manzil (xarita nuqtasi), operator izohi
- `delivered` bo'lganda avtomatik `Sale` yaratiladi; `cancelled` bo'lsa stock qaytadi
- Yangi buyurtma kelganda Telegram botdan operatorga xabar + admin panelda bildirishnoma


## Foydalanuvchilar `/admin/users`

- Saytga login qilgan foydalanuvchilar ro'yxati: ism, telefon, Google/telefon orqali kirgani, ro'yxatdan o'tgan sana, oxirgi kirish, buyurtmalar soni
- **Active/Blok** toggle (bloklangan user kira olmaydi va buyurtma bera olmaydi)
- Qidiruv va filter (faol/bloklangan, sana)
- User tafsiloti: buyurtmalari, sharhlari


## Sozlamalar `/admin/settings`

Tablar:
1. **Umumiy**: sayt nomi, logo, favicon, kontaktlar (telefon, Telegram, manzil, ish vaqti), ijtimoiy tarmoqlar
2. **Katalog**: kategoriyalar (daraxt, i18n, ikonka, tartib), brendlar (nom, logo)
3. **Bosh sahifa**: hero slayderlar, bannerlar, "Nega bizni tanlashadi" bloklari, bo'lim tartibi va yoqish/o'chirish, hit/yangi/eng ko'p sotilgan qoidalari
4. **Qidiruv**: mashhur kategoriyalarni qo'lda pin qilish (qolganlari avtomatik)
5. **Moliya sozlamalari**: **USD/UZS kursi** (bir marta kiritiladi), **soliq foizi**, **viloyat bo'yicha yetkazib berish narxi**, **bepul yetkazish chegarasi**
6. **FAQ**: kategoriyalar, savol, javob (i18n), tartib
7. **Biz haqimizda**: hero rasm, bloklar, filiallar, jamoa a'zolari (ism, lavozim, rasm, aloqa)
8. **Bildirishnomalar**: user'larga yuboriladigan xabar/chegirma (sarlavha, matn, havola, maqsad)
9. **Xavfsizlik**: **parolni o'zgartirish** (eski parol + yangi), sessiyalar ro'yxati
10. **Modullar**: feature flag'lar (PC modul, sharhlar, onlayn to'lov, keyin moliya/ERP)

## Moliya/ERP (keyingi bosqich, hozir faqat tayyorgarlik)

Hozir qurilmaydi, lekin keyin sotish uchun:
- Modul flag: `modules.finance`
- Hozirgi `Purchase` va `Sale` jadvallari moliya moduliga asos bo'ladi
- Keyin qo'shiladi: xarajatlar (ijara, maosh, reklama), kassa/hisoblar, qarzdorlik (nasiya), yetkazib beruvchilar, hisobotlar (P&L, oy bo'yicha), ombor inventarizatsiyasi
- Dizayn qoidasi: har moliyaviy yozuv o'zgarmas (teskari yozuv bilan tuzatiladi), audit log

---

# 5-QISM. Ma'lumotlar modeli, API va biznes qoidalar

## Ma'lumotlar modeli (Drizzle)

```
// Foydalanuvchi va katalog
User(id, firstName, lastName, phone, email?, googleId?, avatarUrl, region, address, lat, lng, role, isActive, lastLoginAt, createdAt)
Category(id, nameI18n, slug, iconUrl, parentId?, sort)
Brand(id, name, slug, logoUrl)
Product(id, slug, categoryId, brandId, sku, nameI18n, descI18n, costPrice, sellPrice, discountPercent, stock, reserved, minStock, isNew, isHit, isActive, ratingAvg, ratingCount, soldCount)
ProductVariant(id, productId, colorName, colorHex, sku, stock, reserved, price?)
ProductImage(id, productId, variantId?, url, sort)
ProductSpec(id, productId, key, title, value, filterable, helpTitle?, helpText?)

// Ombor va kirim
Purchase(id, productId, variantId?, type[piece|bulk], qty, totalCost, unitCost, supplier?, note, purchasedAt, createdBy, voidedAt?)
StockMovement(id, productId, variantId?, delta, reason[purchase|sale|reserve|release|return|adjust], refType, refId, createdAt)

// PC
PcBuild(id, slug, nameI18n, images, costPrice(computed), sellPrice, discountPercent, status[available|sold|hidden], buyerName?, buyerPhone?, soldAt?)
PcComponent(id, pcId, role, productId, variantId?, qty, costSnapshot)
PcSpec(id, pcId, key, title, value, filterable, helpTitle?, helpText?)
PcOrder(id, userId, status[new|reviewing|quoted|confirmed|assembling|ready|delivered|cancelled], name, phone, address, note, quotedPrice?, convertedPcId?, createdAt)
PcOrderItem(id, pcOrderId, role, productId, qty)

// Savat, buyurtma, sotuv, to'lov
Cart(id, userId) / CartItem(cartId, variantId?, pcId?, qty)
Order(id, publicId, userId, status[new|confirmed|shipping|delivered|cancelled], name, phone, region, address, lat, lng, subtotal, shipping, discount, tax, total, paymentMethod, createdAt)
OrderItem(orderId, variantId?, pcId?, nameSnapshot, priceSnapshot, costSnapshot, qty)
Payment(id, orderId, provider, status[pending|paid|failed|cancelled|refunded], amount, currency, externalId unique, rawPayload, createdAt, paidAt)
Sale(id, source[site|offline], type[product|pc], orderId?, buyerName, buyerPhone, soldAt, total, costTotal, profit, createdBy, voidedAt?)
SaleItem(id, saleId, productId?, pcId?, variantId?, nameSnapshot, qty, listPrice, soldPrice, costSnapshot, profit)

// Kontent va sozlamalar
Review(id, userId, productId?, pcId?, orderItemId, rating, text, createdAt)
Favorite(userId, productId?, pcId?)
Notification(id, type, title, body, link, createdAt) / UserNotification(userId, notificationId, readAt)
FaqCategory(id, nameI18n, sort) / Faq(id, categoryId, questionI18n, answerI18n, sort)
HeroSlide/Banner(id, imageUrl, title, link, sort, position) / HomeSection(key, enabled, sort)
SearchStat(term, targetType, targetId, count, updatedAt)
Setting(key, value)   // usd_rate, tax_percent, free_shipping_from, modules, kontaktlar, brend
ShippingRate(region, price)
AdminAuditLog(id, userId, action, entity, entityId, diff, createdAt)
```

**Ombor qoidasi**: `available = stock − reserved`; har o'zgarish `StockMovement` orqali va tranzaksiyada. Qoldiq hech qachon manfiy emas (DB `CHECK`).
**Snapshot qoidasi**: buyurtma va sotuvda nom, narx va tannarx snapshot sifatida saqlanadi.

## API (qisqa ro'yxat)

```
// User tomon
GET  /home                      GET /categories, /brands
GET  /products?q&category&brand&min&max&sort&discount&page      GET /products/:slug
GET  /products/:id/reviews      POST /products/:id/reviews
GET  /pcs?q&cpu&gpu&min&max&rating&page      GET /pcs/:slug      GET /filters/pcs
POST /pc-orders                 GET /pc-orders (o'zining)
GET  /search/suggest?q          GET /search/popular
Auth: telefon OTP (send/verify), Google OAuth, logout
GET/PATCH /me                   POST /me/avatar    DELETE /me/avatar
GET/POST/DELETE /me/favorites   GET/POST/PATCH/DELETE /cart    POST /cart/merge
POST /orders                    GET /orders, /orders/:id
GET  /notifications             POST /notifications/read
GET  /faq     GET /settings/public     GET /pages/about
POST /api/payments/{click|payme}/*      // webhook, hozircha o'chiq (feature flag)

// Admin (server actions / route handlers, faqat role=admin)
products, variants, specs, purchases, sales (qo'lda + qaytarish), pcs, pc-orders, orders (status),
users (active/blok), settings (barcha tablar), notifications, faq, home-cms, stats (kartalar va grafiklar)
```

## Muhim biznes qoidalar

- **Hisob-kitob serverda**: `total = subtotal − discount + tax + shipping`; frontend faqat ko'rsatadi
- **Ombor**: buyurtma tasdiqlanganda stock tranzaksiyada kamayadi, qoldiqdan ortiq miqdor rad etiladi; bekor qilinsa qaytadi
- **PC**: yaratilganda komponentlar zaxiraga olinadi, sotilganda chiqadi, o'chirilsa zaxira bo'shaydi; sotishda xaridor ismi, telefon va sana majburiy
- **Sotuv**: sayt buyurtmasi `delivered` bo'lganda `Sale` avtomatik yaratiladi; qaytarish teskari yozuv bilan
- **Sharh**: faqat `delivered` buyurtmasi bor user, mahsulot/PC uchun 1 ta
- **Mehmon savatcha** login'dan keyin serverdagi savat bilan birlashadi
- **Rate limit**: OTP yuborish, login, sharh, buyurtma endpointlari
- **Qidiruv statistikasi**: har qidiruvda kategoriya/brend hisoblagichi oshadi
- **Moliyaviy yozuvlar** o'zgarmas, tuzatish teskari yozuv bilan, audit log

## Asosiy formulalar


```
dona tannarxi (optom)  = umumiy summa / soni
sotuv narxi (marja)    = tannarx × (1 + foiz/100)
yakuniy narx           = narx − chegirma
PC tannarxi            = Σ (komponent tannarxi × soni)
sof daromad            = (soldPrice − costSnapshot) × qty
marja %                = sof daromad / tushum × 100
ombor qiymati          = Σ (stock × tannarx)
```

---

# 6-QISM. Qurish tartibi, muddat va tayyor mezonlari

## Nega aralash tartib

User tomon admin kiritgan ma'lumotga tayanadi (mahsulot, variant, texnik xususiyat, kategoriya, kurs, soliq, yetkazish). Soxta seed bilan user tomonni qursak, haqiqiy ma'lumot shakli boshqacha chiqsa kartalarni qayta yozamiz; to'liq admin'ni oldin qursak esa uzoq vaqt hech narsa ko'rinmaydi. Shuning uchun: sxema, admin minimal, user asosiy oqim, keyin qolgani.

## Bosqichlar (1 dasturchi, taxminiy)

| # | Bosqich | Mazmun | Muddat |
|---|---------|--------|--------|
| 1 | Poydevor | Repo, CI, Docker, Drizzle sxemasi (mahsulot, ombor, buyurtma, sotuv, PC), dizayn tokenlari, auth (OTP + Google), **tenant tooling** (`tenant:create`, `migrate --all`, backup) | ~1 hafta |
| 2 | Admin minimal | Layout, sozlamalar (kurs, soliq, yetkazish, kontaktlar), kategoriya/brend, mahsulot formasi (variant, rasm, specs) | ~1 hafta |
| 3 | User asosiy oqim | Navbar/Footer, til/valyuta/dark, landing, mahsulotlar, batafsil, savat, checkout (xarita), buyurtma, Telegram xabar | 3–4 hafta |
| 4 | Admin ikkinchi qism | Kirimlar, buyurtmalar, sotuvlar va foyda hisobi, ombor harakati, statistik kartalar | ~2 hafta |
| 5 | PC modul | Admin: PClar, PC zakazlar. User: kompyuterlar sahifasi, batafsil, konfigurator | ~2 hafta |
| 6 | Qolganlari | Profil (4 sahifa), FAQ, About, bildirishnomalar, foydalanuvchilar, qidiruv suggest/mashhur, sharhlar, SEO, performance, testlar | ~2 hafta |

**Jami: ~11–12 hafta** (bitta dasturchi). Mijozga demo kerak bo'lsa 3-bosqich oxirida ishlaydigan sayt tayyor bo'ladi (~5-hafta).

## "Tayyor" mezonlari (Definition of Done)

**Umumiy**
- Hamma sahifa mobile/tablet/desktop'da ishlaydi, dark va light to'g'ri
- Lighthouse Performance ≥ 90 (bosh sahifa, mahsulotlar), LCP < 2.5s
- Til va valyuta almashganda barcha matn va narx yangilanadi
- Filter holati URL'da, yangilanganda saqlanadi
- 404, 500, bo'sh holat va skeleton loading hamma joyda

**User oqimi**
- Savat → checkout → buyurtma → Telegram xabar to'liq ishlaydi
- Konfigurator zakazi admin "PC zakazlar"da ko'rinadi
- E2E testlar: qidiruv, savat, checkout, sharh, PC zakaz

**Admin va hisob-kitob**
- Kirim → sotuv → foyda hisobi to'g'ri (birlik testlar: optom/dona, snapshot, qaytarish)
- Qoldiq manfiy bo'lmaydi; zaxira va chiqim tranzaksiyada
- PC yaratish/o'chirish/sotishda komponent qoldig'i to'g'ri o'zgaradi
- Sotuvlar sahifasi sana va kategoriya filterida to'g'ri jami beradi (qo'lda tekshiruv bilan solishtirilgan)
- Admin o'zgartirgan narx, kurs, soliq, yetkazish user tomonda darrov ko'rinadi (cache invalidation)
- `admin` bo'lmagan user `/admin` va admin API'ga kira olmaydi

**Ko'p mijoz**
- Yangi mijoz `tenant:create` bilan bitta buyruqda ko'tariladi
- `tenant:migrate --all` hamma bazada xatosiz o'tadi, xato bo'lsa to'xtaydi va hisobot beradi
- Backup'dan tiklash sinab ko'rilgan

## Keyingi qadam

1. Yuqoridagi "default qabul qilingan" ro'yxatni ko'rib chiqing, o'zgartirmoqchi bo'lganingizni ayting
2. 1-bosqichni boshlaymiz: loyiha skeleti, Drizzle sxemasi, auth, tenant tooling
