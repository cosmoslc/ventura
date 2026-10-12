/*
 * Dars taqvimi (EDU-CRM-PLAN E2, ADR 0014): guruh dars kunlari, boshlanish sanasi va dam olish kunlaridan dars
 * sanalari. Client (jurnal) va server (davomat saqlash, keyin E3 hisob) bir xil funksiyadan foydalanadi.
 * Sanalar "YYYY-MM-DD" satri — vaqt mintaqasi siljishi bo'lmaydi.
 */

export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export interface HolidayRange {
  startDate: string;
  endDate: string;
  /** null — barcha filiallar */
  branchIds: readonly string[] | null;
  /** "Ha" — shu kunlardagi darslar o'tmaydi (davomat olinmaydi, oylik hisobdagi darslar sonidan chiqadi) */
  affectsLessons: boolean;
}

/** "2026-10-12" → hafta kuni kaliti ("mon") */
export function weekdayOf(date: string): (typeof WEEKDAY_KEYS)[number] {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAY_KEYS[new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay()]!;
}

/** Ikki sana orasidagi barcha kunlar (ikkala chegara ham kiradi) */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  const cur = new Date(Date.UTC(y!, m! - 1, d!));
  for (let i = 0; i < 800; i++) {
    const s = cur.toISOString().slice(0, 10);
    if (s > to) break;
    out.push(s);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

/** Oyning birinchi va oxirgi kuni: "2026-10" → ["2026-10-01", "2026-10-31"] */
export function monthRange(month: string): [string, string] {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return [`${month}-01`, `${month}-${String(last).padStart(2, "0")}`];
}

export function isHoliday(date: string, branchId: string, holidays: readonly HolidayRange[]): boolean {
  return holidays.some(
    (h) =>
      h.affectsLessons &&
      (h.branchIds === null || h.branchIds.includes(branchId)) &&
      h.startDate <= date &&
      date <= h.endDate,
  );
}

/**
 * Guruhning [from, to] oralig'idagi dars sanalari: dars kuni, guruh boshlangandan keyin va dam olish kuni emas.
 */
export function lessonDates(
  group: { days: readonly string[]; startDate: string; branchId: string },
  from: string,
  to: string,
  holidays: readonly HolidayRange[],
): string[] {
  const start = from > group.startDate ? from : group.startDate;
  if (start > to) return [];
  return eachDay(start, to).filter((d) => group.days.includes(weekdayOf(d)) && !isHoliday(d, group.branchId, holidays));
}

/** A'zolik davri shu kuni guruhda bormi: qo'shilgan kundan chiqqan kungacha (chiqqan kun kirmaydi) */
export function memberOn(m: { enrolledAt: string; leftAt: string | null }, date: string): boolean {
  return m.enrolledAt <= date && (m.leftAt === null || date < m.leftAt);
}

export interface MemberPeriod {
  membershipId: string;
  enrolledAt: string;
  leftAt: string | null;
  status: "trial" | "active" | "paused" | "left";
  pausedAt: string | null;
}

/** A'zo shu kuni belgilanishi mumkinmi: shu kuni guruhda bo'lgan va muzlatilmagan */
export function markable(periods: readonly MemberPeriod[], date: string) {
  return periods.some(
    (p) => memberOn(p, date) && !(p.status === "paused" && p.pausedAt !== null && date >= p.pausedAt),
  );
}
