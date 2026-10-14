/*
 * Lid hisobotlari (E5c, ADR 0032) — toza funksiyalar (Vitest): CRM voronka, bosqichda turish vaqti, manbalar
 * samaradorligi, mavsumiy oqim va reklama oylari tavsiyasi. Ma'lumot serverda yig'iladi (lib/server/lead-reports.ts).
 */

const pct = (part: number, whole: number) => (whole ? (part / whole) * 100 : null);

/* ---------- Voronka ---------- */

export type LeadKind = "open" | "won" | "lost";

export interface FunnelLead {
  staffId: string | null;
  kind: LeadKind;
  /**
   * Voronkada yetib borgan pog'ona: ochiq bosqichlar tartibida 0..n-1, "O'quvchi bo'ldi" — n. Bosqichlar tarixidan
   * olinadi (yo'qotilgan lid — yo'qotilishidan oldin yetgan eng uzoq bosqichi).
   */
  reached: number;
}

export interface FunnelStep {
  /** Pog'ona: ochiq bosqich yoki oxirgi — o'quvchi bo'lganlar */
  index: number;
  count: number;
  /** Jami lidlarga nisbatan, % */
  share: number | null;
  /** Oldingi pog'onadan o'tganlar, %; birinchi pog'ona — 100 */
  conv: number | null;
  /** Oldingi pog'onada qolib ketganlar */
  drop: number;
}

/** Har pog'onaga yetganlar (pog'ona ≥ i); oxirgi pog'ona — o'quvchi bo'lganlar */
export function funnelSteps(leads: readonly FunnelLead[], openStages: number): FunnelStep[] {
  const counts = Array.from({ length: openStages + 1 }, (_, i) => leads.filter((l) => l.reached >= i).length);
  return counts.map((count, i) => {
    const prev = i ? counts[i - 1]! : count;
    return {
      index: i,
      count,
      share: pct(count, leads.length),
      conv: i ? pct(count, prev) : leads.length ? 100 : null,
      drop: Math.max(0, prev - count),
    };
  });
}

/** Eng katta tushish: oldingi pog'onaga nisbatan eng ko'p yo'qotilgan pog'ona */
export function biggestDrop(steps: readonly FunnelStep[]): { index: number; rate: number } | null {
  let best: { index: number; rate: number } | null = null;
  for (const s of steps.slice(1)) {
    const prev = steps[s.index - 1]!.count;
    if (!prev || !s.drop) continue;
    const rate = (s.drop / prev) * 100;
    if (!best || rate > best.rate) best = { index: s.index, rate };
  }
  return best;
}

export interface StageEvent {
  leadId: string;
  toStageId: string;
  /** ms */
  at: number;
}

/** Bosqichda o'rtacha turish (kun): bosqichga kirgandan keyingi o'tishgacha — faqat tugallangan turishlar */
export function stageDays(events: readonly StageEvent[]): Map<string, number> {
  const byLead = new Map<string, StageEvent[]>();
  for (const e of events) byLead.set(e.leadId, [...(byLead.get(e.leadId) ?? []), e]);
  const spans = new Map<string, number[]>();
  for (const list of byLead.values()) {
    const sorted = [...list].sort((a, b) => a.at - b.at);
    for (let i = 0; i < sorted.length - 1; i++) {
      const ms = sorted[i + 1]!.at - sorted[i]!.at;
      const key = sorted[i]!.toStageId;
      spans.set(key, [...(spans.get(key) ?? []), ms]);
    }
  }
  return new Map([...spans].map(([id, list]) => [id, list.reduce((s, x) => s + x, 0) / list.length / 86_400_000]));
}

/* ---------- Sabab va bosqich bo'yicha ---------- */

/** Ko'pidan kamiga: [kalit, soni, ulush %] */
export function countShare(keys: readonly string[]): { key: string; count: number; share: number }[] {
  const map = new Map<string, number>();
  for (const k of keys) map.set(k, (map.get(k) ?? 0) + 1);
  return [...map]
    .map(([key, count]) => ({ key, count, share: pct(count, keys.length) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/* ---------- Manbalar ---------- */

export interface SourceLead {
  source: string;
  kind: LeadKind;
  /** O'quvchi bo'lgan bo'lsa — hozirgacha to'lagani (qaytarishlar ayrilgan) */
  revenue: number;
}

export interface SourceRow {
  source: string;
  leads: number;
  open: number;
  won: number;
  lost: number;
  conv: number | null;
  revenue: number;
}

/** "Eng samarali" uchun manbada kamida shuncha lid bo'lsin (1 tadan 1 tasi — 100% birinchi chiqmasin) */
export const MIN_LEADS_FOR_BEST = 5;

export function sourceRows(leads: readonly SourceLead[]): SourceRow[] {
  const map = new Map<string, SourceRow>();
  for (const l of leads) {
    const r = map.get(l.source) ?? { source: l.source, leads: 0, open: 0, won: 0, lost: 0, conv: null, revenue: 0 };
    r.leads++;
    r[l.kind === "won" ? "won" : l.kind === "lost" ? "lost" : "open"]++;
    r.revenue += l.revenue;
    map.set(l.source, r);
  }
  return [...map.values()]
    .map((r) => ({ ...r, conv: pct(r.won, r.leads) }))
    .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));
}

export function bestSource(rows: readonly SourceRow[]): SourceRow | null {
  return (
    [...rows]
      .filter((r) => r.leads >= MIN_LEADS_FOR_BEST && r.won > 0)
      .sort((a, b) => (b.conv ?? 0) - (a.conv ?? 0) || b.leads - a.leads)[0] ?? null
  );
}

/* ---------- Mavsumiy oqim ---------- */

export interface SeasonLead {
  /** Qo'shilgan oy, "YYYY-MM" */
  month: string;
  won: boolean;
}

export interface SeasonMonth {
  month: string;
  /** Hali kelmagan oy */
  future: boolean;
  leads: number;
  prevLeads: number;
  won: number;
  conv: number | null;
  /** Shu oyda birinchi marta faollashtirilgan o'quvchilar (manbasidan qat'i nazar) */
  newStudents: number;
}

export function seasonMonths(
  leads: readonly SeasonLead[],
  newStudentMonths: readonly string[],
  year: number,
  today: string,
): SeasonMonth[] {
  const current = today.slice(0, 7);
  return Array.from({ length: 12 }, (_, i) => {
    const mm = String(i + 1).padStart(2, "0");
    const month = `${year}-${mm}`;
    const own = leads.filter((l) => l.month === month);
    const won = own.filter((l) => l.won).length;
    return {
      month,
      future: month > current,
      leads: own.length,
      prevLeads: leads.filter((l) => l.month === `${year - 1}-${mm}`).length,
      won,
      conv: pct(won, own.length),
      newStudents: newStudentMonths.filter((m) => m === month).length,
    };
  });
}

/** Tavsiya kamida shuncha oylik ma'lumotda — kam ma'lumotda u tasodifiy chiqadi */
export const MIN_MONTHS_FOR_ADVICE = 6;

export interface MonthAdvice {
  /** Kalendar oyi 1..12 */
  month: number;
  /** Yillar bo'yicha o'rtacha lidlar */
  avg: number;
  years: number;
  tag: "peak" | "boost" | "save" | null;
}

/**
 * Reklama oylari (eski tizimdagi "byudjet tavsiyasi"): barcha yillardagi lidlarning kalendar oylari bo'yicha
 * o'rtachasi. Eng ko'p 2 oy — cho'qqi; ulardan oldingi oy — reklamani kuchaytirish; eng kam 2 oy — tejash.
 * Ma'lumot `MIN_MONTHS_FOR_ADVICE` oydan kam bo'lsa null.
 */
export function monthAdvice(leadMonths: readonly string[]): MonthAdvice[] | null {
  const perMonth = new Map<string, number>();
  for (const m of leadMonths) perMonth.set(m, (perMonth.get(m) ?? 0) + 1);
  if (perMonth.size < MIN_MONTHS_FOR_ADVICE) return null;
  const sums = new Array<number>(12).fill(0);
  const years = new Array<number>(12).fill(0);
  for (const [key, n] of perMonth) {
    const i = Number(key.slice(5, 7)) - 1;
    sums[i]! += n;
    years[i]!++;
  }
  const avg = sums.map((s, i) => (years[i] ? s / years[i]! : 0));
  const ranked = avg.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v || a.i - b.i);
  const peaks = ranked.slice(0, 2).map((x) => x.i);
  const boost = [...new Set(peaks.map((p) => (p + 11) % 12))].filter((m) => !peaks.includes(m));
  const save = ranked
    .slice(-2)
    .map((x) => x.i)
    .filter((m) => !peaks.includes(m) && !boost.includes(m));
  return avg.map((v, i) => ({
    month: i + 1,
    avg: v,
    years: years[i]!,
    tag: peaks.includes(i) ? "peak" : boost.includes(i) ? "boost" : save.includes(i) ? "save" : null,
  }));
}
