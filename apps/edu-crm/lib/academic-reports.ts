import { addMonths } from "./billing";

/*
 * O'quv hisobotlari (E5b, ADR 0031) — toza funksiyalar (Vitest): guruhdan chiqish sabablari, xavfli o'quvchilar,
 * o'quvchini ushlab turish. Ma'lumot serverda yig'iladi (lib/server/academic-reports.ts).
 */

const DAY = 86_400_000;
export const daysBetween = (from: string, to: string) =>
  Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY));

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : null);
const avg = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/* ---------- Guruhdan chiqish sabablari ---------- */

export interface LeaveRecord {
  membershipId: string;
  studentId: string;
  groupId: string;
  enrolledAt: string;
  leftAt: string;
  /** Hech faollashtirilmagan — sinovda chiqqan */
  trial: boolean;
  reason: string | null;
  /** Davr ichidagi darslar: bor + kech va belgilangan */
  attended: number;
  marked: number;
}

export interface ReasonLine {
  reason: string;
  count: number;
  share: number;
  trial: number;
  active: number;
  avgDays: number | null;
  /** Davomat, %; belgilangan dars bo'lmasa null */
  rate: number | null;
}

export interface GroupLine {
  groupId: string;
  count: number;
  trial: number;
  share: number;
}

export interface LeaveSummary {
  total: number;
  students: number;
  trial: number;
  avgDays: number | null;
  byReason: ReasonLine[];
  byGroup: GroupLine[];
}

/** Sabab bo'yicha (sabab ko'rsatilmagani — `noReason`) va guruh bo'yicha; ko'pidan kamiga */
export function leaveSummary(records: readonly LeaveRecord[], noReason: string): LeaveSummary {
  const total = records.length;
  const reasons = new Map<string, LeaveRecord[]>();
  const groups = new Map<string, LeaveRecord[]>();
  for (const r of records) {
    const key = r.reason?.trim() || noReason;
    reasons.set(key, [...(reasons.get(key) ?? []), r]);
    groups.set(r.groupId, [...(groups.get(r.groupId) ?? []), r]);
  }
  const rateOf = (list: readonly LeaveRecord[]) => {
    const marked = list.reduce((s, r) => s + r.marked, 0);
    return pct(
      list.reduce((s, r) => s + r.attended, 0),
      marked,
    );
  };
  return {
    total,
    students: new Set(records.map((r) => r.studentId)).size,
    trial: records.filter((r) => r.trial).length,
    avgDays: avg(records.map((r) => daysBetween(r.enrolledAt, r.leftAt))),
    byReason: [...reasons]
      .map(([reason, list]) => ({
        reason,
        count: list.length,
        share: pct(list.length, total) ?? 0,
        trial: list.filter((r) => r.trial).length,
        active: list.filter((r) => !r.trial).length,
        avgDays: avg(list.map((r) => daysBetween(r.enrolledAt, r.leftAt))),
        rate: rateOf(list),
      }))
      .sort((a, b) => b.count - a.count || (a.reason === noReason ? 1 : b.reason === noReason ? -1 : 0)),
    byGroup: [...groups]
      .map(([groupId, list]) => ({
        groupId,
        count: list.length,
        trial: list.filter((r) => r.trial).length,
        share: pct(list.length, total) ?? 0,
      }))
      .sort((a, b) => b.count - a.count),
  };
}

/* ---------- Xavfli o'quvchilar ---------- */

/** Chegaralar (eski tizimdagi standart sozlamalar; baholar Ventura'da hali yo'q) */
export const RISK = {
  /** Ketma-ket qoldirgan darslar */
  consecutive: 2,
  /** Shu oyda qoldirgan darslar */
  monthMissed: 3,
  /** 30 kunlik davomat, % dan past (kamida `minMarked` belgilangan dars bo'lsa) */
  lowRate: 70,
  minMarked: 4,
  /** Qarz, so'mdan ko'p */
  debt: 100_000,
} as const;

export type RiskFactor = "consecutive" | "missed" | "uncontacted" | "debt";
export type RiskLevel = "critical" | "high" | "medium";

export interface RiskInput {
  consecutive: number;
  missedThisMonth: number;
  /** 30 kunlik davomat, %; belgilanmagan bo'lsa null */
  rate: number | null;
  marked: number;
  /** Oxirgi qoldirilgan darsdan keyin bog'lanilgan (qoldirmagan bo'lsa — true) */
  contacted: boolean;
  debt: number;
}

export interface Risk {
  factors: RiskFactor[];
  score: number;
  level: RiskLevel;
}

/**
 * Xavf balli (eski tizimdagidek): ketma-ket qoldirish — har dars 30, ko'p qoldirish yoki past davomat — har dars 15
 * (kamida 15), qoldirgandan keyin bog'lanilmagan — 20, qarz — 20. Kritik: 70+ ball yoki 3+ ketma-ket; yuqori: 40+.
 * Omil bo'lmasa null.
 */
export function riskOf(i: RiskInput): Risk | null {
  const factors: RiskFactor[] = [];
  let score = 0;
  if (i.consecutive >= RISK.consecutive) {
    factors.push("consecutive");
    score += i.consecutive * 30;
  }
  const lowRate = i.marked >= RISK.minMarked && i.rate !== null && i.rate < RISK.lowRate;
  if (i.missedThisMonth >= RISK.monthMissed || lowRate) {
    factors.push("missed");
    score += Math.max(1, i.missedThisMonth) * 15;
  }
  if (factors.length && !i.contacted) {
    factors.push("uncontacted");
    score += 20;
  }
  if (i.debt > RISK.debt) {
    factors.push("debt");
    score += 20;
  }
  if (!factors.length) return null;
  const level: RiskLevel = score >= 70 || i.consecutive >= 3 ? "critical" : score >= 40 ? "high" : "medium";
  return { factors, score, level };
}

/* ---------- O'quvchini ushlab turish ---------- */

export interface StudentSpan {
  studentId: string;
  /** Birinchi faollashtirilgan sana (sinovda qolib ketganlar hisobga kirmaydi) */
  firstJoin: string;
  /** Ochiq a'zoligi yo'q yoki arxivda */
  churned: boolean;
  /** Ketgan bo'lsa — oxirgi chiqqan sana */
  lastLeft: string | null;
  lastReason: string | null;
  /** Hozirgi yoki (ketgan bo'lsa) oxirgi guruhining kursi */
  courseId: string | null;
}

/** Davr [from, to): baza — davr oxirigacha kelgan va davr boshigacha ketmagan; ketganlar — davr ichida ketgan */
export function churnStats(spans: readonly StudentSpan[], range: { from: string; to: string } | null) {
  const from = range?.from ?? "";
  const to = range?.to ?? "9999-12-31";
  const base = spans.filter((s) => s.firstJoin < to && (!s.churned || (s.lastLeft ?? "") >= from));
  const churned = base.filter((s) => s.churned && s.lastLeft !== null && s.lastLeft >= from && s.lastLeft < to);
  const churnRate = pct(churned.length, base.length);
  return { base, churned, churnRate, retentionRate: churnRate === null ? null : 100 - churnRate };
}

const monthDiff = (a: string, b: string) =>
  (Number(a.slice(0, 4)) - Number(b.slice(0, 4))) * 12 + (Number(a.slice(5, 7)) - Number(b.slice(5, 7)));

export interface CohortRow {
  month: string;
  size: number;
  /** k oydan keyin ham o'qiyotganlar ulushi, %; hali kelmagan oy — null */
  cells: (number | null)[];
}

/** Oxirgi `n` oyda kelganlar: kelgan oyi bo'yicha, k oydan keyin qolganlar ulushi */
export function cohorts(spans: readonly StudentSpan[], today: string, n = 6): CohortRow[] {
  const current = today.slice(0, 7);
  return Array.from({ length: n }, (_, i) => addMonths(current, i - n + 1)).map((month) => {
    const group = spans.filter((s) => s.firstJoin.startsWith(month));
    const cells = Array.from({ length: n }, (_, k) => {
      if (!group.length || monthDiff(current, month) < k) return null;
      if (k === 0) return 100;
      const kept = group.filter((s) => !s.churned || monthDiff((s.lastLeft ?? month).slice(0, 7), month) >= k);
      return (kept.length / group.length) * 100;
    });
    return { month, size: group.length, cells };
  });
}

/* ---------- Ko'rinish uchun qo'shimcha hisoblar (grafiklar) ---------- */

export type TenureKey = "week" | "month" | "quarter" | "half" | "long";

/** Qancha o'qib ketgan: 7 kungacha, 30 kungacha, 90 kungacha, 180 kungacha, undan ortiq */
const TENURE_LIMITS: readonly (readonly [TenureKey, number])[] = [
  ["week", 7],
  ["month", 30],
  ["quarter", 90],
  ["half", 180],
];

export const tenureKey = (days: number): TenureKey => TENURE_LIMITS.find(([, max]) => days <= max)?.[0] ?? "long";

/** Chiqishlar muddati bo'yicha taqsimot: har guruhda sinovda va faol chiqqanlar (bo'sh guruhlar ham qaytadi) */
export function tenureBuckets(items: readonly { days: number; trial: boolean }[]) {
  const keys: TenureKey[] = [...TENURE_LIMITS.map(([k]) => k), "long"];
  return keys.map((key) => {
    const list = items.filter((i) => tenureKey(i.days) === key);
    return { key, trial: list.filter((i) => i.trial).length, active: list.filter((i) => !i.trial).length };
  });
}

export interface TrendBucket {
  /** "YYYY-MM-DD" (kun) yoki "YYYY-MM" (oy) */
  key: string;
  count: number;
}

const addDays = (d: string, n: number) => {
  const [y, m, dd] = d.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, dd! + n)).toISOString().slice(0, 10);
};

const monthKeys = (from: string, to: string) => {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
};

/**
 * Chiqishlar dinamikasi: bitta oy tanlansa — kunlar (oy boshidan bugungacha), aks holda oylar (yil — shu yil
 * bugungi oygacha, barcha davr — oxirgi 24 oy). Kelajak bo'sh ustun bo'lib chizilmaydi.
 */
export function leaveTrend(
  leftDates: readonly string[],
  range: { from: string; to: string } | null,
  monthly: boolean,
  today: string,
): TrendBucket[] {
  const count = (prefix: string) => leftDates.filter((d) => d.startsWith(prefix)).length;
  if (range && !monthly) {
    const last = range.to <= today ? addDays(range.to, -1) : today;
    const out: TrendBucket[] = [];
    for (let d = range.from; d <= last; d = addDays(d, 1)) out.push({ key: d, count: count(d) });
    return out;
  }
  const cur = today.slice(0, 7);
  const first = range ? range.from.slice(0, 7) : (leftDates.map((d) => d.slice(0, 7)).sort()[0] ?? cur);
  const lastKey = range ? addMonths(range.to.slice(0, 7), -1) : cur;
  const keys = monthKeys(first, lastKey < cur ? lastKey : cur);
  return (range ? keys : keys.slice(-24)).map((key) => ({ key, count: count(key) }));
}

export interface RetentionPoint {
  month: string;
  base: number;
  churned: number;
  /** Ushlab turish, %; baza bo'sh bo'lsa null */
  rate: number | null;
}

/** Oxirgi `n` oy (joriy oy oxirida): har oy uchun ushlab turish — shu oyning o'zida baza va ketganlar */
export function monthlyRetention(spans: readonly StudentSpan[], today: string, n = 12): RetentionPoint[] {
  const current = today.slice(0, 7);
  return Array.from({ length: n }, (_, i) => addMonths(current, i - n + 1)).map((month) => {
    const s = churnStats(spans, { from: `${month}-01`, to: `${addMonths(month, 1)}-01` });
    return { month, base: s.base.length, churned: s.churned.length, rate: s.retentionRate };
  });
}

export interface RiskItem {
  studentId: string;
  groupId: string;
  level: RiskLevel;
  factors: readonly RiskFactor[];
}

const LEVELS: readonly RiskLevel[] = ["critical", "high", "medium"];

/**
 * Xavf taqsimoti: o'quvchilar — o'z eng yuqori darajasi bo'yicha (ko'p guruhda bo'lsa bir marta), omillar — shu omili
 * bor o'quvchilar, guruhlar — shu guruhdagi xavfli o'quvchilar; guruhlar ko'pidan kamiga.
 */
export function riskBreakdown(items: readonly RiskItem[]) {
  const best = new Map<string, number>();
  for (const i of items) best.set(i.studentId, Math.min(best.get(i.studentId) ?? 9, LEVELS.indexOf(i.level)));
  const levels = LEVELS.map((level, idx) => ({ level, count: [...best.values()].filter((v) => v === idx).length }));
  const factorKeys: RiskFactor[] = ["consecutive", "missed", "uncontacted", "debt"];
  const factors = factorKeys.map((factor) => ({
    factor,
    count: new Set(items.filter((i) => i.factors.includes(factor)).map((i) => i.studentId)).size,
  }));
  const perGroup = new Map<string, Set<string>>();
  for (const i of items) perGroup.set(i.groupId, (perGroup.get(i.groupId) ?? new Set()).add(i.studentId));
  const groups = [...perGroup]
    .map(([groupId, set]) => ({ groupId, count: set.size }))
    .sort((a, b) => b.count - a.count);
  return { students: best.size, levels, factors, groups };
}
