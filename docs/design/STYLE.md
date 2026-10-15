# Ventura dizayn tizimi

2026-10-10 · panel va barcha shablonlar uchun yagona uslub hujjati

Bu hujjat hozirgi kod holatini tasvirlaydi. Qiymatlar manbai — kod: `packages/config/tokens/ventura.css` va `packages/config/theme.css`. Hujjat va kod farq qilsa, kod to'g'ri; hujjatni yangilang.

Jonli ko'rinish (`pnpm dev`):

- http://localhost:3000/ui-preview — komponentlar katalogi, har biri light va dark rejimda yonma-yon
- http://localhost:3000/preview/ventura — namunaviy ekran (shell, jadval, forma, modallar)

## 0. Fayllar xaritasi

| Fayl | Nima bor |
| --- | --- |
| `packages/config/tokens/ventura.css` | Barcha dizayn tokenlari: ranglar, radius, soya, o'lcham, shrift rollari (light va dark) |
| `packages/config/theme.css` | Tokenlarni Tailwind v4 bilan bog'lash (`@theme`), matn shkalasi, z-index shkalasi, `type-*` utility'lar, animatsiya keyframe'lari, asos uslublar |
| `packages/ui/src/components/*.tsx` | shadcn uslubidagi TypeScript komponentlar (Radix ustida) |
| `packages/ui/src/lib/utils.ts` | `cn()` — `clsx` + `tailwind-merge` (qo'shimcha matn o'lchamlari bilan) |
| `packages/ui/src/lib/morph.ts` | "Bosilgan tugmadan morph" animatsiyasi yordamchilari |
| `apps/panel/app/layout.tsx` | `<html data-brand="ventura">`, shriftlar, tema skripti, `<Toaster />` |
| `apps/panel/lib/fonts.ts` | `next/font` orqali shriftlar (o'z serverimizdan) |

## 1. Tamoyillar

1. **Yagona manba.** Rang, radius, o'lcham va soya faqat tokenlardan olinadi. Komponentda `#hex`, `13px`, `rounded-[11px]`, `z-[60]` kabi qo'lda yozilgan qiymat bo'lmaydi.
2. **Bir xil element — bir xil qiymat.** Ko'rinishi o'xshash ikki element (masalan ikki tugma) bir-biridan farq qilmasligi kerak: balandlik, padding, radius, chegara, matn bir xil.
3. **Brend bitta rangdan.** `--primary` o'zgarsa, hover, yumshoq fon, fokus, sidebar urg'ulari, gradientlar va rangli soyalar o'zi o'zgaradi (SPEC 8-bo'lim, brend).
4. **Radius bitta manbadan.** Tugma, input, sidebar bandi va checkbox radiusi `--r-btn` dan hosil bo'ladi.
5. **Light va dark.** Har bir rang tokenining ikkala rejim uchun qiymati bor. Dark'da chuqurlik soya bilan emas, fon farqi va ingichka chiziq bilan beriladi.
6. **Zich panel.** Matn 12–14px, boshqaruv elementlari 38px, jadval qatorlari ixcham.
7. **Harakat ma'noli.** Ochiladigan narsa uni chaqirgan tugmadan o'sib chiqadi (morph) va unga qaytadi. `prefers-reduced-motion` da animatsiya o'chadi.
8. **Matnlar o'zbekcha.**

## 2. Mavzu (tema) mexanizmi

| Narsa | Qiymat |
| --- | --- |
| Brend tanlash | `<html data-brand="ventura">` — tokenlar `[data-brand="ventura"]` ga yozilgan |
| Dark rejim | `<html class="dark">`; Tailwind'da `@custom-variant dark (&:where(.dark, .dark *))` |
| Boshlang'ich tanlov | saqlangan tanlov (`localStorage["ventura-theme"]`) → qurilma sozlamasi (`prefers-color-scheme`) |
| Miltillashsiz yuklash | `themeInitScript` / `themeScript(appearance)` (`packages/ui/src/lib/theme.ts`, server komponentdan import qilinadi) `<head>` da birinchi chizishdan oldin `.dark` ni qo'yadi; shablonlarda standart ko'rinish mijoz brendidan |
| Almashtirish | `ThemeToggle` — bir zumda, animatsiyasiz |

Tokenlar `<html>` ga qo'yilgani uchun portal orqali `body` ga chiqadigan elementlar (modal, dropdown, toast) ham ularni oladi.

## 3. Ranglar

### 3.1 Brend rangi va undan hosil bo'ladiganlar

Faqat `--primary` qo'lda beriladi. Qolganlari CSS `color-mix()` va `oklch(from …)` bilan hisoblanadi.

| Token | Light | Dark | Vazifasi |
| --- | --- | --- | --- |
| `--primary` | `#3f6df6` | `#4f79f6` | Brend rangi |
| `--primary-hover` | primary + 15% qora | primary + 8% qora | Hover, bosilgan holat |
| `--primary-soft` | 11% primary, oq bilan | primary 15% shaffoflikda | Yumshoq fon: ikonka hover, sanoq, qidiruv halqasi |
| `--primary-text` | primary + 8% qora | 70% primary, oq bilan | Urg'u matni (havola, domen) |
| `--primary-foreground` | `#ffffff` | `#ffffff` | Primary fon ustidagi matn |
| `--focus-outline` | `= --primary` | `= --primary` | Umumiy `:focus-visible` konturi |
| `--ring-border` | 90% primary, oq bilan | `= --primary` | Fokusdagi input chegarasi |
| `--ring-shadow` | `0 0 0 3px` + 28% primary, oq bilan | `0 0 0 3px` + 25% primary | Fokus halqasi |
| `--search-ring` | `0 0 0 3px var(--primary-soft)` | xuddi shu | Topbar qidiruvi fokusi |
| `--nav-bar` | `= --primary` | `= --primary` | Sidebar aktiv bandi yonidagi chiziqcha |
| `--sub-active-bg` / `-fg` | 16% primary, oq bilan / primary + 30% qora | primary 25% shaffof / 35% primary, oq bilan | Sidebar ost menyusidagi aktiv band |
| `--sub-dot-active` / `--sub-dot-ring` | `= --primary` / 3px, 20% | 70% primary, oq bilan / 3px, 25% | Ost menyu nuqtasi |
| `--icon-btn-hover-bg` / `-border` / `-fg` | primary-soft / 22% primary, oq bilan / primary-hover | primary-soft / primary-hover / `#ffffff` | Ikonka tugmasi hover |
| `--logo-fg` | `= --primary` | 70% primary, oq bilan | Logo belgisi |
| `--nav-active-shadow`, `--btn-primary-shadow`, `--card-shadow-hover` | primary 45% / 20% / 35% shaffof | 40% / 20% / 18% | Rangli soyalar |

**Gradientlar** (`oklch(from var(--primary) …)` bilan, rang toni aylantiriladi):

| Token | Formula | Default qiymatda |
| --- | --- | --- |
| `--btn-primary-bg` | 90°: L−0.05 · L−0.07, ton +15° · L−0.05, ton +30° | ko'k → indigo → binafsha |
| `--btn-primary-bg-hover` | xuddi shu, L−0.08 / L−0.10 / L−0.08 | to'qroq (oq matn kontrasti uchun, 3.5-bo'lim) |
| `--nav-active-bg` (light) | 135°: L−0.02 · L−0.02, ton +12° | sidebar aktiv "pill" |
| `--nav-active-bg` (dark) | 135°: L−0.15, ton +12° → L−0.05, ton +14° | to'qroq indigo |
| `--avatar-bg` | 135°: L−0.04 · L−0.04, ton +22° | profil avatari |

`oklch(from …)` ni qo'llamaydigan eski brauzerlarda qat'iy zaxira qiymatlar ishlaydi (`#2563eb → #4f46e5 → #7c3aed` va h.k. (hover: `#1d4ed8 → #4338ca → #6d28d9`)).

**Brend rangini almashtirish:** faqat `--primary` (light va dark) qiymatini o'zgartiring. Tekshirilgan: `#16a34a` berilganda tugma, sidebar, fokus va urg'ular yashilga o'tadi.

### 3.2 Neytral ranglar

| Token | Light | Dark | Vazifasi |
| --- | --- | --- | --- |
| `--background` | `#f4f6fb` | `#030712` | Sahifa foni |
| `--foreground` | `#1c2333` | `#f8fafc` | Asosiy matn |
| `--card`, `--popover` | `#ffffff` | `#0f172a` | Kartochka, menyu, modal |
| `--secondary` / `-hover` / `-foreground` | `#f1f5f9` / `#e2e8f0` / `#334155` | `#1e293b` / `#243048` / `#cbd5e1` | Ikkinchi darajali fon (ghost tugma, menyu hover) |
| `--muted` / `--muted-foreground` | `#f8fafc` / `#607089` | `#1e293b` / `#94a3b8` | Yumshoq fon / yordamchi matn |
| `--accent` | `#f5f7fb` | `#1e293b` | Hover foni (radio kartochka) |
| `--border` / `--border-soft` | `#e2e8f0` / `#edeff5` | `#1e293b` / `#1e293b` | Chegara / yengil chegara |
| `--input` / `--input-hover` | `#7f8ca0` / `#66768c` | `#5a6a7f` / `#66758b` | Input chegarasi (3:1) va hover; `input-hover` Switch'ning o'chiq yo'li ham |
| `--input-bg` | `= --background` | `= --background` | Input foni sahifa foni bilan bir xil |
| `--placeholder` | `#8190a5` | `#64748b` | Placeholder, input ikonkasi |
| `--label-fg` | `#607089` | `#94a3b8` | Forma yorlig'i |
| `--table-head` / `--table-row-hover` / `--table-foot` | slate-50 (70% / 80% / 50%) | `#141e33` / `#1e293b` / `#0b1222` | Jadval |
| `--overlay` / `--overlay-blur` | `rgb(2 6 23 / .6)` / `4px` | `rgb(2 6 23 / .8)` | Modal va mobil menyu orqa foni |
| `--scrollbar` | `rgb(15 23 42 / .15)` | `#1e293b` | Aylantirish chizig'i |

### 3.3 Holat ranglari

Badge, toast, stat trendi va xato holatlarida ishlatiladi. Har biri uchun matn (`-fg`), fon (`-bg`) va chegara (`-border`).

| Holat | Ma'nosi | Light fg / bg | Dark fg / bg |
| --- | --- | --- | --- |
| `success` | Ishlayapti, yoqildi, saqlandi | `#047857` / `#ecfdf5` | `#34d399` / `rgb(6 78 59 / .5)` |
| `warning` | Kutilmoqda, to'xtatilgan, ogohlantirish | `#b45309` / `#fffbeb` | `#fbbf24` / `rgb(120 53 15 / .5)` |
| `danger` | Xato, yiqildi, xavfli | `#be123c` / `#fff1f2` | `#fb7185` / `rgb(136 19 55 / .5)` |
| `info` | Jarayonda (build), ma'lumot | `#4338ca` / `#eef2ff` | `#818cf8` / `rgb(49 46 129 / .5)` |
| `neutral` | Sinov, qoralama | `#475569` / `#f1f5f9` | `#cbd5e1` / `#1e293b` |

Pul: `--money-in` (`#047857` / `#34d399`), `--money-out` (`#d91a45` / `#fb7185`).

Xavfli amal tugmasi: `--destructive` `#f43f5e`, hover `#e11d48`, matn uchun `--destructive-text` (`#d91a45` / `#fb7185`).

### 3.3a Grafik ranglari

Kategoriya tartibi qat'iy: birinchi qator har doim `--chart-1`, ikkinchisi `--chart-2` (qator soni o'zgarsa ham ranglar ko'chmaydi). Dark qiymatlar alohida tanlangan. Ikkalasi dataviz validatoridan oq (`#ffffff`) va dark (`#0f172a`) kartochkada o'tgan: yorug'lik, to'yinganlik, rangni ajrata olmaslik (CVD) bo'yicha farq, kontrast. Holat ranglari (success/warning/danger) qator rangi sifatida ishlatilmaydi.

| Token | Light | Dark | Vazifasi |
| --- | --- | --- | --- |
| `--chart-1` | `#2a78d6` | `#3987e5` | Birinchi qator (masalan CPU) |
| `--chart-2` | `#eb6834` | `#d95926` | Ikkinchi qator (masalan xotira) |
| `--chart-3` | `#1baf7a` | `#199e70` | Uchinchi qator (masalan donut bo'lagi) |
| `--chart-4` | `#eda100` | `#c98500` | To'rtinchi qator ("Boshqa" — to'rtinchi bo'lak) |

To'rt qator validatordan birga o'tgan (qo'shni juftlar): CVD ΔE 9.1 light / 8.4 dark, oddiy ko'rish ΔE 22.9 / 19.8. Light'da `--chart-3` va `--chart-4` oq fonda 3:1 dan past — ular faqat yonida yozuv (legenda va qiymat) bilan ishlatiladi. Beshinchi qator yasalmaydi: "Boshqa" ga qo'shiladi.

### 3.4 Shell ranglari

| Token | Light | Dark |
| --- | --- | --- |
| `--topbar-bg` / `--topbar-blur` | `rgb(255 255 255 / .8)` / `blur(14px)` | `rgb(15 23 42 / .72)` |
| `--topbar-border`, `--sidebar-border` | `#edeff5` | `#1e293b` |
| `--sidebar-bg` | `#ffffff` | `#0f172a` |
| `--nav-fg` / `--nav-hover-bg` / `--nav-hover-fg` | `#3d4457` / `#f5f7fb` / `#1c2333` | `#cbd5e1` / `#1e293b` / `#ffffff` |
| `--nav-active-fg` | `#ffffff` | `#ffffff` |
| `--nav-section-fg` / `--nav-chevron` | `#6a748a` / `#8c94a6` | `#7a899f` / `#64748b` |
| `--nav-icon-color` | berilmagan — har bandning o'z rangi | `#94a3b8` (hammasi bir xil) |
| `--nav-hue-*` (`blue`, `sky`, `violet`, `purple`, `orange`, `amber`, `green`, `emerald`, `teal`, `rose`, `pink`, `slate`) | eski CRM menyusi ranglari: `#006aff`, `#0ea5e9`, `#8b5cf6`, `#7c3aed`, `#f97316`, `#f39c12`, `#27ae60`, `#059669`, `#16a085`, `#e11d48`, `#ff6b81`, `#64748b` | ishlatilmaydi (`--nav-icon-color` ustun) |
| `--search-bg` / hover / focus | `#f7f8fc` / `#eef1f8` / `#ffffff` | `#1e293b` / `#243048` / `#0f172a` |

Stat-card ikonkalari (135° gradient, oq ikonka): 1 binafsha `#8b7bff → #6d4aff`, 2 yashil `#34d399 → #16a34a`, 3 qizil `#fb7185 → #e11d48`, 4 havorang `#38bdf8 → #0284c7`.

Danger tugma gradienti: `#dc2626 → #e11d48 → #db2777`, hover `#b91c1c → #be123c → #be185d` (to'qroq).

Log oynasi ikkala rejimda ham to'q fonda (terminal ko'rinishi):

| Token | Light | Dark |
| --- | --- | --- |
| `--log-bg` | `#0f172a` | `#060b18` |
| `--log-fg` / `--log-muted` | `#cbd5e1` / `#758399` | o'sha |
| `--log-cmd` | `--primary` ning 45% + oq | o'sha |
| `--log-err` | `#fda4af` | o'sha |
| `--log-border` | `#1e293b` | o'sha |

### 3.5 Kontrast tekshiruvi (WCAG AA)

Tekshiruv `packages/ui/src/lib/contrast.test.ts` da (`contrast.ts` — hisoblagich): `ventura.css` ni o'qiydi, `var()`, `color-mix()`, `oklch(from …)`, gradient bo'laklari va yarim shaffof fonlarni (kartochka/sahifa ustida) hisoblab, light va dark uchun juftlarni tekshiradi. Token o'zgarsa, test darrov yiqiladi. Yangi token qo'shsangiz, shu yerdagi `PAIRS` ro'yxatiga juftini qo'shing.

| Guruh | Chegara | Juftlar |
| --- | --- | --- |
| Matn | 4.5:1 | asosiy va yordamchi matn (fon, kartochka, secondary, jadval boshi, qidiruv), yorliq, urg'u matni (primary-soft ustida ham), tugma matnlari (hover bilan), holat `-fg` o'z `-bg` ustida (kartochka va sahifa ustida), xavfli matn, pul, sidebar matnlari, log oynasi |
| Interfeys | 3:1 | input chegarasi (`--input`, input foni sahifa foni bilan bir xil bo'lgani uchun chegara yagona belgi), Switch yo'li, fokus konturi va halqa chegarasi, placeholder, sidebar strelkasi, ikonka tugma, grafik qatorlari (`chart-1`, `chart-2`, dark'da hammasi), `primary-foreground` (belgi/raqam) primary ustida |
| Istisno | quyi chegara | light `chart-3` va `chart-4` (3.3a): yonida yozuv bor, `>= 2.3` / `>= 2` dan pasaymasin |

Chetda qolganlari (sabab bilan): o'chirilgan elementlar (WCAG talab qilmaydi); `--nav-hue-*` va stat-card ikonkalari — yonida matn yorlig'i bor bezak; `--border` / `--border-soft` kartochka chegaralari (belgi emas, kontent o'zi ajraladi); `--primary-foreground` dark'da primary ustida 3.9:1 (faqat belgi va raqam, matn tugmalari gradient token bilan 4.5+).

Tuzatilgan tokenlar (eng yomon juft, light yoki dark; oldin → keyin):

| Token | Qiymat (oldin → keyin) | Nisbat |
| --- | --- | --- |
| `--muted-foreground`, `--label-fg` (light) | `#64748b` → `#607089` | 4.34 → 4.59 (secondary ustida) |
| `--placeholder` (light) | `#94a3b8` → `#8190a5` | 2.37 → 3.00 |
| `--primary-text` (light) | `= primary` → primary + 8% qora | 3.88 → 4.70 (primary-soft ustida) |
| `--input` (light / dark) | `#e2e8f0` → `#7f8ca0` / `#334155` → `#5a6a7f` | 1.14 → 3.15 / 1.72 → 3.23 |
| `--input-hover` (light / dark) | `#cbd5e1` → `#66768c` / `#475569` → `#66758b` | 1.48 → 4.63 / 2.36 → 3.81 |
| `--ring-border` (light) | 70% → 90% primary | 2.44 → 3.42 |
| `--destructive-text`, `--money-out` (light) | `#e11d48` → `#d91a45` | 4.34 → 4.64 |
| `--money-in` (light) | `#059669` → `#047857` | 3.49 → 5.07 |
| `--nav-section-fg` (light / dark) | `#9aa3b5` → `#6a748a` / `#64748b` → `#7a899f` | 2.54 → 4.69 / 3.75 → 5.02 |
| `--nav-chevron` (light) | `#a6adbd` → `#8c94a6` | 2.25 → 3.04 |
| `--log-muted` | `#64748b` → `#758399` | 3.75 → 4.64 (light) |
| `--btn-primary-bg-hover` | L+0.02 → L−0.08 (hover to'qroq) | 4.08 → 6.28 (light), 3.59 → 5.46 (dark) |
| danger hover gradienti | `#ef4444…` → `#b91c1c…` | 3.53 → 6.04 |
| `--nav-active-bg`, `--avatar-bg` | L−0.02 / L−0.04 | 4.44 → 4.84 / 3.89 → 4.60 (dark avatar) |

Ko'zga ko'rinadigan o'zgarish: input va checkbox chegarasi endi aniq kulrang (oldin deyarli ko'rinmas edi), Switch'ning o'chiq yo'li to'qroq, tugma hover'i yorug'lashmay qorayadi. Qolganlari 5% dan kam o'zgargan. Qaytarish kerak bo'lsa, `--input` / `--input-hover` qiymatlarini oldingisiga qaytaring va testda ularning juftini istisnoga o'tkazing.

## 4. Tipografiya

### 4.1 Shriftlar

| Rol | Shrift | Vaznlar | Token |
| --- | --- | --- | --- |
| Matn, sarlavha, tugma | Quicksand | 400, 500, 600, 700 | `--font-body`, `--font-display` → Tailwind `font-sans`, `font-heading` |
| Raqamlar, domen, sana, telefon, kod | JetBrains Mono | 400, 500, 600 | `--font-numeric` → `font-mono` |

Shriftlar `next/font/google` bilan build vaqtida yuklab olinadi va o'z serverimizdan beriladi. Eng qalin vazn — 700.

### 4.2 Matn o'lchamlari shkalasi

| Utility | O'lcham | Qayerda |
| --- | --- | --- |
| `text-2xs` | 10px | Bildirishnoma soni, klaviatura yorlig'i (`Ctrl K`) |
| `text-caption` | 11px | Ikkinchi qator (mijoz ismi, rol), stat trendi, sidebar sanog'i |
| `text-xs` | 12px | Jadval matni, forma yorlig'i, yordamchi matn, kichik tugma yozuvi |
| `text-body` | 13px | Izoh, menyu bandi, jadvaldagi asosiy katak, tab, ChoiceField yozuvi |
| `text-sm` | 14px | Tugma, input, select |
| `text-title` | 15px | Kartochka sarlavhasi |
| `text-lg` | 18px | Modal sarlavhasi |
| `--stat-size` | 19px | Stat-card qiymati |
| `--page-title-size` | 24px | Sahifa sarlavhasi (`h1`) |

`text-[13px]` kabi arbitrary o'lchamlar ishlatilmaydi. `cn()` ichidagi `tailwind-merge` `2xs`, `caption`, `body`, `title` ni matn o'lchami deb biladi (aks holda ular rang bilan to'qnashardi).

### 4.3 Matn rollari (`type-*` utility'lar)

Rol bir nechta xususiyatni birga beradi; qiymatlar tokenlarda.

| Utility | Shrift / o'lcham / vazn | Qo'shimcha |
| --- | --- | --- |
| `type-heading` | display / — / 700 | `-0.01em` |
| `type-btn` | body / 14px / 600 | — |
| `type-label` | body / 12px / 500 | rang `--label-fg` |
| `type-eyebrow` | body / 10.5px / 700 | UPPERCASE, `0.08em` (sidebar bo'lim sarlavhasi, logo osti yozuvi) |
| `type-th` | body / 12px / 700 | jadval sarlavhasi |
| `type-badge` | body / 11px / 700 | — |
| `type-brand` | body / 16px / 700 | `-0.01em` (tizim nomi) |
| `type-stat` | body / 19px / 700 | — |
| `type-nav` | body / 13.5px / 600 | sidebar bandi |

## 5. O'lchamlar va oraliqlar

| Token / qiymat | O'lcham | Qayerda |
| --- | --- | --- |
| `--control-h` | 38px (≤900px: 44px) | Tugma, input, select, telefon, topbar qidiruvi, ikonka tugmasi |
| `--control-h-sm` | 32px (≤900px: 40px) | Kichik tugma, jadvaldagi uch nuqta, sahifa raqamlari |
| `--btn-px` | 16px | Matnli tugmalarning yon paddingi |
| Input paddingi | 16px | Ikonkali inputda chap 36px; select'da o'ng 12px (strelka); topbar qidiruvida 40 / 56px |
| Menyu bandi | 36px (≤900px: 40px) balandlik, 12px padding, 8px oraliq | Dropdown, select, flyout |
| `--topbar-h` | 68px (≤900px: 56px) | Topbar |
| `--sidebar-w` / `--sidebar-collapsed-w` | 250px / 74px | Sidebar; mobil (≤900px) 280px drawer |
| `--nav-item-h` / `--sub-item-h` | 40px / 34px (≤900px: 44px / 40px) | Sidebar bandi / ost bandi |
| Kontent maydoni | 16 / 24 / 32px (`p-4 sm:p-6 lg:p-8`) | `main` |
| Kartochka | sarlavha `20px × 16px`, kontent 20px | `CardHeader`, `CardContent` |
| Modal | sarlavha va pastki qism `20 × 16px` (≥640px: `24 × 20px`), tana 20 / 24px | Barcha modallar |
| Jadval | sarlavha katagi `16 × 10px`, katak `16 × 12px` | `Th`, `Td` |
| Stat panjarasi | 1 → 2 (≥560px) → 4 ustun (≥1200px), oraliq 14px | Stat-card'lar |

**Breakpoint'lar:** shell uchun 900px (sidebar drawer bo'ladi, topbar 56px); qolganlari Tailwind standarti — `sm` 640, `md` 768, `lg` 1024, `xl` 1280px.

### 5.1 Mobil ko'rinish (390 va 768 px tekshiruvi)

- ≤900px da `ventura.css` oxiridagi `@media` bloki boshqaruv o'lchamlarini oshiradi (yuqoridagi jadval): asosiy tugma va input 44px, kichik tugma 40px, menyu bandi 40px. Qat'iy `h-8` / `h-9` yozmang — `h-(--control-h-sm)` yoki `max-[900px]:h-10` ishlating.
- Checkbox va radio belgisi 18px, lekin ≤900px da ko'rinmas qatlam teginish maydonini ~42px ga kengaytiradi (`checkbox.tsx`).
- Sahifa gorizontal aylanmasligi shart; keng jadval o'z kartochkasi ichida aylanadi. Faqat ekran o'quvchi uchun jadval (`sr-only`) `<div className="sr-only"><table>…` ichida bo'ladi: jadvalning o'zi `sr-only` bo'lsa, minimal kengligi sahifani kengaytiradi.
- Tekshirish: `apps/edu-crm/e2e/.tmp/mobile.mjs` (vaqtinchalik, git'dan tashqari): `document.scrollWidth` va `innerWidth`, kenglikdan chiqqan elementlar va 40px dan past teginish maydonlari. Jadval ichidagi matnli havolalar (ism, guruh nomi) qator balandligi hisobiga bosiladi va bu tekshiruvdan chetda.

## 6. Radius

| Token | Qiymat | Qayerda |
| --- | --- | --- |
| `--r-btn` | **12px** — asosiy manba | Barcha tugmalar (matnli, ikonkali, kichik, sahifa raqamlari, profil) va logo qutisi |
| `--r-control` | `= --r-btn` | Barcha inputlar, select, telefon, textarea, radio kartochka |
| `--r-nav`, `--r-sub` | `= --r-btn` | Sidebar bandlari va ost bandlari |
| `--r-check` | `--r-btn / 2` (6px) | Checkbox |
| `--r-card` | 12px | Kartochka, stat-card, toast |
| `--r-badge`, `--r-stat-icon`, `--r-avatar`, `--r-menu-item` | 12px | Badge, stat ikonkasi, avatar, menyu bandi |
| `--r-menu` | 16px | Dropdown, select va flyout paneli |
| `--r-modal` | 16px | Markaziy modal, tasdiqlash oynasi |
| to'liq dumaloq | `rounded-full` | Switch, radio, sanoq "pill"i, nuqtalar |

Radiusni o'zgartirish uchun faqat `--r-btn` ni almashtiring — tugma, input, sidebar va checkbox birga o'zgaradi.

## 7. Soya va chuqurlik

| Token | Light | Dark |
| --- | --- | --- |
| `--card-shadow` | `0 10px 30px -18px rgb(17 17 19 / .22)` — yumshoq, pastga cho'zilgan | yo'q |
| `--card-shadow-hover` | `0 18px 40px -16px` + primary 35% | `0 18px 50px` + primary 18% |
| `--card-hover-y` | stat-card hover'da 3px ko'tariladi | xuddi shu |
| `--popover-shadow` | `0 24px 60px rgb(17 17 19 / .14)` + 1px halqa | `0 24px 60px rgb(0 0 0 / .6)` + 1px och halqa |
| `--modal-shadow` | `0 24px 60px rgb(17 17 19 / .18)` | faqat 1px och halqa |
| `--btn-primary-shadow` | `0 4px 6px -1px` + primary 20% | xuddi shu |
| `--btn-danger-shadow` | `0 4px 6px -1px rgb(225 29 72 / .2)` | xuddi shu |
| `--nav-active-shadow` | `0 8px 20px -4px` + primary 45% | primary 40% |

Topbar va orqa fonlar shaffof + blur: topbar `blur(14px)`, modal orqasi `--overlay-blur` (4px).

## 8. Qatlamlar (z-index)

| Token | Qiymat | Nima |
| --- | --- | --- |
| `--z-raised` | 1 | Jadvaldagi yopishqoq ustun (masalan, davomat jurnalidagi o'quvchi ismi) |
| `--z-sidebar` | 30 | Sidebar |
| `--z-topbar` | 40 | Topbar |
| `--z-overlay` | 50 | Modal va mobil menyu orqa foni |
| `--z-modal` | 50 | Modal, drawer, mobil sidebar (DOM'da orqa fondan keyin turadi) |
| `--z-popover` | 60 | Dropdown, select, flyout (va ularning shaffof orqa foni) |
| `--z-toast` | 70 | Toast |

Komponentda `z-(--z-modal)` ko'rinishida ishlatiladi. Faqat bitta komponent ichidagi mahalliy tartib (`z-10`) bundan mustasno.

## 9. Harakat

Asosiy egri chiziq: `--ease-ios` = `cubic-bezier(0.32, 0.72, 0, 1)`.

| Narsa | Ochilish | Yopilish | Tafsilot |
| --- | --- | --- | --- |
| Dropdown, select, flyout | 360ms | 280ms | Panel trigger chegarasidan o'sib chiqadi; kontent bir xil masshtabda (`s = √(sx·sy)`) kattalashadi; bandlar 100ms + 30ms qadam bilan (220ms) paydo bo'ladi; yopilishda trigger'ga qaytadi, oxirgi 40% da so'nadi |
| Markaziy modal, tasdiqlash oynasi | 460ms | 440ms | Oxirgi bosilgan tugmadan morph; kontent 140ms kechikib 220ms da paydo bo'ladi; tugma topilmasa markazdan 0.92 → 1 (350 / 280ms) |
| Drawer (o'ngdan modal) | 320ms | 320ms | O'ngdan siljiydi, orqa fon shu tezlikda so'nadi |
| Modal orqa foni | 350ms | — | Shaffoflik |
| Sidebar aktiv indikatori | 380ms | — | Yangi bandga sirpanadi, o'rtada 0.88 gacha siqiladi |
| Sidebar band hover | 380ms | — | `nav-squish`: 1 → 0.93 → 1, ikonka 1.1 marta kattalashadi |
| Sidebar yig'ilishi | 200ms | — | Kenglik |
| Tab indikatori | 380ms | — | Aktiv tab ostiga sirpanadi |
| Toast | 320ms | 200ms | O'ngdan siljiydi; o'ngga surib yopiladi; 4 soniyada o'zi yopiladi |
| Switch | 200ms | — | Fon rangi va doira |
| Stat-card hover | 300ms | — | 3px ko'tariladi, rangli soya |
| Ikonka tugmasi hover | 200ms | — | 1px ko'tariladi |
| Sahifa kirishi | 480ms | — | `page-in`: 14px pastdan, shaffoflik |
| Tugma bosilishi | — | — | `active:scale-[0.98]` |

**Morph qayerdan boshlanadi:** har bir `pointerdown` da oxirgi bosilgan tugma eslab qolinadi (`installTriggerRecorder`). Modal ochilganda: berilgan element → oxirgi tugma → bosish paytidagi suratga olingan o'lcham (tugma qayta chizilgan bo'lsa, 3 soniya ichida) → fokusdagi element. Kichik tugmada boshlang'ich radius tugma balandligining yarmi bilan cheklanadi.

**`prefers-reduced-motion`:** barcha animatsiya va o'tishlar 1ms ga tushadi; dropdown va modal darhol joyida chiqadi; sidebar indikatori siqilmaydi.

## 10. Ikonkalar

Kutubxona: `lucide-react`; chiziq qalinligi `--icon-stroke` (2).

| O'lcham | Qayerda |
| --- | --- |
| 16px | Matnli tugma, input, menyu bandi, tab, toast yopish |
| 17px | Ikonka tugmasi (topbar, modal yopish) |
| 19px | Sidebar bandi, stat-card ikonkasi |
| 14px | Strelkalar (select, sidebar, profil), kichik tugma ikonkasi |
| 20px | Toast holat ikonkasi, tasdiqlash oynasi ikonkasi |

Sidebar ikonkalari light rejimda har bandning o'z rangida (`item.color`, qiymati `var(--nav-hue-…)` — komponentda `#hex` yozilmaydi), dark'da hammasi `--nav-icon-color`.

## 11. Komponentlar

Hammasi `@ventura/ui/<nom>` dan import qilinadi.

### 11.1 Button — `button.tsx`

| Variant | Ko'rinishi | Qachon |
| --- | --- | --- |
| `primary` (standart) | Brend gradienti, oq matn, rangli soya | Sahifadagi asosiy amal |
| `ghost` | `--secondary` fon, 1px chegara | Ikkinchi darajali amal ("Bekor qilish", "Eksport", paginatsiya) |
| `danger` | Qizil gradient, oq matn | Xavfli amal |
| `icon` | Kvadrat, chegara, hover'da 1px ko'tariladi | Faqat ikonkali tugma (topbar, modal yopish) |
| `subtle` | Fonsiz, hover'da `--secondary` | Jadval qatoridagi uch nuqta |

| O'lcham | Balandlik | Padding |
| --- | --- | --- |
| `default` | 38px | 16px |
| `sm` | 32px | 12px |
| `icon` | 38 × 38 | — |
| `icon-sm` | 32 × 32 | — |

Qoidalar:
- Hamma matnli tugmada 1px chegara bor (primary va danger'da shaffof). Shuning uchun bir xil matnda kengligi aynan bir xil.
- Radius `--r-btn`, matn `type-btn` (14px / 600), ikonka va matn orasi 8px.
- Holatlar: hover, `active:scale-[0.98]`, disabled — 40% shaffoflik.
- `asChild` bilan havola (`<a>`) ham tugma ko'rinishida bo'ladi.

### 11.2 Input — `input.tsx`

- 38px, radius `--r-control`, 1px `--input` chegara, fon `--input-bg`, padding 16px, matn 14px.
- Hover: chegara `--input-hover`. Fokus: chegara `--ring-border` + `--ring-shadow`.
- Xato: `aria-invalid` → chegara `--danger-fg` + `--error-ring`.
- Disabled: 60% shaffoflik.
- `icon` prop: chap tomonda 16px ikonka, chap padding 36px.
- `controlClass` eksport qilinadi — select, telefon va textarea shu asosda.

### 11.3 Select — `select.tsx`

- Trigger input bilan bir xil (`controlClass`), o'ngda 14px strelka (ochilganda 180°).
- Panel morph dropdown asosida, trigger kengligida ochiladi; tanlangan band ✓ va `--primary-text` bilan belgilanadi.
- API: `Select` (`value` / `defaultValue` / `onValueChange`), `SelectTrigger`, `SelectValue` (`placeholder`), `SelectContent`, `SelectItem`.
- Klaviatura: ↑ ↓ Home End Enter Space Escape. Harf bilan qidirish (typeahead) hozircha yo'q.
- Modal ichida ishlaydi: tanlash modalni yopmaydi; birinchi Escape faqat select'ni yopadi.

### 11.4 PhoneInput — `phone-input.tsx`

- Input bilan bir xil konteyner; chapda `+998` bo'lagi (`--secondary` fon, mono, 600).
- Raqam qismi mono, 14px, padding 16px; format `90 123 45 67`, faqat 9 raqam.
- `invalid` prop xato holatini beradi.

### 11.5 Textarea — `textarea.tsx`

- `controlClass` asosida: bir xil chegara, radius, padding va fokus; vertikal padding 10px, eng kam balandlik 38px, faqat vertikal o'lcham o'zgaradi.

### 11.6 Checkbox, Radio — `checkbox.tsx`

- `Checkbox`: 18px, radius `--r-check`; belgilanganda `--primary` fon va oq ✓ (12px).
- `RadioGroup` + `Radio`: 18px doira; tanlanganda `--primary` chegara va 8px nuqta.
- `RadioCard`: sarlavha + izohli kartochka, padding 12px; tanlanganda chegara `--ring-border`, fon `--primary-soft`.
- `ChoiceField`: checkbox, radio yoki switch yonidagi yozuv (13px / 600) va izoh (12px).
- Fokus halqasi va hover chegarasi input bilan bir xil.

### 11.7 Switch — `switch.tsx`

- 36 × 20px, padding 2px — ichki joy aniq 32 × 16px; oq doira 16px, yoqilganda 16px suriladi.
- O'chiq: `--input-hover` fon; yoqilgan: `--primary`.
- O'chirib bo'lmaydigan holat (`disabled`) — 50% shaffof. Masalan "Rejim" turidagi bo'lim (SPEC 8-bo'lim).

### 11.8 Label, FieldHint — `label.tsx`

- `Label`: `type-label` (12px / 500), `--label-fg`, inputdan 6px yuqorida.
- `FieldHint`: 12px yordamchi matn; `error` bilan qizil va 600.

### 11.9 Card — `card.tsx`

- Fon `--card`, 1px `--border`, radius `--r-card`, soya `--card-shadow`.
- `CardHeader`: padding `20 × 16px`, pastda chegara; `CardTitle` — `type-heading` 15px; `CardDescription` — 13px yordamchi.
- `CardContent`: 20px.

### 11.10 StatCard — `stat-card.tsx`

- Padding 16px; chapda 42px ikonka qutisi (`--stat-N-bg`, radius `--r-stat-icon`, ikonka 19px).
- Qiymat `type-stat` (19px / 700), yorliq 12px / 500.
- Trend: badge o'lchamidagi "pill" (8px padding, 11px mono) — `success` yoki `danger`.
- `hint`: yorliq ostida 11px yordamchi qatorlar (taqsimot, o'rtacha qiymat) — eski tizim kartalaridagi ikkinchi qator.
- Hover: 3px ko'tariladi, `--card-shadow-hover`.

### 11.11 Badge — `badge.tsx`

- `type-badge` (11px / 700), padding `8 × 2px`, radius `--r-badge`, 1px chegara.
- `tone`: `success`, `warning`, `danger`, `info`, `neutral` (3.3 jadval).
- `dot`: oldida 6px rangli nuqta.

### 11.12 Table — `table.tsx`

- `TableWrap` (gorizontal aylantirish), `Table` (12px), `THead` (`--table-head`, pastda chegara), `TBody` (qatorlar orasida `--border-soft`), `Tr` (hover `--table-row-hover`), `Th` (`type-th`, 16 × 10px), `Td` (16 × 12px).
- Katak tarkibi: asosiy matn 13px / 700, ikkinchi qator 11px yordamchi, domen va sana mono, holat — `Badge` (`dot`), amallar — `subtle` uch nuqta + dropdown.
- Bo'sh holat: markazda 48px ikonka qutisi, sarlavha 15px, izoh 13px.

### 11.13 Pagination — `pagination.tsx`

- Pastki qism: kartochka sarlavhasi bilan bir xil padding (`20 × 16px`), `--table-foot` fon.
- Chapda "1–10 / 37 ta yozuv", o'ngda `ghost sm` "Oldingi" / "Keyingi" va 32px sahifa raqamlari (aktivi primary gradientda); ko'p sahifada "…".
- `start` — chapda, yozuvlar sonidan oldin qo'shimcha boshqaruv (masalan, "Sahifada ko'rsatish" tanlovi).

### 11.14 Tabs — `tabs.tsx`

- Ro'yxat pastida 1px chegara; tab 40px, padding 12px, 13px / 600; faol bo'lmagan — yordamchi rang.
- Aktiv tab ostida 2px `--primary` chiziq sirpanadi (380ms).
- Fokus: halqa emas, `--secondary` fon (chiziq bilan qutiga aylanmasligi uchun).
- Tab ichida sanoq bo'lishi mumkin (`--primary-soft` "pill").
- Tab ko'p bo'lsa gorizontal aylantiriladi; kontent ochilganda `slide-down` (180ms).

### 11.15 DropdownMenu — `dropdown-menu.tsx`

- Panel: `--popover`, 1px chegara, radius `--r-menu`, `--popover-shadow`, ichki padding 6px, eng kam kenglik 200px.
- `DropdownMenuItem`: `menuItemClass` (36px, 12px padding, 13px / 600, ikonka 16px, oraliq 8px); hover/klaviatura belgisi — `--secondary` fon; `danger` band qizil.
- `DropdownMenuLabel`, `DropdownMenuSeparator` (1px `--border-soft`).
- `DropdownMenuContent` parametrlari: `align` (`start` / `center` / `end`), `side` (`bottom` / `right`), `matchTriggerWidth`, `role` (`menu` / `listbox`).
- Fokus doim trigger'da qoladi, band `aria-activedescendant` bilan belgilanadi; tashqariga bosish faqat yopadi (ostidagi elementni bosmaydi).
- `data-morph-layer` atributi — modal bu qatlamni "tashqari" deb hisoblamaydi.

### 11.16 Modal — `modal.tsx`

| Tur | Ko'rinishi |
| --- | --- |
| `position="right"` (standart) | O'ngdan drawer: to'liq balandlik, kenglik 448px (≥640px: 512px, `wide`: 672px), chapda chegara; sarlavha qatori yarim shaffof + blur |
| `position="center"` | Markazda: kenglik 28rem (`wide`: 42rem), eng ko'pi 85vh, radius `--r-modal` |

- Tuzilishi: sarlavha (18px `type-heading` + izoh 13px + yopish tugmasi) → tana (bloklar orasi 16px, o'zi aylanadi) → ixtiyoriy pastki qism (tugmalar o'ngda).
- Orqa fon `--overlay` + `--overlay-blur`; bosilsa yopiladi; Escape yopadi; fokus Radix Dialog bilan modal ichida ushlanadi.
- Ichidagi dropdown, select va toast modalni yopib yubormaydi.

### 11.17 ConfirmModal — `modal.tsx`

- Kenglik 24rem, padding 24px; tepada 44px qizil ikonka qutisi; sarlavha 18px; matn 13px.
- Pastda ikkita teng tugma: `ghost` "Yo'q, bekor" va `danger` "Ha, tasdiqlash".
- `onConfirm` yopilish animatsiyasi tugagach chaqiriladi.
- `requireText`: xavfli amal uchun — ko'rsatilgan matn (masalan loyiha slug'i) aynan yozilmaguncha tasdiqlash tugmasi o'chiq (SPEC 11-bo'lim).
- `originEl`: morph boshlanadigan element (berilmasa oxirgi bosilgan tugma).

### 11.18 Toast — `toast.tsx`

- Istalgan joydan: `toast({ title, description?, tone? })`; `<Toaster />` layout'da bir marta.
- O'ng yuqorida (mobil'da to'liq kenglikda), kenglik 384px, bir vaqtda ko'pi bilan 4 ta.
- Kartochka: `--popover`, chegara, radius `--r-card`, `--popover-shadow`, padding 16px; chapda 20px holat ikonkasi; sarlavha 13px / 700, izoh 12px; o'ng yuqorida yopish tugmasi.
- `tone`: `success`, `info` (standart), `warning`, `danger`.

### 11.19 Topbar — `topbar.tsx`

- 68px (≤900px: 56px), yopishqoq, fon `--topbar-bg` + `blur(14px)`, pastda chegara.
- Chapda brend bloki — sidebar kengligida (250 / 74px), o'ngida chegara: `Logo`.
- So'ng menyu tugmasi (`icon`), ixtiyoriy `leading` bloki (masalan edu-crm filial tanlovi), qidiruv (38px, kenglik 224px, ≥1024px: 288px, o'ngda `Ctrl K`), o'ng guruh (oraliq 8px): bildirishnoma, `ThemeToggle`, profil.
- Parametrlar: `brandName`, `brandMark`, `brandSubtitle`, `searchPlaceholder`, `onSearchOpen`, `leading`, `collapsed`, `onToggleSidebar`.
- `onSearchOpen` berilsa qidiruv maydoni tugmaga aylanadi (bosilsa shu chaqiriladi, ≥640px) va tor ekranda qidiruv ikonka tugmasi chiqadi; berilmasa — oddiy matn maydoni (panel).
- `CommandPalette` (`command-palette.tsx`, Ctrl K): tepada markazlashgan oyna (≤40rem, `--z-modal`), maydon + guruhlangan natijalar; ↑ ↓ tanlash, Enter ochish, Esc yopish; tanlangan band `bg-secondary`. Ilova ma'lumotni (`groups`) va `onSelect` ni beradi.
- `ProfileButton`: 36px avatar (`--avatar-bg`), ism 13px / 700, rol 11px, strelka; hover'da `--profile-hover-bg`.

### 11.20 Sidebar — `sidebar.tsx`

- 250px (yig'ilgan 74px), topbar ostida yopishqoq, o'zi aylanadi; ichki padding `14px` (yig'ilganda `8px`).
- Bo'lim sarlavhasi: `type-eyebrow`, `--nav-section-fg`, o'ngida chiziq.
- Band: 40px, radius `--r-nav`, `type-nav`, ikonka 19px (32px quti ichida), oraliq 12px; hover — fon, `nav-squish`, ikonka kattalashadi; sanoq "pill"i.
- **Aktiv indikator:** band ostida `--nav-active-bg` gradientli "pill" va chapida 4 × 20px `--nav-bar` chiziqcha; band almashganda sirpanadi va siqiladi.
- **Ost menyu:** chapda 1.5px chiziq, 34px bandlar, 5px nuqta; aktiv band `--sub-active-bg` / `-fg`, nuqta halqali. Ichida aktiv band bo'lgan ota band qalin.
- **Ikkinchi daraja (guruh):** ost menyuda guruh bandi — nuqtasiz, chevron bilan ochiladi (masalan Hisobotlar →
  Moliyaviy hisobotlar → Pul oqimi). Guruh sahifa emas. Ichki bandlar kichikroq chekinish bilan, uzun nom ikki
  qatorga o'tadi. Aktiv band qaysi guruhda bo'lsa, o'sha guruh va ota band o'zi ochiladi.
- **Yig'ilgan rejim:** faqat ikonkalar, `title` tooltip; ost menyuli band bosilsa o'ngga **flyout** (230px, morph) chiqadi; guruhlar flyout'da ajratgich va sarlavha bilan.
- **Mobil (≤900px):** 280px drawer, orqa fon bilan; band tanlanganda yopiladi.
- `footer`: pastda ixtiyoriy blok (masalan server holati).

### 11.21 Logo, Avatar, ThemeToggle

- `Logo`: 40px quti (radius `--r-btn`, `--logo-bg` / `-fg` / `-border` / `-shadow`), ichida belgi — ikki qavatli pastga strelka (`LogoMark`) yoki `mark` (masalan `<img>`); yonida `name` (`type-brand`) va `subtitle` (`type-eyebrow`). Standart nom — "Ventura".
- `Avatar`: bosh harflar (o'lcham × 0.38, 700), radius `--r-avatar`; `variant="brand"` — `--avatar-bg`, `variant="auto"` — ismga qarab 6 juft gradientdan biri.
- `ThemeToggle`: `icon` tugma, Oy / Quyosh ikonkasi.

### 11.22 Stepper — `stepper.tsx`

- Ko'p qadamli forma sarlavhasi (Yangi loyiha formasi). Parametrlar: `steps`, `current`, `canGoTo`, `onStepClick`.
- Qadam: 24px doira (mono, 11px / 700) + nom (12px / 600, faqat ≥1024px); qadamlar orasida 1px chiziq.
- Holatlar: o'tilgan — `--primary` fon va belgi, chizig'i ham `--primary`; joriy — `--primary-soft` fon, `--primary` chegara, `aria-current="step"`; kelgusi — `--card` fon, `--border` chegara.
- O'tilgan qadamga bosib qaytiladi (hover — `--secondary` fon); kelgusi qadam bosilmaydi, `canGoTo` bilan o'zgartiriladi.
- <768px: doiralar o'rniga joriy qadam nomi va "3 / 8" sanog'i.

### 11.23 LogView — `log-view.tsx`

- Deploy loglari uchun: mono 12px, to'q fon (`--log-*` tokenlari), radius `--r-card`, standart balandlik 320px, o'zi aylanadi.
- Qator turlari (`kind`): `cmd` — bajarilgan buyruq (oldida `$`, `--log-cmd`, qalin), `out` — natija, `err` — xato (`--log-err`), `info` — izoh (kursiv, `--log-muted`).
- Yangi qator kelganda pastga o'zi aylanadi; foydalanuvchi yuqoriga aylantirgan bo'lsa joyida qoladi.
- `live`: oxirida miltillovchi kursor (jarayon davom etyapti). `empty`: qator yo'q paytdagi matn.
- `role="log"`, `aria-live="polite"`.

### 11.24 StepList — `step-list.tsx`

- Ketma-ket bajariladigan qadamlar (deploy): 24px doira ichida holat ikonkasi, nom (13px / 600), o'ngda mono `meta` (masalan davomiylik).
- Holatlar: `pending` — nuqta, `running` — aylanuvchi ikonka (`--primary-soft`), `ok` — belgi (success ranglari), `failed` — × (danger ranglari), `skipped` — chiziqcha. `pending` va `skipped` nomi yordamchi rangda.
- `onSelect` berilsa qatorlar tugma bo'ladi (hover va tanlangan — `--secondary` fon); qayta bosilsa tanlov olinadi.
- Stepper'dan farqi: Stepper — foydalanuvchi yuradigan forma qadamlari (gorizontal); StepList — tizim bajaradigan ish holati (vertikal).

### 11.25 Notice — `notice.tsx`

- Sahifa ichidagi doimiy xabar (toast emas): 1px chegara, radius `--r-card`, padding 16 × 12px, matn 13px, chapda 16px ikonka.
- `tone`: `info` (standart), `success`, `warning`, `danger` — Badge bilan bir xil holat ranglari.
- `warning` va `danger` — `role="alert"`, qolganlari `role="status"`.

### 11.26 PageHeader, EmptyState — `page-header.tsx`

- `PageHeader`: sahifa sarlavhasi (`type-heading`, `--page-title-size`), ostida 13px izoh, o'ngda amallar; pastdan 24px oraliq.
- `EmptyState`: kartochka ichida markazda 48px ikonka qutisi (`--r-card`, `bg-muted`), sarlavha, izoh va ixtiyoriy tugma.
- Panel va shablonlar uchun umumiy (avval panel ichida edi).

### 11.27 MoneyInput — `money-input.tsx`

- `controlClass` asosida, mono shrift; faqat raqam qabul qiladi va minglikni bo'shliq bilan ko'rsatadi ("1 500 000").
- Qiymat butun son yoki `null` (bo'sh); `suffix` — o'ngdagi birlik ("so'm"). `formatMoney()` jadval va kartochkalarda ham ishlatiladi.

### 11.28 ColorSwatches — `color-swatches.tsx`

- Foydalanuvchi tanlaydigan rang (kurs, filial): kvadrat namunalar to'ri (`--r-control`), tanlanganida `--focus-outline` kontur va belgi.
- Ranglar chaqiruvchidan keladi (`options`: `#rrggbb` + nom) — bu ma'lumot, interfeys tokeni emas; komponentning o'z ko'rinishi faqat tokenlardan.
- `custom` — ro'yxatdan tashqari rang (brauzerning rang tanlagichi). `role="radiogroup"`, har namuna `role="radio"` va nomi bilan.

### 11.29 Meter — `meter.tsx`

- Bitta ulush chegaraga nisbatan (CPU, xotira, disk): ustida nom va `NN% · tafsilot` (mono), ostida 6px yo'l.
- To'ldirilgan qism holatni bildiradi: `--primary` → `warnAt` dan `--warning-fg` → `dangerAt` dan `--danger-fg`; bo'sh yo'l — shu rangning 16% li och qatlami. Qiymat har doim matnda ham bor (rang yolg'iz ma'no tashimaydi).
- `state` — holatni chaqiruvchi o'zi beradi (chegaralar o'rniga), masalan xarajat rejasi: 80% dan sariq, limitdan oshsa qizil.
- `overflow` — 100% dan oshgan qiymat matnda haqiqiy foiz bilan (masalan, `130%`), yo'l to'la qoladi.
- `role="meter"`, `aria-valuenow`, `aria-valuetext`.

### 11.30 LineChart — `line-chart.tsx`

- Vaqt bo'yicha chiziqli grafik, bitta Y o'qi (0…`max`). Ikki o'qli grafik qilinmaydi.
- 2px chiziqlar, yengil to'r (`--border-soft`, 3 chiziq), mono belgilar. Tepada legenda: qisqa chiziq, nom va oxirgi qiymat.
- Kursor eng yaqin nuqtaga yopishadi: vertikal chiziq, nuqtalar va bitta oynada hamma qatorlar qiymati. Klaviaturada ←/→ bilan yuriladi, Esc yopadi.
- Ekran o'quvchilari uchun yashirin jadval (`caption` majburiy).
- Qator ranglari 3.3a tokenlaridan.

### 11.31 FilterBar — `filter-bar.tsx`

- Ro'yxat filtrlari hamma sahifada bitta ko'rinishda: sarlavhasiz boshqaruvlar bir qatorda, `p-3`, `gap-2`.
- Tartib: qidiruv (`FilterSearch`, qolgan kenglikni oladi) → sana oralig'i (`FilterDates`, "—" bilan) → tanlovlar (`FilterSelect`, birinchi band "Barcha ..." / "Holat (Hammasi)") → belgilar va "Tozalash" → o'ngda `FilterEnd` (yozuvlar soni, jami).
- Yorliqlar ko'rinmaydi — `aria-label` va `title` sifatida beriladi.
- Filtr qatori har doim alohida karta (`standalone`, Guruhlar sahifasidagidek): ro'yxat yoki jadval kartasidan oldin, ular orasida sahifa oralig'i.
- "Qo'shish" tugmasi filtr qatorida emas, sahifa sarlavhasida.

### 11.32 Grafiklar: Sparkline, DonutChart, Gauge, TrendChart

- Ranglar faqat 3.3a tokenlaridan (qator tartibi qat'iy: tushum `--chart-1`, chiqim `--chart-2`); holat ma'nosidagi bo'laklar (faol, muzlatilgan, ketgan) — `--success-fg` / `--warning-fg` / `--danger-fg`, har doim yozuv bilan.
- **Sparkline** (`sparkline.tsx`) — KPI kartasidagi kichik grafik: `area` (trend) yoki `bar` (taqqoslash), o'q va yorliqsiz, ekran o'quvchisidan yashirin (qiymat kartada matn bilan).
- **DonutChart** (`donut-chart.tsx`) — halqa va yonida legenda (har doim). Bo'laklar orasida 2px oraliq; ustiga kelganda bo'lak qalinlashadi, qolganlari xiralashadi, markazda foiz. Ko'pi bilan 4 kategoriya rangi — qolgani "Boshqa".
- **Gauge** (`gauge.tsx`) — bitta ulush 270° yoyda, markazda foiz, `role="meter"`.
- **TrendChart** (`trend-chart.tsx`) — vaqt bo'yicha bir nechta qator: chiziq (2px, birinchi qator 12% to'ldirish bilan) yoki guruhlangan ustunlar (2px oraliq, yuqori burchaklari 4px). Bitta Y o'qi (yozuv kengligiga qarab joy), uzuq "reja" chizig'i, legenda, kursor oynasi (← → bilan ham), yashirin jadval.

### 11.33 SearchSelect — `search-select.tsx`

- Qidiruvli tanlov: bitta qiymat (guruh tanlash) yoki `multiple` (ko'p tanlov, bandlarda checkbox). Bandda ikkinchi qator (`hint`) bo'lishi mumkin.
- Ro'yxat portalda emas, trigger ostida ochiladi (balandlik bo'yicha silliq o'tish, `ease-ios`, 200ms) — 13-bo'lim 8-qoidasidan ongli istisno: Radix Dialog fokus tuzog'i portaldagi qidiruv maydoniga fokus bermaydi, forma esa ko'pincha modal ichida.
- Klaviatura: ↑ ↓ — band, Enter — tanlash, Escape — faqat ro'yxat yopiladi (modal emas). Tashqariga bosilsa yopiladi.
- Bitta tanlovda tanlangan bandni qayta bosish — tozalash.

### 11.34 MetricCard — `metric-card.tsx`

- Profil tepasidagi ixcham ko'rsatkich (o'qituvchi profili, ADR 0021): yorliq va o'ngda kichik rangli ikonka yoki belgi (`badge`, masalan "Qarz"), ostida katta qiymat + birlik, chiziq ostida izoh (`foot`).
- StatCard'dan farqi — bir qatorga 5–6 ta sig'adi; StatCard sahifa statistikasi uchun qoladi.
- Ohang (`tone`): `neutral`, `primary`, `success`, `warning`, `danger`, `info` — faqat holat tokenlari. `colorValue` — qiymat ham ohang rangida; `highlight` — karta foni va chegarasi ohangda (balans qarzda yoki qoldiqda).

### 11.35 ListCard — `list-card.tsx`

- Sarlavhali qisqa ro'yxat kartasi ("Bugungi ishlar" bloklari, ADR 0027):
  - tepada sarlavha, soni va o'ngda amal (`action`, odatda "Ochish" havolasi);
  - ostida qatorlar;
  - oxirida ixtiyoriy `footer` ("Yana N ta").
- `count` 0 bo'lsa — `empty` matni markazda.
- `ListCardRow` — qator:
  - `title` (odatda havola);
  - `sub` — ikkinchi qator: telefon, guruh, izoh;
  - o'ngda `aside` va uning ostida `asideSub` (masalan sana);
  - `tone` — `aside` rangi: `muted`, `primary`, `success`, `warning`, `danger` (faqat holat tokenlari);
  - `children` — qator ostida.
- `ListCardProgress` — qator ostidagi ingichka progress chizig'i (`role="progressbar"`).
- Havolalar ilovadan beriladi — komponent Next'ga bog'lanmaydi.
- Sahifa tepasidagi ko'rsatkichlar — `MetricCard` (11.34); ro'yxatli bloklar — `ListCard`.

### 11.36 SelectionBar — `selection-bar.tsx`

- Jadvalda qatorlar tanlanganda pastda, o'rtada suzib chiqadigan amallar paneli (o'quvchilar ro'yxati, ADR 0028):
  - "N ta tanlandi";
  - amal tugmalari (`SelectionBarAction`, xavflisi `tone="danger"`);
  - tanlovni bekor qilish (X).
- Tanlov bo'lmasa pastga tushib yo'qoladi:
  - animatsiya faqat `translate` va `opacity` (Tailwind v4 siljitishni `translate` xususiyati bilan beradi), `--ease-ios`, 300ms;
  - yopilayotganda oxirgi son ko'rinib turadi;
  - yashiringanda `inert` (`visibility` emas);
  - `prefers-reduced-motion` — animatsiyasiz.
- Qatlam — `--z-topbar`, modaldan past: amal oynasi ochilganda panel uning orqasida qoladi.
- Panel ochiq paytda sahifa pastiga joy qoldiring (`pb-20`), pagination yopilib qolmasin.
- Qatorni tanlash — `Checkbox`; sarlavhadagi checkbox sahifadagilarni tanlaydi (`"indeterminate"` — bir qismi tanlangan).
  Tanlangan qator — `bg-primary-soft`.

## 12. Fokus va qulaylik

- Umumiy `:focus-visible`: 2px `--focus-outline` kontur, 2px masofa.
- Input, select, checkbox, radio, switch: `--ring-shadow` (3px) va `--ring-border` chegara. Xatoda `--error-ring` (3px).
- Tablar: fokusda halqa o'rniga `--secondary` fon.
- Dropdown va select: fokus trigger'da qoladi, `aria-activedescendant`, `role="menu"` / `listbox`, `menuitem` / `option`.
- Modal: Radix Dialog — fokus ushlanadi, Escape, `aria` sarlavha va izoh.
- Toast: Radix Toast — `aria-live`, surib yopish.
- Rang kontrasti (WCAG AA) `packages/ui/src/lib/contrast.test.ts` bilan har CI'da tekshiriladi (3.5-bo'lim).

## 13. Yangi komponent qo'shish qoidalari

1. Rang — faqat token (`bg-card`, `text-muted-foreground`, `bg-(--danger-bg)`). `#hex` yozilmaydi.
2. Brendga bog'liq rang kerak bo'lsa, `--primary` dan hosil qiling (`color-mix`), yangi qat'iy ko'k yozmang.
3. O'lcham — mavjud tokenlar: `h-(--control-h)`, `h-(--control-h-sm)`, `px-(--btn-px)`.
4. Radius — `rounded-btn`, `rounded-control`, `rounded-card`, `rounded-menu`, `rounded-modal`, `rounded-check`. Arbitrary radius yo'q.
5. Matn — 4.2 shkalasi yoki `type-*` rol. `text-[13px]` yo'q.
6. Qatlam — `z-(--z-…)`.
7. Input turidagi element — `controlClass` dan; menyu bandi — `menuItemClass` dan.
8. Ochiladigan element — `DropdownMenuContent` yoki `Modal` ustida (morph va fokus mantiqi tayyor).
9. Ikonka o'lchami — 10-bo'lim jadvali.
10. Light va dark'da tekshiring; `prefers-reduced-motion` ni buzmang. Komponentni `/ui-preview` katalogiga qo'shing.
11. Yangi token kerak bo'lsa, `ventura.css` ga ikkala rejim uchun qo'shing va shu hujjatni yangilang.

## 14. Qarorlar jurnali

Hammasi Saidakbar tomonidan 2026-10-10 da qabul qilingan.

| # | Qaror |
| --- | --- |
| 1 | Panel bitta temada — "ventura". Ventura premium (landing) temasi panelga olinmadi; Unbounded va Onest shriftlari ishlatilmaydi. |
| 2 | Asosiy rang `#3f6df6`; boshqa barcha brend ranglari undan hosil qilinadi. Tugma va sidebar gradientlari alohida token, lekin ular ham `--primary` dan. |
| 3 | Soyalar yumshoq va pastga cho'zilgan; hover nuri brend rangida. Dark'da kartochka soyasiz. |
| 4 | Topbar shaffof + `blur(14px)` — orqadagi kontent xira ko'rinadi. |
| 5 | Danger tugma — primary kabi gradient (qizil → atirgul → pushti). |
| 6 | Input foni sahifa foni bilan bir xil. |
| 7 | Barcha tugma, input va sidebar bandlari bitta radiusda (`--r-btn`, 12px); checkbox — uning yarmi. |
| 8 | Bir xil elementlar bir xil qiymatda: hamma matnli tugmada 1px chegara; "outline" varianti `ghost` ga birlashtirildi; menyu bandi, izoh matni, pill, ikonka o'lchamlari tenglashtirildi. |
| 9 | Matn shkalasi (`2xs` / `caption` / `body` / `title`) va z-index shkalasi joriy qilindi. |
| 10 | Morph animatsiyalari: dropdown, select, flyout (360 / 280ms), markaziy va tasdiqlash modali (460 / 440ms), drawer (320ms). Uch nuqtali kichik tugmalar ham to'liq morph. |
| 11 | Modal standarti — o'ngdan drawer; markaziy variant `position="center"`. |
| 12 | Xavfli amallar nomini yozib tasdiqlanadi (`requireText`). |
| 13 | Logo va tizim nomi sozlanadigan (`brandName`, `brandMark`). |
| 14 | Kodda va fayl nomlarida eski loyiha nomi ishlatilmaydi; tema, route va tokenlar "ventura" nomida. |
| 15 | Raqam, domen, sana va telefon uchun haqiqiy mono shrift (JetBrains Mono); eng qalin vazn 700. |

## 15. Ochiq masalalar

- Brend rangini almashtirganda kontrast: test faqat standart `--primary` uchun; boshqa rang berilsa, `pnpm --filter @ventura/ui test` bilan qayta tekshiring.
- Select'da harf bilan qidirish (typeahead).
- Keyingi bosqichlar komponentlari: skeleton, tooltip, nusxalash va yashirin qiymat maydoni, sana tanlash, logo yuklash.
