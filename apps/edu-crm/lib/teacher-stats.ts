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
  const { start, end } = monthBounds(month, today);
  const atStart = spans.filter((s) => s.enrolledAt < start && (s.leftAt === null || s.leftAt >= start));
  if (!atStart.length) return null;
  const kept = atStart.filter((s) => s.leftAt === null || s.leftAt > end).length;
  return Math.round((kept / atStart.length) * 100);
}

/** Davomat — kelgan va kechikkanlar barcha belgilarga nisbatan (bosh paneldagidek), foizda; belgi bo'lmasa null */
export function attendanceRate(ok: number, total: number): number | null {
  return total > 0 ? Math.round((ok / total) * 100) : null;
}
