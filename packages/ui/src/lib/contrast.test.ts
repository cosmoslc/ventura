import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { over, ratio, resolveColors, tokensFor, type Mode } from "./contrast";

// WCAG 2.x AA: matn 4.5:1, katta matn va interfeys elementlari (chegara, ikonka, grafik) 3:1.
// Tokenlar to'g'ridan-to'g'ri ventura.css dan o'qiladi: token o'zgarsa, shu test darrov tekshiradi.

const css = readFileSync(fileURLToPath(new URL("../../../config/tokens/ventura.css", import.meta.url)), "utf8");

const TEXT = 4.5;
const UI = 3;

type Pair = {
  /** oldingi plan (rang token'i yoki gradient) */
  fg: string;
  /** orqa fon qatlamlari pastdan yuqoriga (shaffof fonlar ostidagisi bilan birga) */
  bg: string[];
  min: number;
  /** faqat bir rejimda tekshiriladi */
  only?: Mode;
};

const v = (name: string) => `var(--${name})`;
const SURFACES = ["background", "card"] as const;
// Badge/toast fonlari kartochka (yoki sahifa) ustida shaffof: ikkala ostki fon bilan tekshiriladi.
const STATUSES = ["success", "warning", "danger", "info", "neutral"] as const;

const PAIRS: Pair[] = [
  // Asosiy matn
  ...SURFACES.map((s) => ({ fg: v("foreground"), bg: [v(s)], min: TEXT })),
  { fg: v("popover-foreground"), bg: [v("popover")], min: TEXT },
  // Yordamchi matn: yorliq, jadval sarlavhasi, izoh (muted-foreground fon, kartochka, muted, jadval boshi ustida)
  ...[...SURFACES, "muted", "secondary"].map((s) => ({ fg: v("muted-foreground"), bg: [v(s)], min: TEXT })),
  { fg: v("muted-foreground"), bg: [v("card"), v("table-head")], min: TEXT },
  { fg: v("muted-foreground"), bg: [v("card"), v("table-row-hover")], min: TEXT },
  { fg: v("muted-foreground"), bg: [v("card"), v("table-foot")], min: TEXT },
  ...SURFACES.map((s) => ({ fg: v("label-fg"), bg: [v(s)], min: TEXT })),
  { fg: v("secondary-foreground"), bg: [v("secondary")], min: TEXT },
  { fg: v("accent-foreground"), bg: [v("accent")], min: TEXT },
  // Placeholder: input foni (= sahifa foni) va kartochka ustida
  ...SURFACES.map((s) => ({ fg: v("placeholder"), bg: [v(s)], min: UI })),
  // Urg'u matni (havola, domen)
  ...SURFACES.map((s) => ({ fg: v("primary-text"), bg: [v(s)], min: TEXT })),
  { fg: v("primary-text"), bg: [v("card"), v("primary-soft")], min: TEXT },
  // Tugmalar
  // ikonka (belgi, raqamli qadam) primary fon ustida: 3:1; matn tugmalari gradient tokenlari bilan tekshiriladi
  { fg: v("primary-foreground"), bg: [v("primary")], min: UI },
  { fg: v("btn-primary-fg"), bg: [v("btn-primary-bg")], min: TEXT },
  { fg: v("btn-primary-fg-hover"), bg: [v("btn-primary-bg-hover")], min: TEXT },
  { fg: v("destructive-foreground"), bg: [v("btn-danger-bg")], min: TEXT },
  { fg: v("destructive-foreground"), bg: [v("btn-danger-bg-hover")], min: TEXT },
  { fg: v("btn-ghost-fg"), bg: [v("btn-ghost-bg")], min: TEXT },
  { fg: v("btn-ghost-fg-hover"), bg: [v("btn-ghost-bg-hover")], min: TEXT },
  { fg: v("icon-btn-fg"), bg: [v("icon-btn-bg")], min: UI },
  { fg: v("icon-btn-hover-fg"), bg: [v("card"), v("icon-btn-hover-bg")], min: UI },
  { fg: v("avatar-fg"), bg: [v("avatar-bg")], min: TEXT },
  // Xavfli matn va pul
  ...SURFACES.map((s) => ({ fg: v("destructive-text"), bg: [v(s)], min: TEXT })),
  ...SURFACES.flatMap((s) => [
    { fg: v("money-in"), bg: [v(s)], min: TEXT },
    { fg: v("money-out"), bg: [v(s)], min: TEXT },
  ]),
  // Holat ranglari: badge, toast, stat trendi (matn o'z foni ustida; fon kartochka/sahifa ustida shaffof)
  ...STATUSES.flatMap((s) => SURFACES.map((surf) => ({ fg: v(`${s}-fg`), bg: [v(surf), v(`${s}-bg`)], min: TEXT }))),
  // Holat matni to'g'ridan-to'g'ri kartochka/sahifa ustida (stat trendi, xato matni)
  ...["success", "warning", "danger", "info"].flatMap((s) =>
    SURFACES.map((surf) => ({ fg: v(`${s}-fg`), bg: [v(surf)], min: TEXT })),
  ),
  // Sidebar
  { fg: v("nav-fg"), bg: [v("sidebar-bg")], min: TEXT },
  { fg: v("nav-hover-fg"), bg: [v("nav-hover-bg")], min: TEXT },
  { fg: v("nav-parent-active-fg"), bg: [v("sidebar-bg")], min: TEXT },
  { fg: v("nav-active-fg"), bg: [v("nav-active-bg")], min: TEXT },
  { fg: v("nav-section-fg"), bg: [v("sidebar-bg")], min: TEXT },
  { fg: v("nav-chevron"), bg: [v("sidebar-bg")], min: UI },
  { fg: v("sub-fg"), bg: [v("sidebar-bg")], min: TEXT },
  { fg: v("sub-active-fg"), bg: [v("sidebar-bg"), v("sub-active-bg")], min: TEXT },
  { fg: v("nav-icon-color"), bg: [v("sidebar-bg")], min: UI, only: "dark" },
  // Topbar
  { fg: v("muted-foreground"), bg: [v("background"), v("search-bg")], min: TEXT },
  { fg: v("placeholder"), bg: [v("search-bg")], min: UI },
  // Interfeys elementlari: input chegarasi (input foni = sahifa foni, chegara yagona belgi) va o'chirilgan holat
  ...SURFACES.map((s) => ({ fg: v("input"), bg: [v(s)], min: UI })),
  { fg: v("input"), bg: [v("input-bg")], min: UI },
  { fg: v("input-hover"), bg: [v("card")], min: UI }, // Switch (o'chiq) yo'li
  // Fokus: kontur va halqa chegarasi
  ...SURFACES.map((s) => ({ fg: v("focus-outline"), bg: [v(s)], min: UI })),
  ...SURFACES.map((s) => ({ fg: v("ring-border"), bg: [v(s)], min: UI })),
  // Log oynasi (ikkala rejimda to'q)
  { fg: v("log-fg"), bg: [v("log-bg")], min: TEXT },
  { fg: v("log-muted"), bg: [v("log-bg")], min: TEXT },
  { fg: v("log-cmd"), bg: [v("log-bg")], min: TEXT },
  { fg: v("log-err"), bg: [v("log-bg")], min: TEXT },
  // Grafiklar: o'q yozuvi (muted-foreground, yuqorida) va qator ranglari (kartochka ustida)
  { fg: v("chart-1"), bg: [v("card")], min: UI },
  { fg: v("chart-2"), bg: [v("card")], min: UI },
  { fg: v("chart-3"), bg: [v("card")], min: UI, only: "dark" },
  { fg: v("chart-4"), bg: [v("card")], min: UI, only: "dark" },
];

/**
 * Ma'lum istisnolar (STYLE.md 3.3a): light'dagi chart-3 va chart-4 oq fonda 3:1 dan past, shuning uchun
 * grafikda faqat yonida yozuv (legenda, qiymat) bilan ishlatiladi. Quyi chegara — yomonlashmasligi uchun.
 */
const EXCEPTIONS: (Pair & { why: string })[] = [
  { fg: v("chart-3"), bg: [v("card")], min: 2.3, only: "light", why: "yonida yozuv bor" },
  { fg: v("chart-4"), bg: [v("card")], min: 2, only: "light", why: "yonida yozuv bor" },
];

/** Bir juftning eng yomon nisbati (gradient bo'laklari bo'yicha). */
function worst(pair: Pair, mode: Mode): number {
  const vars = tokensFor(css, mode);
  const fgs = resolveColors(pair.fg, vars);
  // qatlamlar: har bir qatlam bitta rang yoki gradient (bo'laklar bo'yicha tekshiriladi)
  let bases = [{ r: 255, g: 255, b: 255, a: 1 }];
  for (const layer of pair.bg) {
    bases = bases.flatMap((base) => resolveColors(layer, vars).map((c) => over(c, base)));
  }
  let min = Infinity;
  for (const fg of fgs) for (const bg of bases) min = Math.min(min, ratio(fg, bg));
  return min;
}

const MODES: Mode[] = ["light", "dark"];

describe("rang kontrasti (WCAG AA)", () => {
  for (const mode of MODES) {
    describe(mode, () => {
      for (const pair of PAIRS) {
        if (pair.only && pair.only !== mode) continue;
        it(`${pair.fg.slice(6, -1)} / ${pair.bg.map((b) => b.slice(6, -1)).join(" + ")} >= ${pair.min}`, () => {
          const r = worst(pair, mode);
          console.log(`${mode}\t${pair.fg}\t${pair.bg.join("+")}\t${pair.min}\t${r.toFixed(2)}`);
          expect(r).toBeGreaterThanOrEqual(pair.min);
        });
      }
      for (const pair of EXCEPTIONS) {
        if (pair.only && pair.only !== mode) continue;
        it(`istisno: ${pair.fg.slice(6, -1)} (${pair.why}) >= ${pair.min}`, () => {
          expect(worst(pair, mode)).toBeGreaterThanOrEqual(pair.min);
        });
      }
    });
  }
});
