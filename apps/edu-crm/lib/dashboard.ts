/*
 * Bosh panel (eski tizimdagi DashboardHome) hisoblari — toza funksiyalar, Vitest bilan (ADR 0017). Pul oqimi
 * kunlik yig'indilardan olinadi: o'quvchi to'lovlari va qo'shimcha daromad — tushum; xarajatlar va qaytarishlar —
 * chiqim (ish haqi E3c'da qo'shiladi). Bekor qilingan yozuvlar bu yerga umuman kelmaydi.
 */

/** Bir kunlik pul harakati */
export interface DayFlow {
  date: string;
  kind: "pay" | "income" | "refund" | "expense";
  amount: number;
  count: number;
  /** Xarajat toifasi (faqat `expense`) */
  category?: string;
}

/** [from, to) — sanalar "YYYY-MM-DD"; null — barcha davr */
export type Range = { from: string; to: string } | null;

export interface Totals {
  income: number;
  expense: number;
  refund: number;
  outflow: number;
  profit: number;
  payCount: number;
  categories: Record<string, number>;
}

export const inRange = (date: string, r: Range) => !r || (date >= r.from && date < r.to);

export function totalsFor(flows: readonly DayFlow[], r: Range): Totals {
  const t: Totals = { income: 0, expense: 0, refund: 0, outflow: 0, profit: 0, payCount: 0, categories: {} };
  for (const f of flows) {
    if (!inRange(f.date, r)) continue;
    if (f.kind === "pay" || f.kind === "income") {
      t.income += f.amount;
      if (f.kind === "pay") t.payCount += f.count;
    } else if (f.kind === "refund") t.refund += f.amount;
    else {
      t.expense += f.amount;
      const c = f.category ?? "";
      t.categories[c] = (t.categories[c] ?? 0) + f.amount;
    }
  }
  t.outflow = t.expense + t.refund;
  t.profit = t.income - t.outflow;
  return t;
}

/* ---------- Davr ---------- */

const pad = (n: number) => String(n).padStart(2, "0");
export const monthKey = (y: number, m: number) => {
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
};
/** Oy oralig'i [1-kun, keyingi oyning 1-kuni) */
export const monthRange = (month: string): { from: string; to: string } => {
  const [y, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: `${monthKey(y!, m! + 1)}-01` };
};
export const addMonths = (month: string, n: number) => {
  const [y, m] = month.split("-").map(Number);
  return monthKey(y!, m! + n);
};
export const addDays = (date: string, n: number) => {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
};

export interface Period {
  /** null — barcha yillar */
  year: number | null;
  /** 1–12; null — barcha oylar */
  month: number | null;
  cur: Range;
  prev: Range;
  /** Guruhlar jadvali, yig'ilish va 12 oylik grafik shu oyga qaraydi */
  focusMonth: string;
  /** Kunlik grafik shu kungacha (davr tugagan bo'lsa — uning oxirgi kuni) */
  anchor: string;
  kind: "month" | "year" | "all";
}

/**
 * Eski tizimdagidek: yil va oy tanlansa — o'sha oy (oldingisi — o'tgan oy); faqat yil — o'sha yil (oldingisi —
 * o'tgan yil); "barcha" — butun davr, solishtirishsiz. Oy tanlanib yil "barcha" bo'lsa — joriy yildagi o'sha oy.
 */
export function resolvePeriod(year: number | null, month: number | null, today: string): Period {
  const cy = Number(today.slice(0, 4));
  const cm = Number(today.slice(5, 7));
  let p: Omit<Period, "anchor">;
  if (month !== null) {
    const y = year ?? cy;
    const key = monthKey(y, month);
    p = { year: y, month, cur: monthRange(key), prev: monthRange(addMonths(key, -1)), focusMonth: key, kind: "month" };
  } else if (year !== null) {
    p = {
      year,
      month: null,
      cur: { from: `${year}-01-01`, to: `${year + 1}-01-01` },
      prev: { from: `${year - 1}-01-01`, to: `${year}-01-01` },
      focusMonth: monthKey(year, year === cy ? cm : 12),
      kind: "year",
    };
  } else {
    p = { year: null, month: null, cur: null, prev: null, focusMonth: monthKey(cy, cm), kind: "all" };
  }
  const anchor = p.cur && p.cur.to <= today ? addDays(p.cur.to, -1) : today;
  return { ...p, anchor };
}

/* ---------- Ko'rinish ---------- */

const trim = (x: number) => (x >= 100 ? String(Math.round(x)) : x.toFixed(1).replace(/\.0$/, ""));

/** 1 250 000 → { v: "1.3", u: "mln" } (eski tizimdagi qisqa yozuv) */
export function compact(n: number): { v: string; u: "" | "ming" | "mln" | "mlrd" } {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (a >= 1e9) return { v: sign + trim(a / 1e9), u: "mlrd" };
  if (a >= 1e6) return { v: sign + trim(a / 1e6), u: "mln" };
  if (a >= 1e3) return { v: sign + trim(a / 1e3), u: "ming" };
  return { v: sign + String(Math.round(a)), u: "" };
}
export const compactStr = (n: number) => {
  const c = compact(n);
  return c.u ? `${c.v} ${c.u}` : c.v;
};

export type DeltaTone = "up" | "down" | "flat";

/**
 * KPI o'zgarishi oldingi davrga nisbatan. `good` — o'sish yaxshimi (tushum — ha, chiqim — yo'q).
 * `mode`: foiz (standart), foiz punkti (`pp`, davomat) yoki son (`count`).
 */
export function kpiDelta(
  cur: number,
  prev: number | null | undefined,
  good: "up" | "down",
  mode: "percent" | "pp" | "count" = "percent",
): { text: string; tone: DeltaTone } | null {
  if (prev === null || prev === undefined) return null;
  const diff = cur - prev;
  const sign = diff >= 0 ? "+" : "−";
  let text: string;
  if (mode === "pp") text = `${sign}${Math.abs(diff).toFixed(1)} p.p.`;
  else if (mode === "count") text = `${sign}${Math.abs(diff)}`;
  else if (!prev) return { text: "—", tone: "flat" };
  else text = `${sign}${Math.abs((diff / Math.abs(prev)) * 100).toFixed(1)}%`;
  const tone: DeltaTone = diff === 0 ? "flat" : diff > 0 === (good === "up") ? "up" : "down";
  return { text, tone };
}

/** Bo'lak foizi: "12.5%"; jami 0 bo'lsa — bo'sh */
export const pctOf = (v: number, total: number) => (total > 0 ? `${((v / total) * 100).toFixed(1)}%` : "");

/** Eng kattasidan 3 tasi va qolgani "Boshqa" ga (beshinchi rang yasalmaydi) */
export function topWithOther(entries: readonly [string, number][], other: string, keep = 3): [string, number][] {
  const sorted = entries.filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, keep);
  const rest = sorted.slice(keep).reduce((s, e) => s + e[1], 0);
  return rest > 0 ? [...top, [other, rest]] : top;
}
