import { addMonths } from "./billing";

/*
 * Moliyaviy hisobot ko'rinishlari uchun toza yordamchilar (ADR 0030, 0034): grafik oynasi, oldingi davr va o'zgarish.
 * Vitest bilan sinaladi (finance-views.test.ts).
 */

/** Davrning kerakli qismi: yil va oy (ikkalasi null — barcha davr) */
export interface PeriodLike {
  year: number | null;
  month: number | null;
}

const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** Grafik oylari (eskisi birinchi): oy — shu oy oxirgi bo'lgan `count` oy; yil — yil oylari (kelmagani yo'q); barcha davr — oxirgi 12 oy */
export function trendMonths(p: PeriodLike, today: string, count = 6): string[] {
  const thisMonth = today.slice(0, 7);
  if (p.year !== null && p.month !== null) {
    const last = key(p.year, p.month);
    return Array.from({ length: count }, (_, i) => addMonths(last, i - count + 1));
  }
  if (p.year !== null) {
    const all = Array.from({ length: 12 }, (_, i) => key(p.year!, i + 1));
    const past = all.filter((m) => m <= thisMonth);
    return past.length ? past : all;
  }
  return Array.from({ length: 12 }, (_, i) => addMonths(thisMonth, i - 11));
}

/** Taqqoslanadigan oldingi davr oylari: oy — o'tgan oy, yil — o'tgan yil; barcha davr — yo'q */
export function previousMonths(p: PeriodLike): string[] | null {
  if (p.year === null) return null;
  if (p.month !== null) return [addMonths(key(p.year, p.month), -1)];
  return Array.from({ length: 12 }, (_, i) => key(p.year! - 1, i + 1));
}

/** Oylar to'plamini qamrab oladigan [from, to) sanalar */
export function monthBounds(months: readonly string[]): { from: string; to: string } {
  const sorted = [...months].sort();
  return { from: `${sorted[0]}-01`, to: `${addMonths(sorted[sorted.length - 1]!, 1)}-01` };
}

/** Oy → summa xaritasiga qo'shish */
export function addTo(map: Map<string, number>, month: string, amount: number) {
  map.set(month, (map.get(month) ?? 0) + amount);
}

/** Tanlangan oylar yig'indisi; `months` null — hammasi */
export function sumMonths(map: ReadonlyMap<string, number>, months: readonly string[] | null): number {
  let s = 0;
  for (const [m, v] of map) if (!months || months.includes(m)) s += v;
  return s;
}

/** Joriy qiymatning oldingiga nisbatan o'zgarishi, %; oldingi 0 yoki yo'q bo'lsa null */
export function change(cur: number, prev: number | null): number | null {
  return prev !== null && prev > 0 ? ((cur - prev) / prev) * 100 : null;
}

/** "+12.5%" / "−3.0%" */
export function signedPercent(v: number): string {
  return `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;
}
