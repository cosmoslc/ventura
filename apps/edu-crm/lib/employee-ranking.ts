/*
 * Xodimlar davomati reytingi (ADR 0014). Foiz = (kelgan + kech qolgan) / belgilangan kunlar; belgilanmagan kun
 * hisobga olinmaydi (eski tizimda belgisiz xodim "Kelgan" ko'rinardi va kech qolgan sanalmasdi).
 */

export interface RankRecord {
  key: string;
  date: string;
  status: "present" | "late" | "absent";
}

export interface RankRow {
  key: string;
  present: number;
  late: number;
  absent: number;
  records: number;
  /** 0–100; belgisi yo'q bo'lsa null */
  rate: number | null;
}

export function rankEmployees(
  keys: readonly string[],
  records: readonly RankRecord[],
  from: string,
  to: string,
): RankRow[] {
  const rows = new Map<string, RankRow>(
    keys.map((key) => [key, { key, present: 0, late: 0, absent: 0, records: 0, rate: null }]),
  );
  for (const r of records) {
    const row = rows.get(r.key);
    if (!row || r.date < from || r.date > to) continue;
    row[r.status]++;
    row.records++;
  }
  for (const row of rows.values()) {
    row.rate = row.records ? Math.round(((row.present + row.late) / row.records) * 100) : null;
  }
  return [...rows.values()].sort(
    (a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.records - a.records || b.present - a.present,
  );
}
