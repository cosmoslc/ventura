/*
 * Haftalik jadval joylashuvi (WeekSchedule, STYLE.md 11.37): soat oralig'i va bir kunda ustma-ust tushgan
 * darslarni yonma-yon ustunlarga taqsimlash. Toza funksiyalar — komponent va Vitest bir xil koddan foydalanadi.
 */

export interface ScheduleSlot {
  id: string;
  day: string;
  /** "HH:MM" */
  start: string;
  end: string;
}

export interface PlacedSlot<T extends ScheduleSlot> {
  slot: T;
  /** Kun boshidan (oraliq boshidan) daqiqalar */
  top: number;
  height: number;
  /** Ustma-ust guruhdagi ustun va ustunlar soni */
  column: number;
  columns: number;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Ko'rsatiladigan soatlar oralig'i: eng erta boshlanishdan eng kech tugashgacha, butun soatga yaxlitlangan */
export function hourRange(slots: readonly ScheduleSlot[], fallback: [number, number] = [9, 18]): [number, number] {
  if (!slots.length) return fallback;
  const from = Math.min(...slots.map((s) => Math.floor(toMinutes(s.start) / 60)));
  const to = Math.max(...slots.map((s) => Math.ceil(toMinutes(s.end) / 60)));
  return [Math.max(0, from), Math.min(24, Math.max(to, from + 1))];
}

/** Bir kundagi darslarni joylashtirish: kesishganlar bitta to'plamda, har biri o'z ustunida */
export function placeDay<T extends ScheduleSlot>(slots: readonly T[], startHour: number): PlacedSlot<T>[] {
  const sorted = [...slots].sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || a.id.localeCompare(b.id));
  const out: PlacedSlot<T>[] = [];
  let cluster: PlacedSlot<T>[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = cluster.reduce((m, p) => Math.max(m, p.column + 1), 0);
    for (const p of cluster) out.push({ ...p, columns });
    cluster = [];
  };
  for (const slot of sorted) {
    const s = toMinutes(slot.start);
    const e = Math.max(toMinutes(slot.end), s + 15);
    if (cluster.length && s >= clusterEnd) flush();
    // Bo'sh ustun: oxirgi darsi shu dars boshlanishigacha tugagan
    const used = new Set(cluster.filter((p) => toMinutes(p.slot.end) > s).map((p) => p.column));
    let column = 0;
    while (used.has(column)) column++;
    cluster.push({ slot, top: s - startHour * 60, height: e - s, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  }
  if (cluster.length) flush();
  return out;
}
