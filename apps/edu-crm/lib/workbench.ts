/*
 * "Bugungi ishlar" (E4d, ADR 0027) — toza funksiyalar, Vitest bilan. Eski tizimdagi "Bugungi ish stoli" bloklari:
 * bog'lanish kerak bo'lgan lidlar, bugungi birinchi darslar, mas'ulsiz yangi lidlar, bugun kelmaganlar, qarzdorlar,
 * tugayotgan guruhlar.
 */

const DAY_MS = 86_400_000;
const utc = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** b − a kunlarda (Toshkent kunlari, "YYYY-MM-DD") */
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY_MS);

/**
 * Guruh tugash sanasi: boshlanish + davomiylik (oy). Oy oxiri qisqa bo'lsa — o'sha oyning oxirgi kuni
 * (31-yanvar + 1 oy = 28/29-fevral). Davomiylik 0 — muddatsiz guruh, null.
 */
export function groupEndDate(start: string, months: number): string | null {
  if (!months) return null;
  const [y, m, d] = start.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, last));
  return target.toISOString().slice(0, 10);
}

export interface EndingGroup<T> {
  group: T;
  endDate: string;
  /** Tugashiga qolgan kun; manfiy — muddati o'tgan */
  daysLeft: number;
  /** Boshlanishdan beri o'tgan qism, 0–100 */
  progress: number;
}

/** `window` kun ichida tugaydigan yoki muddati o'tgan (arxivlanmagan) guruhlar, eng yaqini birinchi */
export function endingGroups<T extends { startDate: string; durationMonths: number }>(
  list: readonly T[],
  today: string,
  window = 30,
): EndingGroup<T>[] {
  const out: EndingGroup<T>[] = [];
  for (const g of list) {
    const endDate = groupEndDate(g.startDate, g.durationMonths);
    if (!endDate || g.startDate > today) continue;
    const daysLeft = daysBetween(today, endDate);
    if (daysLeft > window) continue;
    const total = Math.max(1, daysBetween(g.startDate, endDate));
    const progress = Math.min(100, Math.max(0, Math.round((daysBetween(g.startDate, today) / total) * 100)));
    out.push({ group: g, endDate, daysLeft, progress });
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Bog'lanish sanasi: bugun yoki o'tgan (kechikkan kunlar soni bilan), eng eskisi birinchi */
export function dueFollowUps<T extends { targetDate: string | null }>(
  list: readonly T[],
  today: string,
): (T & { targetDate: string; overdue: number })[] {
  return list
    .filter((l): l is T & { targetDate: string } => !!l.targetDate && l.targetDate <= today)
    .map((l) => ({ ...l, overdue: daysBetween(l.targetDate, today) }))
    .sort((a, b) => b.overdue - a.overdue);
}

/** "14-oktabr, 2026 · Seshanba" */
export function todayTitle(today: string, months: readonly string[], weekdays: readonly string[]): string {
  const [y, m, d] = today.split("-").map(Number) as [number, number, number];
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${d}-${months[m - 1]!.toLowerCase()}, ${y} · ${weekdays[wd]}`;
}
