import { addDays } from "./billing";
import { weekdayOf } from "./lessons";

/*
 * Kabinet haftalik jadvali (ADR 0062): hafta dushanbadan boshlanadi. Toza funksiyalar — sahifa va Vitest uchun.
 */

export const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/** Sana turgan haftaning dushanbasi */
export function weekStart(date: string): string {
  const idx = WEEK_ORDER.indexOf(weekdayOf(date) as (typeof WEEK_ORDER)[number]);
  return addDays(date, -idx);
}

/** Haftaning 7 kuni: kalit (mon…sun) va sana */
export function weekDays(monday: string): { key: (typeof WEEK_ORDER)[number]; date: string }[] {
  return WEEK_ORDER.map((key, i) => ({ key, date: addDays(monday, i) }));
}

/** Manzildagi `?hafta=` — istalgan sana; noto'g'ri bo'lsa joriy hafta */
export function parseWeek(raw: string | undefined, today: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw ?? "") && !Number.isNaN(Date.parse(raw!)) ? weekStart(raw!) : weekStart(today);
}

/** Jadval qutilari: har guruh — dars kunlarida bittadan */
export function weekItems<G extends { id: string; days: readonly string[]; startTime: string; endTime: string }>(
  groups: readonly G[],
): (G & { slotId: string; day: string })[] {
  return groups.flatMap((g) => g.days.map((day) => ({ ...g, slotId: `${g.id}|${day}`, day })));
}
