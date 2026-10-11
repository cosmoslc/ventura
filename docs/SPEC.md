# Ventura.uz boshqaruv tizimi — Texnik topshiriq

Oct 10, 2026 · @Saidakbar Saidov

## 1. Maqsad va umumiy ko'rinish

Ventura.uz boshqaruv tizimi — bitta joydan mijozlar uchun tayyor tizimlarni (o'quv markaz CRM, pilorama va boshqalar) yaratadigan, moslaydigan, serverga chiqaradigan va to'liq nazorat qiladigan ichki platforma.

Panel quyidagilarni qila olishi kerak:

- Shablondan yangi mijoz loyihasini yaratish (klonlash).
- Loyihani 3 xil joyga chiqarish: **GitHub + Vercel**, **online VPS** (IP, port, SSH), **lokal VPS** (uydagi kompyuter, internetga chiqarilgan).
- Har loyihaga cheksiz domen ulash, SSL avtomatik.
- Har mijozga moslash: brend (rang, logo, nom), bo'limlarni yoqish/o'chirish, sozlamalar.
- To'liq nazorat: kim, qachon push qildi, qaysi build o'tdi yoki yiqildi, kim serverga kirdi.
- Kiberxavfsizlik: 2FA, shifrlangan kalitlar, o'chirib bo'lmaydigan audit jurnali, Telegram ogohlantirishlar.

**Foydalanuvchilar:** Saidakbar (super admin), keyinchalik jamoa adminlari. Panel manzili: admin.ventura.uz. Mijozlar panelga kirmaydi — ular faqat o'z tizimiga (masalan `bilim.ventura.uz`) kiradi.

**Bu hujjatga kirmaydi:** shablonlarning ichki funksiyalari (CRM'dagi davomat, moliya va h.k.). Ular har bir shablonning o'z hujjatida yoziladi.

## 2. Texnologiyalar stacki

Hamma loyihalar (panel va barcha shablonlar) bitta stackda yoziladi. Bu qaror o'zgarmaydi.

| Qatlam | Tanlov | Sabab |
| --- | --- | --- |
| Til | TypeScript (strict) | Xatolar yozish paytida ushlanadi |
| Framework | Next.js (App Router) | React + server + API bitta joyda |
| Dizayn | Tailwind CSS + shadcn/ui | Umumiy komponentlar, light/dark |
| Baza | PostgreSQL | Ishonchli, bepul, VPS'da ishlaydi |
| ORM | Drizzle (+ drizzle-kit migratsiyalar) | SQL'ga yaqin, yengil |
| Login | Better Auth (+ 2FA plagini) | Bepul, o'z bazamizda saqlanadi |
| Monorepo | Turborepo + pnpm | Umumiy kod, tez build |
| Fon vazifalari | pg-boss (PostgreSQL navbati) | Deploy, tekshiruv, zahira — so'rovdan tashqarida; Redis shart emas |
| Validatsiya | Zod | Har bir kirish ma'lumotini tekshirish |
| VPS deploy | O'z SSH drayverimiz (`ssh2`): git, pnpm build, PM2, nginx, certbot | To'liq nazorat, har qadam bizning logda |
| Uydagi server | Cloudflare Tunnel (yoki statik IP + port yo'naltirish) | Uydagi kompyuterni xavfsiz internetga chiqarish |
| Bulut deploy | Vercel REST API | Avto loyiha, env, domen |
| Kod | GitHub App | Avto repo, webhooklar, qisqa muddatli tokenlar |
| Ogohlantirish | Telegram Bot API | Tezkor xabarlar |
| Testlar | Vitest + Playwright | Mantiq va sahifalar testi |

**Panelning o'zi Vercel'da emas, VPS'da ishlaydi.** Sabab: unga uzoq davom etadigan fon vazifalari, SSH va server bilan doimiy aloqa kerak.

## 3. Monorepo tuzilishi

Bitta GitHub repo (`ventura`), ichida panel, shablonlar va umumiy paketlar. Har bir ilova alohida deploy qilinadi.

```
ventura/
├── apps/
│   ├── panel/           boshqaruv paneli (Next.js) — admin.ventura.uz
│   ├── edu-crm/         o'quv markaz tizimi — 1-shablon
│   └── sawmill/         pilorama tizimi — 2-shablon (keyinroq)
├── packages/
│   ├── ui/              shadcn komponentlar, tema, brend ranglar
│   ├── db/              Drizzle sxemalar: panel/ va tenant/ alohida
│   ├── auth/            Better Auth sozlamasi, rollar, 2FA
│   ├── tenants/         tenant konfiguratsiyasi, bo'limlar, sozlamalar
│   ├── deploy/          deploy drayverlari: vercel, ssh
│   ├── integrations/    GitHub, Vercel, Cloudflare, Telegram API klientlari
│   ├── security/        shifrlash, audit yozuvi, xesh zanjiri
│   ├── jobs/            pg-boss vazifalari (deploy, tekshiruv, zahira, migratsiya)
│   └── config/          tsconfig, eslint, tailwind preset
├── tooling/
│   └── scripts/         shablon eksporti (turbo prune), seed, server tayyorlash
├── docs/
│   ├── SPEC.md          shu hujjat
│   └── decisions/       qarorlar jurnali (ADR)
├── CLAUDE.md            Claude Code uchun qisqa qoidalar
├── turbo.json
└── pnpm-workspace.yaml
```

**Qoidalar:**

- `apps/*` bir-birini import qilmaydi. Umumiy narsa faqat `packages/*` orqali ulashiladi.
- Har shablon (`edu-crm`, `sawmill`) o'z `features.ts` manifestiga ega (8-bo'lim).
- Shablonni alohida repo qilib klonlash kerak bo'lsa, `turbo prune edu-crm` orqali faqat shu ilova va uning paketlari ajratib olinadi.

## 4. Asosiy tushunchalar

Kod va interfeysda shu nomlar bir xil ishlatiladi.

| Tushuncha | Kodda | Ma'nosi |
| --- | --- | --- |
| Shablon | `Template` | Klonlanadigan tizim turi: `edu-crm`, `sawmill` |
| Loyiha (mijoz tizimi) | `Project` / `Tenant` | Bitta mijozning tizimi: `bilim.ventura.uz` |
| Deploy rejimi | `DeployMode` | Loyiha qanday ishlashi: `shared`, `dedicated`, `fork` |
| Deploy manzili | `Target` | Qayerda ishlashi: `vercel`, `vps-online`, `vps-local` |
| Server | `Server` | Panelga ulangan VPS (IP, port, SSH) |
| Domen | `Domain` | Loyihaga ulangan manzil, cheksiz soni |
| Bo'lim | `Feature` | Yoqib/o'chiriladigan funksiya: `attendance`, `coins` |
| Sozlama | `Setting` | Mijoz o'zgartira oladigan qiymat: to'lov kuni va h.k. |
| Deployment | `Deployment` | Bitta build va ishga tushirish urinishi |
| Audit hodisa | `AuditEvent` | Kim, qachon, nima qilgani haqida o'chmas yozuv |

### Deploy rejimlari

| Rejim | Qanday ishlaydi | Qachon |
| --- | --- | --- |
| `shared` (standart) | Bitta ilova, ko'p mijoz. Mijoz domeniga qarab o'z sozlamasini va bazasini oladi | Ko'pchilik mijozlar |
| `dedicated` | Kod umumiy repodan, lekin mijozga alohida deploy | Katta mijoz, alohida server so'rasa |
| `fork` | Mijozga alohida GitHub repo klonlanadi, o'z deploy bilan | Juda katta moslash kerak bo'lsa (qimmat, kam ishlatiladi) |

`shared` rejimda xato bir marta tuzatiladi va hamma mijozga tushadi. `fork` rejimda har bir repo alohida yangilanadi, shuning uchun panel "shablondan N ta commit orqada" deb ko'rsatadi va bir tugma bilan yangilash PR'ini ochadi.

### Baza strategiyasi

Har loyiha yaratilayotganda baza qanday saqlanishi tanlanadi. Barcha variantlar qo'llab-quvvatlanadi; deploy rejimidan mustaqil.

| Strategiya | Kodda | Qanday | Qachon |
| --- | --- | --- | --- |
| Umumiy baza | `shared_db` | Hamma mijoz bitta bazada, har jadvalda `tenant_id` + PostgreSQL RLS | Kichik mijozlar, eng arzon |
| Alohida baza (standart) | `db_per_tenant` | Bitta PostgreSQL server ichida har mijozga o'z bazasi (`db_bilim`) | Ko'pchilik mijozlar: to'liq ajratilgan, alohida zahira va tiklash |
| Alohida server | `dedicated_server` | Mijozga o'z PostgreSQL serveri | Katta mijoz yoki qonun talabi bo'lsa |

**Qoidalar:**

- Shablon kodi har uchala strategiyada bir xil ishlaydi: ulanish `getTenantDb(tenant)` orqali olinadi, ichida strategiyaga qarab to'g'ri baza qaytariladi.
- Migratsiyalar panel fon vazifasi orqali barcha mijoz bazalarida ketma-ket ishga tushiriladi; panel har bazaning sxema versiyasini ko'rsatadi, xato bo'lsa to'xtaydi.
- Ko'p ulanish uchun PgBouncer ishlatiladi.
- Mijozni bir strategiyadan boshqasiga ko'chirish (masalan umumiydan alohida bazaga) panel orqali: eksport → yangi baza → import → tekshiruv → almashtirish.

## 5. Panel sahifalari

Chap tomonda sidebar, o'ngda kontent. Interfeys tili o'zbekcha, light/dark/tizim rejimi.

| Sahifa | Manzil | Nima bor |
| --- | --- | --- |
| Bosh sahifa | `/` | Faol loyihalar soni, oxirgi deploylar, yiqilgan buildlar, ogohlantirishlar |
| Loyihalar | `/projects` | Kartochkalar: nom, domen, holat, rejim, manzil, yoqilgan bo'limlar soni |
| Yangi loyiha | `/projects/new` | Qadamli forma (pastda) |
| Loyiha sahifasi | `/projects/[id]` | Tablar: Umumiy · Brend · Bo'limlar · Sozlamalar · Domenlar · Deploylar · Muhit o'zgaruvchilari · Baza · Zahira · Audit |
| Shablonlar | `/templates` | Shablonlar ro'yxati, versiyasi, bo'limlar manifesti |
| Bo'limlar xaritasi | `/features` | Har bo'lim nimani talab qiladi va unga kim tayanadi, API yo'llari |
| Serverlar | `/servers` | VPS ro'yxati: CPU, RAM, disk, holat, loyihalar soni; VPS qo'shish |
| Mijozlar | `/clients` | Mijozlar, ularning loyihalari, obuna holati (sinov, faol, to'xtatilgan) |
| Audit jurnali | `/audit` | Barcha hodisalar, filtr: kim, loyiha, turi, sana |
| Ogohlantirishlar | `/alerts` | Qoidalar va yuborilgan xabarlar tarixi |
| Integratsiyalar | `/settings/integrations` | GitHub App, Vercel, Cloudflare, Telegram ulanishi |
| Xavfsizlik | `/settings/security` | 2FA, sessiyalar, adminlar va rollar |
| Xavfli hudud | `/settings/danger` | Qaytarib bo'lmaydigan amallar, qayta tasdiq bilan |

### Baza tabi

Loyiha bazasini panel ichidan ko'rish va tahrirlash (Supabase'dagi Table Editor'ga o'xshash).

- **Ulanish ma'lumoti:** server, baza nomi, foydalanuvchi, baza strategiyasi, sxema versiyasi. Parol ko'rsatilmaydi.
- **Jadvallar:** ro'yxat, ustunlar va turlari, qatorlarni sahifalab ko'rish, qidirish va saralash.
- **Tahrirlash:** qator qo'shish, o'zgartirish, o'chirish. Har o'zgarish oldin tasdiqlanadi va audit jurnaliga eski va yangi qiymat bilan yoziladi.
- **SQL oynasi yo'q.** Qo'lda so'rov kerak bo'lsa, u serverda bajariladi.
- Cheklovlar 11-bo'limda.

### Yangi loyiha formasi

1. **Shablon:** o'quv markaz, pilorama va h.k.
2. **Nom va domen:** loyiha nomi va `slug`. Domen tanlanadi: **bepul subdomen** (`<slug>.ventura.uz`) yoki **mijozning o'z domeni** (`crm.bilim.uz`). O'z domeni tanlansa, yaratilgandan keyin DNS uchun IP va yozuvlar ko'rsatiladi.
3. **Brend:** asosiy rang (tayyor palitralar + o'z rangi), logo, light/dark ko'rinishi. O'ng tomonda jonli ko'rinish (preview).
4. **Ega hisobi:** login va parol (generatsiya tugmasi).
5. **Bo'limlar:** guruhlangan ro'yxat, qidiruv, bog'liqlar avtomatik yoqiladi/o'chadi.
6. **Rejim, manzil va baza:** `shared` / `dedicated` / `fork`; Vercel / online VPS / uydagi server; baza strategiyasi (umumiy / alohida baza / alohida server).
7. **Integratsiyalar:** Telegram bot tokeni (ixtiyoriy), alohida GitHub repo (faqat `fork`).
8. **Ko'rib chiqish → "Yaratish va ishga tushirish".** Keyin har qadam jonli ko'rsatiladi: repo → baza → env → build → domen → SSL → tekshiruv.

## 6. Deploy usullari

Uchala usul bitta umumiy interfeys orqali ishlaydi, panel qaysi drayver ekanini bilmasdan ishlaydi. Har deploy fon vazifasi (pg-boss) sifatida bajariladi, so'rov ichida emas.

```ts
interface DeployDriver {
  kind: 'vercel' | 'ssh';
  createApp(input: CreateAppInput): Promise<AppRef>;
  setEnv(app: AppRef, vars: EnvVar[]): Promise<void>;
  deploy(app: AppRef, opts?: { commitSha?: string }): Promise<DeploymentRef>;
  getStatus(dep: DeploymentRef): Promise<DeploymentStatus>;
  streamLogs(dep: DeploymentRef): AsyncIterable<string>;
  rollback(app: AppRef, toDeployment: DeploymentRef): Promise<void>;
  addDomain(app: AppRef, hostname: string): Promise<DomainStatus>;
  removeDomain(app: AppRef, hostname: string): Promise<void>;
  stop(app: AppRef): Promise<void>;
  start(app: AppRef): Promise<void>;
  destroy(app: AppRef): Promise<void>;
}
```

### ① GitHub + Vercel

1. GitHub App Ventura GitHub hisobiga o'rnatiladi (faqat kerakli repolarga ruxsat).
2. `fork` rejimda: shablon reposidan yangi yopiq repo yaratiladi (GitHub API `generate`).
3. Vercel API orqali loyiha yaratiladi: repo ulanadi, `rootDirectory` = `apps/edu-crm`, framework = Next.js.
4. Muhit o'zgaruvchilari yoziladi (baza manzili, tenant kaliti, brend).
5. Domenlar qo'shiladi, Vercel SSL'ni o'zi beradi.
6. Har `git push` avtomatik deploy beradi; holat Vercel webhook orqali panelga keladi.

Eslatma: tijorat uchun Vercel Pro tarifi kerak. Shaxsiy ma'lumotlar uchun Vercel faqat qonun talabi aniqlashtirilgandan keyin ishlatiladi (11-bo'lim).

### ② Online VPS (IP, port, SSH)

1. "VPS qo'shish": nom, IP/domen, SSH port, foydalanuvchi, SSH kalit (shifrlanib saqlanadi), sig'im. Standart: O'zbekistondagi provayder.
2. Panel SSH orqali ulanishni tekshiradi va serverni tayyorlaydi (bir martalik skript): `deploy` foydalanuvchi, Node.js, pnpm, PM2, nginx, certbot, PostgreSQL, PgBouncer, firewall, fail2ban.
3. Server holati tekshiriladi: CPU, RAM, disk, o'rnatilgan dasturlar (✓ belgilari bilan).
4. Loyiha SSH drayveri orqali chiqariladi (pastdagi qadamlar).
5. Domen va SSL: nginx konfiguratsiyasi + certbot (Let's Encrypt).

### ③ Uydagi server (lokal)

Uydagi kompyuter server sifatida ishlaydi va internetga chiqariladi; panelning o'zi ham shu yerda turishi mumkin. Keyinchalik shu kompyuterga VPS dasturlari o'rnatilib, mijozlarga tarqatish uchun ishlatiladi. Panel bu serverda SSH'siz, to'g'ridan-to'g'ri buyruq bajaradi; qolgan qadamlar ② bilan bir xil.

**Internetga chiqarish:** uy internetida odatda statik IP yo'q va portlar yopiq bo'ladi. Shuning uchun standart yo'l — **Cloudflare Tunnel**: kompyuterdan tashqariga shifrlangan tunnel ochiladi, router'da port ochish shart emas, uy IP'si ko'rinmaydi. Muqobil: provayderdan statik IP olib, 80/443 portlarni yo'naltirish.

**Uydagi server xavflari:** elektr yoki internet uzilsa, mijoz saytlari ham to'xtaydi. Shuning uchun UPS (uzluksiz quvvat manbai) tavsiya qilinadi, zahira albatta boshqa joyda saqlanadi, va muhim mijozlar O'zbekistondagi online VPS'ga o'tkaziladi.

### Deploy holatlari

`queued` → `building` → `deploying` → `ready` yoki `failed` / `canceled`. Har o'tish audit jurnaliga yoziladi. `failed` bo'lsa, Telegram'ga xabar ketadi va oxirgi ishlagan versiya joyida qoladi.

### SSH drayveri: bitta deploy qadamlari

1. Yangi reliz papkasi: `/home/deploy/apps/<slug>/releases/<sana-commit>`.
2. `git clone` (GitHub App tokeni bilan) va kerakli commit'ga o'tish.
3. `.env` yozish (sirlar paneldan, faqat server ichida).
4. `pnpm install --frozen-lockfile` va `pnpm turbo build --filter=<shablon>`.
5. Baza migratsiyasi (tanlangan baza strategiyasiga qarab).
6. `current` havolasini yangi relizga almashtirish va `pm2 reload` (to'xtamasdan).
7. Health check: sayt javob bermasa, avtomatik oldingi relizga qaytish (rollback).
8. nginx konfiguratsiyasi va certbot (yangi domen bo'lsa).
9. Eski relizlardan oxirgi 5 tasi qoldiriladi.

Har buyruq va uning natijasi deploy logiga yoziladi va panelda jonli ko'rinadi. Drayver faqat oldindan belgilangan buyruqlarni bajaradi; foydalanuvchi kiritgan matn buyruqqa qo'shilmaydi.

## 7. Domenlar va SSL

Har loyihaga avtomatik subdomen beriladi va istalgancha o'z domeni ulanadi.

**Bepul subdomen:** `<slug>.ventura.uz` (masalan `bilim.ventura.uz`). `*.ventura.uz` wildcard DNS yozuvi serverga (yoki Cloudflare Tunnel'ga) yo'naltirilgan, shuning uchun yangi subdomen darhol ishlaydi.

**Mijozning o'z domeni:**

1. Domen mijoz uchun qo'lda sotib olinadi (`.uz` registrator orqali). Panel domen sotib olmaydi.
2. Loyiha yaratilayotganda yoki keyin "Domenlar" tabida domen kiritiladi (`crm.bilim.uz`).
3. Panel DNS ko'rsatmasini beradi: VPS uchun **A yozuvi** (server IP), Vercel yoki Cloudflare Tunnel uchun **CNAME**.
4. Yozuv DNS provayderda qo'shiladi.
5. Panel DNS'ni tekshiradi; to'g'ri bo'lsa, domen ulanadi va SSL avtomatik chiqariladi.

| Holat | Ma'nosi |
| --- | --- |
| `pending_dns` | DNS yozuvi hali to'g'ri emas |
| `verified` | DNS to'g'ri, ulanmoqda |
| `ssl_issuing` | Sertifikat chiqarilmoqda |
| `active` | Ishlayapti |
| `error` | Xato, sababi ko'rsatiladi |

**Qoidalar:**

- Domenlar soni cheklanmaydi; bittasi `asosiy` deb belgilanadi, qolganlari unga yo'naltiriladi (`www` → asosiy).
- Har 15 daqiqada DNS va SSL tekshiriladi.
- SSL tugashiga 14 kun qolsa yoki domen ishlamay qolsa, Telegram'ga xabar ketadi.

## 8. Moslash: brend, bo'limlar, sozlamalar

Har mijoz boshqacha bo'lishi mumkin, lekin kod bitta qoladi. Farqlar faqat bazadagi konfiguratsiya orqali beriladi.

| Daraja | Nima | Qayerda saqlanadi |
| --- | --- | --- |
| Brend | Nom, logo, favicon, asosiy rang, qo'shimcha ranglar (fon, dark) | `projects.brand` (jsonb) |
| Bo'limlar | Qaysi funksiya yoqilgan | `project_features` |
| Sozlamalar | Mijoz o'zgartiradigan qiymatlar (to'lov kuni, valyuta va h.k.) | `projects.settings` (jsonb, Zod sxema bilan) |
| Maxsus buyurtma | Faqat bitta mijozga kerak funksiya | Baribir bo'lim sifatida yoziladi, boshqalarda o'chiq |

### Brend

- Bitta asosiy rangdan light va dark uchun to'liq rang shkalasi avtomatik hosil qilinadi (CSS o'zgaruvchilar).
- Kontrast tekshiriladi: matn o'qilmaydigan rang tanlansa, ogohlantirish chiqadi.
- O'zgarish deploysiz qo'llanadi.

### Bo'limlar (feature flags)

Har shablonda `features.ts` manifesti bo'ladi:

```ts
export const features = [
  {
    key: 'attendance',
    name: 'Davomat',
    group: 'Davomat',
    type: 'regular',           // 'permanent' | 'core' | 'mode' | 'regular'
    requires: ['groups', 'holidays'],
    routes: ['/api/attendance', '/api/attendance-settings'],
    nav: [{ label: 'Davomat', href: '/attendance' }],
  },
] satisfies FeatureManifest;
```

| Tur | Ma'nosi |
| --- | --- |
| `permanent` (Doimiy) | Hech qachon o'chmaydi |
| `core` (O'zak) | O'chirsa bo'ladi, lekin tizimning katta qismi ishlamaydi; qo'shimcha tasdiq kerak |
| `mode` (Rejim) | O'chirgich emas, loyiha sozlamasi boshqaradi (masalan ko'p filialli rejim) |
| `regular` (Oddiy) | Istalgan vaqt yoqiladi/o'chiriladi |

**Qoidalar:**

- Bo'lim yoqilsa, u talab qiladigan bo'limlar ham avtomatik yoqiladi. O'chirilsa, unga tayanadiganlar ham o'chadi (avval ro'yxat ko'rsatiladi).
- O'chirilgan bo'lim: menyuda ko'rinmaydi, API yo'llari 404 qaytaradi, **ma'lumotlari o'chirilmaydi** (qayta yoqilsa, hammasi joyida).
- Kodda tekshirish faqat shunday: `if (await hasFeature(tenant, 'coins'))`.
- **Taqiqlangan:** `if (tenant.slug === 'butcher')` kabi mijoz nomiga qarab yozilgan kod.

### Konfiguratsiya ilovaga qanday yetadi

- `shared` rejim: ilova so'rovdagi domen bo'yicha tenant'ni topadi, konfiguratsiyani bazadan o'qiydi va qisqa muddat keshlaydi.
- `dedicated` va `fork` rejim: ilova paneldan imzolangan so'rov bilan konfiguratsiyani oladi (`GET /api/tenant-config`); panel o'zgarishdan keyin ilovaga webhook yuborib, keshni yangilatadi.
- Ikkala holatda ham brend va bo'lim o'zgarishi deploysiz qo'llanadi.

## 9. Baza sxemasi (panel bazasi)

Panel o'z alohida PostgreSQL bazasiga ega. Barcha jadvallarda `id` (uuid), `created_at`, `updated_at` bor; bu yerda faqat asosiy maydonlar ko'rsatilgan.

| Jadval | Asosiy maydonlar | Izoh |
| --- | --- | --- |
| `users` | phone\_number, name, role (`super_admin` / `admin` / `viewer`), two\_factor\_enabled | Panel adminlari (Better Auth jadvallari bilan) |
| `clients` | name, phone, company, status | Mijozlar |
| `templates` | key, name, category, repo, app\_path, version, manifest (jsonb) | Shablonlar va bo'limlar manifesti |
| `projects` | client\_id, template\_id, slug, name, mode, target\_id, db\_strategy (`shared_db` / `db_per_tenant` / `dedicated_server`), status, brand (jsonb), settings (jsonb) | Mijoz loyihalari |
| `project_features` | project\_id, feature\_key, enabled, updated\_by | Yoqilgan bo'limlar |
| `servers` | name, host, ssh\_port, ssh\_user, kind (`home` / `online`), provider, tunnel\_id, ssh\_key\_secret\_id, deploy\_root, capacity, status, last\_seen\_at | Serverlar (uydagi va online) |
| `db_servers` | server\_id, host, port, admin\_secret\_id, pgbouncer\_port | PostgreSQL serverlari |
| `tenant_databases` | project\_id, db\_server\_id, db\_name, db\_user, password\_secret\_id, schema\_version, last\_migrated\_at | Har loyiha bazasi va uning migratsiya versiyasi |
| `targets` | type (`vercel` / `ssh`), server\_id, vercel\_team\_id | Deploy manzillari |
| `repos` | project\_id, owner, name, private, default\_branch, template\_version | Faqat `fork` rejim uchun |
| `deployments` | project\_id, provider, release\_path, commit\_sha, branch, triggered\_by, status, started\_at, finished\_at, rolled\_back\_from | Har build |
| `deployment_steps` | deployment\_id, step, command, exit\_code, output, started\_at, finished\_at | SSH drayveri bajargan har buyruq |
| `domains` | project\_id, hostname, kind (`subdomain` / `custom`), is\_primary, status, ssl\_expires\_at, last\_checked\_at | Domenlar |
| `env_vars` | project\_id, key, value yoki secret\_id, is\_secret | Muhit o'zgaruvchilari |
| `secrets` | owner\_type, owner\_id, name, ciphertext, iv, auth\_tag, key\_version | Shifrlangan kalitlar; hech qachon brauzerga qaytarilmaydi |
| `subscriptions` | project\_id, plan, status (`trial` / `active` / `suspended`), trial\_ends\_at, paid\_until | Obuna (hozircha qo'lda belgilanadi) |
| `backups` | project\_id, kind (`db` / `files`), location, size\_bytes, status, verified\_at | Zahiralar |
| `audit_events` | at, actor\_type, actor\_id, action, target\_type, target\_id, ip, user\_agent, metadata (jsonb), prev\_hash, hash | O'chmas audit jurnali |
| `alert_rules`, `alerts` | rule, channel, threshold; rule\_id, project\_id, message, sent\_at | Ogohlantirishlar |

**Shablon bazalari (masalan edu-crm):** baza strategiyasi 4-bo'limda. `shared_db`da har jadvalda `tenant_id` va RLS bo'ladi; `db_per_tenant` va `dedicated_server`da har loyihaning o'z bazasi va o'z baza foydalanuvchisi bo'ladi. Shablon sxemasi uchala holatda bir xil, `tenant_id` ustuni doim bor (bitta qiymat bilan bo'lsa ham), shunda loyihani strategiyalar orasida ko'chirish oson.

## 10. Audit va monitoring

Panel, GitHub, Vercel va serverlarda bo'lgan har bir muhim hodisa bitta audit jurnalida ko'rinadi.

| Hodisa | Manba | Telegram xabari |
| --- | --- | --- |
| Panelda har qanday o'zgarish (loyiha, bo'lim, domen, env, server) | Panel | Faqat xavfli amallar |
| Panelga kirish, 2FA xatosi, yangi qurilmadan kirish | Panel | Ha |
| `push`, yangi branch, PR, `main`ga to'g'ridan-to'g'ri push | GitHub webhook | `main`ga panel tashqarisidan push bo'lsa — ha |
| Repo ochiq (public) qilindi, yangi a'zo yoki deploy kalit qo'shildi | GitHub webhook | Ha |
| Build boshlandi / tugadi / yiqildi | Vercel webhook, SSH drayveri | Yiqilsa — ha |
| Serverga SSH orqali kirish (kim, qaysi IP) | Server auth logi | Notanish IP bo'lsa — ha |
| Sayt ishlamay qoldi (2 daqiqadan ko'p) | Uptime tekshiruv (har daqiqa) | Ha |
| Disk 85% dan, RAM 90% dan oshdi | Server metrikalari | Ha |
| SSL tugashiga 14 kun qoldi | Domen tekshiruvi | Ha |
| Zahira olinmadi yoki tekshiruvdan o'tmadi | Zahira vazifasi | Ha |

**Audit jurnali qoidalari:**

- Har bir o'zgartiruvchi amal `audit.record()` chaqiradi: kim, qachon, nima, qaysi obyekt, IP, oldingi va keyingi qiymat.
- Jurnalni o'zgartirib bo'lmaydi: ilova baza foydalanuvchisida `audit_events` uchun `UPDATE` va `DELETE` huquqi yo'q.
- Har yozuv oldingisining xeshini saqlaydi (xesh zanjiri). Kimdir bazaga qo'lda aralashsa, zanjir buziladi va panel buni ko'rsatadi.
- Webhooklar imzo bilan tekshiriladi (GitHub `X-Hub-Signature-256`, Vercel imzosi); imzosizlari rad etiladi.
- Saqlash muddati: kamida 1 yil.

**Audit sahifasi:** filtr (kim, loyiha, hodisa turi, sana), har yozuvni ochib tafsilotini ko'rish, CSV eksport.

## 11. Kiberxavfsizlik talablari

Panel barcha serverlar va repolarning kalitlarini saqlaydi, shuning uchun u eng himoyalangan qism bo'lishi shart.

### Panelga kirish

- Kirish telefon raqam va parol bilan. Barcha adminlar uchun 2FA majburiy: har kirishda Telegram bot 6 xonali kod yuboradi; 2FA'siz panelga kirib bo'lmaydi (`docs/decisions/0001-panelga-kirish.md`).
- Rollar: `super_admin` (hammasi), `admin` (loyihalar, deploy), `viewer` (faqat ko'rish).
- Xavfli amallar (loyiha o'chirish, bazani tozalash, sirni ko'rsatish, serverni o'chirish) uchun parol + 2FA qayta so'raladi va nomini yozib tasdiqlash kerak.
- Login sahifasida urinishlar soni cheklanadi; 5 ta xatodan keyin hisob bloklanadi va uni super admin ochadi.
- Panel alohida domenda ishlaydi; ixtiyoriy ravishda faqat ruxsat berilgan IP'lardan kirish.

### Sirlar (kalitlar, tokenlar, parollar)

- AES-256-GCM bilan shifrlanadi. Asosiy kalit bazada emas, serverdagi alohida, ruxsatlari cheklangan faylda saqlanadi.
- Kalit versiyasi saqlanadi, kalitni almashtirish (rotatsiya) mumkin.
- Saqlangandan keyin sir brauzerga hech qachon qaytarilmaydi, logga yozilmaydi.
- `.env` fayllar hech qachon repoga tushmaydi; repoda faqat `.env.example`.

### GitHub

- Shaxsiy token emas, **GitHub App** ishlatiladi: faqat kerakli repolarga, qisqa muddatli tokenlar bilan.
- `main` branch himoyalangan: to'g'ridan-to'g'ri push taqiqlangan, faqat PR orqali.
- GitHub'ning sir skanerlash va push himoyasi yoqilgan.
- Kutubxonalar zaifligi: Dependabot yoki Renovate, CI'da `pnpm audit`.

### Serverlar

- SSH faqat kalit bilan; parol bilan kirish va `root` kirishi o'chirilgan.
- Ish uchun alohida `deploy` foydalanuvchi, cheklangan huquqlar bilan.
- Har server uchun alohida SSH kalit.
- Firewall: faqat 22, 80, 443 portlar ochiq; uydagi serverda tashqi port umuman ochilmaydi (Cloudflare Tunnel).
- fail2ban va avtomatik xavfsizlik yangilanishlari yoqilgan.

### Ilova

- Har bir kirish ma'lumoti Zod bilan tekshiriladi.
- Xavfsizlik sarlavhalari: CSP, HSTS, `X-Frame-Options`.
- `shared` rejimda mijozlar ma'lumoti RLS bilan ajratilgan; `dedicated` rejimda alohida baza va foydalanuvchi.
- O'chirilgan loyiha 30 kun "savat"da turadi, keyin butunlay o'chadi.
- Baza tabi (5-bo'lim) mijozning haqiqiy ma'lumotini ko'rsatadi: faqat `super_admin` ochadi; har ochilish va har o'zgarish audit jurnaliga yoziladi; parol xeshlari va shifrlangan ustunlar ko'rsatilmaydi va tahrirlanmaydi; jadval tuzilishi (ustun qo'shish, o'chirish) o'zgartirilmaydi — u faqat migratsiya orqali.

### Shaxsiy ma'lumotlar qonuni

O'zbekiston fuqarolarining shaxsiy ma'lumotlari (ism, telefon) O'zbekistondagi serverlarda saqlanishi talab qilinadi. Shuning uchun standart manzil — O'zbekistondagi VPS. Vercel'ni shaxsiy ma'lumotli loyihalar uchun ishlatishdan oldin talabni yurist bilan aniqlashtirish kerak.

## 12. Zahira (backup) va tiklash

Baza zahirasi eng muhimi: kodni qayta yozish mumkin, mijozning to'lov tarixini esa qaytarib bo'lmaydi. Zahira har doim **boshqa joyda** (boshqa server yoki S3-mos saqlash) turadi, VPS'ning o'zida emas.

| Nima | Qayerga | Qanchalik tez-tez | Qancha saqlanadi |
| --- | --- | --- | --- |
| Mijoz bazalari | Tashqi S3-mos saqlash, shifrlangan | Har kuni | Kunliklar 30 kun, haftaliklar 12 hafta |
| Panel bazasi | Tashqi saqlash, shifrlangan | Har kuni + har migratsiyadan oldin | 90 kun |
| Yuklangan fayllar (logo, PDF) | Tashqi saqlash | Har kuni | 30 kun |
| Kod | GitHub | Har push | Doim |
| Asosiy shifrlash kaliti | Oflayn, alohida joy (qog'oz yoki parol menejeri) | O'zgarganda | Doim |

**Qoidalar:**

- Zahira panelning `pg_dump` vazifasi orqali avtomatik olinadi.
- Har oy avtomatik tiklash testi: zahira vaqtinchalik bazaga tiklanadi, jadvallar va qatorlar soni tekshiriladi, natija `backups.verified_at`ga yoziladi.
- Loyiha sahifasida "Zahiradan tiklash" tugmasi: zahirani tanlash → qayta tasdiq → tiklash. Tiklashdan oldin joriy holatning ham zahirasi olinadi.
- Maqsad: eng ko'pi bilan 24 soatlik ma'lumot yo'qolishi, 1 soat ichida tiklash.
- Zahira olinmasa yoki test o'tmasa, Telegram'ga xabar ketadi.

## 13. Bosqichlar va qabul mezonlari

Har bosqich alohida PR. Keyingi bosqich faqat oldingisining barcha mezonlari bajarilgandan keyin boshlanadi.

### 0-bosqich. Tayyorgarlik

- [x] Eski Cosmos CRM stillarini tahlil qilish (faqat o'qish): `docs/design/STYLE.md` — ranglar, shrift, padding, radius, soya; sidebar, topbar, button, card, table, input, badge, modal
- [x] Turborepo + pnpm monorepo, `apps/panel`, `packages/config`, `packages/ui`, `packages/db`
- [x] `packages/config`: Tailwind preset, `docs/design/STYLE.md` asosidagi design tokenlar (CSS o'zgaruvchilar, light va dark)
- [x] `packages/ui`: shadcn/ui asosida TypeScript komponentlar, eski CRM ko'rinishida
- [x] `apps/panel` ichida `/ui-preview` sahifasi: barcha komponentlar light va dark rejimda
- [x] TypeScript strict, ESLint, Prettier, Vitest
- [x] GitHub Actions: lint, typecheck, test, build har PR'da
- [x] `docs/SPEC.md` (shu hujjat) va `CLAUDE.md`

* **Qabul:** `pnpm dev` panelni ochadi; `/ui-preview` eski CRM ko'rinishiga o'xshaydi; CI yashil.

### 1-bosqich. Panel asosi

- [x] Better Auth: login, 2FA majburiy, rollar
- [x] `packages/security`: shifrlash va `audit.record()` (xesh zanjiri bilan)
- [x] Layout: sidebar, light/dark, o'zbekcha matnlar bitta faylda
- [x] Shablonlar sahifasi: `edu-crm` manifestini o'qish
- [x] Loyihalar: ro'yxat, yaratish (deploysiz), tahrirlash, "savat"ga o'chirish

* **Qabul:** 2FA'siz kirib bo'lmaydi; har o'zgarish audit jurnalida ko'rinadi; xesh zanjiri testi o'tadi.

### 2-bosqich. Uydagi serverga deploy

- [ ] Uydagi kompyuterni server qilib tayyorlash skripti (Node, pnpm, PM2, nginx, PostgreSQL, PgBouncer)
- [ ] Cloudflare Tunnel orqali `admin.ventura.uz` va `*.ventura.uz`ni internetga chiqarish
- [ ] `packages/deploy`: `DeployDriver` interfeysi va SSH drayveri (relizlar, `pm2 reload`, health check, rollback)
- [ ] pg-boss navbati, deploy vazifasi, jonli loglar (`deployment_steps`)
- [ ] Baza strategiyalari: `shared_db` va `db_per_tenant`, `getTenantDb()`, barcha bazalarda migratsiya
- [ ] `edu-crm`ni bepul subdomenda ishga tushirish
- [ ] Deploylar tabi: tarix, holat, loglar, qayta deploy, rollback

* **Qabul:** Yangi loyiha formasi orqali yaratilgan loyiha `<slug>.ventura.uz`da SSL bilan ochiladi; build yiqilsa, oldingi versiya ishlashda davom etadi.

### 3-bosqich. Online VPS va domenlar

- [ ] Serverlar sahifasi: VPS qo'shish (IP, port, foydalanuvchi, SSH kalit), server tayyorlash skripti, metrikalar
- [ ] O'zbekistondagi provayder VPS'ini ulash
- [ ] `dedicated` rejim va `dedicated_server` baza strategiyasi
- [ ] Mijozning o'z domenini ulash: DNS ko'rsatmasi, tekshiruv, certbot SSL, holatlar
- [ ] Loyihani bir serverdan boshqasiga ko'chirish (uydagi → online)

* **Qabul:** tashqi VPS'da `dedicated` loyiha o'z domenida SSL bilan ishlaydi; DNS xato bo'lsa, panel sababini ko'rsatadi.

### 4-bosqich. GitHub + Vercel

- [ ] GitHub App ulash, webhooklar (imzo tekshiruvi bilan)
- [ ] `fork` rejim: shablondan repo yaratish (`turbo prune` eksporti), "orqada qolgan commitlar" va yangilash PR'i
- [ ] Vercel drayveri: loyiha, env, domen, deploy holati webhook orqali

* **Qabul:** bitta tugma bilan yopiq repo yaratiladi va Vercel'da ishga tushadi; push qilinganda avtomatik qayta deploy bo'ladi.

### 5-bosqich. Moslash

- [ ] Brend muharriri, jonli ko'rinish, rang shkalasi va kontrast tekshiruvi
- [ ] Bo'limlar: bog'liqliklar bilan yoqish/o'chirish, Bo'limlar xaritasi sahifasi
- [ ] Sozlamalar (Zod sxema asosida avtomatik forma)
- [ ] Konfiguratsiyani deploysiz yetkazish (kesh va webhook)
- [ ] Baza tabi: ulanish ma'lumoti, jadvallarni ko'rish va qatorlarni tahrirlash

* **Qabul:** rang yoki bo'lim o'zgarishi mijoz saytida 1 daqiqa ichida deploysiz ko'rinadi; o'chirilgan bo'lim API'si 404 qaytaradi; Baza tabida o'zgartirilgan qator mijoz tizimida ko'rinadi va o'zgarish audit jurnalida turadi.

### 6-bosqich. Audit, monitoring, ogohlantirishlar

- [ ] Audit sahifasi: filtr, tafsilot, CSV eksport
- [ ] GitHub, Vercel va SSH drayveri hodisalarini qabul qilish
- [ ] Uptime, SSL, disk/RAM tekshiruvlari, SSH kirishlarni kuzatish
- [ ] Telegram ogohlantirishlar va qoidalar sahifasi

* **Qabul:** 10-bo'limdagi jadvaldagi har bir hodisa jurnalda ko'rinadi va kerakli joyda Telegram xabari keladi.

### 7-bosqich. Zahira va xavfli hudud

- [ ] Avtomatik zahira, tashqi saqlash, oylik tiklash testi
- [ ] "Zahiradan tiklash" tugmasi
- [ ] Xavfli hudud: qayta tasdiq, 30 kunlik savat

* **Qabul:** test loyihasi o'chirib, zahiradan 1 soat ichida to'liq tiklanadi.

### 8-bosqich. Ikkinchi shablon (pilorama)

- [ ] `apps/sawmill` va uning bo'limlar manifesti

* **Qabul:** panel kodiga o'zgartirish kiritmasdan yangi shablon qo'shiladi va ishga tushadi.

## 14. Claude Code uchun qoidalar

Bu hujjatni repoda `docs/SPEC.md` sifatida saqlang. Quyidagi qoidalarni `CLAUDE.md`ga ko'chiring, Claude Code har safar ularni o'qiydi.

```markdown
# CLAUDE.md — Ventura.uz

## Ishni boshlash
- Avval docs/SPEC.md ni o'qi. Faqat joriy bosqich ustida ishla (13-bo'lim).
- Har bosqich = alohida branch va PR. Qabul mezonlari bajarilmaguncha keyingisiga o'tma.
- Muhim qarorlarni docs/decisions/ ichiga qisqa ADR qilib yoz.

## Kod
- TypeScript strict. `any` taqiqlangan.
- Har tashqi kirish (forma, API, webhook) Zod bilan tekshiriladi.
- Sirlar, kalitlar va baza faqat server kodida. Client komponentga hech qachon tushmaydi.
- Baza o'zgarishi faqat Drizzle migratsiyasi orqali (drizzle-kit generate). Bazani qo'lda o'zgartirma.
- Tashqi API'lar (GitHub, Vercel, Cloudflare, Telegram) faqat packages/integrations orqali chaqiriladi.
- Deploy, tekshiruv, zahira faqat pg-boss fon vazifasi sifatida. So'rov ichida uzoq ish qilma.
- Har o'zgartiruvchi amal audit.record() chaqiradi.
- Mijozga xos farq faqat bo'lim (hasFeature) yoki sozlama orqali. `if (tenant.slug === ...)` taqiqlangan.
- UI faqat packages/ui komponentlaridan. Interfeys matnlari o'zbekcha, bitta faylda.

## Test
- Mantiq: Vitest (tashqi API'lar mock qilinadi).
- Asosiy oqimlar (login + 2FA, Yangi loyiha formasi): Playwright.

## Xavfsizlik
- .env ni hech qachon commit qilma. Yangi o'zgaruvchi qo'shilsa, .env.example ni yangila.
- Sirni logga yozma, brauzerga qaytarma.
- Webhook imzosini har doim tekshir.
- SSH orqali faqat packages/deploy ichida oldindan belgilangan buyruqlar bajariladi. Foydalanuvchi kiritgan matn buyruqqa qo'shilmaydi.

## So'rab qil
- Ma'lumot o'chirish, force push, migratsiyada ustun o'chirish, serverda buyruq ishga tushirish — avval Saidakbardan tasdiq so'ra.
```

## 15. Qarorlar va ochiq savollar

Qabul qilingan qarorlar (2026-yil 10-oktabr):

| Savol | Qaror |
| --- | --- |
| Tizim nomi | Ventura.uz |
| Panel manzili | `admin.ventura.uz` |
| Mijoz domeni | Loyiha yaratilayotganda tanlanadi: bepul `<slug>.ventura.uz` yoki mijozning o'z domeni (qo'lda sotib olinadi, panel IP va DNS yozuvlarini beradi) |
| Baza | Har loyihada tanlanadi: umumiy baza, alohida baza (standart), alohida server |
| Uydagi server | Uydagi kompyuter server bo'ladi, Cloudflare Tunnel orqali internetga chiqariladi va mijozlarga tarqatish uchun ishlatiladi |
| Online VPS | O'zbekistondagi provayder |
| Deploy | O'z SSH drayverimiz (git, pnpm, PM2, nginx, certbot); Coolify ishlatilmaydi |
| Mavjud Cosmos CRM | Muzlatilgan, unga yozilmaydi. Admin qismi `apps/edu-crm` sifatida qayta yoziladi (`docs/EDU-CRM-PLAN.md`) |
| Baza tabi | Ko'rish va tahrirlash; SQL oynasi yo'q (2026-10-11) |
| Obuna to'lovi | Keyinroq; hozircha holat qo'lda belgilanadi |

Qolgan ochiq savollar:

- [ ] O'zbekistondagi qaysi provayder va qaysi tarif (CPU, RAM, disk)?
- [ ] `ventura.uz` DNS'ini Cloudflare'ga o'tkazish. 2026-10-11 holatiga DNS ahost'da (`rdns1–3.ahost.uz`); Cloudflare Tunnel uchun kerak
- [ ] Uydagi kompyuter: hozircha ishlab chiqish kompyuterining o'zi (Windows, WSL orqali). Internet tezligi, UPS, 24/7 yoqiq turishi aniqlanmagan
- [ ] Shaxsiy ma'lumotlar qonuni bo'yicha yurist bilan aniqlashtirish (Vercel'dan foydalanish chegarasi).
