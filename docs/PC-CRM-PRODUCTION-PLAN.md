# PC CRM: kod auditi va productionga chiqarish rejasi

Sana: 2026-10-31  
Holat: remediatsiya boshlandi; productionga chiqarishga tayyor emas  
Qamrov: Ventura monorepo qoidalari, `apps/pc-crm`, PC CRM sxemasi/migratsiyasi, provision va seed skriptlari, `docs/PC-CRM.md`, shablon manifesti.

## Qisqa xulosa

PC CRM — Next.js 16 App Router ilovasi (`apps/pc-crm`, port 3004), Ventura monoreposidagi `@ventura/*` paketlariga bog'langan. O'zining PostgreSQL bazasi va Drizzle sxemasi bor; bu dedicated/silo model. UI oqimlari va ekranlarining katta qismi mavjud, lekin ko'plab sahifalar demo ma'lumot bilan ishlaydi. Eng muhimi, hozirgi server amallari va buyurtma hisob-kitoblari ishonchli ishlab chiqarish ma'lumotini himoya qilmaydi. Faqat build yoki sahifalarni ko'rish production tayyorligini isbotlamaydi.

`docs/PC-CRM.md` biznes qo'llanmasi va kerakli qoidalarni belgilaydi. Ventura arxitektura qoidalariga ko'ra shablonning manifesti `apps/<template>/features.ts` ichida bo'ladi, sxema/migratsiyasi `packages/db/src/schema/<template>` va `packages/db/migrations/<template>` ichida, mijoz bazasini ko'tarish esa skript bilan takrorlanadigan bo'lishi kerak. PC CRM bu qismlarning boshlang'ich shakliga ega (`features.ts`, `pc:tenant`, `pc:seed`), ammo paneldagi template/deploy oqimidan yangi PC CRM mijozini oxirigacha yaratish va yangilash yo'li hali isbotlanmagan.

### Remediatsiya holati

Quyidagilar amalga oshirildi, lekin avtomatik tekshiruvlar va staging sinovi hali bajarilmagan: admin sahifalari va mutatsiyalariga server-side rol nazorati; bloklangan foydalanuvchi sessiyalarini yopish; auth role/isActive maydonlarini self-service'dan berkitish; checkout'dan narx va jami summalarni olib tashlab, server hisob-kitobi hamda buyurtma zaxirasini tranzaksiyaga o'tkazish; buyurtma yetkazilganda sale yozish, bekor qilinganda zaxirani bo'shatish; kirim va oflayn sale amallarini tranzaksiyaga o'tkazish; production auth/DB fallback'larini olib tashlash va DB pool singleton; admin hisob yaratish CLI (`pnpm pc:admin:create`); storefront katalogi, bosh sahifa va PC build detail'ni DB'dan ko'rsatishga o'tkazish va demo katalog fixture'larini olib tashlash. Bu ishlar release-ready deb qabul qilinmaydi, toki admin UI, provisioning/deploy va release gate'lari yopilib, stagingda tasdiqlanmaguncha.

Amalga oshirish holati: 1-bosqichning kod o'zgarishlari qo'llandi, lekin test/staging gate'lari o'tgani yo'q; 2-bosqich davom etmoqda. Storefront katalog/bosh sahifa/mahsulot tafsiloti/PC detail va PC konfigurator komponentlari DB'dan olinadi; katalogda buyurtma zaxirasidan keyingi mavjud qoldiq ko'rsatiladi, checkout ishlatmaydigan variant tanlash UI'si yashirilgan. PC konfigurator buyurtmani DB'ga yozadi va faqat server tasdiqlagan barqaror ID bilan muvaffaqiyat ko'rsatadi; mijozga login talab qilinadi. Admin katalogi ro'yxati/CRUD, kirimlar, oddiy buyurtmalar, PC buyurtmalari, sotuvlar, foydalanuvchilar, dashboard, asosiy sozlamalar va yetkazish tariflari DB query/action'larga ulandi; mahsulot editida nom, kategoriya, brend, SKU, narx, status, zaxira, asosiy rasm va texnik xususiyatlar transaction orqali saqlanadi; qoldiq mavjud rezervdan pastga tushirilmaydi. Admin navigatsiyasi Ventura `Sidebar`/`Topbar` komponentlari va Ventura CSS tokenlariga o'tkazildi. Shu panellarda demo fixture'lar olib tashlandi. Oddiy order va custom PC order tranzaksiyalari tasdiqda zaxira qiladi, bekor qilinganda zaxirani bo'shatadi, yetkazilganda stock/reservedni kamaytirib sale va sale item yozadi; stock movement ham qayd etiladi. Mahsulot qatorlari bir xil tartibda lock qilinadi, parallel buyurtmalardagi deadlock xavfi kamayadi. PC build create/edit va sotuv ham komponent zaxirasi, stock movement, sale va sale item'ni tranzaksiyada yuritadi. Sotuv/kirim/order/PC order mutatsiyalaridan keyin bog'liq admin dashboard, katalog va storefront route'lari qayta validatsiya qilinadi. Dashboard ko'rsatkichlari DB order, sale va katalog ma'lumotidan yig'iladi. Mahsulot variantlarini admin tahriri va checkout tanlovi alohida inventory lifecycle tayyor bo'lmagani uchun vaqtincha yashirilgan; mavjud variant yozuvlari bo'lsa ham ularning stock'i asosiy order oqimida ishlatilmaydi. Demo notification'lar olib tashlandi; haqiqiy bildirishnoma oqimi hali yo'q. Sotuv view'i ko'p itemli orderlarni jami tushum/tannarx/miqdor bilan ko'rsatadi; site/PC sale qaytarish tugmasi yo'q, chunki qaytarish oqimi yo'q. PC buyurtmasini tayyor buildga aylantirish workflow'i hali implement qilinmagan. Mahsulot description/warranty maydonlari uchun DB ustunlari yo'q. Sozlamadagi modul switch'lari ishlaydigan flag emasligi sabab o'chirilgan. Checkout summasini ko'rsatishda client estimate va server quote o'rtasidagi farq ham hal qilinishi kerak.

## Aniqlangan production bloklovchilar

Admin panel login yo'li alohida: admin user faqat `pnpm pc:admin:create` CLI orqali telefon/parol bilan yaratiladi; admin login UI Better Auth phone-number/password endpointidan foydalanadi, Google va email login tugmalari ko'rsatilmaydi. Better Auth phone plugin mavjud `users.phone`/`phone_verified` ustunlariga map qilingan. SMS/OTP login yoqilmagan. CLI real E.164 +998 raqamni tekshiradi.

### P0 — server amallarida autentifikatsiya va rol tekshiruvi yo'q

`apps/pc-crm/lib/server/actions.ts` dagi faqat `createOrderAction` va `getMyOrdersAction` sessiyani o'qiydi. `updateOrderStatusAction`, mahsulot/kirim/sotuv/PC buyurtmasi/sozlama o'zgarishlari va `toggleUserActiveAction` server tomonida admin rolini tekshirmaydi. `apps/pc-crm/app/admin/layout.tsx` faqat UI qobig'ini ko'rsatadi; ruxsat nazorati yo'q. Brauzer UI'da admin havolasini yashirish xavfsizlik chegarasi bo'la olmaydi. Bu ma'lumot o'g'irlanishi, narx/ombor o'zgarishi va buyurtmalarni soxtalashtirish xavfini tug'diradi.

**Kerakli yechim:** barcha server action va server data loaderlar uchun `requireUser` / `requireRole` kabi markaziy guard; admin sahifalarida server-side redirect/403; xaridor ma'lumotlarida egasiga bog'liq tekshiruv. Har bir mutatsiyada input Zod bilan serverda tekshirilsin. `isActive` bloklangan foydalanuvchi auth'dan va amallardan cheklansin.

### P0 — checkout summasi va katalog ma'lumoti mijozdan ishoniladi

`CreateOrderInput` (`apps/pc-crm/lib/server/orders.ts`) subtotal, shipping, discount, tax, total, mahsulot nomi, narxi va miqdorni brauzerdan qabul qiladi. `createOrderAction` qiymatlarni qayta hisoblamaydi va DB'dagi faol mahsulot/narx bilan solishtirmaydi. Istalgan mijoz narxni pasaytirib, mavjud bo'lmagan yoki arzonlashtirilgan mahsulotni buyurtma qilishi mumkin.

**Kerakli yechim:** klient faqat `productId/variantId/qty` va manzilni yuborsin. Server tranzaksiya ichida faol mahsulot, joriy narx/chegirma, mavjud qoldiq va sozlamalardan summalarni olsin; bir xil pul birliklari va yaxlitlash siyosatini qo'llasin.

### P0 — ombor va moliya yozuvlari tranzaksiyasiz va noto'g'ri vaqtda yoziladi

`createDbOrder` buyurtma, itemlar, stock kamayishi va sale yozuvini alohida so'rovlar bilan bajaradi; xato bo'lsa yarimta yozuv qolishi mumkin. Qoldiq yetarli bo'lmasa buyurtma baribir davom etadi. Hamma item'lardan keyin order status `new` bo'lib turganda stock allaqachon kamaytiriladi, `Sale` esa darhol yaratiladi; bu `PC-CRM.md`dagi “tasdiqda zaxira/chiqim, delivered bo'lganda Sale” qoidalariga mos emas. `updateDbOrderStatus` faqat statusni almashtiradi, ombor/sale lifecycle'ini boshqarmaydi. Sotuvni bekor qilishda, xaridni void qilishda, oflayn sotuvda ham tranzaksiya va zaxira tekshiruvi yo'q; `GREATEST(0, stock - qty)` xatoni yashirib, ombor tarixini noto'g'ri qiladi.

**Kerakli yechim:** yagona DB tranzaksiyalari va aniq state machine. `new → confirmed` da mavjudlikni atomik tekshirish/zaxiralash; `delivered` da sale va cost snapshot yaratish; cancellation/return'da idempotent teskari harakat; har bir delta uchun stock movement. Parallel xarid uchun `UPDATE ... WHERE stock - reserved >= qty` yoki row lock, `CHECK` constraint va qayta urinish siyosati. Katalog, zaxira, buyurtma, sale hammasi bitta izchil qoidaga amal qilsin.

### P0 — production secret va DB ulanish boshqaruvi xavfli

`apps/pc-crm/lib/auth.ts` productionda ham standart Better Auth secret'ga tushishi mumkin; `apps/pc-crm/lib/db.ts` esa DB URL bo'lmaganda lokal credential bilan fallback qiladi. `.env.example` ichida ham haqiqiyga o'xshash DB paroli va auth secret ko'rsatilgan. Productionda maxfiy qiymatlar majburiy bo'lishi, misollarda faqat placeholder turishi kerak. `getDb()` har chaqirilganda production pool yaratadi va yopmaydi; bu ulanishlar sonini ko'paytiradi. Bitta uzoq yashaydigan pool singleton yoki deploy runtime'iga mos lifecycle kerak.

**Kerakli yechim:** env schema (`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`) startup paytida tekshiriladi; productionda fallback yo'q, zaif/standart secret bilan startup to'xtaydi. `.env.example`ni placeholderlarga almashtirish; ilgari ishlatilgan haqiqiy kalit/parollarni rotate qilish. DB pool singleton, limit va shutdown hook.

### P1 — mijozga ko'rinadigan “muvaffaqiyat” DB xatosini yashiradi

`apps/pc-crm/app/checkout/page.tsx` server action xato qaytarsa yoki yiqilsa tasodifiy `ORD-####` ID chiqarib, savatni tozalab, buyurtma muvaffaqiyatli bo'lganini ko'rsatadi. Bazada buyurtma yo'q bo'lishi mumkin. Bu mijoz buyurtmasi yo'qolishiga olib keladi.

**Kerakli yechim:** faqat server qaytargan real public ID bilan muvaffaqiyat holati ko'rsatilsin. Xatoda savat saqlansin, qayta urinish va yordam xabari chiqsin. Ikki marta bosish uchun idempotency key qo'llansin.

### P1 — PC CRM sahifalari aralash demo/DB holatida

`apps/pc-crm/app/admin/page.tsx` statistikasi va ro'yxatlari statik. `admin/products`, `purchases`, `sales`, `orders`, `users`, `pcs` sahifalarida demo boshlang'ich ro'yxatlar bor; mutatsiyalarning bir qismi faqat React state'ni o'zgartiradi. Public `products/page.tsx` DB'dan ma'lumotni demo ro'yxatga qo'shib birlashtiradi, bazada natija bo'lmasa demo mahsulotlar qoladi. Demak admin o'zgartirgan qatorlar va storefront ko'rsatgan narsalar bir xil haqiqat manbaidan olinmaydi.

**Kerakli yechim:** demo seed faqat development/e2e profilida; production query'lari DB'dan server-side, demo fallback'siz. Admin sahifalarida haqiqiy ma'lumot, bo'sh/error holati, server mutatsiyasi va qayta yuklash; seed test hisoblarini productiondan chiqarib tashlash.

### P1 — valyuta/to'lov/til/dinamik sozlamalar ishlaydigan imkoniyat emas

Checkout `click` va `payme` tanlash imkonini beradi, lekin `docs/PC-CRM.md` operator orqali to'lovni hozirgi yo'l deb belgilagan; provider adapter/webhook implementatsiyasi ko'rinmadi. Savat shipping va free limitni koddagi konstanta bilan oladi (`lib/cart-context.tsx`) va hudud/sozlamaga bog'lanmaydi. Navbar'dagi til/valyuta faqat local UI state; valyuta narxlarni aylantirmaydi, sahifa tarjimalari ishlamaydi. Frontenddagi bu yorliqlar foydalanuvchiga mavjud bo'lmagan funksiyani va noto'g'ri final summani ko'rsatishi mumkin.

**Kerakli yechim:** birinchi release'da faqat operator to'lovini qoldirish yoki payment interface/webhook/idempotency to'liq implementatsiya va sinovdan o'tgach Click/Payme'ni yoqish. Server yetkazish narxini region va sozlamadan hisoblasin. Tugallanmagan til/valyuta tanlagichlarini olib tashlash/yashirish yoki to'liq ishlatish.

### P1 — demo auth va biznes qoidalaridagi qolgan bo'shliqlar

Better Auth email/parol va Google OAuth sozlangan, telefon OTP esa yo'q, garchi `PC-CRM.md`da telefon + OTP qarori bo'lsa. Minimal parol 6 belgi. `toggleDbUserActive` user'ni o'chiradi, lekin mavjud sessiyalarni bekor qilmaydi. `isActive` auth tekshiruviga bog'lanmagan. Public ID 4 xonali `Math.random()` (`orders.ts`) to'qnashishi mumkin; PC order raqami vaqtga/ro'yxat indeksiga bog'langan va qayta kirganda o'zgaradi (`pcs.ts`). PC konfiguratordagi `componentIds`ga rol va mahsulot mosligi/stock tekshiruvi yo'q.

**Kerakli yechim:** foydalaniladigan login turini mahsulot talabi bilan yakunlab, rate limit va ishonchli parol/OTP qoidalarini qo'shish; bloklashda sessiyalarni revoke qilish. DB unique sequence/UUID asosidagi o'zgarmas, mijozga ko'rsatiladigan ID. Konfigurator input'ini role enum, aktiv mahsulot va miqdor bo'yicha tekshirish.

### P2 — ombor/mahsulotlar modelidagi risklar

Variant jadvali bor ch гэсэн, lekin purchase/order/sale inventory code stock-ийг product-level байдлаар o'zgartiradi; variant zaxirasi hisobga olinmaydi. UI `available = stock - reserved` talab qilingan bo'lsa-da, bir necha joy `stock > 0` ni ishlatadi. Review uchun delivered orderItem va bir user-bitta sharh qoidasi DB/action qatlamida majbur qilinmagan; reviews/favorites/content jadvallari mavjudligi bu oqimlar ishlashini bildirmaydi. Xaridni void qilish qoldiq yetarli bo'lmasa 0 ga tushiradi, tannarxni eski qiymatga qaytarmaydi.

**Kerakli yechim:** variantni inventarning yagona hisob birligi sifatida belgilash (yoki variant inventory'sini chiqarilguncha o'chirish); reserved bilan query'larni birxillashtirish; stock movement va xarid/sotuv tuzatishlarini audit qilinadigan holda bajarish; sharhni order-item/status/user va unique constraint bilan tekshirish.

## Kodda hozir mavjud poydevor

- Ilova paketi, Next.js App Router, UI/config/auth/db/security/integrations/tenants ulanishlari.
- PC CRM feature manifesti (`apps/pc-crm/features.ts`), DB schema bo'limlari va birinchi migratsiya.
- Dedicated DB migratsiyasi (`packages/db/src/pc-crm-migrate.ts`) va klient tayyorlash (`pnpm pc:tenant`), demo ma'lumot seed'i (`pnpm pc:seed`).
- Vitest va Playwright konfiguratsiyasi hamda unit/E2E fayllari bor. Bu fayllarning mavjudligi release gate'lari o'tganini tasdiqlamaydi.
- Monorepo deploy qatlami (`packages/deploy`) bor, lekin PC CRM uchun end-to-end mijoz yaratish, deploy, migratsiya, backup/restore va rollback yo'lini ushbu audit tasdiqlamadi. `pc:tenant` o'zi PostgreSQL bazasini yaratmaydi; mavjud URLga migratsiya qo'llaydi.

## Ventura loyihasidagi tuzilish va ish qoidalari

1. `apps/*` — mustaqil ilovalar/shablonlar; `packages/*` — ular orasida takror ishlatiladigan kod. PC CRMning dedicated silo ekanligi sabab PC CRM jadvallarida `tenant_id`/RLS ishlatilmasligi sxema izohida qayd qilingan; har bir real mijozga alohida DB kerak.
2. `features.ts` — shablonning koddagi manifesti; `templates:sync` manifestni panel DB'siga olib boradi (`docs/decisions/0003`). Bo'lim manifestda bo'lishi route/action o'z-o'zidan himoyalanganini anglatmaydi.
3. DB schema va migratsiyalarni ilova ichida ad hoc yaratmasdan `packages/db`da tutish; provisioning va seed skriptlarini takror bajarishga xavfsiz qilish; production seed'e demo users/sales/orders ommaviy kiritmaslik.
4. Serverda tekshirilgan permission va input, tranzaksiya bilan biznes yozuvlari, audit trail, pul uchun bigint UZS snapshot va stock movement Ventura qoidalariga mos bo'lishi kerak.
5. Release paytida repo qoidalari bo'yicha o'rnatilgan turbo versiyasining o'z hujjatiga rioya qilish kerak (`AGENTS.md`). Next.js kodini o'zgartirishdan oldin `apps/pc-crm`dan resolve qilingan Next.js 16.4.3'ning local docs'ini o'qish kerak (`apps/pc-crm/AGENTS.md`). Ushbu auditda turbo yoki Next config o'zgartirilmadi.

## Gemini muallifligi haqida

`docs/decisions/0067-crm-landing-va-free-trial.md` Gemini muallifligini ko'rsatadi, ammo u Ventura EDU CRM landing va 7 kunlik trial haqida; PC CRM kodining tahlili emas. PC CRM uchun alohida Gemini audit hujjati repo qidiruvida topilmadi. Shu bois quyidagi kamchiliklar Gemini matniga nisbat berilmaydi — ular PC CRM kodini `docs/PC-CRM.md` talablari bilan tekshirish natijasidir.

## Productionga chiqarish rejasi

### 0. Release chegarasini tanlash

- Birinchi versiyani bitta pilot PC do'koni, alohida DB, operator orqali buyurtma va to'lov bilan cheklash.
- Click/Payme, ishlamaydigan tillar/valyuta, to'liq kontent CMS, sharh/notification oqimlari kabi tayyor bo'lmagan funksiyalarni yashirish yoki keyingi bosqichga qoldirish.
- Real kontaktlar, yetkazish tariflari, hududlar, QQS, qaytarish siyosati, operator aloqa manzili va pul/ombor qoidalarini biznes egasi bilan tasdiqlash.

### 1. Xavfsizlik va hisob-kitob poydevori (release blocker)

- Barcha action/data entrypoint'lariga server-side auth, role va ownership guard.
- Har bir action uchun Zod input schema va qiymat/range/enum cheklovlari.
- Checkout server-side narx, chegirma, shipping, tax va total hisoblash; stock reservation race-safe.
- Order, inventory, sale va void lifecycle'larini tranzaksiyaga o'tkazish; idempotency va audit log.
- Server muvaffaqiyatni faqat DB commit'dan keyin qaytarsin; checkout xatosida savatni saqlasin.
- Production env fail-fast, secret rotate, DB pool singleton/limiti va bloklangan user sessiyalarini revoke qilish.

### 2. Bitta ma'lumot manbai va real admin oqimlari

- Admin dashboard/katalog/kirim/sotuv/buyurtma/PC/user sahifalarini DB query va server actions'ga ulash.
- Demo `INITIAL_*` ma'lumotlarini production bundle oqimidan chiqarish; storefront demo merge/fallback'siz ishlasin.
- Mahsulot yaratish/tahrirlash: barcha kerakli i18n, brand/category, rasmlar, slug/SKU unique, stock va price validation.
- PC build: component reserve/release, snapshot cost, availability, sale transition, sold customer/timestamp.
- Server pagination, loading/empty/error state, revalidation, CSV va audit — release scope'da qaysi biri majbur ekanini aniqlashtirish.

### 3. DB, migratsiya, provisioning va tiklash

- DB constraints: manfiy bo'lmagan narx/qoldiq/miqdor, chegirma oralig'i, status enum, order public ID va kerakli unique/index'lar.
- PC migration'ni yangi bo'sh DB'da toza o'tkazish va takror deploy'da xavfsizligini tasdiqlash.
- `pc:tenant` provisioningni panel deploy bilan bog'lash (DB yaratish/credential saqlash/domain/seed/admin hisob/birinchi login), yoki boshqariladigan aniq ops runbook yozish.
- `pc:seed`ni demo-only deb belgilash; production bootstrap uchun real birinchi admin yaratish va demo fixture'dan ajratish.
- Backup, restore rehearsal, migratsiya oldi backup, expand/contract va oldingi app image'ga rollback tartibi.

### 4. Mijoz yo'lidagi qolgan xususiyatlar

- Operator to'lov oqimini order status/audit/Telegram notification bilan yakunlash. Click/Payme faqat alohida feature flag va verifikatsiyalangan webhook adapterdan so'ng.
- Regionga qarab shipping, real contact/settings, profil va order ownership.
- Authentication qarori: telefon OTP (spec'dagi) yoki email/parol/Google — bitta aniq release talabi; SMS provider, rate limit, account lock va recovery.
- Valyuta/tillarni amalga oshirish yoki UI'dan olib tashlash; review/favorite/notification'ni DB'dan real ulash yoki vaqtincha yashirish.
- Rasm yuklash uchun tasdiqlangan storage, MIME/size tekshiruvi va zaxira nusxa; tashqi demo image'larni production katalogi sifatida ishlatmaslik.

### 5. Release gate va pilot chiqarish

- Unit: formula/chegirma/tax/shipping, stock race, reservation/release, purchase void, sale return, order state transitions, idempotency, role/ownership.
- DB integratsiya: migratsiya bo'sh bazaga, constraints, transactional rollback, concurrency va seed takror ishlashi.
- E2E: admin login va deny; mahsulot/kirim; xaridor savati-checkout; buyurtmani tasdiqlash/deliver/cancel; PC build va konfigurator; stock va sotuv reconciliation.
- CI gate: repo'dagi install qilingan turbo hujjatiga muvofiq lint, typecheck, unit, app build va kerakli E2E. Muvaffaqiyatsiz job bilan release yo'q.
- Deploydan oldin staging DB snapshot; HTTPS/cookie, domain, env, backup, health check, log/alert va rollback rehearsal.
- Avval pilot do'konda chiqarish; real buyurtma va kun yakuni bo'yicha DB order, stock movement, sale total va foydani qo'lda solishtirish; keyin boshqa mijozlarga tarqatish.

## Chiqarish mezonlari

PC CRM productionga tayyor deb belgilanmasin, toki:

- admin endpointlarning barchasi auth/role bilan yopilgan va unauthorized mutatsiyalar rad etilgan;
- buyurtma summasi server tomonidan hisoblanadi, qoldiq manfiy bo'lmaydi va parallel buyurtmada oversell yo'q;
- order, sale, inventory va return lifecycle'lari bitta aniq biznes qoidasiga mos, tranzaksiyali va takror yuborishga chidamli;
- mijozga soxta muvaffaqiyat ko'rsatilmaydi, demo data productionda chiqmaydi;
- bo'sh mijoz DB'sini provision, migrate, admin bilan ochish, backup'dan tiklash va oldingi versiyaga qaytish amalda bajarilgan;
- yuqoridagi test/release gate'lar CI/staging'da o'tgan va biznes egasi haqiqiy savdo qiymatlarini tasdiqlagan.

## Eslatma: joriy workspace holati

Audit vaqtida `apps/pc-crm/components/storefront/navbar.tsx` faylida oldindan mavjud unstaged diff bor edi (sevimlilar tugmasi olib tashlangan). Unga tegilmadi. `.env.local` va root `.env` maxfiy qiymatlar bo'lishi mumkinligi sababli hisobotga kiritilmadi.
