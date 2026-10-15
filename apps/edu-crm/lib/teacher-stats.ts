/*
 * O'qituvchi profili ko'rsatkichlari (ADR 0021). Eski tizimdagi "Retention" reyting va o'quvchilar sonidan
 * o'ylab topilgan formula edi (65–99% oralig'ida) — bu yerda haqiqiy a'zolik davrlaridan hisoblanadi.
 */

export interface MembershipSpan {
  enrolledAt: string;
  leftAt: string | null;
}

/** Oy oralig'i: boshi va oxiri (joriy oy bo'lsa — bugungacha) */
export function monthBounds(month: string, today: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const end = `${month}-${String(last).padStart(2, "0")}`;
  return { start: `${month}-01`, end: end > today ? today : end };
}

/**
 * Retention — oy boshida guruhlarda bo'lgan a'zoliklardan oy oxirigacha (joriy oyda — bugungacha) qolganlar ulushi,
 * foizda. Oy boshida a'zolik bo'lmasa — null (hisoblab bo'lmaydi).
 */
export function retentionRate(spans: readonly MembershipSpan[], month: string, today: string): number | null {
  const { base, kept } = retentionCounts(spans, month, today);
  return base ? Math.round((kept / base) * 100) : null;
}

/** Retention sanoqlari: oy boshidagi a'zoliklar va ulardan qolganlar (bir nechta o'qituvchini yig'ish uchun) */
export function retentionCounts(
  spans: readonly MembershipSpan[],
  month: string,
  today: string,
): { base: number; kept: number } {
  const { start, end } = monthBounds(month, today);
  const atStart = spans.filter((s) => s.enrolledAt < start && (s.leftAt === null || s.leftAt >= start));
  return { base: atStart.length, kept: atStart.filter((s) => s.leftAt === null || s.leftAt > end).length };
}

/** Davomat — kelgan va kechikkanlar barcha belgilarga nisbatan (bosh paneldagidek), foizda; belgi bo'lmasa null */
export function attendanceRate(ok: number, total: number): number | null {
  return total > 0 ? Math.round((ok / total) * 100) : null;
}
