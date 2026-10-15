# 0041. edu-crm: rang kontrasti (WCAG AA) tekshiruvi va mobil ko'rinish

2026-10-15 · qabul qilingan · E6l paketi, ADR 0034 (hisobot ko'rinishlari) cheklovlari davomi

## Vaziyat

`docs/design/STYLE.md` da rang kontrasti "hali to'liq tekshirilmagan" deb turardi. Qo'lda ko'zga ishonib tanlangan
yordamchi matn, placeholder, input chegarasi, sidebar bo'lim yozuvi va hover gradientlari amalda 1.1–4.4:1 oralig'ida
chiqdi (WCAG AA: matn 4.5:1, interfeys elementlari 3:1). Kontrast ko'zda emas, hisob bilan ushlanishi kerak: token
o'zgarsa, jim buzilmasligi uchun.

## Qaror

- **Avtomatik tekshiruv:** `packages/ui/src/lib/contrast.ts` (hisoblagich) va `contrast.test.ts` (juftlar ro'yxati).
  Test `packages/config/tokens/ventura.css` ni o'qiydi; `var()`, `color-mix()`, `oklch(from …)`, gradient bo'laklari
  va yarim shaffof fonlarni (kartochka yoki sahifa ustida) hisoblaydi. Light va dark alohida. `pnpm --filter
  @ventura/ui test` va `pnpm turbo run test` (CI) da ishlaydi; qo'shimcha asbob yo'q.
- **Chegaralar:** matn 4.5:1; interfeys elementlari (input chegarasi, Switch yo'li, fokus halqasi, placeholder,
  ikonka, grafik qatori) 3:1. Placeholder 3:1 da qoldi (4.5 qilinsa, kiritilgan matndan farqi yo'qoladi).
- **Input chegarasi 3:1.** Input foni sahifa foni bilan bir xil bo'lgani uchun chegara — maydonni ko'rsatuvchi yagona
  belgi; oldin 1.1:1 edi. Bu yagona sezilarli ko'rinish o'zgarishi. Yengillashtirish kerak bo'lsa, `--input` ni
  qaytarib, testda uni istisnoga o'tkazish kerak (qaror shu ADR'ni o'zgartirishni talab qiladi).
- **Tokenlar minimal o'zgartirildi** (rang tabiati saqlandi, faqat chegaraga yetguncha): `--muted-foreground`,
  `--label-fg`, `--placeholder`, `--primary-text`, `--input`, `--input-hover`, `--ring-border`, `--destructive-text`,
  `--money-in`, `--money-out`, `--nav-section-fg`, `--nav-chevron`, `--log-muted`, hover gradientlari. To'liq
  oldin/keyin jadvali — STYLE.md 3.5.
- **Hover tugmasi qorayadi, yorug'lashmaydi:** oq matn yorqinroq gradientda 3.5–4.1:1 berardi. `--primary-hover` ham
  shunday yo'nalishda edi.
- **Istisnolar (testda quyi chegara bilan qayd etilgan):** light `chart-3`, `chart-4` (yonida yozuv bor, ADR 0034);
  o'chirilgan elementlar; yonida yozuvi bor bezak ikonkalar (`--nav-hue-*`, stat-card).
- **Mobil (390 va 768 px):** sahifa gorizontal aylanmasligi, jadvallar o'z kartochkasi ichida aylanishi, asosiy tugmalar
  40 px dan past bo'lmasligi `apps/edu-crm/e2e/.tmp/mobile.mjs` (git'dan tashqari vaqtinchalik skript) bilan o'lchandi;
  topilgan kamchiliklar faqat CSS/joylashuv bilan tuzatildi, mantiq o'zgarmadi. Sahifalar ro'yxati va natija hisobotda.

## Oqibatlari

- Yangi rang tokeni qo'shilsa, uning juftini `contrast.test.ts` `PAIRS` ga qo'shish kerak (STYLE.md 13-qoida).
- Test faqat standart `--primary` (`#3f6df6` / `#4f79f6`) uchun. Mijoz brend rangini almashtirsa, gradient va
  `--primary-text` kontrasti o'zgaradi; panelda rang tanlanganda qayta tekshirish alohida ish (STYLE.md 15-bo'lim).
- `--primary-foreground` dark'da primary ustida 3.9:1: faqat belgi va raqamli qadam uchun; matnli tugmalar gradient
  tokeni orqali 4.5+ oladi.
