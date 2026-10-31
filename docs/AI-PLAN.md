# ai: Ventura AI chatini Ventura qolipiga ko'chirish rejasi

2026-10-14 · holat: qarorlar qabul qilindi (2-bo'lim, 14 ta), AI0 ga tayyor; ochiq faqat CRM imkoniyatlari (AI8) · manba: `C:\Projects\COSMOS LC\ollama` (faqat o'qish uchun namuna)

## 1. Maqsad

Hozirgi AI chat (bitta `public/index.html`, ~2 000 qator vanilla JS + CSS, Supabase, Vercel) `apps/ai` sifatida qaytadan yoziladi:

- Next.js App Router, React 19, TypeScript strict.
- Ko'rinish faqat `packages/ui` komponentlari va tokenlardan.
- Alohida PostgreSQL baza + Drizzle, kirish telefon + parol bilan.
- Ventura serverida PM2 bilan ishlaydi.

Kalit, model va foydalanuvchilarni boshqarish Ventura panelidagi yangi **Agents** bo'limida bo'ladi. Keyinchalik AI mijozning CRM'iga qo'shib ham deploy qilinadi (2-bo'lim, 7-qaror).

Eski loyiha o'z joyida ishlab turaveradi. Fayllar ko'chirilmaydi, mantiq va oqimlar undan o'qib olinadi.

## 2. Qarorlar (Saidakbar, 2026-10-14)

| # | Qaror |
| --- | --- |
| 1 | Deploy — Ventura serverida PM2 (`pnpm start` ga qo'shiladi, panel va edu-crm bilan yonma-yon). Vercel ishlatilmaydi. |
| 2 | Supabase to'liq olib tashlanadi. AI'ning o'z PostgreSQL bazasi bo'ladi (panel va mijoz bazalaridan alohida), sxema va migratsiya Drizzle bilan. |
| 3 | Kirish: telefon + parol. Telegram kodi (2FA) ixtiyoriy: admin hamma uchun majburiy qila oladi; majburiy bo'lmasa, har foydalanuvchi profilida o'zi yoqadi yoki o'chiradi. |
| 4 | Ochiq ro'yxatdan o'tish yo'q. Foydalanuvchini panelning **Agents** bo'limida admin qo'shadi. O'sha yerda API kalitlar, modellar va har foydalanuvchining limiti boshqariladi. |
| 5 | Limit ikki xil: (a) har foydalanuvchiga ruxsat etilgan modellar; (b) token limiti. Kunlik so'rovlar soni (`DAILY_REQUEST_LIMIT`) ishlatilmaydi. |
| 6 | Tashqi API'lar `packages/integrations` orqali chaqiriladi: Ollama Cloud, GitHub va Supabase MCP, Vercel, web qidiruv. |
| 7 | AI ikki yo'lda ishlatiladi: (a) mustaqil, panel qo'shgan foydalanuvchilar bilan; (b) mijozning CRM'iga qo'shib deploy qilinadi, CRM uchun alohida imkoniyatlari bilan. CRM imkoniyatlari keyinroq so'raladi (8-bo'lim) — birinchi bosqichlarga kirmaydi, lekin tuzilma ularga tayyor bo'ladi. |
| 8 | Rang eski chatniki saqlanadi: urg'u `#ff5b2e`, iliq neytrallar, bir rangli asosiy tugma. Radius, o'lcham, soya, harakat va tipografiya shkalasi Ventura'dan olinadi. Rang Ventura komponentlariga sig'masa (masalan chat pufagi, composer), yangi komponent yaratiladi. |
| 9 | Shriftlar Ventura'niki: Quicksand + JetBrains Mono (`next/font/local`). Unbounded va Onest ishlatilmaydi. |
| 10 | Tema qurilma sozlamasiga qarab (`themeScript("system")`), `ThemeToggle` bilan almashtiriladi — panel va edu-crm bilan bir xil. |
| 11 | Eski ma'lumot ko'chirilmaydi: baza toza boshlanadi. |
| 12 | Token limiti **oylik**: har oy boshida qayta to'ladi (Toshkent vaqti bo'yicha). Kiruvchi va chiquvchi tokenlar birga sanaladi (`prompt_eval_count + eval_count`). |
| 13 | Kirish kodlarini AI uchun **alohida Telegram bot** yuboradi. Uning tokeni Agents → Sozlamalar'da kiritiladi va shifrlangan holda saqlanadi. |
| 14 | Agents bo'limini standart holatda `super_admin` va `admin` boshqaradi. Kirish sozlanadi: `super_admin` Agents → Sozlamalar'da qaysi rollar ko'rishi va qaysilari o'zgartirishi mumkinligini belgilaydi. |

## 3. Eski tizim: nima bor

| | Eski tizim |
| --- | --- |
| Frontend | `public/index.html`: ~350 qator CSS (258 selektor), ~1 460 qator JS, framework yo'q, DOM qo'lda (`$('id')`, `innerHTML`) |
| Backend | `lib/app.js` — `handle(Request) → Response` (Web standart); `server.js` (lokal) va `api/index.mjs` (Vercel) shunga uzatadi |
| Server modullari | `connectors.js` (47 KB: GitHub/Supabase OAuth, Vercel tokeni, MCP), `excel-tools.js`, `web-tools.js`, `supabase.js` |
| API | `GET /api/config`, `POST /api/chat` (NDJSON oqim, Ollama Cloud proxy), `GET /api/tags`, `GET /api/usage`, `GET /api/tools`, `POST /api/tools/run`, `GET /api/connectors`, `POST /api/connectors/:id/(start\|finish\|token\|disconnect\|mode/:m)`, lokalda `GET /excel/:file` |
| Ma'lumot | Supabase: Google kirish, suhbatlar, `rpc/use_request` (kunlik limit), shifrlangan connector tokenlari |
| Sozlama | `.env`: bitta `OLLAMA_API_KEY` hamma uchun, `DEFAULT_MODEL`, `ALLOWED_MODELS`, `UNLIMITED_EMAILS` |
| Uslub | O'z tokenlari (`--bg`, `--accent`), `data-theme`, Unbounded + Onest (Google Fonts CDN), qo'lda yozilgan `px` va `#hex` |

Chat imkoniyatlari (hammasi saqlanadi): suhbatlar ro'yxati (50 ta, sana guruhlari, qidiruv, nomini o'zgartirish, o'chirish), vaqtinchalik chat, rasm biriktirish, javob oqimi va to'xtatish, fikrlash (`think`: o'chiq / yoqilgan / low / medium / high), markdown (jadval, ro'yxat, kod), xabar amallari (nusxa, qayta so'rash, baho, ovozda o'qish), model tanlash, ruxsat rejimi (Qo'lda / Avto), javob uslubi (Standart / Qisqa / Batafsil), loyiha ko'rsatmasi (system), limit oynasi. Tool'lar: 8 raund, tool qidiruvi (3 marta), yozadigan amalga ruxsat so'rash. Connectors, Excel fayllar va ko'rinish paneli (formula qatori, varaqlar, yuklab olish), ovoz (diktovka va ovozli suhbat rejimi).

## 4. Tuzilma

### 4.1 Yangi va o'zgaradigan joylar

| Joy | Nima |
| --- | --- |
| `apps/ai` | Chat ilovasi (`@ventura/ai`, port 3002) |
| `apps/panel/app/(panel)/agents/*` | Agents bo'limi: API kalitlar, modellar, foydalanuvchilar, limitlar, sozlamalar |
| `packages/db/src/schema/ai.ts`, `drizzle.ai.config.ts`, `migrations/ai/` | AI bazasi sxemasi; `pnpm db:generate:ai` / `db:migrate:ai` (`AI_MIGRATE_URL`) |
| `packages/auth` | Telegram 2FA'ni ixtiyoriy qilish (hozir majburiy: `needs_telegram`); AI sxemasi uchun `createAuth` varianti |
| `packages/integrations` | `ollama.ts`, `github-mcp.ts`, `supabase-mcp.ts`, `vercel.ts`, `web-search.ts` (eski `connectors.js` va `web-tools.js` dan) |
| `packages/ui` | Chat komponentlari (6.2-bo'lim) |
| `packages/config/tokens/ai.css` | AI ranglari (6.1-bo'lim) |

### 4.2 `apps/ai`

```
apps/ai/
  app/
    layout.tsx               data-brand="ventura" data-palette="ai", shriftlar, themeScript, <Toaster />
    globals.css              tailwindcss + theme.css + tokens/ventura.css + tokens/ai.css + @source packages/ui
    fonts/                   quicksand, jetbrains-mono (panel'dagi fayllar)
    (auth)/login, login/verify, account/password, connect-telegram   — panel naqshi
    (chat)/layout.tsx        ChatShell: Topbar + Sidebar
    (chat)/page.tsx          yangi suhbat
    (chat)/c/[id]/page.tsx   ochiq suhbat
    (chat)/settings/page.tsx profil: parol, Telegram 2FA (agar majburiy bo'lmasa), limit holati
    oauth/[provider]/callback/page.tsx
    api/chat/route.ts        NDJSON oqim: limit → model ruxsati → integrations/ollama → tokenlarni hisoblash
    api/tools/route.ts, api/tools/run/route.ts, api/connectors/[...action]/route.ts, api/files/[name]/route.ts
  components/                faqat ilovaga xos yig'uvchilar (ChatShell, ChatView) — uslub yozilmaydi
  lib/
    uz.ts  prompts.ts  settings.ts (EFFORTS, MODES, OUTPUTS)
    chat-loop.ts             eski respond(): oqim, tool raundlari, qidiruv, ruxsat — DOM'siz, Vitest bilan
    ndjson.ts
    hooks/  use-chats  use-settings  use-chat-stream  use-connectors  use-usage  use-voice
    server/ session.ts  deps.ts  usage.ts  models.ts  tools/ (excel, web, connector tool'lari)
  e2e/
```

Server mantig'i Next route handler'larga bo'linadi. Eski `handle()` dagi yo'nalishlar `api/*` fayllariga tarqatiladi, har kirish Zod bilan tekshiriladi.

### 4.3 AI bazasi (Drizzle)

| Jadval | Nima |
| --- | --- |
| `users`, `sessions`, `accounts`, `verifications`, `two_factors` | better-auth (panel sxemasi kabi): telefon, parol, `telegramChatId`, `twoFactorEnabled`, bloklash |
| `provider_keys` | Ollama Cloud kalitlari — `packages/security` bilan shifrlangan, nomi, faol yoki yo'q |
| `models` | Model nomi, qaysi kalit orqali, yoqilgan yoki yo'q, standart model belgisi |
| `user_models` | Foydalanuvchi ↔ ruxsat etilgan modellar |
| `user_limits` | Oylik token limiti (12-qaror); bo'sh = cheksiz |
| `usage_events` | Har so'rov: foydalanuvchi, model, `prompt_eval_count`, `eval_count`, vaqt — limit va hisobot shundan |
| `chats` | Suhbat: egasi, nomi, tarix (`jsonb`), yangilangan vaqt |
| `connector_tokens` | GitHub / Supabase / Vercel tokenlari (shifrlangan), rejim (o'qish / ikkalasi) |
| `settings` | Umumiy sozlamalar: `telegram2faRequired`, AI Telegram bot tokeni (shifrlangan), standart model |
| `audit_log` | O'zgartiruvchi amallar (panel'dagi `audit.record()` naqshi, o'zgarmas) |

Har foydalanuvchi faqat o'z suhbatlari va tokenlarini ko'radi — har so'rovda `userId` bo'yicha filtr (Vitest bilan ajratish testi).

## 5. Ekran xaritasi

### 5.1 Chat (`apps/ai`)

| Eski (`index.html`) | Yangi | Izoh |
| --- | --- | --- |
| `#login` (Google) | Panel'dagi `(auth)` naqshi: `AuthCard`, telefon (`PhoneInput`) + parol, kerak bo'lsa Telegram kodi | |
| `#sidebar` | `Sidebar` (250 / 74px, mobil drawer) | "Asosiy": Yangi suhbat, Connectors, Fayllar (ost menyuda Excel fayllar) |
| `#chat-list` | **yangi** `ConversationList` — Sidebar'ning yangi `children` slotida | Guruh sarlavhasi `type-eyebrow`; band `--nav-*` tokenlarida; `subtle` uch nuqta + `DropdownMenu` |
| `#search` | `Topbar` qidiruvi (`Ctrl K`) — suhbatlarni filtrlaydi | |
| `#brand` | `Logo` (`brandName="Ventura AI"`) | |
| `#profile`, `#logout` | `ProfileButton` + `DropdownMenu` (Sozlamalar, Chiqish) | |
| `#topbar` | `Topbar`; `leading` — suhbat nomi → `DropdownMenu` (nomini o'zgartirish, o'chirish → `ConfirmModal`) | |
| `#theme` | `ThemeToggle` | |
| `#incognito` | `Button variant="icon"` + `aria-pressed`, yoqilganda `Badge tone="info"` "Vaqtinchalik" | |
| `#messages` | **yangi** `ChatMessage` | |
| markdown (`innerHTML`) | **yangi** `Markdown` — React elementlari, `innerHTML` yo'q | Jadval → `Table`; kod → `--code-*` tokenlari, mono |
| "Fikrlash" | **yangi** `ThinkingBlock` | |
| "O'ylayapti" | **yangi** `TypingIndicator` | |
| xabar amallari | `Button variant="subtle" size="icon-sm"` + `toast()` | |
| xato | `Notice tone="danger"` | |
| ruxsat so'rovi | **yangi** `ToolApproval` | |
| `#composer` | **yangi** `Composer` + `AttachmentChip` | Yuborish — primary `icon`; to'xtatish — `danger` |
| model / rejim / javob uslubi menyulari | `DropdownMenu`; bandga `description` va `selected` qo'shiladi | Model menyusida faqat foydalanuvchiga ruxsat etilganlari |
| loyiha ko'rsatmasi | `Modal position="center"` + `Textarea` | |
| limit oynasi | `DropdownMenuContent` ichida `Meter` (sarflangan token / limit, `warnAt 0.8`) | |
| `#connectors` | `Modal` (o'ngdan drawer): `Badge` holat, `Select` rejim, ulash/uzish, Vercel uchun `Input` | |
| Excel paneli | **yangi** `SpreadsheetView` + `Tabs` (varaqlar) | ≤900px da `Modal` |

### 5.2 Agents (`apps/panel`)

Panel menyusida yangi band "Agents" (`Bot` ikonkasi), ost menyusi bilan. Kim ko'radi va o'zgartiradi — 14-qaror: standart `super_admin` + `admin`, rollar ro'yxati panel bazasidagi sozlamada (tekshiruv `packages/auth/policy.ts` da). Ko'rish huquqi bor, o'zgartirish huquqi yo'q rolga API kalitlar sahifasi ko'rinmaydi.

| Sahifa | Tarkibi |
| --- | --- |
| API kalitlar | `Table`: nomi, oxirgi 4 belgi, holat (`Badge`), qo'shilgan sana; qo'shish — `Modal` + `Input`; kalit qayta ko'rsatilmaydi |
| Modellar | `Table`: model, kalit, yoqilgan (`Switch`), standart; "Ollama'dan olish" — mavjud modellar ro'yxati |
| Foydalanuvchilar | `FilterBar` + `Table`: ism, telefon, 2FA, sarflangan token (`Meter`), holat; qo'shish / tahrirlash — `Modal`: ism, `PhoneInput`, vaqtinchalik parol, ruxsat etilgan modellar (`SearchSelect multiple`), token limiti; bloklash, parolni tiklash, 2FA'ni qayta o'rnatish |
| Sozlamalar | "Telegram kodi hamma uchun majburiy" `Switch`; AI Telegram bot tokeni (`Input`, saqlangach qayta ko'rsatilmaydi); standart model; bo'limga kirish — rollar uchun "ko'rish" / "o'zgartirish" (`Checkbox`, faqat `super_admin`) |

Har o'zgartirish `audit.record()` bilan yoziladi. Panel AI bazasiga faqat server kodida ulanadi (`AI_DATABASE_URL`).

## 6. Dizayn: tokenlar va komponentlar

### 6.1 Ranglar — `tokens/ai.css`

Ventura tokenlari brend bo'yicha `[data-brand="ventura"]` da. AI uchun `<html data-brand="ventura" data-palette="ai">` qo'yiladi va `ai.css` faqat **rang** tokenlarini qayta beradi (`[data-brand="ventura"][data-palette="ai"]` va `.dark` varianti). Radius, o'lcham, soya shakli, tipografiya va harakat tokenlari `ventura.css` dan o'zgarmay meros qoladi — bitta manba saqlanadi.

| Token | Light | Dark | Eski manba |
| --- | --- | --- | --- |
| `--primary` | `#ff5b2e` | `#ff5b2e` | `--accent` |
| `--primary-text` | `#b23a0c` | `#ff5b2e` | `--accent-text` (light'da oq fonda kontrast uchun to'qroq) |
| `--primary-foreground` | `#0a0a0b` | `#0a0a0b` | `--ink` (to'q sariq ustida qora matn) |
| `--background` | `#fcfcfb` | `#0a0a0b` | `--bg` |
| `--foreground` | `#111113` | `#f1eee7` | `--text` |
| `--card`, `--popover` | `#ffffff` | `#141416` | `--surface` |
| `--sidebar-bg` | `#fbfbf9` | `#121214` | `--sidebar` |
| `--muted-foreground` | `#5e5b55` | `#a9a69e` | `--muted` |
| `--border` | `rgb(17 17 19 / .13)` | `rgb(241 238 231 / .14)` | `--border` |
| `--input` | `rgb(17 17 19 / .2)` | `rgb(241 238 231 / .22)` | `--border-strong` |
| `--btn-primary-bg` | `#111113` | `#f1eee7` | `--btn-bg` — bir rangli, gradient emas |
| `--btn-primary-fg` | `#fbfaf7` | `#0a0a0b` | `--btn-fg` |
| `--btn-primary-bg-hover` | `var(--primary)` | `var(--primary)` | hover'da urg'u rangi |
| `--btn-primary-fg-hover` | `var(--primary-foreground)` | `var(--primary-foreground)` | |
| `--btn-primary-shadow` | `none` | `none` | |
| `--nav-active-bg` | `rgb(17 17 19 / .11)` | `rgb(241 238 231 / .14)` | `--active` — gradient o'rniga yumshoq fon |
| `--nav-active-fg` | `var(--foreground)` | `var(--foreground)` | |
| `--avatar-bg` | `var(--primary)` | `var(--primary)` | `#avatar` |
| `--avatar-fg` | `var(--primary-foreground)` | `var(--primary-foreground)` | |

Qolgan ranglar (`--secondary`, `--accent`, `--ring-*`, `--sub-*`, `--icon-btn-*`, holat ranglari) shu jadvaldagilardan `color-mix` bilan hosil qilinadi; aniq ro'yxat AI2 da `ai.css` ga yoziladi va STYLE.md ga yangi bo'lim ("AI palitrasi") qo'shiladi. Komponentlar `--primary` dan hosil bo'ladigan ranglarni ishlatgani uchun Ventura `Button`, `Sidebar`, `Switch` va boshqalar o'z-o'zidan AI ranglarida chiqadi — alohida "AI tugmasi" kerak emas.

Yangi tokenlar (`ventura.css` ga, ikkala rejim, `ai.css` da rangi qayta beriladi):

| Token | Ventura | AI | Vazifasi |
| --- | --- | --- | --- |
| `--bubble-user-bg` | `var(--primary-soft)` | `#f0efeb` / `#1c1c1f` | Foydalanuvchi xabari (eski `--bubble`) |
| `--r-bubble` | `var(--r-modal)` | meros | Xabar pufagi radiusi |
| `--composer-bg` | `var(--card)` | meros | Yozish maydoni |
| `--composer-shadow` | `var(--card-shadow)` | meros | |
| `--code-bg`, `--code-border` | `var(--muted)`, `var(--border)` | `--card`, `--border` | Markdown'dagi kod bloki |
| `--chat-max-w` | `768px` | meros | Xabarlar va composer kengligi |
| `--preview-w` | `480px` | meros | Excel paneli |
| `--sheet-cell-h` | `28px` | meros | Excel katagi |

### 6.2 `packages/ui` ga qo'shiladiganlar

Har biri: TSX, faqat tokenlar, Ventura va AI palitrasida, light va dark'da `/ui-preview` katalogiga qo'shiladi; STYLE.md 11-bo'limiga band yoziladi (11.37 dan).

| Komponent | Fayl | Asosi |
| --- | --- | --- |
| `ChatMessage` (+ `MessageActions`) | `chat-message.tsx` | `role`: `user` (o'ngda, pufak) / `assistant` (to'liq kenglik, fonsiz) |
| `Markdown` | `markdown.tsx` | Eski parser mantig'i (ro'yxat, jadval, kod, inline) TS'ga, natija React tugunlari |
| `ThinkingBlock` | `thinking-block.tsx` | `<details>`, `slide-down` |
| `TypingIndicator` | `typing-indicator.tsx` | 3 nuqta + yozuv, `prefers-reduced-motion` da harakatsiz |
| `ToolApproval` | `tool-approval.tsx` | `Card` + ghost "Rad etish" / primary "Ruxsat berish", argumentlar mono |
| `Composer`, `AttachmentChip` | `composer.tsx` | `controlClass`, `Button` |
| `ConversationList` | `conversation-list.tsx` | `--nav-*`, `DropdownMenu` |
| `SpreadsheetView` | `spreadsheet-view.tsx` | `Table` tokenlari, mono kataklar, `Tabs` |
| `Sidebar` o'zgarishi | `sidebar.tsx` | bo'limlardan keyin ixtiyoriy `children` (aylanadigan qism) |
| `DropdownMenuItem` o'zgarishi | `dropdown-menu.tsx` | ixtiyoriy `description` (ikkinchi qator) va `selected` (✓) |

## 7. Bosqichlar

Har bosqich — alohida branch va PR. Qabul mezonlari bajarilmaguncha keyingisiga o'tilmaydi. Har PR'da `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` yashil bo'ladi. Muhim qarorlar ADR qilib yoziladi (0032 dan).

### AI0 — skelet va palitra

- `apps/ai`: `package.json`, `next.config.ts`, tsconfig, eslint, postcss, `globals.css`, shriftlar, `layout.tsx`.
- `tokens/ai.css`, `data-palette="ai"`; `ChatShell` (Topbar + Sidebar) bo'sh holatda, mobil drawer.
- turbo `dev`/`build`/`start` ga qo'shiladi, `.env.example` yangilanadi.
- ADR 0032: "AI chat Ventura qolipida" (2-bo'limdagi qarorlar).
- **Qabul:** http://localhost:3002 da shell light va dark'da AI ranglarida ochiladi. `data-palette` olib tashlansa, xuddi shu ekran Ventura ko'kida chiqadi.

### AI1 — baza va kirish

- `schema/ai.ts`, migratsiya, `AI_DATABASE_URL` / `AI_MIGRATE_URL`.
- `packages/auth`: Telegram 2FA ixtiyoriy. Holat: umumiy sozlama majburiy qilsa yoki foydalanuvchi o'zi yoqqan bo'lsa → kod so'raladi; aks holda yo'q. Panel'da 2FA majburiyligicha qoladi.
- `apps/ai` kirish sahifalari (panel naqshi), profil: parol, Telegram ulash va 2FA'ni yoqish yoki o'chirish (majburiy bo'lmasa).
- `pnpm ai:user` — mahalliy ishlab chiqish uchun foydalanuvchi yaratish (Agents bo'limi tayyor bo'lguncha).
- **Qabul:** Vitest — 2FA holat jadvali (majburiy / ixtiyoriy × yoqilgan / o'chiq), suhbatlar ajratish testi. Playwright — kirish, 2FA yoqilganda kod so'raladi.

### AI2 — UI komponentlar

- 6-bo'limdagi tokenlar va komponentlar, `/ui-preview` (Ventura va AI palitrasida), STYLE.md.
- `Markdown` uchun Vitest: jadval, ro'yxat, kod; `<script>` va HTML matn sifatida chiqadi.
- **Qabul:** komponentlarda `#hex`, `text-[..]`, `rounded-[..]`, `z-[..]` yo'q (grep tekshiruvi); katalogda ikkala palitra, ikkala rejim.

### AI3 — integrations va chat serveri

- `packages/integrations/ollama.ts`: chat (NDJSON oqim), modellar ro'yxati; kalit bazadan, shifrdan ochilgan holda faqat serverda.
- `api/chat`: Zod → foydalanuvchi modelga ruxsatlimi → token limiti → oqim → oxirgi qatordagi `prompt_eval_count + eval_count` `usage_events` ga yoziladi.
- Uzun oqim: `ReadableStream` to'g'ridan-to'g'ri, `dynamic = "force-dynamic"`, brauzer uzsa so'rov ham to'xtaydi.
- **Qabul:** Vitest (Ollama mock): ruxsatsiz model — 403, limit tugagan — 429, token hisobi to'g'ri yoziladi.

### AI4 — asosiy chat ekrani

- Suhbatlar (bazada, 50 ta, sana guruhlari, qidiruv, nomini o'zgartirish, o'chirish), vaqtinchalik chat.
- `chat-loop.ts` + `useChatStream`: oqim, fikrlash, to'xtatish; suhbat almashsa eski so'rov yangisiga tegmaydi.
- Xabarlar: markdown, rasm, nusxa, qayta so'rash, baho, ovozda o'qish.
- Composer sozlamalari: model (faqat ruxsat etilganlari) + fikrlash, ruxsat rejimi, javob uslubi, loyiha ko'rsatmasi, limit oynasi (`Meter`).
- **Qabul:** Vitest — `chat-loop` (tool raundlari, bo'sh javob, xato, to'xtatish); 3-bo'limdagi chat imkoniyatlari ishlaydi.

### AI5 — Agents bo'limi (panel)

- 5.2-bo'limdagi sahifalar, ruxsatlar, audit.
- **Qabul:** Playwright — admin foydalanuvchi qo'shadi, model va limit beradi; o'sha foydalanuvchi AI'ga kirib faqat ruxsat etilgan modelni ko'radi; limit tugaganda chat xabar beradi.

### AI6 — tool'lar, connectors, Excel

- `packages/integrations`: GitHub va Supabase MCP, Vercel, web qidiruv (eski `connectors.js`, `web-tools.js` dan; avval joriy xatti-harakat testlar bilan qayd qilinadi).
- Tool qidiruvi va yuklanishi, `ToolApproval` (Qo'lda rejimi va `permission_required`).
- Connectors drawer; OAuth callback; tokenlar shifrlangan, brauzerga qaytmaydi; webhook yoki callback `state` tekshiriladi.
- Excel: fayllar foydalanuvchi bo'yicha alohida (eski lokal `excel/` papkasi o'rniga), sidebar'da ro'yxat, `SpreadsheetView`, yuklab olish.
- **Qabul:** Qo'lda rejimida yozadigan tool ruxsatsiz bajarilmaydi (e2e); boshqa foydalanuvchining fayli ochilmaydi.

### AI7 — ovoz, mobil, deploy

- Mikrofon va ovozli suhbat rejimi (`SpeechRecognition` + `speechSynthesis`), qo'llamasa tugmalar yashirin.
- ≤900px: sidebar drawer, Excel paneli `Modal` da; `prefers-reduced-motion`.
- PM2: `pnpm start` ga `ai` (3002); serverda deploy yo'li (`packages/deploy`) va health route.
- **Qabul:** eski chat bilan funksional farq ro'yxati bo'sh (CRM imkoniyatlaridan tashqari).

### AI8 — CRM integratsiyasi (keyinroq)

2-bo'lim 7-qaror. Imkoniyatlar ro'yxati Saidakbardan so'raladi, alohida reja yoziladi. Tuzilma oldindan tayyor: tool'lar ro'yxati kengaytiriladigan (`lib/server/tools/`), CRM tool'lari alohida modul bo'lib qo'shiladi.

## 8. Ochiq savollar

1. **CRM integratsiyasi:** CRM'ga qo'shilganda qanday imkoniyatlar bo'ladi; AI mijoz deployida alohida ilova bo'ladimi yoki edu-crm ichida bo'lim (`hasFeature`)? Mijozning AI bazasi alohida bo'ladimi? AI8 dan oldin so'raladi.

Token davri, hisob, Telegram boti va Agents ruxsatlari bo'yicha savollar yopildi (12–14-qarorlar).

## 9. Xavflar

| Xavf | Chora |
| --- | --- |
| `connectors.js` katta (47 KB) va tiplanmagan | AI6 da avval Vitest bilan joriy xatti-harakat qayd qilinadi, keyin `packages/integrations` ga ko'chiriladi |
| `packages/auth` dagi 2FA o'zgarishi panel kirishini buzishi | Panel uchun 2FA majburiyligicha qoladi; panel'ning auth e2e testlari har PR'da |
| Markdown React'ga o'tganda ko'rinish farqi | Eski chatdan namunaviy javoblar bilan snapshot test |
| Next route handler'da oqim buferlanishi | AI3 da `ReadableStream` bilan tekshiriladi, PM2 orqasidagi proksida ham |
| AI palitrasi ba'zi hosil qilingan ranglarda (light'da to'q sariq urg'u matni) kontrastdan o'tmasligi | `--primary-text` alohida to'qroq qiymatda; AI2 da kontrast tekshiriladi |
| Eski loyihadagi `connectors.json` (lokal tokenlar) | Ko'chirilmaydi |
